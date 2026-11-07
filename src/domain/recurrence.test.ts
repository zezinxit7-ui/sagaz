import { describe, expect, it } from "vitest";
import { advanceOne, clampToMonth, nextOccurrence, occurrencesBetween } from "./recurrence";

describe("clampToMonth", () => {
  it("31 de fevereiro vira 28/29", () => {
    expect(clampToMonth(2025, 1, 31).getDate()).toBe(28);
    expect(clampToMonth(2024, 1, 31).getDate()).toBe(29); // 2024 bissexto
  });
});

describe("advanceOne", () => {
  it("daily", () => {
    expect(advanceOne("2026-03-31", "daily")).toBe("2026-04-01");
  });
  it("weekly", () => {
    expect(advanceOne("2026-03-31", "weekly")).toBe("2026-04-07");
  });
  it("monthly com clamp", () => {
    expect(advanceOne("2026-02-28", "monthly")).toBe("2026-03-28");
    expect(advanceOne("2026-01-31", "monthly")).toBe("2026-02-28");
  });
});

describe("nextOccurrence", () => {
  it("base futura → ela mesma", () => {
    expect(nextOccurrence("2026-12-10", "daily", "2026-11-01")).toBe("2026-12-10");
  });
  it("base passada → a primeira ocorrência estritamente >= from", () => {
    // base 01/01 mensal: ocorrências são o dia 1 de cada mês; a 1ª ≥ 05/11 é 01/12
    expect(nextOccurrence("2026-01-01", "monthly", "2026-11-05")).toBe("2026-12-01");
  });
  it("base passada e from antes da próxima → from", () => {
    // base 01/11, from 06/11, daily → 06/11
    expect(nextOccurrence("2026-11-01", "daily", "2026-11-06")).toBe("2026-11-06");
  });
});

describe("occurrencesBetween", () => {
  it("daily expande dentro do intervalo", () => {
    expect(occurrencesBetween("2026-01-01", "daily", undefined, "2026-03-15", "2026-03-17")).toEqual([
      "2026-03-15",
      "2026-03-16",
      "2026-03-17",
    ]);
  });
  it("weekly usa os dias da semana", () => {
    // terça (2) e quinta (4) entre segunda 09/03 e domingo 15/03 de 2026
    expect(occurrencesBetween("2026-03-01", "weekly", [2, 4], "2026-03-09", "2026-03-15")).toEqual([
      "2026-03-10",
      "2026-03-12",
    ]);
  });
  it("mensal aterrissa em meses curtos com clamp", () => {
    // base 31/01 → em fevereiro vira 28, março 31...
    const occ = occurrencesBetween("2026-01-31", "monthly", undefined, "2026-01-31", "2026-04-30");
    expect(occ[0]).toBe("2026-01-31");
    expect(occ[1]).toBe("2026-02-28");
  });
  it("intervalo invertido vazio", () => {
    expect(occurrencesBetween("2026-01-01", "daily", undefined, "2026-01-10", "2026-01-05")).toEqual([]);
  });
});
