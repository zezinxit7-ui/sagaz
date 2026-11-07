/** Metas: de economia (valor) e pessoais (etapas). */

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Target } from "lucide-react";
import { Btn, EmptyState, Field, Sheet, TopBar } from "@/components/ui";
import * as repo from "@/data/goals";
import { formatMoney } from "@/domain/money";
import { dayLabel, todayLocal } from "@/domain/dates";

export function GoalsScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        variant="module"
        title="Metas"
        onMenu={onOpenDrawer}
      />
      <GoalsList />
    </div>
  );
}

function GoalsList() {
  const goals = useLiveQuery(() => repo.listGoals(), []) ?? [];
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <>
      <div className="flex-1 px-3 pb-24">
        {goals.length === 0 ? (
          <EmptyState
            icon={<Target size={20} />}
            title="Defina uma meta"
            hint="Juntar dinheiro passaporte — ou algo pessoal com etapas."
            action={
              <Btn className="mt-3" onClick={() => setSheetOpen(true)}>
                <Plus size={16} /> Nova meta
              </Btn>
            }
          />
        ) : (
          <ul className="mt-3 space-y-2">
            {goals.map((g) => (
              <li key={g.id}>
                <GoalCard goalId={g.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[640px] px-4 pb-6">
        <button
          aria-label="Criar meta"
          className="mx-auto flex h-14 items-center gap-2 rounded-[18px] bg-accent px-5 text-on-accent shadow-glow"
          onClick={() => setSheetOpen(true)}
        >
          <Plus size={20} /> Nova meta
        </button>
      </div>

      <GoalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

function GoalCard({ goalId }: { goalId: string }) {
  const goal = useLiveQuery(() => repo.listGoals().then((gs) => gs.find((g) => g.id === goalId)), [goalId]);
  const steps = useLiveQuery(() => repo.stepsOf(goalId), [goalId]) ?? [];
  const [stepTitle, setStepTitle] = useState("");
  const [amount, setAmount] = useState("");

  if (!goal) return null;
  const progress = goal.kind === "savings"
    ? Math.min(100, Math.round(((goal.savedCents ?? 0) / (goal.targetCents || 1)) * 100))
    : steps.length === 0
      ? 0
      : Math.round((steps.filter((s) => s.done).length / steps.length) * 100);

  const overdue = goal.deadline && goal.deadline < todayLocal() && !goal.doneAt;
  const done = Boolean(goal.doneAt);

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-base font-semibold">{goal.name}</p>
        <button
          aria-label="Remover meta"
          className="text-xs text-muted hover:text-danger"
          onClick={() => void repo.deleteGoal(goal.id)}
        >
          ✕
        </button>
      </div>
      {overdue && !done ? (
        <p className="mt-1 text-xs text-danger">Prazo: {dayLabel(goal.deadline!)} (atrasada)</p>
      ) : goal.deadline ? (
        <p className="mt-1 text-xs text-muted">Prazo: {dayLabel(goal.deadline)}</p>
      ) : null}

      {goal.kind === "savings" ? (
        <>
          <div className="my-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <p className="num text-sm text-muted">
            {formatMoney(goal.savedCents ?? 0)} de {formatMoney(goal.targetCents ?? 0)} · {progress}%
          </p>
          <div className="mt-2 flex gap-2">
            <Field
              className="flex-1"
              inputMode="decimal"
              placeholder="+ valor guardado"
              aria-label="Depositar"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Btn
              onClick={() => {
                const cents = ((n) => (Number.isFinite(n) ? Math.round(n * 100) : 0))(
                  Number(amount.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".")),
                );
                if (cents > 0) void repo.addDeposit(goal.id, cents);
                setAmount("");
              }}
            >
              Guardar
            </Btn>
          </div>
        </>
      ) : (
        <>
          <div className="my-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <ul className="mt-1 space-y-1">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.done}
                  aria-label={s.title}
                  onChange={() => void repo.toggleStep(s.id)}
                  className="h-4 w-4 accent-[#8b7bff]"
                />
                <span className={`flex-1 text-sm ${s.done ? "text-muted line-through" : ""}`}>{s.title}</span>
                <button
                  className="text-xs text-muted hover:text-danger"
                  aria-label="Remover etapa"
                  onClick={() => void repo.deleteStep(s.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Field
              className="flex-1"
              placeholder="nova etapa"
              aria-label="Nova etapa"
              value={stepTitle}
              onChange={(e) => setStepTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && stepTitle.trim().length >= 2) {
                  void repo.addStep(goal.id, stepTitle.trim());
                  setStepTitle("");
                }
              }}
            />
            <Btn
              onClick={() => {
                if (stepTitle.trim().length >= 2) {
                  void repo.addStep(goal.id, stepTitle.trim());
                  setStepTitle("");
                }
              }}
            >
              <Plus size={16} />
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

function GoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"savings" | "personal">("savings");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Nova meta">
      <div className="space-y-3">
        <Field placeholder="nome da meta" aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <button
            className={`chip flex-1 justify-center ${kind === "savings" ? "chip-selected" : "bg-surface"}`}
            aria-pressed={kind === "savings"}
            onClick={() => setKind("savings")}
          >
            Economia
          </button>
          <button
            className={`chip flex-1 justify-center ${kind === "personal" ? "chip-selected" : "bg-surface"}`}
            aria-pressed={kind === "personal"}
            onClick={() => setKind("personal")}
          >
            Pessoal
          </button>
        </div>
        {kind === "savings" ? (
          <Field
            inputMode="decimal"
            placeholder="quanto você quer juntar"
            aria-label="Alvo em reais"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        ) : null}
        <Field type="date" aria-label="Prazo (opcional)" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Btn
          className="w-full"
          onClick={() => {
            if (name.trim().length < 2) {
              setError("Dê um nome à meta.");
              return;
            }
            const cents = ((n) => (Number.isFinite(n) ? Math.round(n * 100) : 0))(
              Number(target.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".")),
            );
            void repo.addGoal({
              name: name.trim(),
              kind,
              targetCents: kind === "savings" && cents > 0 ? cents : undefined,
              deadline: deadline || undefined,
            });
            setName("");
            setTarget("");
            setDeadline("");
            setError(null);
            onClose();
          }}
        >
          Criar meta
        </Btn>
      </div>
    </Sheet>
  );
}
