/**
 * Expansão de recorrências: LEMBRETES e assinaturas compartilham as mesmas
 * regras. Funções puras — sem acesso ao banco, fáceis de testar.
 */

import { parseLocalDate, toLocalISOString } from "./dates";

export type Cycle = "daily" | "weekly" | "monthly" | "yearly";

/** Clamp: "dia 31" em fevereiro vira o último dia do mês (28/29). */
export function clampToMonth(year: number, month0: number, day: number): Date {
  const last = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(day, last));
}

/** Próxima data depois de `from` (exclusive) dada uma data-base e um ciclo. */
export function nextOccurrence(base: string, cycle: Cycle, from: string): string {
  const baseD = parseLocalDate(base);
  const fromD = parseLocalDate(from);

  const advance = (d: Date): Date => {
    const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    switch (cycle) {
      case "daily":
        nd.setDate(nd.getDate() + 1);
        return nd;
      case "weekly":
        nd.setDate(nd.getDate() + 7);
        return nd;
      case "monthly":
        return clampToMonth(nd.getFullYear(), nd.getMonth() + 1, nd.getDate());
      case "yearly":
        return clampToMonth(nd.getFullYear() + 1, nd.getMonth(), nd.getDate());
    }
  };

  let d = baseD;
  // se a própria base ainda é futura (>= from), a próxima dela é ela mesma
  if (d.getTime() >= fromD.getTime()) return toLocalISOString(d);
  for (let i = 0; i < 3660; i++) {
    d = advance(d);
    if (d.getTime() >= fromD.getTime()) return toLocalISOString(d);
  }
  return toLocalISOString(d);
}

/**
 * Ocorrências dentro de [start..end] (inclusos). Para semanal com dias da
 * semana, `weekdays` domina sobre a data-base.
 */
export function occurrencesBetween(
  base: string,
  cycle: Cycle,
  weekdays: number[] | undefined,
  start: string,
  end: string,
): string[] {
  if (start > end) return [];
  const out: string[] = [];
  const endD = parseLocalDate(end);

  if (cycle === "weekly" && weekdays && weekdays.length > 0) {
    const set = new Set(weekdays);
    const cursor = parseLocalDate(start);
    for (let i = 0; i < 434 && cursor.getTime() <= endD.getTime(); i++) {
      if (set.has(cursor.getDay())) out.push(toLocalISOString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  // primeira ocorrência >= start
  let d = base < start ? nextOccurrence(base, cycle, start) : base;
  let guard = 0;
  while (d <= end && guard++ < 400) {
    out.push(d);
    const nd = advanceOne(d, cycle);
    if (nd === d) break; // segurança
    d = nd;
  }
  return out;
}

/** Avança uma data em exatamente um ciclo. */
export function advanceOne(s: string, cycle: Cycle): string {
  const d = parseLocalDate(s);
  switch (cycle) {
    case "daily":
      d.setDate(d.getDate() + 1);
      return toLocalISOString(d);
    case "weekly":
      d.setDate(d.getDate() + 7);
      return toLocalISOString(d);
    case "monthly":
      return toLocalISOString(clampToMonth(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    case "yearly":
      return toLocalISOString(clampToMonth(d.getFullYear() + 1, d.getMonth(), d.getDate()));
  }
}
