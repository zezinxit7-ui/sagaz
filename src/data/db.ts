/**
 * Banco local do Sagaz — Dexie sobre IndexedDB. Local-first, v1.
 * Diagrama-fonte de verdade: replica/architecture.md §3.
 */

import Dexie, { type EntityTable } from "dexie";
import { todayLocal } from "@/domain/dates";

// ── Tipos das tabelas ────────────────────────────────────────────────────

export interface Context {
  id: string;
  kind: "personal" | "business";
  name: string;
  color: string;
}

export interface Category {
  id: string;
  contextId?: string; // undefined = vale para os dois contextos
  name: string;
  icon: string; // nome de ícone lucide, ex.: "utensils"
  kind: "income" | "expense";
  scope: "default" | "custom";
}

export interface Transaction {
  id: string;
  contextId: string;
  type: "income" | "expense";
  amountCents: number;
  categoryId: string;
  date: string; // YYYY-MM-DD local
  note?: string;
  source: "chat" | "manual" | "seed";
  actionId?: string; // idempotência (dedupeKey quando veio do chat)
  createdAt: string; // ISO UTC
}

export interface Budget {
  id: string;
  contextId: string;
  month: string; // YYYY-MM
  totalCents: number;
  perCategoryCents?: Record<string, number>;
}

export interface Subscription {
  id: string;
  contextId: string;
  name: string;
  amountCents: number;
  cycle: "monthly" | "yearly";
  nextChargeDate: string; // YYYY-MM-DD
  remindBeforeDays: number;
}

export interface Goal {
  id: string;
  contextId?: string;
  kind: "savings" | "personal";
  name: string;
  targetCents?: number;
  savedCents?: number;
  deadline?: string; // YYYY-MM-DD
  createdAt: string;
  doneAt?: string;
}

export interface GoalStep {
  id: string;
  goalId: string;
  title: string;
  done: boolean;
  order: number;
}

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  dueDate?: string; // YYYY-MM-DD (once)
  dueTime?: string; // HH:MM
  priority: "low" | "medium" | "high";
  kind: "once" | "recurring";
  recurrence?: "daily" | "weekly" | "monthly";
  weekdays?: number[]; // para weekly
  exceptionDates?: string[]; // ocorrências semanais concluídas individualmente
  baseDate: string; // âncora de recorrência
  status: "pending" | "done";
  doneAt?: string;
  actionId?: string; // idempotência via chat
}

export interface Habit {
  id: string;
  name: string;
  weekdays: number[]; // 0–6
  targetValue?: number;
  unit?: string;
  createdAt: string;
}

export interface HabitLog {
  id: string; // `${habitId}|${date}` — idempotente
  habitId: string;
  date: string; // YYYY-MM-DD
  value?: number;
}

export interface Conversation {
  id: string;
  title?: string;
  startedAt: string; // ISO
}

export type MessageStatus = "sent" | "queued" | "failed" | "sending";
export type MessageKind = "text" | "action_card" | "summary" | "error";

export interface ChatAction {
  /** proposta serializada (ActionProposal) */
  payload: unknown;
  status: "pending" | "confirmed" | "discarded" | "applied" | "error";
  error?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  kind: MessageKind;
  body: string;
  status: MessageStatus;
  actions?: ChatAction[];
  createdAt: string; // ISO
}

export interface Memory {
  id: string;
  content: string;
  active: boolean;
  createdAt: string;
}

export interface Profile {
  id: "local"; // perfil único no v1
  name: string;
  nickname?: string;
  pinHash?: string; // hash simples + salt serializados
  theme: "dark" | "light";
  aiConfig?: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };
  weeklySummaryOn: boolean;
  privacyMasked?: boolean;
}

// ── Banco ────────────────────────────────────────────────────────────────

export type DBTables = {
  contexts: EntityTable<Context, "id">;
  categories: EntityTable<Category, "id">;
  transactions: EntityTable<Transaction, "id">;
  budgets: EntityTable<Budget, "id">;
  subscriptions: EntityTable<Subscription, "id">;
  goals: EntityTable<Goal, "id">;
  goalSteps: EntityTable<GoalStep, "id">;
  reminders: EntityTable<Reminder, "id">;
  habits: EntityTable<Habit, "id">;
  habitLogs: EntityTable<HabitLog, "id">;
  conversations: EntityTable<Conversation, "id">;
  messages: EntityTable<Message, "id">;
  memories: EntityTable<Memory, "id">;
  profiles: EntityTable<Profile, "id">;
};

export const db = new Dexie("sagaz") as Dexie & DBTables;

db.version(1).stores({
  contexts: "id, kind",
  categories: "id, name, [contextId+kind]",
  transactions: "id, [contextId+date], categoryId, actionId",
  budgets: "id, [contextId+month]",
  subscriptions: "id, nextChargeDate, [contextId+nextChargeDate]",
  goals: "id, kind, createdAt, [kind+doneAt]",
  goalSteps: "id, goalId",
  reminders: "id, status, kind, dueDate, actionId, [kind+status]",
  habits: "id, createdAt",
  habitLogs: "id, [habitId+date]",
  conversations: "id, startedAt",
  messages: "id, createdAt, [conversationId+createdAt]",
  memories: "id, createdAt",
  profiles: "id",
});

// ── IDs ──────────────────────────────────────────────────────────────────

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 10_000;
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${t}${counter.toString(36)}${r}`;
}

// ── Seeds (executados uma vez) ───────────────────────────────────────────

export const PERSONAL_CONTEXT_ID = "ctx_personal";
export const BUSINESS_CONTEXT_ID = "ctx_business";

export async function ensureSeeded(): Promise<void> {
  await db.transaction("rw", [db.contexts, db.categories, db.profiles], async () => {
    const ctxCount = await db.contexts.count();
    if (ctxCount === 0) {
      await db.contexts.bulkAdd([
        {
          id: PERSONAL_CONTEXT_ID,
          kind: "personal",
          name: "Pessoa Física",
          color: "#8b7bff",
        },
        {
          id: BUSINESS_CONTEXT_ID,
          kind: "business",
          name: "Meu Negócio",
          color: "#4ade80",
        },
      ]);
    }

    const catCount = await db.categories.count();
    if (catCount === 0) {
      await db.categories.bulkAdd([
        // despesas pessoais
        c("Moradia", "home", "expense"),
        c("Alimentação", "utensils", "expense"),
        c("Transporte", "car", "expense"),
        c("Saúde", "heart-pulse", "expense"),
        c("Educação", "graduation-cap", "expense"),
        c("Lazer", "gamepad-2", "expense"),
        c("Assinaturas", "repeat", "expense"),
        c("Contas", "receipt", "expense"),
        c("Compras", "shopping-bag", "expense"),
        c("Outros (despesa)", "circle-dot", "expense"),
        // receitas pessoais
        c("Salário", "wallet", "income"),
        c("Freelance", "laptop", "income"),
        c("Rendimentos", "trending-up", "income"),
        c("Presente", "gift", "income"),
        c("Outros (receita)", "circle-dot", "income"),
        // despesas de negócio
        c("Fornecedores", "package", "expense", BUSINESS_CONTEXT_ID),
        c("Infraestrutura", "server", "expense", BUSINESS_CONTEXT_ID),
        c("Marketing", "megaphone", "expense", BUSINESS_CONTEXT_ID),
        c("Equipe", "users", "expense", BUSINESS_CONTEXT_ID),
        c("Taxas", "percent", "expense", BUSINESS_CONTEXT_ID),
        // receitas de negócio
        c("Vendas", "store", "income", BUSINESS_CONTEXT_ID),
        c("Serviços", "briefcase", "income", BUSINESS_CONTEXT_ID),
      ]);
    }

    const profileCount = await db.profiles.count();
    if (profileCount === 0) {
      await db.profiles.add({
        id: "local",
        name: "Você",
        theme: "dark",
        weeklySummaryOn: true,
      });
    }
  });
}

function c(
  name: string,
  icon: string,
  kind: Category["kind"],
  contextId?: string,
): Category {
  return {
    id: newId("cat"),
    contextId,
    name,
    icon,
    kind,
    scope: "default",
  };
}

/** Dia-base para seeds/demos — exportado para testes usarem data fixa. */
export function seedToday(): string {
  return todayLocal();
}
