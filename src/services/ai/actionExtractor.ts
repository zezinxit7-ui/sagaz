/**
 * actionExtractor: mensagem do usuário → ActionProposal[] (ou pergunta).
 * Contrato: o LLM devolve SOMENTE JSON; inválido → rejeita e cai no parser
 * local. O app nunca aplica direto — o usuário confirma item por item.
 */

import { complete, extractJSON, AIUnavailableError } from "./client";
import { parseActionsLocal } from "./localParser";
import { validateProposal, type ActionProposal } from "@/domain/actions";
import type { Category, Memory, Message } from "@/data/db";

export interface ExtractInput {
  text: string;
  conversationId: string;
  today: string;
  categories: Array<Pick<Category, "id" | "name" | "kind" | "contextId">>;
  memories: Memory[];
  history: Array<Pick<Message, "role" | "body">>;
}

const SYSTEM = (inp: ExtractInput): string => `Você é o Sagaz, assistente pessoal de finanças e rotina em português do Brasil. Hoje é ${inp.today} (data local do usuário, formato AAAA-MM-DD).

Sua resposta SEMPRE é um único objeto JSON, sem texto fora dele.

Esquema:
{
  "kind": "extract" | "question",
  "reply": "string (casa 'question': resposta objetiva; casa 'extract': frase curta confirmando o que entendeu)",
  "actions": [
    {
      "type": "expense" | "income" | "reminder",
      "amountCents": número inteiro em centavos (35,50 → 3550),
      "date": "AAAA-MM-DD" (obrigatório p/ expense/income; ausente = hoje),
      "title": "string (lembrete; sempre presente)",
      "dueDate": "AAAA-MM-DD",
      "dueTime": "HH:MM (opcional)",
      "recurrence": "daily" | "weekly" | "monthly" (opcional),
      "weekdays": [0-6] (obrigatório se weekly; 0=domingo),
      "note": "descrição curta sem o valor (opcional)",
      "categoryName": "nome EXATO de uma categoria listada, quandoouver match claro",
      "context": "personal" | "business" (opcional; default personal)
    }
  ]
}

Regras inegociáveis:
- Se a mensagem contém uma pergunta com números (quanto gastei, quanto sobrou), use "question" e responda APENAS se os dados estiverem no CONTEXTO abaixo; sem dado = responda "Não tenho esse registro."
- NÃO invente valores, datas ou categorias. Sem valor claro em gasto/receita, use "question" pedindo o valor.
- Uma mensagem pode ter várias ações (ex.: "gastei 30 no almoço e me lembra da luz amanhã" → 1 expense + 1 reminder).
- Dígitos por extenso ("trinta e cinco") também viram valores.
- categoryName só as listadas; senão omita.`;

const userBlock = (inp: ExtractInput): string =>
  [
    inp.memories.length > 0
      ? `MEMÓRIAS do usuário: ${inp.memories.map((m) => m.content).join(" | ")}`
      : "",
    inp.categories.length > 0
      ? `CATEGORIAS (despesa): ${inp.categories
          .filter((c) => c.kind === "expense")
          .map((c) => c.name + (c.contextId ? "*" : ""))
          .join(", ")}; (receita): ${inp.categories
          .filter((c) => c.kind === "income")
          .map((c) => c.name + (c.contextId ? "*" : ""))
          .join(", ")} (* = categoria de negócio)`
      : "",
    inp.history.length > 0
      ? `CONVERSA RECENTE:\n${inp.history
          .slice(-6)
          .map((m) => `${m.role === "user" ? "Usuário" : "Sagaz"}: ${m.body}`)
          .join("\n")}`
      : "",
    `MENSAGEM: ${inp.text}`,
  ]
    .filter(Boolean)
    .join("\n\n");

export type ExtractResult =
  | { kind: "actions"; proposals: ActionProposal[]; reply: string; source: "ai" }
  | { kind: "question"; reply: string; source: "ai" }
  | { kind: "actionsLocal"; proposals: ActionProposal[]; reply: string; source: "local" };

export async function extractActions(inp: ExtractInput): Promise<ExtractResult> {
  try {
    const raw = await complete(
      [
        { role: "system", content: SYSTEM(inp) },
        { role: "user", content: userBlock(inp) },
      ],
      { forceJson: true },
    );
    const data = extractJSON(raw) as {
      kind?: string;
      reply?: string;
      actions?: unknown[];
    };

    if (data.kind === "question") {
      return { kind: "question", reply: data.reply ?? "", source: "ai" };
    }

    const proposals: ActionProposal[] = [];
    const list = Array.isArray(data.actions) ? data.actions : [];
    for (const [i, a] of list.entries()) {
      const a0 = a as Record<string, unknown>;
      const type = a0.type;
      const base = {
        actionId: `act_${inp.conversationId}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        note: typeof a0.note === "string" ? a0.note : undefined,
        contextKind: a0.context === "business" ? "business" : a0.context === "personal" ? "personal" : undefined,
        rawText: inp.text,
      } as const;
      if (type === "expense" || type === "income") {
        proposals.push({
          ...base,
          actionId: base.actionId,
          kind: type,
          amountCents: typeof a0.amountCents === "number" ? Math.round(a0.amountCents) : undefined,
          date: typeof a0.date === "string" ? a0.date : undefined,
          categoryId: matchCategory(String(a0.categoryName ?? ""), inp.categories),
        });
      } else if (type === "reminder") {
        const rec = a0.recurrence;
        proposals.push({
          ...base,
          kind: "reminder",
          title: typeof a0.title === "string" ? a0.title : "",
          dueDate: typeof a0.dueDate === "string"
            ? a0.dueDate
            : typeof a0.date === "string"
              ? a0.date
              : undefined,
          dueTime: typeof a0.dueTime === "string" ? a0.dueTime : undefined,
          recurrence: rec === "daily" || rec === "weekly" || rec === "monthly" ? rec : undefined,
          weekdays: Array.isArray(a0.weekdays)
            ? a0.weekdays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6).sort()
            : undefined,
        });
      }
    }

    if (proposals.length === 0) {
      return { kind: "question", reply: data.reply ?? "", source: "ai" };
    }
    // valida uma a uma (propostas inválidas são descartadas, não aplicadas)
    const valid: ActionProposal[] = proposals
      .map((p) => validateProposal(p))
      .filter((v) => v.ok)
      .map((v) => v.proposal);
    return { kind: "actions", proposals: valid, reply: data.reply ?? "", source: "ai" };
  } catch (e) {
    if (e instanceof AIUnavailableError) {
      const local = await parseActionsLocal(inp.text, inp.conversationId);
      if (local.length > 0) {
        return {
          kind: "actionsLocal",
          proposals: local as ActionProposal[],
          reply: "Problemas com a IA: usei a extração simplificada local — confirme os itens abaixo.",
          source: "local",
        };
      }
      throw e;
    }
    throw e;
  }
}

function matchCategory(
  name: string,
  categories: Array<Pick<Category, "id" | "name" | "kind" | "contextId">>,
): string | undefined {
  if (!name) return undefined;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const target = norm(name);
  return categories.find((c) => norm(c.name) === target)?.id;
}
