/**
 * Executor de propostas confirmadas — ÚNICO caminho de escrita via chat.
 * Idempotente: transações bloqueadas por dedupeKey; lembretes por actionId
 * no repositório. Aplicado duas vezes = resultado idêntico.
 */

import { dedupeKeyOf, type ActionProposal } from "@/domain/actions";
import { findByActionIdOrAdd } from "@/data/finance";
import { addReminder } from "@/data/reminders";

export type ApplyResult =
  | { ok: true; label: string }
  | { ok: false; reason: string };

export async function applyProposal(
  proposal: ActionProposal,
): Promise<ApplyResult> {
  try {
    if (proposal.kind === "expense" || proposal.kind === "income") {
      if (!proposal.amountCents || proposal.amountCents <= 0) {
        return { ok: false, reason: "proposta sem valor" };
      }
      const tx = await findByActionIdOrAdd(
        dedupeKeyOf(proposal),
        proposal,
        "chat",
      );
      return { ok: true, label: describeTx(proposal, tx.date) };
    }

    if (proposal.kind === "reminder") {
      if (!proposal.title || proposal.title.length < 2) {
        return { ok: false, reason: "lembrete sem título" };
      }
      if (proposal.recurrence === "weekly" && (!proposal.weekdays || proposal.weekdays.length === 0)) {
        return { ok: false, reason: "recorrência semanal sem dias" };
      }
      const recurrence =
        proposal.recurrence && proposal.recurrence !== "none" ? proposal.recurrence : undefined;
      const r = await addReminder(
        {
          title: proposal.title,
          dueDate: proposal.dueDate,
          dueTime: proposal.dueTime,
          priority: proposal.priority ?? "medium",
          kind: recurrence ? "recurring" : "once",
          recurrence,
          weekdays: proposal.weekdays,
        },
        proposal.actionId, // idempotência por actionId
      );
      return { ok: true, label: `Lembrete "${r.title}" ${whenLabel(proposal)}` };
    }

    if (proposal.kind === "task") {
      // tarefa = lembrete sem data, ainda assim idempotente
      if (!proposal.title || proposal.title.length < 2) {
        return { ok: false, reason: "tarefa sem título" };
      }
      const r = await addReminder(
        {
          title: proposal.title,
          priority: proposal.priority ?? "medium",
          kind: "once",
        },
        proposal.actionId,
      );
      return { ok: true, label: `Tarefa "${r.title}" criada` };
    }

    return { ok: false, reason: `tipo não aplicável: ${proposal.kind}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

function describeTx(p: ActionProposal, date: string): string {
  const type = p.transactionType === "income" ? "Receita" : "Despesa";
  const ctx = p.contextKind === "business" ? " (negócio)" : "";
  return `${type}${ctx} de R$ ${(p.amountCents ?? 0) / 100} em ${date}`;
}

function whenLabel(p: ActionProposal): string {
  const parts: string[] = [];
  if (p.recurrence === "daily") parts.push("todos os dias");
  else if (p.recurrence === "weekly") parts.push(p.weekdays?.length ? "semanalmente" : "");
  else if (p.recurrence === "monthly") parts.push("todo mês");
  else parts.push(p.dueDate ?? "sem data");
  if (p.dueTime) parts.push(`às ${p.dueTime}`);
  return parts.filter(Boolean).join(" ");
}

/**
 * Reprocessa mensagens da fila offline: extrai de novo e DEVOLVE as
 * propostas (sem aplicar) — confirmação sempre passa pela UI.
 */
export { applyProposal as apply };
