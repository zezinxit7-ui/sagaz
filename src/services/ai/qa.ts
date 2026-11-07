/**
 * qa: perguntas com números EXATOS do banco.
 * Dois caminhos: (1) sem IA → responde por regras os padrões clássicos;
 * (2) com IA → monta contexto com os números e pede frase natural.
 * A regra dos dados: sem registro = "não sei" — nunca chuto.
 */

import { AIUnavailableError, complete } from "./client";
import { resolveAI } from "./config";
import { monthTotals, subscriptionsMonthlyCents } from "@/data/finance";
import { stats } from "@/data/reminders";
import { formatMoney } from "@/domain/money";
import { formatMonthLabel } from "@/domain/dates";
import type { Profile } from "@/data/db";

export interface QAQuery {
  question: string;
  month: string; // YYYY-MM
  contextId: string;
  profile: Profile;
}

export interface QAAnswer {
  answer: string;
  question: string;
  source: "local" | "ai";
}

const KNOWN_PATTERNS: Array<{ re: RegExp; build: (q: QAQuery) => Promise<string | null> }> = [
  {
    // "quanto gastei" / "despesas do mês"
    re: /quanto gastei|total de gastos|gastos do m[êe]s|despesas do m[êe]s/i,
    build: async ({ month, contextId }) => {
      const t = await monthTotals(contextId, month);
      return t.expenseCents === 0
        ? `Não tenho registro de gastos em ${formatMonthLabel(month)}.`
        : `Você gastou ${formatMoney(t.expenseCents)} em ${formatMonthLabel(month)}.`;
    },
  },
  {
    re: /rece(\w+) do m[êe]s|total de rece(tas)?|entrada(s)? do m[êe]s|^recebi nesse m[êe]s|quanto recebi/i,
    build: async ({ month, contextId }) => {
      const t = await monthTotals(contextId, month);
      return t.incomeCents === 0
        ? `Nenhum registro de receitas em ${formatMonthLabel(month)}.`
        : `Suas receitas de ${formatMonthLabel(month)} somam ${formatMoney(t.incomeCents)}.`;
    },
  },
  {
    re: /sobra|balanço|sald[o]/i,
    build: async ({ month, contextId }) => {
      const t = await monthTotals(contextId, month);
      if (t.incomeCents === 0 && t.expenseCents === 0)
        return `Não tenho registros em ${formatMonthLabel(month)}.`;
      const verb = t.balanceCents >= 0 ? "Sobra" : "Faltou";
      return `${verb} ${formatMoney(Math.abs(t.balanceCents))} em ${formatMonthLabel(month)}.`;
    },
  },
  {
    re: /assinaturas?|mensalidade de servi\w+/i,
    build: async ({ contextId }) => {
      const cents = await subscriptionsMonthlyCents(contextId);
      return cents === 0
        ? "Não encontrei assinaturas cadastradas."
        : `Sua base de assinaturas custa ${formatMoney(cents)} por mês.`;
    },
  },
];

export async function answer(q: QAQuery): Promise<QAAnswer> {
  // 1) sem IA configurada: regras cobrem as perguntas usuais
  const { config } = await resolveAI();
  const isQuestiony = /quanto|qual|total|sobra|gasto|recebi|assina/i.test(q.question);

  if (!config) {
    for (const p of KNOWN_PATTERNS) {
      if (p.re.test(q.question)) {
        const a = await p.build(q);
        if (a) return { answer: a, question: q.question, source: "local" };
      }
    }
    return {
      answer: isQuestiony
        ? "Configure uma IA em Configurações para perguntas em linguagem livre — por enquanto, os números do painel têm exatamente esses totais."
        : "Não entendi a pergunta. Tente algo como “quanto gastei este mês?”.",
      question: q.question,
      source: "local",
    };
  }

  // 2) IA: contexto com NÚMEROS EXATOS já calculados
  const [totals, subs] = await Promise.all([
    monthTotals(q.contextId, q.month),
    subscriptionsMonthlyCents(q.contextId),
  ]);
  const rem = await stats();
  const facts = [
    `Mes em foco: ${formatMonthLabel(q.month)}.`,
    `Receitas registradas: ${totals.incomeCents / 100} (BRL).`,
    `Despesas registradas: ${totals.expenseCents / 100} (BRL).`,
    `Saldo: ${totals.balanceCents / 100} (BRL).`,
    `Assinaturas mensais: ${subs / 100} (BRL).`,
    `Lembretes pendentes: ${rem.pending} (hoje: ${rem.today}, atrasados: ${rem.overdue}).`,
  ].join("\n");

  const reply = await complete(
    [
      {
        role: "system",
        content:
          'Você é o Sagaz. Responda em português do Brasil, curto, usando APENAS os números do CONTEXTO. Não invente números que não estejam lá. Dado ausente = "Não tenho esse registro."',
      },
      { role: "user", content: `CONTEXTO (dados calculados localmente):\n${facts}\n\nPERGUNTA: ${q.question}` },
    ],
    { maxTokens: 220 },
  ).catch((e) => {
    if (e instanceof AIUnavailableError) return null;
    throw e;
  });

  if (reply === null) {
    // IA sumiu de rede? degrada para regras
    for (const p of KNOWN_PATTERNS) {
      if (p.re.test(q.question)) {
        const a = await p.build(q);
        if (a) return { answer: a, question: q.question, source: "local" };
      }
    }
    return { answer: "IA indisponível agora. Tente mais tarde ou confira o painel.", question: q.question, source: "local" };
  }
  return { answer: reply.trim(), question: q.question, source: "ai" };
}
