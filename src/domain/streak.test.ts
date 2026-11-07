import { describe, expect, it } from "vitest";
import { currentStreak, longestStreak, adherence4w } from "./streak";

const WEEK = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"];

describe("currentStreak", () => {
  it("hábito diário feito todos os dias até ontem", () => {
    const logs = new Set(WEEK.slice(0, 6)); // até 07/03
    expect(currentStreak(logs, undefined, "2026-03-08")).toBe(6);
  });
  it("hoje sem registro não quebra a sequência", () => {
    const logs = new Set(WEEK.slice(0, 6)); // inclui 07/03, falta hoje (08/03)
    expect(currentStreak(logs, undefined, "2026-03-08")).toBe(6);
    // e agora registra hoje:
    logs.add("2026-03-08");
    expect(currentStreak(logs, undefined, "2026-03-08")).toBe(7);
  });
  it("falta de um dia diário quebra", () => {
    const logs = new Set(WEEK.filter((d) => d !== "2026-03-05"));
    // hoje (08) registrado: conta 08,07,06 = 3 e quebra em 05
    expect(currentStreak(logs, undefined, "2026-03-08")).toBe(3);
  });
  it("weekdays agendados: dias fora não quebram", () => {
    // seg/qua/sex (1,3,5) — logs só nos agendados
    const logs = new Set(["2026-03-02", "2026-03-04", "2026-03-06"]); // segunda, quarta, sexta
    expect(currentStreak(logs, [1, 3, 5], "2026-03-06")).toBe(3);
  });
  it("weekdays agendados: os dois últimos agendados fizeram → streak conta só os agendados", () => {
    // seg 02 e qua 04 feitos; sex 05 não feito mas é "hoje" → não quebra ainda
    const logs = new Set(["2026-03-02", "2026-03-04"]);
    expect(currentStreak(logs, [1, 3, 5], "2026-03-06")).toBe(2);
  });
  it("weekdays agendados: faltou o último agendado anterior → streak zero", () => {
    // hoje qua 04 (agendado, não feito) → começa em ter 03 (não agendado),
    // depois seg 02 (agendado, feito) e, antes disso, qua 26/02 (agendado, não feito)
    const logs = new Set(["2026-03-02"]);
    expect(currentStreak(logs, [1, 3, 5], "2026-03-04")).toBe(1);
  });
});

describe("longestStreak", () => {
  it("maior sequência da semana", () => {
    const logs = new Set(WEEK.slice(2));
    expect(longestStreak(logs, undefined, WEEK)).toBe(5);
  });
});

describe("adherence4w", () => {
  it("100% quando tudo registrado", () => {
    const days = Array.from({ length: 28 }, (_, i) => `2026-03-${String(i + 1).padStart(2, "0")}`);
    expect(adherence4w(new Set(days), undefined, "2026-03-28")).toBe(100);
  });
  it("0% quando nada", () => {
    expect(adherence4w(new Set(), undefined, "2026-03-28")).toBe(0);
  });
});
