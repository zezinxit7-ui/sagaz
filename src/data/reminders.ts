/** Repositório de lembretes (únicos e recorrentes) + expansão para calendário. */

import type { Reminder } from "./db";
import { db, newId } from "./db";
import { occurrencesBetween, advanceOne } from "@/domain/recurrence";
import { monthGrid, todayLocal } from "@/domain/dates";

export type NewReminder = Omit<Reminder, "id" | "status" | "doneAt" | "baseDate">;

/**
 * Criação idempotente via chat: actionId já registrado → devolve o existente.
 * Para recorrentes, baseDate = primeira data conhecida (dueDate ou hoje).
 */
export async function addReminder(input: NewReminder, actionId?: string): Promise<Reminder> {
  if (actionId) {
    const existing = await db.reminders.where("actionId").equals(actionId).first();
    if (existing) return existing;
  }
  const today = todayLocal();
  const r: Reminder = {
    ...input,
    actionId: actionId ?? input.actionId, // fonte da idempotência
    baseDate: input.kind === "recurring" ? input.dueDate ?? today : today,
    id: newId("rem"),
    status: "pending",
  };
  await db.reminders.add(r);
  return r;
}

export async function updateReminder(id: string, patch: Partial<Reminder>): Promise<void> {
  await db.reminders.update(id, patch);
}

export async function deleteReminder(id: string): Promise<void> {
  await db.reminders.delete(id);
}

export async function markDone(id: string, done: boolean): Promise<void> {
  if (done) {
    await db.reminders.update(id, { status: "done", doneAt: new Date().toISOString() });
  } else {
    await db.reminders.update(id, { status: "pending", doneAt: undefined });
  }
}

/**
 * Conclui UMA ocorrência:
 * - único: marca done;
 * - diário/mensal: antecipa a âncora para a próxima data (item segue pendente);
 * - semanal: adiciona o dia a `exceptionDates` (ocorrência individual).
 */
export async function completeOccurrence(r: Reminder, date: string): Promise<void> {
  if (r.kind === "once") {
    await markDone(r.id, true);
    return;
  }
  if (r.recurrence === "weekly") {
    const dates = new Set(r.exceptionDates ?? []);
    dates.add(date);
    await db.reminders.update(r.id, { exceptionDates: [...dates].sort() });
  } else {
    const next = advanceOne(date, r.recurrence ?? "daily");
    await db.reminders.update(r.id, { baseDate: next });
  }
}

export async function listAll(): Promise<Reminder[]> {
  // toArray (não orderBy em campo opcional: IndexedDB omite linhas sem chave)
  return db.reminders.toArray();
}

export async function listPending(): Promise<Reminder[]> {
  return db.reminders.where("status").equals("pending").toArray();
}

export interface DayOccurrences {
  date: string;
  once: Reminder[];
  recurring: Reminder[];
}

/**
 * Ocorrências visíveis em um mês: únicos (pending no mês) + recorrências
 * expandidas. Usado pelo calendário (S04) e pela lista.
 */
export async function monthOccurrences(month: string): Promise<Map<string, DayOccurrences>> {
  const grid = monthGrid(month);
  const first = grid[0]!.date;
  const last = grid[grid.length - 1]!.date;
  const today = todayLocal();

  const all = await listAll();
  const map = new Map<string, DayOccurrences>();
  const touch = (date: string) => {
    let d = map.get(date);
    if (!d) {
      d = { date, once: [], recurring: [] };
      map.set(date, d);
    }
    return d;
  };

  for (const r of all) {
    if (r.kind === "once") {
      // pendentes aparecem no dia marcado; atrasadas seguem no dia original
      if (r.dueDate && r.status === "pending" && r.dueDate >= first && r.dueDate <= last) {
        touch(r.dueDate).once.push(r);
      }
    } else if (r.status === "pending") {
      const excluded = new Set(r.exceptionDates ?? []);
      const days = occurrencesBetween(
        r.baseDate,
        r.recurrence ?? "daily",
        r.recurrence === "weekly" ? r.weekdays : undefined,
        r.recurrence === "weekly" ? first : r.baseDate > first ? r.baseDate : first,
        last,
      ).filter((d) => !excluded.has(d));
      for (const d of days) touch(d).recurring.push(r);
    }
  }
  void today;
  return map;
}

/** Contagens dos stat-cards (S04): pendentes, hoje, concluídos, atrasados. */
export async function stats(): Promise<{
  pending: number;
  today: number;
  done: number;
  overdue: number;
}> {
  const today = todayLocal();
  const all = await listAll();
  let pending = 0;
  let todayCount = 0;
  let done = 0;
  let overdue = 0;
  for (const r of all) {
    if (r.status === "done") {
      done++;
      continue;
    }
    pending++;
    if (r.kind === "once" && r.dueDate) {
      if (r.dueDate < today) overdue++;
      else if (r.dueDate === today) todayCount++;
    } else if (r.kind === "recurring") {
      const excluded = new Set(r.exceptionDates ?? []);
      const days = occurrencesBetween(
        r.baseDate,
        r.recurrence ?? "daily",
        r.recurrence === "weekly" ? r.weekdays : undefined,
        r.baseDate,
        today,
      ).filter((d) => !excluded.has(d));
      if (days.includes(today)) todayCount++;
    }
  }
  return { pending, today: todayCount, done, overdue };
}
