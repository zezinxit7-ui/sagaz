import { describe, expect, it } from "vitest";
import { dedupeKeyOf, makeActionId, validateProposal } from "./actions";

describe("validateProposal", () => {
  it("despesa válida", () => {
    const r = validateProposal({
      actionId: "a1",
      kind: "expense",
      amountCents: 3550,
      transactionType: "expense",
    });
    expect(r.ok).toBe(true);
  });

  it("sem valor → inválida, sem inventar", () => {
    const r = validateProposal({ actionId: "a2", kind: "expense" });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/valor/);
  });

  it("valor fracionado (não cents inteiros) → inválido", () => {
    const r = validateProposal({ actionId: "a3", kind: "income", amountCents: 10.5 });
    expect(r.ok).toBe(false);
  });

  it("lembrete semanal sem dias → inválido", () => {
    const r = validateProposal({
      actionId: "a4",
      kind: "reminder",
      title: "Academia",
      recurrence: "weekly",
    });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/semana/i);
  });

  it("lembrete sem título → inválido", () => {
    const r = validateProposal({ actionId: "a5", kind: "reminder" });
    expect(r.ok).toBe(false);
  });

  it("recurrence 'none' é normalizada para undefined", () => {
    const r = validateProposal({ actionId: "a6", kind: "reminder", title: "Ligar", recurrence: "none" });
    expect(r.ok).toBe(true);
    expect(r.proposal.recurrence).toBeUndefined();
  });

  it("contexto inválido → erro", () => {
    const r = validateProposal({
      actionId: "a7",
      kind: "expense",
      amountCents: 100,
      contextKind: "empresarial" as never,
    });
    expect(r.ok).toBe(false);
  });
});

describe("idempotência", () => {
  it("mesma proposta → mesmo dedupeKey; diferente → diferente", () => {
    const p: Parameters<typeof dedupeKeyOf>[0] = {
      actionId: makeActionId("c1", 0),
      kind: "expense",
      amountCents: 3000,
      transactionType: "expense",
      date: "2026-11-07",
      note: "almoço",
    };
    const same = { ...p };
    const diffNote = { ...p, note: "janta" };
    expect(dedupeKeyOf(p)).toBe(dedupeKeyOf(same));
    expect(dedupeKeyOf(p)).not.toBe(dedupeKeyOf(diffNote));
  });

  it("makeActionId gera ids distintos", () => {
    expect(makeActionId("c1", 0)).not.toBe(makeActionId("c1", 1));
  });
});
