/** Repositório de hábitos + logs (idempotentes por habitId+date). */

import type { Habit, HabitLog } from "./db";
import { db, newId } from "./db";
import { todayLocal } from "@/domain/dates";

export type NewHabit = Omit<Habit, "id" | "createdAt">;

export async function addHabit(input: NewHabit): Promise<Habit> {
  const h: Habit = { ...input, id: newId("hab"), createdAt: new Date().toISOString() };
  await db.habits.add(h);
  return h;
}

export async function updateHabit(id: string, patch: Partial<Habit>): Promise<void> {
  await db.habits.update(id, patch);
}

export async function deleteHabit(id: string): Promise<void> {
  await db.habits.delete(id);
  // limpa histórico órfão
  await db.habitLogs.where("habitId").equals(id).delete();
}

export async function listHabits(): Promise<Habit[]> {
  return db.habits.orderBy("createdAt").toArray();
}

/** Log do dia (união com weekdays): escreve 1x e devolve o log. */
export async function logToday(habitId: string, date = todayLocal()): Promise<HabitLog> {
  const id = `${habitId}|${date}`;
  const existing = await db.habitLogs.get(id);
  if (existing) return existing;
  const log: HabitLog = { id, habitId, date };
  await db.habitLogs.add(log);
  return log;
}

export async function unlog(habitId: string, date = todayLocal()): Promise<void> {
  await db.habitLogs.delete(`${habitId}|${date}`);
}

/** Todos os logs de um hábito (para streak/adherência). */
export async function logsOf(habitId: string): Promise<HabitLog[]> {
  return db.habitLogs.where("habitId").equals(habitId).toArray();
}

/** Logs de um dia (para o calendário geral). */
export async function logsOn(date: string): Promise<HabitLog[]> {
  return db.habitLogs.where("date").equals(date).toArray();
}

export async function isLoggedOn(habitId: string, date = todayLocal()): Promise<boolean> {
  return db.habitLogs.get(`${habitId}|${date}`).then((r) => r !== undefined);
}
