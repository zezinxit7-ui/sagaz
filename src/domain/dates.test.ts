import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayDiff,
  endOfMonth,
  extractDateHint,
  monthGrid,
  monthKeyOf,
  parseLocalDate,
  toLocalISOString,
} from "./dates";

describe("helpers de data local", () => {
  it("parseLocalDate é estável (sem derrapagem de TZ)", () => {
    expect(toLocalISOString(parseLocalDate("2026-03-15"))).toBe("2026-03-15");
  });
  it("addDays e dayDiff", () => {
    expect(addDays("2026-03-30", 3)).toBe("2026-04-02");
    expect(dayDiff("2026-04-02", "2026-03-30")).toBe(3);
  });
  it("addMonths e fim de mês", () => {
    expect(addMonths("2026-01", 1)).toBe("2026-02");
    expect(endOfMonth("2026-02")).toMatch(/2026-02-28/);
  });
  it("monthKeyOf", () => {
    expect(monthKeyOf("2026-11-07")).toBe("2026-11");
  });
  it("grade do mês tem 42 dias e começa no domingo", () => {
    const grid = monthGrid("2026-11");
    expect(grid).toHaveLength(42);
    const w = parseLocalDate(grid[0]!.date).getDay();
    expect(w).toBe(0);
    expect(grid.some((c) => c.inMonth)).toBe(true);
  });
});

describe("extractDateHint", () => {
  it("amanhã", () => {
    const h = extractDateHint("lembra da luz amanhã");
    expect(h.date).toBe(addDays(new Date().toISOString().slice(0, 10), 1));
  });
  it("dia 15 do mês que vem", () => {
    const h = extractDateHint("conta no dia 15 do mês que vem");
    expect(h.date?.slice(8)).toBe("15");
  });
  it("recorrência semanal com dois dias", () => {
    const h = extractDateHint("meditar toda terça e quinta");
    expect(h.recurrence).toBe("weekly");
    expect(h.weekdays).toEqual([2, 4]);
  });
  it("hora da tarde", () => {
    const h = extractDateHint("lembrete às 2 da tarde");
    expect(h.time).toBe("14:00");
  });
  it("não inventa data sem pista", () => {
    expect(extractDateHint("comprar arroz").date).toBeUndefined();
  });
});
