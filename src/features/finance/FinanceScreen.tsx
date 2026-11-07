/** Finanças (S07/S08): dashboard dual-ledger + transações + relatório. */

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import {
  Btn,
  EmptyState,
  Field,
  FilterChips,
  MonthPager,
  Sheet,
  TopBar,
} from "@/components/ui";
import {
  BUSINESS_CONTEXT_ID,
  PERSONAL_CONTEXT_ID,
  db,
} from "@/data/db";
import {
  addManual,
  addSubscription,
  categoryTotals,
  dailyExpenseSeries,
  deleteSubscription,
  getBudget,
  listByMonth,
  monthTotals,
  setBudgetTotal,
  subscriptionsMonthlyCents,
  upcomingCharges,
} from "@/data/finance";
import { getProfile, updateProfile } from "@/data/profile";
import { formatMoney } from "@/domain/money";
import { MONTH_NAMES, formatDayShort, endOfMonth, todayLocal } from "@/domain/dates";

type Tab = "hoje" | "relatorio" | "assinaturas";

export function FinanceScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [month, setMonth] = useState(() => todayLocal().slice(0, 7));
  const [tab, setTab] = useState<Tab>("hoje");

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        variant="module"
        title="Finanças"
        onMenu={onOpenDrawer}
      />
      <div className="flex-1 pb-safe">
        <div className="px-3">
          <MonthPager month={month} onChange={setMonth} />
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <TabBtn active={tab === "hoje"} onClick={() => setTab("hoje")}>
              Painel
            </TabBtn>
            <TabBtn active={tab === "relatorio"} onClick={() => setTab("relatorio")}>
              <BarChart3 size={14} /> Relatório
            </TabBtn>
            <TabBtn
              active={tab === "assinaturas"}
              onClick={() => setTab("assinaturas")}
            >
              Assinaturas
            </TabBtn>
          </div>
        </div>
        {tab === "hoje" ? <PanelTab month={month} /> : null}
        {tab === "relatorio" ? <ReportTab month={month} /> : null}
        {tab === "assinaturas" ? <SubscriptionsTab month={month} /> : null}
      </div>
    </div>
  );
}

function TabBtn({
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
      className={`chip whitespace-nowrap ${active ? "chip-selected" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ── Painel (dual ledger) ─────────────────────────────────────────────────

function PanelTab({ month }: { month: string }) {
  const profile = useLiveQuery(() => getProfile());
  const masked = Boolean(profile?.privacyMasked);

  const toggleMask = () => {
    void updateProfile({ privacyMasked: !masked });
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 pt-1">
        <p className="text-sm text-muted">
          {MONTH_NAMES[Number(month.slice(5, 7)) - 1]!}
        </p>
        <button
          className="flex items-center gap-1 text-xs text-muted"
          aria-pressed={masked}
          onClick={toggleMask}
        >
          {masked ? <Eye size={14} /> : <EyeOff size={14} />}
          {masked ? "mostrar" : "ocultar valores"}
        </button>
      </div>

      <ContextCard
        contextId={BUSINESS_CONTEXT_ID}
        title="Meu Negócio"
        month={month}
        masked={masked}
        accent="#4ade80"
      />
      <ContextCard
        contextId={PERSONAL_CONTEXT_ID}
        title="Pessoa Física"
        month={month}
        masked={masked}
        accent="#8b7bff"
      />
    </>
  );
}

function ContextCard({
  contextId,
  title,
  month,
  masked,
  accent,
}: {
  contextId: string;
  title: string;
  month: string;
  masked: boolean;
  accent: string;
}) {
  const totals = useLiveQuery(() => monthTotals(contextId, month), [contextId, month]);
  const spent = useLiveQuery(
    async () => {
      const [budget, t] = await Promise.all([getBudget(contextId, month), monthTotals(contextId, month)]);
      return { budget: budget?.totalCents ?? 0, expense: t.expenseCents };
    },
    [contextId, month],
  );
  const budgets = useLiveQuery(() => getBudget(contextId, month), [contextId, month]);

  const pct =
    spendBudgetComparator(spent?.budget ?? 0, spent?.expense ?? 0) !== undefined
      ? Math.min(
          100,
          Math.round(((spent?.expense ?? 0) / (spent?.budget || 1)) * 100),
        )
      : 0;

  return (
    <section className="px-3 py-2">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 text-sm">
          <span className="font-semibold" style={{ color: accent }}>
            {title}
          </span>
          <BudgetEditorButton contextId={contextId} month={month} total={budgets?.totalCents ?? 0} masked={masked} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-line text-center">
          <Metric label="Entradas" value={formatMoney(totals?.incomeCents ?? 0, masked)} tone="#4ade80" />
          <Metric label="Saídas" value={formatMoney(totals?.expenseCents ?? 0, masked)} tone="#ff6b6b" />
          <Metric
            label="Saldo"
            value={formatMoney(totals?.balanceCents ?? 0, masked)}
            tone={(totals?.balanceCents ?? 0) >= 0 ? undefined : "#ff6b6b"}
          />
        </div>
        {(budgets?.totalCents ?? 0) > 0 ? (
          <div className="px-4 pb-3 pt-2">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Orçamento do mês</span>
              <span className="num">
                {formatMoney(spent?.expense ?? 0, masked)} / {formatMoney(budgets?.totalCents ?? 0, masked)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${pct}%`, background: pct > 90 ? "#ff6b6b" : accent }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <TxList contextId={contextId} month={month} masked={masked} />
    </section>
  );
}

function spendBudgetComparator(b: number, e: number): number | undefined {
  // helper semântico p/ evitar divisão por zero duplicada
  return b > 0 ? e / b : undefined;
}

/** Botão que abre o editor de orçamento do contexto/mês. */
function BudgetEditorButton({
  contextId,
  month,
  total,
  masked,
}: {
  contextId: string;
  month: string;
  total: number;
  masked: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-xs text-muted" onClick={() => setOpen(true)}>
        Orçamento: {total ? formatMoney(total, masked) : "—"}
      </button>
      <BudgetSheet
        open={open}
        onClose={() => setOpen(false)}
        contextId={contextId}
        month={month}
      />
    </>
  );
}

function BudgetSheet({
  open,
  onClose,
  contextId,
  month,
}: {
  open: boolean;
  onClose: () => void;
  contextId: string;
  month: string;
}) {
  const existing = useLiveQuery(() => getBudget(contextId, month), [contextId, month, open]);
  const [value, setValue] = useState<string>("");
  const shown = value !== "" ? value : existing?.totalCents ? String(existing.totalCents / 100) : "";
  return (
    <Sheet open={open} onClose={onClose} title="Orçamento do mês">
      <div className="space-y-3">
        <Field
          inputMode="decimal"
          aria-label="Total do mês"
          placeholder="ex.: 1500,00"
          value={shown}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex gap-2">
          <Btn
            className="flex-1"
            onClick={() => {
              const cents = parseAmount(shown);
              void setBudgetTotal(contextId, month, cents ?? 0);
              setValue("");
              onClose();
            }}
          >
            Salvar
          </Btn>
          {existing ? (
            <Btn
              variant="secondary"
              className="flex-1"
              onClick={() => {
                void setBudgetTotal(contextId, month, 0);
                setValue("");
                onClose();
              }}
            >
              Remover
            </Btn>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-1 py-3">
      <p className="num text-lg" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function TxList({
  contextId,
  month,
  masked,
}: {
  contextId: string;
  month: string;
  masked: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const txs = useLiveQuery(() => listByMonth(contextId, month, filter), [contextId, month, filter]);
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div className="mt-2 flex items-center justify-between gap-2">
        <FilterChips
          options={[
            { value: "all", label: "Tudo" },
            { value: "income", label: "Receitas" },
            { value: "expense", label: "Despesas" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="flex gap-1">
          <button
            aria-label="Adicionar lançamento"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-on-accent"
            onClick={() => setEditing(true)}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {txs === undefined ? null : txs.length === 0 ? (
        <EmptyState
          icon={<ArrowDownLeft size={20} />}
          title="Sem lançamentos"
          hint="Diga no chat “gastei 20 no mercado” ou toque em +"
        />
      ) : (
        <ul className="divide-y divide-line">
          {txs.map((tx) => {
            const cat = catById.get(tx.categoryId);
            const isIncome = tx.type === "income";
            const dayLabel = formatDayShort(tx.date);
            return (
              <li key={tx.id} className="flex items-center gap-3 py-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
                  style={{ background: `${cat?.id ? "#4ade80" : "#8b7bff"}22`, color: cat?.id ? "#4ade80" : "#8b7bff" }}
                  aria-hidden
                >
                  {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{tx.note || cat?.name || "Sem categoria"}</p>
                  <p className="text-xs text-muted">
                    {cat?.name ?? ""} · {dayLabel} {tx.source === "chat" ? "· chat" : ""}
                  </p>
                </div>
                <span
                  className={`num text-sm ${isIncome ? "text-success" : "text-danger"}`}
                >
                  {isIncome ? "+" : "−"}
                  {formatMoney(tx.amountCents, masked)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <ManualSheet
        open={editing}
        onClose={() => setEditing(false)}
        defaultContextId={contextId}
      />
    </>
  );
}

// ── Formulário manual ────────────────────────────────────────────────────

function ManualSheet({
  open,
  onClose,
  defaultContextId,
}: {
  open: boolean;
  onClose: () => void;
  defaultContextId: string;
}) {
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [contextId, setContextId] = useState(defaultContextId);
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pool = cats.filter(
    (c) => c.kind === type && (!c.contextId || c.contextId === contextId),
  );

  const save = async () => {
    const cents = parseAmount(amount);
    if (!cents || cents <= 0) {
      setError("Informe o valor (ex.: 35,50).");
      return;
    }
    await addManual({
      contextId,
      type,
      amountCents: cents,
      categoryId: category || pool[0]?.id || "",
      date,
      note: note.trim() || undefined,
    });
    setError(null);
    setAmount("");
    setNote("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Novo lançamento">
      <div className="space-y-3">
        <FilterChips
          options={[
            { value: "expense", label: "Despesa" },
            { value: "income", label: "Receita" },
          ]}
          value={type}
          onChange={(v) => {
            setType(v);
            setCategory("");
          }}
        />
        <Field
          inputMode="decimal"
          placeholder="valor (ex.: 35,50)"
          aria-label="Valor"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Field
          placeholder="descrição (opcional)"
          aria-label="Descrição"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="field text-sm"
            aria-label="Contexto"
            value={contextId}
            onChange={(e) => setContextId(e.target.value)}
          >
            <option value={PERSONAL_CONTEXT_ID}>Pessoa Física</option>
            <option value={BUSINESS_CONTEXT_ID}>Meu Negócio</option>
          </select>
          <select
            className="field text-sm"
            aria-label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">— categoria —</option>
            {pool.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Field type="date" aria-label="Data" value={date} onChange={(e) => setDate(e.target.value)} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Btn className="w-full" onClick={() => void save()}>
          Salvar lançamento
        </Btn>
      </div>
    </Sheet>
  );
}

export function parseAmount(raw: string): number | null {
  const normalized = raw.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

// ── Relatório ────────────────────────────────────────────────────────────

function ReportTab({ month }: { month: string }) {
  const profile = useLiveQuery(() => getProfile());
  const masked = Boolean(profile?.privacyMasked);
  const series = useLiveQuery(() => dailyExpenseSeries(PERSONAL_CONTEXT_ID, month), [month]);
  const byCat = useLiveQuery(
    () => categoryTotals(PERSONAL_CONTEXT_ID, month, "expense"),
    [month],
  );
  const totals = useLiveQuery(() => monthTotals(PERSONAL_CONTEXT_ID, month), [month]);
  const totalExp = byCat?.reduce((a, e) => a + e.cents, 0) ?? 0;

  const maxDay = Math.max(1, ...(series?.map((s) => s.cents) ?? [1]));
  const top = byCat?.slice(0, 6) ?? [];

  return (
    <div className="space-y-4 px-3 py-3">
      <section>
        <h2 className="mb-2 text-sm font-semibold">Gastos por dia — {MONTH_NAMES[Number(month.slice(5, 7)) - 1]!}</h2>
        <div className="card flex h-36 items-end gap-[2px] overflow-x-auto p-3">
          {(series ?? []).map((s) => (
            <div key={s.day} className="flex h-full flex-1 flex-col items-center justify-end" title={`dia ${s.day}: ${formatMoney(s.cents, masked)}`}>
              <div
                className="w-full rounded-sm bg-accent/80"
                style={{ height: `${(s.cents / maxDay) * 100}%` }}
              />
              <span className="mt-1 text-[9px] text-muted">{s.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Por categoria</h2>
        {top.length === 0 ? (
          <p className="text-sm text-muted">Sem despesas neste mês.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {top.map(({ category, cents }) => (
              <li key={category.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
                <span className="num text-xs text-muted">
                  {Math.round((cents / (totalExp || 1)) * 100)}%
                </span>
                <span className="num">{formatMoney(cents, masked)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-muted">
        Fechamento do mês: {formatDayShort(month === todayLocal().slice(0, 7) ? todayLocal() : endOfMonth(month))}
        {totals?.expenseCents ? ` · total ${formatMoney(totals.expenseCents, masked)}` : ""}
      </p>
    </div>
  );
}

// ── Assinaturas ──────────────────────────────────────────────────────────

function SubscriptionsTab({ month: _month }: { month: string }) {
  const subs = useLiveQuery(() => upcomingCharges(60), []);
  const monthly = useLiveQuery(() => subscriptionsMonthlyCents(), []);
  const profile = useLiveQuery(() => getProfile());
  const masked = Boolean(profile?.privacyMasked);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3 px-3 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Mensal efetivo</p>
          <p className="num text-xl">{formatMoney(monthly ?? 0, masked)}</p>
        </div>
        <Btn onClick={() => setOpen(true)}>
          <Plus size={16} /> Nova
        </Btn>
      </div>

      {(subs ?? []).length === 0 ? (
        <EmptyState
          icon={<BarChart3 size={20} />}
          title="Nenhuma assinatura"
          hint="Registre Netflix, academia… e veja a data da próxima cobrança."
        />
      ) : (
        <ul className="card divide-y divide-line">
          {(subs ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.name}</p>
                <p className="text-xs text-muted">
                  próxima em {formatDayShort(s.nextChargeDate)} ·{" "}
                  {s.cycle === "monthly" ? "mensal" : "anual"}
                </p>
              </div>
              <span className="num text-sm">{formatMoney(s.amountCents, masked)}</span>
              <button
                className="text-xs text-danger"
                onClick={() => void deleteSubscription(s.id)}
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <SubSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function SubSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [next, setNext] = useState(todayLocal());
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Nova assinatura">
      <div className="space-y-3">
        <Field placeholder="nome (ex.: Spotify)" aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <Field inputMode="decimal" placeholder="valor" aria-label="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className="field text-sm" aria-label="Ciclo" value={cycle} onChange={(e) => setCycle(e.target.value as "monthly" | "yearly")}>
          <option value="monthly">Mensal</option>
          <option value="yearly">Anual</option>
        </select>
        <Field type="date" aria-label="Próxima cobrança" value={next} onChange={(e) => setNext(e.target.value)} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Btn
          className="w-full"
          onClick={() => {
            const cents = parseAmount(amount);
            if (!name.trim() || !cents) {
              setError("Informe nome e valor.");
              return;
            }
            void addSubscription({
              contextId: PERSONAL_CONTEXT_ID,
              name: name.trim(),
              amountCents: cents,
              cycle,
              nextChargeDate: next,
              remindBeforeDays: 2,
            });
            setName("");
            setAmount("");
            setError(null);
            onClose();
          }}
        >
          Salvar assinatura
        </Btn>
      </div>
    </Sheet>
  );
}
