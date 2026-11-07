/** Repositório de metas (economia e pessoais, com etapas). */

import type { Goal, GoalStep } from "./db";
import { db, newId } from "./db";

export type NewGoal = Pick<Goal, "name" | "kind"> &
  Partial<Pick<Goal, "targetCents" | "savedCents" | "deadline" | "contextId">>;

export async function addGoal(input: NewGoal): Promise<Goal> {
  const g: Goal = {
    id: newId("goal"),
    kind: input.kind,
    name: input.name,
    targetCents: input.targetCents,
    savedCents: input.savedCents ?? 0,
    deadline: input.deadline,
    contextId: input.contextId,
    createdAt: new Date().toISOString(),
  };
  await db.goals.add(g);
  return g;
}

export async function listGoals(): Promise<Goal[]> {
  return db.goals.orderBy("createdAt").toArray();
}

export async function addDeposit(goalId: string, cents: number): Promise<Goal> {
  const g = await db.goals.get(goalId);
  if (!g) throw new Error("meta inexistente");
  const saved = (g.savedCents ?? 0) + cents;
  const patch: Partial<Goal> = { savedCents: saved };
  if (g.targetCents !== undefined && saved >= g.targetCents) patch.doneAt = g.doneAt ?? new Date().toISOString();
  await db.goals.update(goalId, patch);
  return (await db.goals.get(goalId))!;
}

export async function deleteGoal(goalId: string): Promise<void> {
  await db.goals.delete(goalId);
  await db.goalSteps.where("goalId").equals(goalId).delete();
}

// ── Etapas ───────────────────────────────────────────────────────────────

export async function stepsOf(goalId: string): Promise<GoalStep[]> {
  return db.goalSteps.where("goalId").equals(goalId).toArray();
}

export async function addStep(goalId: string, title: string): Promise<GoalStep> {
  const siblings = await stepsOf(goalId);
  const step: GoalStep = {
    id: newId("step"),
    goalId,
    title,
    done: false,
    order: siblings.length,
  };
  await db.goalSteps.add(step);
  return step;
}

export async function toggleStep(stepId: string): Promise<GoalStep | undefined> {
  const s = await db.goalSteps.get(stepId);
  if (!s) return undefined;
  await db.goalSteps.update(stepId, { done: !s.done });
  return db.goalSteps.get(stepId);
}

export async function deleteStep(stepId: string): Promise<void> {
  await db.goalSteps.delete(stepId);
}

/** Progresso 0–100: metas de economia por valor; pessoais por etapas. */
export async function progressOf(g: Goal, steps?: number): Promise<number> {
  if (g.kind === "savings" && g.targetCents && g.targetCents > 0) {
    return Math.min(100, Math.round(((g.savedCents ?? 0) / g.targetCents) * 100));
  }
  const total = steps ?? (await stepsOf(g.id)).length;
  if (total === 0) return 0;
  const done = (await stepsOf(g.id)).filter((s) => s.done).length;
  return Math.round((done / total) * 100);
}
