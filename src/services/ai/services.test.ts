import { beforeEach, describe, expect, it } from "vitest";
import { db, ensureSeeded } from "@/data/db";
import { applyProposal } from "@/services/ai/executor";
import { parseActionsLocal } from "@/services/ai/localParser";
import type { ActionProposal } from "@/domain/actions";

beforeEach(async () => {
  const names = db.tables.map((t) => t.name);
  await db.transaction("rw", names, async () => {
    for (const n of names) await db.table(n).clear();
  });
  await ensureSeeded();
});

describe("localParser", () => {
  it("extrai despesa com valor e nota", async () => {
    const ps = await parseActionsLocal("gastei 30 no almoço", "conv1");
    expect(ps.find((p) => p.kind === "expense")?.amountCents).toBe(3000);
  });

  it("extrai despesa e lembrete da mesma mensagem (multi-action)", async () => {
    const ps = await parseActionsLocal("gastei 30 no almoço e me lembra da luz amanhã", "conv2");
    const kinds = ps.map((p) => p.kind).sort();
    expect(kinds).toEqual(["expense", "reminder"]);
    const rem = ps.find((p) => p.kind === "reminder");
    expect(rem?.title?.toLowerCase()).toContain("luz");
  });

  it("não propõe nada em conversa sem intenção", async () => {
    const ps = await parseActionsLocal("nossa, que calor hoje", "conv3");
    expect(ps).toHaveLength(0);
  });

  it("valor por extenso", async () => {
    const ps = await parseActionsLocal("gastei trinta e cinco reais no mercado", "conv4");
    expect(ps.find((p) => p.kind === "expense")?.amountCents).toBe(3500);
  });
});

describe("executor (idempotência ponta a ponta)", () => {
  it("confirma 2× a mesma proposta → 1 linha no banco", async () => {
    const p: ActionProposal = {
      actionId: "act_x1",
      kind: "expense",
      amountCents: 3550,
      transactionType: "expense",
      note: "almoço",
      date: "2026-11-07",
    };
    const r1 = await applyProposal(p);
    const r2 = await applyProposal({ ...p, actionId: "act_x2" }); // nova proposta, mesma substância
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(await db.transactions.count()).toBe(1);
  });

  it("cria lembrete recorrente uma vez só", async () => {
    const p: ActionProposal = {
      actionId: "act_rem_x",
      kind: "reminder",
      title: "Academia",
      recurrence: "weekly",
      weekdays: [1, 5],
    };
    const r1 = await applyProposal(p);
    const r2 = await applyProposal({ ...p }); // MESMO actionId
    expect(r1.ok && r2.ok).toBe(true);
    expect(await db.reminders.count()).toBe(1);
  });

  it("recusa proposta sem valor", async () => {
    const r = await applyProposal({ actionId: "act_e", kind: "expense" });
    expect(r.ok).toBe(false);
  });

  it("contexto business cria no contexto certo", async () => {
    const r = await applyProposal({
      actionId: "act_biz",
      kind: "income",
      amountCents: 50000,
      contextKind: "business",
      date: "2026-11-07",
    });
    expect(r.ok).toBe(true);
    const tx = (await db.transactions.toArray())[0]!;
    expect(tx.contextId).toBe("ctx_business");
    expect(tx.amountCents).toBe(50000);
  });
});
