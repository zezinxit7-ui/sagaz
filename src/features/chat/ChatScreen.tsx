/** Chat (S01): conversa + cartões de ação com confirmação item por item. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Mic, Send, Sparkles, BarChart3 } from "lucide-react";
import { TopBar } from "@/components/ui";
import { db } from "@/data/db";
import { decideProposal, patchProposalPayload, pushWeeklySummary, retryQueued, sendUserMessage } from "@/services/ai/engine";
import { applyProposal } from "@/services/ai/executor";
import { parseActionsLocal } from "@/services/ai/localParser";
import { resolveAI } from "@/services/ai/config";
import { FREEFORM_LABEL, validateProposal, type ActionProposal } from "@/domain/actions";
import { formatMoney } from "@/domain/money";
import { formatDayShort } from "@/domain/dates";
import type { ChatAction } from "@/data/db";
import { ActionChipRow } from "./ActionChipRow";

export function ChatScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const messages = useLiveQuery(() => db.messages.orderBy("createdAt").toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];

  useEffect(() => {
    resolveAI().then((r) => setAiConfigured(r.source !== "none"));
  }, []);

  // fila offline: ao abrir e a cada volta de rede
  useEffect(() => {
    void retryQueued();
    const onOnline = () => void retryQueued();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el && typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight });
  }, [messages.length, busy]);

  const sendLocal = async (text: string) => {
    setBusy(true);
    try {
      // tenta IA; cai no parser local se não houver rede/chave
      await sendUserMessage(text);
    } catch {
      // última linha de defesa: parser local registra proposta pendente
      const conv = await db.conversations.orderBy("startedAt").reverse().first();
      if (conv) {
        const proposals = await parseActionsLocal(text, conv.id);
        if (proposals.length > 0) {
          await db.messages.add({
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            conversationId: conv.id,
            role: "assistant",
            kind: "action_card",
            body: "Extração simplificada local — confirme os itens abaixo:",
            status: "sent",
            actions: proposals.map((p) => ({ payload: p, status: "pending" as const })),
            createdAt: new Date().toISOString(),
          });
        } else {
          await db.messages.add({
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            conversationId: conv.id,
            role: "assistant",
            kind: "error",
            body: "Você está offline. Escrevi na fila e respondo assim que a internet voltar.",
            status: "failed",
            createdAt: new Date().toISOString(),
          });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendLocal(text);
  };

  const quick = useMemo(
    () => ["Gastei 30 no almoço", "Quanto gastei esse mês?", "Lembra da conta de luz amanhã às 14h"],
    [],
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        variant="chat"
        title="Falar com Sagaz"
        subtitle={aiConfigured === false ? "IA não configurada · modo local" : "On-line no seu ritmo"}
        onMenu={onOpenDrawer}
        actions={
          aiConfigured === false ? (
            <span className="chip">Local</span>
          ) : (
            <span className="text-xs text-muted" aria-hidden>
              <Sparkles size={16} className="text-accent" />
            </span>
          )
        }
      />

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4 pb-2">
        {messages.length === 0 ? (
          <div className="rise flex flex-col items-center gap-2 px-6 py-10 text-center">
            <p className="text-base font-semibold">Oi! O que registramos hoje?</p>
            <p className="text-sm text-muted">
              Conta em palavras: “gastei 35 no almoço”, “recebi 200 de freelance”,
              “lembra da conta de luz amanhã”. Nada é salvo sem o seu OK.
            </p>
          </div>
        ) : null}

        {messages.map((m) => (
          <MessageRow key={m.id} message={m} categories={categories} />
        ))}

        {busy ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="dot-typing" aria-hidden /> Sagaz está pensando…
          </div>
        ) : null}
      </div>

      <div className="border-t border-line px-3 pt-2 safe-bottom">
        {!busy && messages.length === 0 ? (
          <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
            {quick.map((q) => (
              <button key={q} className="chip whitespace-nowrap bg-surface-2" onClick={() => void sendLocal(q)}>
                {q}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2 pb-3">
          <button
            aria-label="Falar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
            title="Voz por reconhecimento do navegador (quando disponível)"
            onClick={() => void startDictation(setInput)}
          >
            <Mic size={18} />
          </button>
          <textarea
            className="field max-h-40 min-h-11 flex-1 resize-none"
            rows={1}
            aria-label="Mensagem para o Sagaz"
            placeholder="Escreva em palavras…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            aria-label="Enviar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40"
            disabled={!input.trim() || busy}
            onClick={submit}
          >
            <Send size={18} />
          </button>
        </div>
        <div className="flex justify-center pb-2">
          <button
            className="chip bg-surface-2"
            disabled={busy}
            onClick={() => void pushWeeklySummary()}
          >
            <BarChart3 size={13} /> Resumo da semana
          </button>
        </div>
        <p className="pb-2 text-center text-xs text-muted">
          Sagaz é IA. Ele propõe — você confirma antes de virar registro.
        </p>
      </div>
    </div>
  );
}

// ── Mensagens ────────────────────────────────────────────────────────────

function MessageRow({
  message,
  categories,
}: {
  message: { id: string; role: "user" | "assistant"; kind: string; body: string; status: string; actions?: ChatAction[]; createdAt: string };
  categories: Array<{ id: string; name: string; kind: string }>;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[18px] rounded-br-md bg-accent/15 px-3.5 py-2.5 text-base text-ink">
          <span className="block whitespace-pre-wrap break-words">{message.body}</span>
          {message.status === "queued" ? (
            <span className="mt-1 block text-right text-xs text-muted">na fila (offline)</span>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[95%]">
        {message.kind === "summary" ? (
          <div className="card rise p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-accent">
              <BarChart3 size={15} /> Resumo da semana
            </div>
            <span className="block whitespace-pre-wrap break-words text-base text-ink">
              {message.body}
            </span>
          </div>
        ) : (
          <div className="rounded-[18px] rounded-bl-md bg-surface px-3.5 py-2.5 text-base text-ink">
            <span className="block whitespace-pre-wrap break-words">{message.body}</span>
          </div>
        )}
        {message.kind === "action_card" && message.actions ? (
          <div className="mt-2 space-y-2">
            {message.actions.map((a, i) => (
              <ActionCard
                key={i}
                proposal={a.payload as ActionProposal}
                status={a.status}
                error={a.error}
                categories={categories}
                onDecide={(d) =>
                  void decideProposal(message.id, i, d, a.payload as ActionProposal, applyProposal)
                }
                onPatch={(patch) => void patchProposalPayload(message.id, i, patch)}
              />
            ))}
          </div>
        ) : null}
        {message.kind === "error" ? (
          <span className="sr-only">erro</span>
        ) : null}
      </div>
    </div>
  );
}

function ActionCard({
  proposal,
  status,
  error,
  categories,
  onDecide,
  onPatch,
}: {
  proposal: ActionProposal;
  status: "pending" | "confirmed" | "discarded" | "applied" | "error";
  error?: string;
  categories: Array<{ id: string; name: string; kind: string }>;
  onDecide: (d: "confirm" | "discard") => void;
  onPatch: (patch: Partial<ActionProposal>) => void;
}) {
  const v = validateProposal(proposal);
  const isMoney = proposal.kind === "expense" || proposal.kind === "income";
  const pool = isMoney
    ? categories.filter((c) => c.kind === (proposal.transactionType ?? "expense"))
    : [];

  const when =
    proposal.dueDate ?? proposal.date
      ? formatDayShort(proposal.dueDate ?? proposal.date!)
      : proposal.recurrence === "daily"
        ? "todos os dias"
        : proposal.recurrence === "weekly"
          ? "semanal"
          : proposal.recurrence === "monthly"
            ? "mensal"
            : isMoney
              ? "hoje"
              : "sem data";

  return (
    <div className="card pop-in p-3" data-status={status}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {FREEFORM_LABEL[proposal.kind]}
        </span>
        <ActionChipRow status={status} />
      </div>

      {isMoney ? (
        <p className="num mt-1 text-xl">
          {formatMoney(proposal.amountCents ?? 0)}
        </p>
      ) : (
        <p className="mt-1 text-base">{proposal.title}</p>
      )}
      {proposal.note ? <p className="text-sm text-muted">{proposal.note}</p> : null}
      <p className="text-sm text-muted">
        {when}
        {proposal.dueTime ? ` · ${proposal.dueTime}` : ""}
        {proposal.contextKind ? ` · ${proposal.contextKind === "business" ? "Meu Negócio" : "Pessoa Física"}` : ""}
      </p>

      {isMoney && pool.length > 0 ? (
        <label className="mt-2 block text-xs text-muted">
          Categoria
          <select
            className="field mt-1 text-sm"
            value={pool.find((c) => c.id === proposal.categoryId)?.name ?? ""}
            onChange={(e) => {
              const cat = pool.find((c) => c.name === e.target.value);
              if (cat) onPatch({ categoryId: cat.id });
            }}
          >
            <option value="">— escolher —</option>
            {pool.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <button className="btn btn-primary flex-1" disabled={!v.ok} title={v.errors.join("; ")} onClick={() => onDecide("confirm")}>
            Confirmar
          </button>
          <button className="btn btn-secondary flex-1" onClick={() => onDecide("discard")}>
            Descartar
          </button>
        </div>
      ) : null}
      {status === "error" && error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {!v.ok && status === "pending" ? (
        <p className="mt-2 text-xs text-warning">{v.errors[0]}</p>
      ) : null}
    </div>
  );
}

// ── ditado (STT do navegador; fallback silencioso) ──────────────────────

async function startDictation(setInput: (updater: (prev: string) => string) => void): Promise<void> {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) {
    setInput((prev) => `${prev}${prev ? " " : ""}(ditado não suportado neste navegador)`);
    return;
  }
  const rec = new (SR as new () => {
    lang: string;
    interimResults: boolean;
    start(): void;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  })();
  rec.lang = "pt-BR";
  rec.interimResults = false;
  rec.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i]![0]!.transcript;
    setInput(() => text);
  };
  try {
    rec.start();
  } catch {
    setInput(() => "");
  }
}
