/**
 * Repositórios com fake-indexeddb: transações idempotentes, lembretes com
 * actionId e expansão de recorrência.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureSeeded } from "@/data/db";
import { findByActionIdOrAdd, addManual, monthTotals, setBudgetTotal, budgetProgress } from "@/data/finance";
import { addReminder, monthOccurrences, stats } from "@/data/reminders";
import { addHabit, logToday, listHabits, unlog } from "@/data/habits";
import { addGoal, addDeposit, addStep, toggleStep, progressOf } from "@/data/goals";
import { exportBackup, importBackup, verifyPin, setPin } from "@/data/profile";
import type { ActionProposal } from "@/domain/actions";

beforeEach(async () => {
  const names = db.tables.map((t) => t.name);
  await db.transaction("rw", names, async () => {
    for (const n of names) await db.table(n).clear();
  });
  await ensureSeeded();
});

const proposalBase: ActionProposal = {
  actionId: "act_test_1",
  kind: "expense",
  amountCents: 3550,
  transactionType: "expense",
  note: "almoço",
  date: "2026-11-07",
};

describe("transações", () => {
  it("aplica proposta e É idempotente", async () => {
    const t1 = await findByActionIdOrAdd("dedupe|a", proposalBase, "chat");
    const t2 = await findByActionIdOrAdd("dedupe|a", proposalBase, "chat");
    expect(t2.id).toBe(t1.id);
    expect(await db.transactions.count()).toBe(1);
  });

  it("cadastro manual computa totais do mês", async () => {
    const cats = await db.categories.toArray();
    const expenseCat = cats.find((c) => c.kind === "expense" && c.name === "Alimentação")!;
    await addManual({ contextId: "ctx_personal", type: "expense", amountCents: 500, categoryId: expenseCat.id });
    const t = await monthTotals("ctx_personal", "2026-11");
    expect(t.expenseCents).toBe(500);
    expect(t.incomeCents).toBe(0);
  });

  it("orçamento: progresso e saldo", async () => {
    await setBudgetTotal("ctx_personal", "2026-11", 1000);
    const cats = await db.categories.toArray();
    await addManual({
      contextId: "ctx_personal",
      type: "expense",
      amountCents: 400,
      categoryId: cats.find((c) => c.kind === "expense")!.id,
    });
    const p = await budgetProgress("ctx_personal", "2026-11");
    expect(p?.remainingCents ?? p.remainingCents).toBe(600);
  });
});

describe("lembretes", () => {
  it("criação via chat é idempotente por actionId", async () => {
    const r1 = await addReminder(
      { title: "Conta de luz", priority: "medium", kind: "once", dueDate: "2026-11-08" },
      "act_rem_1",
    );
    const r2 = await addReminder(
      { title: "Conta de luz", priority: "medium", kind: "once", dueDate: "2026-11-08" },
      "act_rem_1",
    );
    expect(r1.id).toBe(r2.id);
    expect(await db.reminders.count()).toBe(1);
  });

  it("recorrente semanal expande só nos dias marcados", async () => {
    // 2026-11-02 é segunda (weekdays = [1]); só segundas aparecem
    await addReminder({
      title: "Periódico",
      priority: "low",
      kind: "recurring",
      recurrence: "weekly",
      weekdays: [1],
    });
    const occ = await monthOccurrences("2026-11");
    const nov2 = occ.get("2026-11-02");
    expect(nov2?.recurring.some((r) => r.title === "Periódico")).toBe(true);
    const nov3 = occ.get("2026-11-03");
    expect(nov3?.recurring.length ?? 0).toBe(0);
  });

  it("stats contam pendentes e atrasados", async () => {
    await addReminder({ title: "Atrasada", priority: "medium", kind: "once", dueDate: "2020-01-01" });
    const s = await stats();
    expect(s.pending).toBe(1);
  });
});

describe("hábitos", () => {
  it("log do dia é idempotente", async () => {
    const h = await addHabit({ name: "Ler", weekdays: [1, 2, 3, 4, 5, 6, 0] });
    const l1 = await logToday(h.id, "2026-11-07");
    const l2 = await logToday(h.id, "2026-11-07");
    expect(l1.id).toBe(l2.id);
    expect((await listHabits()).length).toBe(1);
    await unlog(h.id, "2026-11-07");
    expect(await db.habitLogs.count()).toBe(0);
  });
});

describe("metas", () => {
  it("depósito cumulativo e progresso", async () => {
    const g = await addGoal({ name: "Viagem", kind: "savings", targetCents: 10000 });
    await addDeposit(g.id, 2500);
    await addDeposit(g.id, 2500);
    const after = (await db.goals.get(g.id))!;
    expect(after.savedCents).toBe(5000);
    expect(await progressOf(after)).toBe(50);
  });
  it("etapas: progresso pessoal", async () => {
    const g = await addGoal({ name: "Organizar casa", kind: "personal" });
    const s1 = await addStep(g.id, "Limpar");
    await addStep(g.id, "Vender");
    await toggleStep(s1.id);
    const after = (await db.goals.get(g.id))!;
    expect(await progressOf(after)).toBe(50);
  });
});

describe("PIN e backup", () => {
  it("PIN: define e valida", async () => {
    await setPin("1234");
    expect(await verifyPin("1234")).toBe(true);
    expect(await verifyPin("9999")).toBe(false);
  });

  it("backup: exporta e restaura", async () => {
    const cats = await db.categories.toArray();
    await addManual({
      contextId: "ctx_personal",
      type: "expense",
      amountCents: 700,
      categoryId: cats.find((c) => c.kind === "expense")!.id,
    });
    const backup = await exportBackup();
    // simula restauração em banco vazio
    const names = db.tables.map((t) => t.name);
    await db.transaction("rw", names, async () => {
      for (const n of names) await db.table(n).clear();
    });
    const { imported } = await importBackup(backup, true);
    expect(imported).toBeGreaterThan(1);
    const t = await db.transactions.toArray();
    expect(t).toHaveLength(1);
    expect(t[0]!.amountCents).toBe(700);
  });
});
