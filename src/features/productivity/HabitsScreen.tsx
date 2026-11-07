/** Hábitos: cards com streak, linha da semana e registro do dia. */

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Flame, Plus, Trophy } from "lucide-react";
import { Btn, EmptyState, Field, Sheet, TopBar, WeekdayChips } from "@/components/ui";
import * as repo from "@/data/habits";
import { currentStreak } from "@/domain/streak";
import { addDays, todayLocal, weekdayOf, WEEKDAY_SHORT } from "@/domain/dates";

export function HabitsScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        variant="module"
        title="Hábitos"
        onMenu={onOpenDrawer}
      />
      <HabitsList />
    </div>
  );
}

function HabitsList() {
  const habits = useLiveQuery(() => repo.listHabits(), []) ?? [];
  const today = todayLocal();
  const logsToday = useLiveQuery(() => repo.logsOn(today), [today]) ?? [];
  const loggedIds = new Set(logsToday.map((l) => l.habitId));
  const [sheetOpen, setSheetOpen] = useState(false);

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - weekdayOf(today)));

  return (
    <>
      <div className="flex-1 px-3 pb-24">
        {habits.length === 0 ? (
          <EmptyState
            icon={<Trophy size={20} />}
            title="Comece um hábito"
            hint="Ex.: ler, meditar, treinar 3x por semana. Marque os dias que faz sentido."
            action={
              <Btn className="mt-3" onClick={() => setSheetOpen(true)}>
                <Plus size={16} /> Criar hábito
              </Btn>
            }
          />
        ) : (
          <ul className="mt-3 space-y-2">
            {habits.map((h) => (
              <li key={h.id}>
                <HabitCard
                  habit={h}
                  weekDates={week}
                  loggedToday={loggedIds.has(h.id)}
                  onToggleToday={() =>
                    void (loggedIds.has(h.id) ? repo.unlog(h.id, today) : repo.logToday(h.id, today))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[640px] px-4 pb-6">
        <button
          aria-label="Criar hábito"
          className="mx-auto flex h-14 items-center gap-2 rounded-[18px] bg-accent px-5 text-on-accent shadow-glow"
          onClick={() => setSheetOpen(true)}
        >
          <Plus size={20} /> Novo hábito
        </button>
      </div>

      <HabitSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

function HabitCard({
  habit,
  weekDates,
  loggedToday,
  onToggleToday,
}: {
  habit: { id: string; name: string; weekdays: number[] };
  weekDates: string[];
  loggedToday: boolean;
  onToggleToday: () => void;
}) {
  const logs = useLiveQuery(() => repo.logsOf(habit.id), [habit.id]) ?? [];
  const logSet = new Set(logs.map((l) => l.date));
  const streak = currentStreak(logSet, habit.weekdays);

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold">{habit.name}</p>
        <span className={`flex items-center gap-1 text-sm ${streak >= 3 ? "text-accent" : "text-muted"}`}>
          <Flame size={15} />
          <span className="num">{streak}</span>
          {streak === 1 ? "dia" : "dias"}
        </span>
      </div>

      {habit.weekdays.length > 0 && habit.weekdays.length < 7 ? (
        <div className="mt-2 flex gap-1.5">
          {weekDates.map((d, idx) => {
            const wd = weekdayOf(d);
            const due = habit.weekdays.includes(wd);
            const done = logSet.has(d);
            return (
              <span
                key={d}
                title={d}
                className={`flex h-7 flex-1 items-center justify-center rounded-md text-xs ${
                  due
                    ? done
                      ? "bg-accent text-on-accent"
                      : "border border-line text-muted"
                    : "bg-surface-2 text-muted/50"
                }`}
              >
                {WEEKDAY_SHORT[wd]}
                {idx === weekDates.length - 1 && due ? "" : ""}
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {dueToday(habit.weekdays) ? (
          <Btn
            className="flex-1"
            variant={loggedToday ? "secondary" : "primary"}
            onClick={onToggleToday}
          >
            {loggedToday ? "Registrado hoje ✓" : "Registrar hoje"}
          </Btn>
        ) : (
          <p className="flex-1 text-xs text-muted">
            Não está nos dias desse hábito — a sequência continua.
          </p>
        )}
        <button
          className="px-1 text-xs text-muted hover:text-danger"
          onClick={() => void repo.deleteHabit(habit.id)}
          aria-label={`Remover ${habit.name}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function dueToday(weekdays: number[]): boolean {
  return weekdays.includes(weekdayOf(todayLocal()));
}

function HabitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Novo hábito">
      <div className="space-y-3">
        <Field placeholder="ex.: ler 20 minutos" aria-label="Nome do hábito" value={name} onChange={(e) => setName(e.target.value)} />
        <p className="text-xs text-muted">Nos quais dias faz sentido?</p>
        <WeekdayChips selected={weekdays} onToggle={(d) => setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Btn
          className="w-full"
          onClick={() => {
            if (name.trim().length < 2) {
              setError("Dê um nome ao hábito.");
              return;
            }
            if (weekdays.length === 0) {
              setError("Escolha ao menos um dia.");
              return;
            }
            void repo.addHabit({ name: name.trim(), weekdays });
            setName("");
            setError(null);
            onClose();
          }}
        >
          Criar hábito
        </Btn>
      </div>
    </Sheet>
  );
}
