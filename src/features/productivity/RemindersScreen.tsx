/** Lembretes (S04/S05): stat cards, calendário/lista, únicos vs recorrentes. */

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bell, CalendarDays, Check, ListTodo, Plus } from "lucide-react";
import {
  Btn,
  EmptyState,
  Field,
  MonthPager,
  Sheet,
  StatCard,
  TopBar,
  WeekdayChips,
} from "@/components/ui";
import type { Reminder } from "@/data/db";
import * as repo from "@/data/reminders";
import {  MONTH_NAMES,
  WEEKDAY_SHORT,
  monthGrid,
  todayLocal,
} from "@/domain/dates";

export function RemindersScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [month, setMonth] = useState(() => todayLocal().slice(0, 7));
  const [view, setView] = useState<"calendar" | "list">("list");
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        variant="module"
        title="Lembretes"
        onMenu={onOpenDrawer}
      />
      <div className="flex-1 px-3 pb-safe">
        <MonthPager month={month} onChange={setMonth} />
        <div className="my-2 flex gap-2">
          <ViewBtn active={view === "calendar"} onClick={() => setView("calendar")}>
            <CalendarDays size={15} />
            Calendário
          </ViewBtn>
          <ViewBtn active={view === "list"} onClick={() => setView("list")}>
            <ListTodo size={15} />
            Lista
          </ViewBtn>
        </div>
        {view === "calendar" ? <CalendarView month={month} /> : <ListView month={month} />}
      </div>
    </div>
  );
}

function ViewBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`chip flex-1 justify-center ${active ? "chip-selected" : "bg-surface"}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ── Calendário ───────────────────────────────────────────────────────────

function CalendarView({ month }: { month: string }) {
  const occurrences = useLiveQuery(() => repo.monthOccurrences(month), [month]);
  const grid = useMemo(() => monthGrid(month), [month]);
  const today = todayLocal();

  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ? occurrences?.get(selected) : undefined;

  return (
    <>
      <div className="mb-2 grid grid-cols-7 text-center text-xs text-muted">
        {WEEKDAY_SHORT.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }) => {
          const d = occurrences?.get(date);
          const count = d ? d.once.length + d.recurring.length : 0;
          return (
            <button
              key={date}
              className={`flex h-12 flex-col items-center justify-center rounded-lg border text-xs ${
                date === today ? "border-accent" : "border-transparent"
              } ${inMonth ? "text-ink" : "text-muted/50"} bg-surface`}
              onClick={() => setSelected(date)}
            >
              <span className="num">{Number(date.slice(8))}</span>
              {count > 0 ? (
                <span className="mt-0.5 flex gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(3, count) }).map((_, i) => (
                    <span key={i} className="h-1 w-1 rounded-full bg-accent" />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {sel ? (
        <section className="mt-3 rise">
          <h3 className="mb-1 text-sm font-semibold">
            {Number(sel.date.slice(8))} de {MONTH_NAMES[Number(sel.date.slice(5, 7)) - 1]}
          </h3>
          {sel.once.length === 0 && sel.recurring.length === 0 ? (
            <p className="text-sm text-muted">Nada marcado nesse dia.</p>
          ) : (
            <ul className="space-y-1">
              {[...sel.once, ...sel.recurring].map((r) => (
                <li key={r.id}>
                  <ReminderRow r={r} date={sel.date} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-center text-xs text-muted">Toque no para concluir a ocorrência do dia.</p>
        </section>
      ) : null}
      <StatsRow />
    </>
  );
}

// ── Lista ────────────────────────────────────────────────────────────────

function ListView({ month }: { month: string }) {
  const [segment, setSegment] = useState<"once" | "recurring">("once");
  const [sheetOpen, setSheetOpen] = useState(false);
  const stats = useLiveQuery(() => repo.stats(), []);
  const all = useLiveQuery(() => repo.listAll(), []);

  const shown = (all ?? [])
    .filter((r) => r.kind === segment)
    .filter((r) => {
      // lista mostra pendentes do mês e pendentes pendurados (atrasos)
      if (r.status !== "pending") return false;
      if (!r.dueDate) return true;
      return r.dueDate <= `${month}-31`;
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  return (
    <>
      <StatsRowOverride stats={stats} />
      <div className="mt-3 flex gap-2">
        <ViewBtn
          active={segment === "once"}
          onClick={() => setSegment("once")}
        >
          Únicos ({all?.filter((r) => r.kind === "once" && r.status === "pending").length ?? 0})
        </ViewBtn>
        <ViewBtn
          active={segment === "recurring"}
          onClick={() => setSegment("recurring")}
        >
          Recorrentes ({all?.filter((r) => r.kind === "recurring" && r.status === "pending").length ?? 0})
        </ViewBtn>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Bell size={20} />}
          title="Nada pendente por aqui"
          hint="Peça no chat “lembra da luz amanhã” ou toque em +"
          action={
            <Btn className="mt-3" onClick={() => setSheetOpen(true)}>
              <Plus size={16} /> Novo lembrete
            </Btn>
          }
        />
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {shown.map((r) => (
            <li key={r.id}>
              <ReminderRow r={r} date={r.dueDate ?? todayLocal()} />
            </li>
          ))}
        </ul>
      )}

      <ReminderSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

// ── Stat cards ───────────────────────────────────────────────────────────

function StatsRow() {
  const stats = useLiveQuery(() => repo.stats(), []);
  return <StatsRowOverride stats={stats} />;
}

function StatsRowOverride({
  stats,
}: {
  stats: { pending: number; today: number; done: number; overdue: number } | undefined;
}) {
  return (
    <div className="mt-3 flex gap-2">
      <StatCard label="Hoje" value={String(stats?.today ?? 0)} tone="accent" icon={<Check size={16} />} />
      <StatCard label="Pendentes" value={String(stats?.pending ?? 0)} tone="neutral" icon={<Bell size={16} />} />
      <StatCard label="Atrasados" value={String(stats?.overdue ?? 0)} tone="danger" icon={<CalendarDays size={16} />} />
    </div>
  );
}

// ── Linha de lembrete ────────────────────────────────────────────────────

function ReminderRow({ r, date }: { r: Reminder; date: string }) {
  const prioCls =
    r.priority === "high" ? "border-l-2 border-danger" : r.priority === "low" ? "" : "border-l-2 border-accent";
  const when =
    r.kind === "recurring"
      ? r.recurrence === "weekly" && r.weekdays?.length
        ? r.weekdays.map((w) => WEEKDAY_SHORT[w]).join(" ")
        : r.recurrence === "monthly"
          ? "mensal"
          : "todos os dias"
      : r.dueDate
        ? `${r.dueDate.slice(8)}/${r.dueDate.slice(5, 7)}${r.dueTime ? ` ${r.dueTime}` : ""}`
        : "sem data";

  return (
    <div className={`flex items-center gap-3 py-2.5 ${prioCls} ps-2`}>
      <button
        aria-label="Concluir"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          r.status === "done" ? "border-success bg-success text-[#0b0c0f]" : "border-input"
        }`}
        onClick={() => void repo.completeOccurrence(r, date)}
      >
        {r.status === "done" ? <Check size={14} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{r.title}</p>
        <p className="text-xs text-muted">{when}</p>
      </div>
      <button
        aria-label="Remover"
        className="shrink-0 px-2 text-xs text-muted hover:text-danger"
        onClick={() => void repo.deleteReminder(r.id)}
      >
        ✕
      </button>
    </div>
  );
}

// ── Sheet de criação manual ──────────────────────────────────────────────

const REMINDER_COST_PLACEHOLDER = ""; // sem implementar custo: assinatura fica em Finanças
void REMINDER_COST_PLACEHOLDER;

function ReminderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"once" | "recurring">("once");
  const [dueDate, setDueDate] = useState(todayLocal());
  const [dueTime, setDueTime] = useState("");
  const [recurrence, setRecurrence] = useState<"daily" | "weekly" | "monthly">("daily");
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [priority, setPriority] = useState<Reminder["priority"]>("medium");
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Novo lembrete">
      <div className="space-y-3">
        <Field placeholder="o que lembrar?" aria-label="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex gap-2">
          <ViewBtn active={kind === "once"} onClick={() => setKind("once")}>
            Único
          </ViewBtn>
          <ViewBtn active={kind === "recurring"} onClick={() => setKind("recurring")}>
            Recorrente
          </ViewBtn>
        </div>

        {kind === "once" ? (
          <>
            <Field type="date" aria-label="Data" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Field type="time" aria-label="Hora (opcional)" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </>
        ) : (
          <>
            <select
              className="field text-sm"
              aria-label="Frequência"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as "daily" | "weekly" | "monthly")}
            >
              <option value="daily">Todos os dias</option>
              <option value="weekly">Dias específicos da semana</option>
              <option value="monthly">Todo mês</option>
            </select>
            {recurrence === "weekly" ? (
              <WeekdayChips
                selected={weekdays}
                onToggle={(d) =>
                  setWeekdays((cur) =>
                    cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort(),
                  )
                }
              />
            ) : null}
            <Field type="time" aria-label="Hora (opcional)" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </>
        )}

        <select
          className="field text-sm"
          aria-label="Prioridade"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Reminder["priority"])}
        >
          <option value="low">Baixa prioridade</option>
          <option value="medium">Prioridade média</option>
          <option value="high">Alta prioridade</option>
        </select>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Btn
          className="w-full"
          onClick={() => {
            if (title.trim().length < 2) {
              setError("Escreva um título com pelo menos 2 letras.");
              return;
            }
            if (kind === "recurring" && recurrence === "weekly" && weekdays.length === 0) {
              setError("Escolha ao menos um dia da semana.");
              return;
            }
            void repo.addReminder({
              title: title.trim(),
              dueDate: kind === "once" ? dueDate : undefined,
              dueTime: dueTime || undefined,
              priority,
              kind,
              recurrence: kind === "recurring" ? recurrence : undefined,
              weekdays: kind === "recurring" && recurrence === "weekly" ? weekdays : undefined,
            });
            setTitle("");
            setError(null);
            onClose();
          }}
        >
          Salvar lembrete
        </Btn>
      </div>
    </Sheet>
  );
}
