/**
 * Datas do Sagaz: os "dias" são datas locais no formato YYYY-MM-DD.
 * Nunca troque por ISO-UTC em consultas mensais — é o dia do dispositivo.
 */

export interface ParsedDateHint {
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  recurrence?: RecurringKind;
  weekdays?: number[]; // 0 domingo … 6 sábado
}

export type RecurringKind = "none" | "daily" | "weekly" | "monthly";

const WEEKDAY_TOKENS: Array<{ re: RegExp; weekday: number }> = [
  { re: /dom(ingo)?/, weekday: 0 },
  { re: /seg(unda)?/, weekday: 1 },
  { re: /ter(ça|ca)/, weekday: 2 },
  { re: /qua(rta)/, weekday: 3 },
  { re: /qui(nta)/, weekday: 4 },
  { re: /sex(ta)/, weekday: 5 },
  { re: /sab(ado|ádo)/, weekday: 6 },
];

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const WEEKDAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

export function toLocalISOString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal(): string {
  return toLocalISOString(new Date());
}

export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(s: string, n: number): string {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + n);
  return toLocalISOString(d);
}

export function dayDiff(a: string, b: string): number {
  return Math.round(
    (parseLocalDate(a).getTime() - parseLocalDate(b).getTime()) / 86_400_000,
  );
}

export function weekdayOf(s: string): number {
  return parseLocalDate(s).getDay();
}

export function startOfMonth(month: string): string {
  return `${month}-01`;
}

export function endOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return toLocalISOString(new Date(y!, m!, 0));
}

export function monthKeyOf(s: string): string {
  return s.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(month: string): string {
  const [, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]!} ${month.slice(0, 4)}`;
}

export function formatDayShort(s: string): string {
  const d = parseLocalDate(s);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTH_NAMES[d.getMonth()]!.slice(0, 3).toLowerCase()}.`;
}

export function dayLabel(s: string): string {
  const today = todayLocal();
  if (s === today) return "Hoje";
  if (s === addDays(today, -1)) return "Ontem";
  if (s === addDays(today, 1)) return "Amanhã";
  const d = parseLocalDate(s);
  return `${WEEKDAY_FULL[d.getDay()]!}, ${String(d.getDate()).padStart(2, "0")} de ${MONTH_NAMES[d.getMonth()]!.toLowerCase()}`;
}

export const WEEKDAY_FULL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** Lista dos dias do mês para a grade do calendário (6 semanas x 7, começa domingo). */
export function monthGrid(month: string): Array<{ date: string; inMonth: boolean }> {
  const first = startOfMonth(month);
  const offset = weekdayOf(first);
  const gridStart = addDays(first, -offset);
  const out: Array<{ date: string; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    out.push({ date, inMonth: monthKeyOf(date) === month });
  }
  return out;
}

function parseTimeToken(raw: string): string | null {
  const clean = raw.replace(/[h:]/, "h").trim();
  const m = /^(\d{1,2})(?:h(\d{1,2})(?:min)?)?$/.exec(clean);
  if (!m) return null;
  const h = Number(m[1]);
  if (h < 0 || h > 23) return null;
  const min = m[2] ? Number(m[2]) : 0;
  if (min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Extrai pistas de data/tempo/recorrência de texto natural pt-BR.
 * Não inventa: se não reconhece, volta vazio.
 */
export function extractDateHint(text: string): ParsedDateHint {
  const lower = ` ${text.toLowerCase()} `;
  const hint: ParsedDateHint = {};

  // recorrência
  if (/\btodos? os dias\b|\bd todo dia\b|\bdiariamente\b|\bdiário\b/.test(lower)) {
    hint.recurrence = "daily";
  }
  if (/\btod(o|a)s? os? (meses|mês)\b|\bmensalmente\b|\btodo mês\b/.test(lower)) {
    hint.recurrence = "monthly";
  }

  // "lembra da luz amanhã às 2 da tarde"
  if (/amanhã|amanha/.test(lower)) hint.date = addDays(todayLocal(), 1);
  else if (/depois de amanhã|depois de amanha/.test(lower)) hint.date = addDays(todayLocal(), 2);
  else if (/\bhoje\b/.test(lower)) hint.date = todayLocal();

  // dia explícito: "dia 5", "dia 15 do mês que vem"
  const diaMatch = /\bdia\s+(\d{1,2})\b(.*?)(m[êe]s que vem|mês que vem|proximo mes|próximo mês)?/.exec(lower);
  if (!hint.date && diaMatch) {
    const day = Number(diaMatch[1]);
    let month = monthKeyOf(todayLocal());
    if (diaMatch[3]) month = addMonths(month, 1);
    const candidate = `${month}-${String(day).padStart(2, "0")}`;
    if (day >= 1 && day <= 31) {
      if (diaRefnc(candidate)) hint.date = candidate;
      else if (!diaMatch[3]) hint.date = candidate;
    }
  }

  // "5/06" ou "05/06/2026"
  if (!hint.date) {
    const slash = /\b(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?\b/.exec(lower);
    if (slash) {
      const day = Number(slash[1])!;
      const month = Number(slash[2])!;
      let year = slash[4] ? Number(slash[4]) : Number(monthKeyOf(todayLocal()).slice(0, 4));
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        hint.date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // dias da semana (possivelmente vários): "toda terça e quinta"
  if (!hint.recurrence) {
    const weekdays: number[] = [];
    const saysEvery = /\btod[oa]s?\b/.test(lower);
    for (const { re, weekday } of WEEKDAY_TOKENS) {
      const dayRe = new RegExp(`\\b${re.source}\\b`);
      if (dayRe.test(lower)) weekdays.push(weekday);
    }
    if (weekdays.length > 1 || (saysEvery && weekdays.length === 1)) {
      hint.recurrence = "weekly";
      hint.weekdays = [...new Set(weekdays)].sort();
      hint.date = undefined;
    } else if (weekdays.length === 1 && !/\b(que vem|proximo|próximo)\b/.test(lower)) {
      // "sabado" → dia fixo mais próximo
      const weekday = weekdays[0]!;
      const today = todayLocal();
      const delta = (weekday - weekdayOf(today) + 7) % 7 || 7;
      hint.date = addDays(today, delta);
    }
  }

  // hora: "às 14h", "as 9:30", "14h30", "às 2 da tarde"
  const timeMatch = /(?:as|às|@)\s*(\d{1,2})(?:h(\d{1,2})?|:(\d{2}))?/.exec(lower);
  if (!timeMatch) {
    const bare = /\b(\d{1,2})h(\d{1,2})?min?\b/.exec(lower);
    if (bare) {
      const t = parseTimeToken(`${bare[1]}h${bare[2] ?? "00"}`);
      if (t) hint.time = t;
    }
  } else {
    const raw = `${timeMatch[1]!}h${timeMatch[2] ?? timeMatch[3] ?? "00"}`;
    let t = parseTimeToken(raw);
    if (t &&/hv/.test(t) === false) {
      const H = Number(t.slice(0, 2))!;
      if (/da tarde|da noite/.test(lower) && H < 12) {
        t = `${String(H + 12).padStart(2, "0")}:${t.slice(3)}`;
      } else if (/da manhã|da manha|da matina/.test(lower) && H >= 12) {
        t = `${String(H - 12).padStart(2, "0")}:${t.slice(3)}`;
      }
    }
    if (t) hint.time = t;
  }
  // "meio-dia"/"meia-noite"
  if (!hint.time) {
    if (/meio[- ]dia/.test(lower)) hint.time = "12:00";
    else if (/meia[- ]noite/.test(lower)) hint.time = "00:00";
  }
  return hint;
}

function diaRefnc(candidate: string): boolean {
  // valida se o dia existe no mês ref.so de validação local
  const [y, m, d] = candidate.split("-").map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return (d ?? 1) <= last;
}
