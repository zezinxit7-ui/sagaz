/** Repositório de finanças: transações, orçamentos e assinaturas. */

import {
  type Budget,
  type Category,
  type Subscription,
  type Transaction,
  BUSINESS_CONTEXT_ID,
  PERSONAL_CONTEXT_ID,
  db,
  newId,
} from "./db";
import { addDays, endOfMonth, startOfMonth, todayLocal } from "@/domain/dates";
import type { ActionProposal } from "@/domain/actions";

export interface MonthTotals {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

export async function monthTotals(
  contextId: string,
  month: string,
): Promise<MonthTotals> {
  const rows = await db.transactions
    .where("[contextId+date]")
    .between([contextId, startOfMonth(month)], [contextId, `${endOfMonth(month)}￿`])
    .toArray();
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.type === "income") income += r.amountCents;
    else expense += r.amountCents;
  }
  return { incomeCents: income, expenseCents: expense, balanceCents: income - expense };
}

export async function listByMonth(
  contextId: string,
  month: string,
  filter: "all" | "income" | "expense" = "all",
): Promise<Transaction[]> {
  const rows = await db.transactions
    .where("[contextId+date]")
    .between([contextId, startOfMonth(month)], [contextId, `${endOfMonth(month)}￿`])
    .reverse()
    .toArray();
  if (filter === "all") return rows;
  return rows.filter((r) => r.type === filter);
}

/** Série diária de despesas do mês (para gráfico). */
export async function dailyExpenseSeries(contextId: string, month: string) {
  const rows = await db.transactions
    .where("[contextId+date]")
    .between([contextId, startOfMonth(month)], [contextId, `${endOfMonth(month)}￿`])
    .toArray();
  const byDay = new Map<string, number>();
  for (const r of rows) if (r.type === "expense") byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.amountCents);
  const out: Array<{ day: number; cents: number }> = [];
  const last = Number(endOfMonth(month).slice(8));
  for (let d = 1; d <= last; d++) out.push({ day: d, cents: byDay.get(`${month}-${String(d).padStart(2, "0")}`) ?? 0 });
  return out;
}

/** Totais por categoria no mês (para donut/lista relatório). */
export async function categoryTotals(
  contextId: string,
  month: string,
  kind: "income" | "expense",
): Promise<Array<{ category: Category; cents: number }>> {
  const cats = await db.categories.toArray();
  const byId = new Map(cats.map((c) => [c.id, c]));
  const rows = await db.transactions
    .where("[contextId+date]")
    .between([contextId, startOfMonth(month)], [contextId, `${endOfMonth(month)}￿`])
    .toArray();
  const sums = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== kind) continue;
    sums.set(r.categoryId, (sums.get(r.categoryId) ?? 0) + r.amountCents);
  }
  return [...sums.entries()]
    .map(([catId, cents]) => ({ category: byId.get(catId)!, cents }))
    .filter((e) => e.category !== undefined)
    .sort((a, b) => b.cents - a.cents);
}

export async function addManual(
  input: {
    contextId: string;
    type: "income" | "expense";
    amountCents: number;
    categoryId: string;
    date?: string;
    note?: string;
  },
): Promise<Transaction> {
  const tx: Transaction = {
    id: newId("tx"),
    contextId: input.contextId,
    type: input.type,
    amountCents: input.amountCents,
    categoryId: input.categoryId,
    date: input.date ?? todayLocal(),
    note: input.note,
    source: "manual",
    createdAt: new Date().toISOString(),
  };
  await db.transactions.add(tx);
  return tx;
}

/**
 * Aplicação de proposta (via chat ou fallback local). Idempotente:
 * `actionId` (dedupeKey) já registrado → devolve a transação existente.
 */
export async function findByActionIdOrAdd(
  actionId: string,
  proposal: ActionProposal,
  source: Transaction["source"],
): Promise<Transaction> {
  const existing = actionId ? await db.transactions.where("actionId").equals(actionId).first() : undefined;
  if (existing) return existing;

  const contextId =
    proposal.contextKind === "business" ? BUSINESS_CONTEXT_ID : PERSONAL_CONTEXT_ID;
  const type: Transaction["type"] =
    proposal.transactionType ?? (proposal.kind === "income" ? "income" : "expense");
  const amountCents = proposal.amountCents ?? 0;
  if (amountCents <= 0) throw new Error("transação sem valor positivo");

  let categoryId = proposal.categoryId ?? "";
  if (!categoryId) categoryId = await defaultCategoryId(contextId, type);

  const tx: Transaction = {
    id: newId("tx"),
    contextId,
    type,
    amountCents,
    categoryId,
    date: proposal.date ?? todayLocal(),
    note: proposal.note,
    source,
    actionId: actionId || undefined,
    createdAt: new Date().toISOString(),
  };
  await db.transactions.add(tx);
  return tx;
}

async function defaultCategoryId(contextId: string, type: "income" | "expense"): Promise<string> {
  const all = await db.categories.toArray();
  const pool = all.filter((c) => c.kind === type && (!c.contextId || c.contextId === contextId));
  const named = pool.find((c) => c.name.startsWith("Outros"));
  return (named ?? pool[0])?.id ?? "";
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id);
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
  await db.transactions.update(id, patch);
}

// ── Orçamento ────────────────────────────────────────────────────────────

export async function getBudget(contextId: string, month: string): Promise<Budget | undefined> {
  return db.budgets.where({ "[contextId+month]": [contextId, month] }).first();
}

export async function setBudgetTotal(contextId: string, month: string, totalCents: number): Promise<void> {
  const existing = await getBudget(contextId, month);
  if (existing) await db.budgets.update(existing.id, { totalCents });
  else await db.budgets.add({ id: newId("bud"), contextId, month, totalCents });
}

export async function budgetProgress(contextId: string, month: string) {
  const budget = await getBudget(contextId, month);
  const totals = await monthTotals(contextId, month);
  return { budget, totals, remainingCents: (budget?.totalCents ?? 0) - totals.expenseCents };
}

// ── Assinaturas ──────────────────────────────────────────────────────────

export async function listSubscriptions(): Promise<Subscription[]> {
  return db.subscriptions.orderBy("nextChargeDate").toArray();
}

export async function addSubscription(
  input: Omit<Subscription, "id">,
): Promise<Subscription> {
  const sub: Subscription = { ...input, id: newId("sub") };
  await db.subscriptions.add(sub);
  return sub;
}

export async function deleteSubscription(id: string): Promise<void> {
  await db.subscriptions.delete(id);
}

/** Assinaturas com cobrança nos próximos `days` dias (para o card do dashboard). */
export async function upcomingCharges(days = 30): Promise<Subscription[]> {
  const today = todayLocal();
  const horizon = addDays(today, days);
  const subs = await listSubscriptions();
  return subs.filter((s) => s.nextChargeDate >= today && s.nextChargeDate <= horizon);
}

/** Custo mensal efetivo das assinaturas (anuais ÷ 12). */
export async function subscriptionsMonthlyCents(contextId?: string): Promise<number> {
  const all = await listSubscriptions();
  const subs = contextId ? all.filter((s) => s.contextId === contextId) : all;
  return subs.reduce(
    (acc, s) => acc + (s.cycle === "monthly" ? s.amountCents : Math.round(s.amountCents / 12)),
    0,
  );
}
