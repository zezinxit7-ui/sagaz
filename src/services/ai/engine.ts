/**
 * engine do chat: entrada do usuário → extração → mensagem do assistente
 * com cartões de ação. Regras:
 * - offline → mensagem é "queued" e extração apenas local (sempre disponível);
 * - propostas nunca são aplicadas aqui — só criadas como "pending";
 * - sem proposta e sem pergunta → resposta de empatia pedindo detalhe.
 */

import { addMessage, currentConversation, listMemories, setCardActionStatus } from "@/data/chat";
import { extractActions } from "./actionExtractor";
import { AIUnavailableError } from "./client";
import { db, type Message } from "@/data/db";
import { todayLocal } from "@/domain/dates";
import { BUSINESS_CONTEXT_ID, PERSONAL_CONTEXT_ID } from "@/data/db";
import { validateProposal, type ActionProposal } from "@/domain/actions";

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/** Envia a mensagem do usuário e gera a resposta do assistente. */
export async function sendUserMessage(
  text: string,
): Promise<{ userMsg: Message; assistantMsg: Message | null }> {
  const clean = text.trim();
  if (!clean) throw new Error("mensagem vazia");
  const conv = await currentConversation();
  const online = isOnline();

  const userMsg = await addMessage({
    conversationId: conv.id,
    role: "user",
    kind: "text",
    body: clean,
    status: online ? "sent" : "queued",
  });

  let assistantMsg: Message | null = null;
  try {
    assistantMsg = await respondTo(conv.id, clean);
  } catch (e) {
    const offline = !online;
    assistantMsg = await addMessage({
      conversationId: conv.id,
      role: "assistant",
      kind: "error",
      body:
        e instanceof AIUnavailableError
          ? "IA indisponível agora. Sua mensagem está salva e eu respondo quando a conexão voltar."
          : `Não consegui processar: ${e instanceof Error ? e.message : String(e)}`,
      status: offline ? "failed" : "sent",
    });
    if (offline) {
      // marca a user msg como queued p/ reprocessar depois
      await db.messages.update(userMsg.id, { status: "queued" });
    }
  }
  return { userMsg, assistantMsg };
}

/** Reprocessamento da fila offline ao abrir o app. */
export async function retryQueued(): Promise<number> {
  const queued = await db.messages.filter((m) => m.status === "queued" && m.role === "user").toArray();
  let done = 0;
  for (const m of queued) {
    try {
      await db.messages.update(m.id, { status: "sending" });
      await respondTo(m.conversationId, m.body);
      await db.messages.update(m.id, { status: "sent" });
      done++;
    } catch {
      await db.messages.update(m.id, { status: "queued" });
    }
  }
  return done;
}

async function respondTo(
  conversationId: string,
  text: string,
): Promise<Message> {
  const [categories, memories, history] = await Promise.all([
    db.categories.toArray(),
    listMemories(),
    db.messages.where("conversationId").equals(conversationId).toArray(),
  ]);

  const result = await extractActions({
    text,
    conversationId,
    today: todayLocal(),
    categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, contextId: c.contextId })),
    memories,
    history: history
      .filter((m) => m.status !== "queued")
      .map((m) => ({ role: m.role, body: m.body })),
  });

  if (result.kind === "question") {
    return addMessage({
      conversationId,
      role: "assistant",
      kind: "text",
      body: result.reply || "Não entendi. Me dá mais um detalhe?",
      status: "sent",
    });
  }

  const proposals = result.kind === "actions" ? result.proposals : result.kind === "actionsLocal" ? result.proposals : [];
  if (proposals.length === 0) {
    return addMessage({
      conversationId,
      role: "assistant",
      kind: "text",
      body: "Não identifiquei nada para registrar ainda. Pode reformular? Ex.: “gastei 35 no almoço”.",
      status: "sent",
    });
  }

  return addMessage({
    conversationId,
    role: "assistant",
    kind: "action_card",
    body: result.reply || "O que entendi — confirme para eu aplicar:",
    status: "sent",
    actions: proposals.map((p) => ({ payload: serialize(p), status: "pending" as const })),
  });
}

function serialize(p: ActionProposal): unknown {
  const v = validateProposal(p);
  return v.ok ? v.proposal : { ...v.proposal, invalid: v.errors };
}

/** util para UI: rótulos de contexto */
export const CONTEXT_LABELS: Record<string, string> = {
  [PERSONAL_CONTEXT_ID]: "Pessoa Física",
  [BUSINESS_CONTEXT_ID]: "Meu Negócio",
};

/**
 * Confirma/descarta UMA proposta de um cartão. Confirmar valida e aplica;
 * o status do cartão é persistido (vira "applied" ou erro legível).
 */
export async function decideProposal(
  messageId: string,
  index: number,
  decision: "confirm" | "discard",
  proposal: ActionProposal,
  apply: (p: ActionProposal) => Promise<{ ok: true; label: string } | { ok: false; reason: string }>,
): Promise<void> {
  if (decision === "discard") {
    await setCardActionStatus(messageId, index, "discarded");
    return;
  }
  const v = validateProposal(proposal);
  if (!v.ok) {
    await setCardActionStatus(messageId, index, "error", v.errors.join("; "));
    return;
  }
  const r = await apply(v.proposal);
  await setCardActionStatus(messageId, index, r.ok ? "applied" : "error", r.ok ? undefined : r.reason);
}

// mesclar aqui: patch de proposta editada (UI permite ajustar categoria antes de confirmar)
export async function patchProposalPayload(
  messageId: string,
  index: number,
  patch: Partial<ActionProposal>,
): Promise<ActionProposal | undefined> {
  const m = await db.messages.get(messageId);
  const box = m?.actions?.[index];
  if (!m || !box) return undefined;
  const current = box.payload as ActionProposal;
  const updated = { ...current, ...patch };
  m.actions![index] = { ...box, payload: updated };
  await db.messages.update(messageId, { actions: m.actions });
  return updated;
}
