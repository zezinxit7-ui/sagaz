/**
 * summarizer: resumo semanal — números calculados localmente, texto da IA
 * quando disponível (senão frase montada por regras, sempre verdadeira).
 * Tony envia aos domingos; o Sagaz deixa o usuário abrir quando quiser.
 */

import { AIUnavailableError, complete } from "./client";
import { resolveAI } from "./config";
import { monthTotals, upcomingCharges } from "@/data/finance";
import { stats as reminderStats } from "@/data/reminders";
import { listMemories } from "@/data/chat";
import { formatMoney } from "@/domain/money";
import { addDays, formatDayShort, todayLocal } from "@/domain/dates";

export interface SummaryReport {
  rangeStart: string;
  rangeEnd: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  remindersPending: number;
  remindersOverdue: number;
  subscriptionsUpcoming: Array<{ name: string; date: string; cents: number }>;
  text: string;
  source: "local" | "ai";
}

/** Semana fechada: últimos 7 dias incluindo hoje. */
export async function weeklyReport(contextId: string): Promise<SummaryReport> {
  const today = todayLocal();
  const start = addDays(today, -6);
  // totals do mês corrente (proxy honesto v1: o corte diário detalhado fica no relatório)
  const [totals, rem, subs, memories] = await Promise.all([
    monthTotals(contextId, today.slice(0, 7)),
    reminderStats(),
    upcomingCharges(14),
    listMemories(),
  ]);

  const base: SummaryReport = {
    rangeStart: start,
    rangeEnd: today,
    incomeCents: totals.incomeCents,
    expenseCents: totals.expenseCents,
    balanceCents: totals.balanceCents,
    remindersPending: rem.pending,
    remindersOverdue: rem.overdue,
    subscriptionsUpcoming: subs
      .slice(0, 5)
      .map((s) => ({ name: s.name, date: s.nextChargeDate, cents: s.amountCents })),
    text: "",
    source: "local",
  };

  base.text = localText(base, memories.map((m) => m.content));
  const { config } = await resolveAI();
  if (config) {
    try {
      const reply = await complete(
        [
          {
            role: "system",
            content:
              "Você é o Sagaz. Escreva um resumo SEMANAL de até 6 frases em português do Brasil, tom direto e gentil, com os números REAIS do CONTEXTO. Não invente nenhum dado que não esteja lá; nenhuma recomendação baseada em dado ausente.",
          },
          { role: "user", content: `CONTEXTO:\n${facts(base, memories.map((m) => m.content))}\n\nEscreva o resumo.` },
        ],
        { maxTokens: 350 },
      );
      base.text = reply.trim();
      base.source = "ai";
    } catch (e) {
      if (!(e instanceof AIUnavailableError)) throw e;
    }
  }
  return base;
}

function facts(r: SummaryReport, memories: string[]): string {
  const subs = r.subscriptionsUpcoming
    .map((s) => `- ${s.name}: ${formatMoney(s.cents)} em ${formatDayShort(s.date)}`)
    .join("\n");
  return [
    `Período: ${formatDayShort(r.rangeStart)} a ${formatDayShort(r.rangeEnd)} (${r.rangeStart}).`,
    `Receitas do mês atual: ${formatMoney(r.incomeCents)}.`,
    `Despesas do mês atual: ${formatMoney(r.expenseCents)}.`,
    `Saldo: ${formatMoney(r.balanceCents)}.`,
    `Lembretes pendentes: ${r.remindersPending} (atrasados: ${r.remindersOverdue}).`,
    subs ? `Próximas cobranças:\n${subs}` : "Sem cobranças nos próximos 14 dias.",
    memories.length ? `Memórias do usuário: ${memories.slice(0, 5).join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function localText(r: SummaryReport, memories: string[]): string {
  const parts: string[] = [];
  parts.push(
    r.expenseCents === 0 && r.incomeCents === 0
      ? "Sem movimentos financeiros no mês até agora."
      : `No mês: ${formatMoney(r.incomeCents)} de entradas, ${formatMoney(r.expenseCents)} de saídas, saldo ${formatMoney(r.balanceCents)}.`,
  );
  if (r.remindersOverdue > 0) parts.push(`${r.remindersOverdue} lembrete(s) atrasado(s) aguardando você.`);
  else if (r.remindersPending > 0) parts.push(`${r.remindersPending} lembrete(s) pendente(s).`);
  if (r.subscriptionsUpcoming.length > 0) {
    parts.push(
      `Próxima cobrança: ${r.subscriptionsUpcoming[0]!.name} (${formatMoney(r.subscriptionsUpcoming[0]!.cents)}) em ${formatDayShort(r.subscriptionsUpcoming[0]!.date)}.`,
    );
  }
  if (memories.length > 0) parts.push(`Estou levando em conta suas memórias: ${memories.slice(0, 3).join(" • ")}.`);
  return parts.join(" ");
}
