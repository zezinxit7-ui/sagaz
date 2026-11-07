/**
 * Contrato de ações da IA — o coração da segurança do Sagaz.
 * O LLM propõe; o usuário confirma; o executor aplica UMA vez por actionId.
 * Nada aqui escreve no banco — este módulo só descreve e valida.
 */

import type { RecurringKind } from "./dates";

export type ActionKind =
  | "expense"
  | "income"
  | "reminder"
  | "task"
  | "habit_log"
  | "goal_step"
  | "question";

export type TransactionType = "income" | "expense";
export type ReminderKind = "once" | "recurring";

/** Contextos do dual-ledger (espelham a tabela `contexts`). */
export type ContextKind = "personal" | "business";

/** Uma proposta que a IA extraiu de uma mensagem. Sempre editável. */
export interface ActionProposal {
  actionId: string;
  kind: ActionKind;

  // expense/income
  amountCents?: number;
  transactionType?: TransactionType;
  categoryId?: string;
  note?: string;
  date?: string; // YYYY-MM-DD
  contextKind?: ContextKind;

  // reminder/task
  title?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  recurrence?: RecurringKind;
  weekdays?: number[];
  priority?: "low" | "medium" | "high";

  rawText?: string;
  confidence?: number;
}

export type ProposalStatus = "pending" | "confirmed" | "discarded" | "applied" | "error";

/** Uma proposta com seu estado no chat. */
export interface TrackedProposal {
  proposal: ActionProposal;
  status: ProposalStatus;
  error?: string;
}

export const FREEFORM_LABEL: Record<ActionKind, string> = {
  expense: "Despesa",
  income: "Receita",
  reminder: "Lembrete",
  task: "Tarefa",
  habit_log: "Registro de hábito",
  goal_step: "Etapa de meta",
  question: "Pergunta",
};

const KINDS: ReadonlySet<ActionKind> = new Set([
  "expense",
  "income",
  "reminder",
  "task",
  "habit_log",
  "goal_step",
  "question",
]);

/** actionId estável e único. */
export function makeActionId(conversationId: string, index: number): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `act_${conversationId}_${index}_${rand}`;
}

/** Gera id usado pelo executor para bloquear aplicações repetidas. */
export function dedupeKeyOf(p: ActionProposal): string {
  if (p.kind === "expense" || p.kind === "income") {
    if (p.amountCents === undefined || p.transactionType === undefined) return p.actionId;
    return [
      p.transactionType,
      p.amountCents,
      p.date ?? "no-date",
      p.note ?? "no-note",
    ].join("|");
  }
  // reminder/task: título + due
  return [
    p.kind,
    p.title ?? "no-title",
    p.dueDate ?? "no-date",
    p.dueTime ?? "no-time",
    p.recurrence ?? "once",
  ].join("|");
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  proposal: ActionProposal;
}

/**
 * Validação NUNCA inventa valor: faltou valor → proposta inválida e o app
 * pede reformulação ao usuário (ou à IA). normaliza minúsculas, datas.
 */
export function validateProposal(input: unknown): ValidationResult {
  const errors: string[] = [];
  const p: ActionProposal =
    typeof input === "object" && input !== null
      ? { ...(input as ActionProposal) }
      : { actionId: "", kind: "question" };

  if (!KINDS.has(p.kind)) {
    errors.push(`tipo de ação desconhecido: ${String(p.kind)}`);
  }

  if (p.kind === "expense" || p.kind === "income") {
    if (p.amountCents === undefined || p.amountCents <= 0 || !Number.isInteger(p.amountCents)) {
      errors.push("valor ausente ou inválido (em centavos inteiros)");
    }
    if (!p.transactionType) {
      p.transactionType = p.kind === "expense" ? "expense" : "income";
    }
    if (!p.date) {
      // sem data explícita = hoje (padrão previsível)
      p.date = undefined; // executor define hoje na aplicação
    }
    if (p.contextKind && p.contextKind !== "personal" && p.contextKind !== "business") {
      errors.push(`contexto inválido: ${String(p.contextKind)}`);
    }
  }

  if (p.kind === "reminder" || p.kind === "task") {
    const t = (p.title ?? "").trim();
    if (t.length < 2) errors.push("título ausente ou muito curto");
    p.title = t;
    if (p.recurrence && !["none", "daily", "weekly", "monthly"].includes(p.recurrence)) {
      errors.push(`recorrência inválida: ${String(p.recurrence)}`);
    }
    if (p.weekdays && (p.weekdays.length === 0 || p.weekdays.some((w) => w < 0 || w > 6))) {
      errors.push("dias da semana inválidos");
    }
    if (p.recurrence === "weekly" && (!p.weekdays || p.weekdays.length === 0)) {
      errors.push("recorrência semanal precisa de dias da semana");
    }
    if (!p.recurrence || p.recurrence === "none") p.recurrence = undefined;
  }

  return { ok: errors.length === 0, errors, proposal: p };
}

/** Resumo curto para UI (usado em card e notificação). */
export function proposalSummary(p: ActionProposal): string {
  switch (p.kind) {
    case "expense":
      return `Despesa de ${(p.amountCents ?? 0) / 100}`;
    case "income":
      return `Receita de ${(p.amountCents ?? 0) / 100}`;
    case "reminder":
    case "task":
      return p.title ? `Lembrete: ${p.title}` : "Lembrete";
    case "habit_log":
      return `Registro de hábito`;
    case "goal_step":
      return p.title ?? "Etapa de meta";
    case "question":
      return "Pergunta";
  }
}
