/**
 * Streaks de hábitos: quantos dias seguidos (ou "dias agendados" seguidos)
 * um hábito foi cumprido até hoje. Regra: dias que não estão entre os dias
 * da semana agendados NÃO quebram a sequência.
 */

import { addDays, todayLocal, weekdayOf } from "./dates";

/**
 * @param scheduledWeekdays 0–6; quando definido, só esses dias contam.
 * @param logsSet conjunto de `YYYY-MM-DD` registrados.
 */
export function currentStreak(
  logsSet: ReadonlySet<string>,
  scheduledWeekdays?: number[],
  today = todayLocal(),
): number {
  const isDue = (d: string): boolean =>
    scheduledWeekdays ? scheduledWeekdays.includes(weekdayOf(d)) : true;

  // se hoje é due e não foi registrado, começamos ontem (streak ainda vivo)
  let cursor = today;
  if (isDue(cursor) && !logsSet.has(cursor)) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;
  let guard = 0;
  while (guard++ < 3660) {
    if (isDue(cursor)) {
      if (!logsSet.has(cursor)) break;
      streak++;
    }
    if (cursor < "2020-01-01") break; // segurança
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Melhor sequência histórica em um intervalo de dias. */
export function longestStreak(
  logsSet: ReadonlySet<string>,
  scheduledWeekdays: number[] | undefined,
  days: string[], // lista ordenada de YYYY-MM-DD exibidos (ex.: últimos 60)
): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    const isDue = scheduledWeekdays ? scheduledWeekdays.includes(weekdayOf(d)) : true;
    if (!isDue) continue;
    if (logsSet.has(d)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** Adesão das últimas 4 semanas (0–100%). */
export function adherence4w(
  logsSet: ReadonlySet<string>,
  scheduledWeekdays: number[] | undefined,
  today = todayLocal(),
): number {
  let due = 0;
  let done = 0;
  for (let i = 0; i < 28; i++) {
    const d = addDays(today, -i);
    const isDue = scheduledWeekdays ? scheduledWeekdays.includes(weekdayOf(d)) : true;
    if (!isDue) continue;
    due++;
    if (logsSet.has(d)) done++;
  }
  return due === 0 ? 0 : Math.round((done / due) * 100);
}
