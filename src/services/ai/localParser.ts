/**
 * Parser local — fallback sem IA: extração de intenção por regras em pt-BR.
 * Rotulado na UI como extração simples. MESMA saída de ActionProposal.
 */

import { extractMoneyCents } from "@/domain/money";
import { extractDateHint } from "@/domain/dates";
import { type ActionProposal, makeActionId } from "@/domain/actions";

const REMINDER_VERBS =
  /\b(me\s+lembra|lembra|lembrar|lembre|me\s+avisa|avisa|avisar|lembrete(s)?)\b/i;
/**
 * "conta/fatura/boleto" + data costuma ser lembrete de pagamento. Cascata
 * deliberada: "paguei a conta 30" é despesa; "lembra da conta da luz" é lembrete.
 */
const BILL_WORDS = /\b(conta|fatura|boleto|vencimento)\b/i;
const EXPENSE_VERBS = /\b(gastei|gaste|paguei|pago|comprei|comprar|gasto|custou)\b/i;
const INCOME_VERBS = /\b(recebi|receber|ganhei|ganho|vendi|vende(r)?|recebido)\b/i;

// mapeamento de categorias conhecidas por palavra (usado no parser e na UI)
const CATEGORY_HINTS: Array<{ re: RegExp; name: string }> = [
  { re: /\b(alm(o|ô)co|janta?r?|comida|lanche|pizza|mercado|padaria|restaurante)\b/i, name: "Alimentação" },
  { re: /\b(uber|99|ônibus|onibus|metrô|metro|gasolina|combustível|estacionamento)\b/i, name: "Transporte" },
  { re: /\b(luz|água|agua|internet|net|telefone|aluguel|condomínio|gas)\b/i, name: "Contas" },
  { re: /\b(netflix|spotify|amazon|prime|disney|hbo|max|assinatura)\b/i, name: "Assinaturas" },
  { re: /\b(farmácia|remédio|dentista|médico|consulta|exame)\b/i, name: "Saúde" },
  { re: /\b(curso|faculdade|livro|aula|mensalidade)\b/i, name: "Educação" },
  { re: /\b(cinema|jogo|game|bar|show|viagem)\b/i, name: "Lazer" },
];

export async function parseActionsLocal(
  text: string,
  conversationId: string,
): Promise<ActionProposal[]> {
  const proposals: ActionProposal[] = [];
  let index = 0;

  /**
   * Multi-ação: recorta a frase na cláusula do lembrete (último verbo de
   * lembrar). O que fica ANTES é transação; DEPOIS é lembrete. A data
   * "amanhã" não vaza do lembrete para o gasto (e vice-versa).
   */
  let splitAt = -1;
  const verbRe = /(?:me\s+)?(?:lembra(?:r)?|lembre|avisa(?:r)?|lembrete)/gi;
  let vm: RegExpExecArray | null;
  while ((vm = verbRe.exec(text)) !== null) splitAt = vm.index;
  const before = splitAt >= 0 ? text.slice(0, splitAt) : text;
  const after = splitAt >= 0 ? text.slice(splitAt) : "";

  const hintBefore = extractDateHint(before);
  const hintAfter = extractDateHint(after);
  const money = extractMoneyCents(text);

  const isExpense = money !== null && EXPENSE_VERBS.test(before);
  const isIncome = money !== null && INCOME_VERBS.test(before);
  const isReminder =
    REMINDER_VERBS.test(text) ||
    (BILL_WORDS.test(after) && Boolean(hintAfter.date || hintAfter.recurrence) && !isExpense);

  if (isExpense && money) {
    proposals.push({
      actionId: makeActionId(conversationId, index++),
      kind: "expense",
      transactionType: "expense",
      amountCents: money.amountCents,
      date: hintBefore.date,
      note: deriveNote(before, EXPENSE_VERBS) ?? undefined,
    });
  }

  if (isIncome && money) {
    proposals.push({
      actionId: makeActionId(conversationId, index++),
      kind: "income",
      transactionType: "income",
      amountCents: money.amountCents,
      date: hintBefore.date,
      note: deriveNote(before, INCOME_VERBS) ?? undefined,
    });
  }

  if (isReminder) {
    const title = reminderTitle(text);
    if (title) {
      proposals.push({
        actionId: makeActionId(conversationId, index++),
        kind: "reminder",
        title,
        dueDate: hintAfter.date,
        dueTime: hintAfter.time || hintBefore.time,
        recurrence:
          hintAfter.recurrence && hintAfter.recurrence !== "none"
            ? hintAfter.recurrence
            : hintBefore.recurrence !== "none" && hintBefore.recurrence
              ? hintBefore.recurrence
              : undefined,
        weekdays: hintAfter.weekdays ?? hintBefore.weekdays,
      });
    }
  }

  return proposals;
}

/** Nota: recorte curto após o verbo de gasto/receita. */
function deriveNote(text: string, verbs: RegExp): string | null {
  const m = verbs.exec(text);
  if (!m) return null;
  const after = text
    .slice(m.index + m[0].length)
    .replace(/^\s*(de|do|da|em|no|na|para|pro|com)\s+/i, "");
  // corta em conectores de data/classificação
  const cut = after.split(/\s+(?:no|na|amanh[ãa]|hoje|dia|às|as|em)\b/i)[0] ?? after;
  const cleaned = cut.replace(/\s*[,.!].*$/, "").trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 60) : null;
}

/** Título de lembrete: recorta o que vem após o último verbo de lembrar. */
function reminderTitle(text: string): string | null {
  const verbRe = /(?:me\s+)?(?:lembra(?:r)?|lembre|avisa(?:r)?)(?:\s+pra|\s+para|\s+de|\s+do|\s+da|\s+que|\s+em|\s+com)?\s*/gi;
  let last: { index: number; len: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = verbRe.exec(text)) !== null) {
    last = { index: m.index, len: m[0].length };
  }
  if (!last) return null;

  let t = text.slice(last.index + last.len);
  // recorta na primeira referência de data/hora
  t = t.split(/\s+(?:amanh[ãa]|hoje|depois de amanh[ãa]|dia\b|às|as\b|toda|todo|todos|todas|no dia)/i)[0] ?? t;
  t = t.replace(/^(?:de|do|da|pra|para|que|em|com)\s+/i, "").replace(/\s*[,.!].*$/, "").trim();
  if (t.length < 2 || t.length > 80) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Sugestão de categoria por palavras-chave (usada também pela UI). */
export function suggestCategoryName(text: string): string | null {
  for (const { re, name } of CATEGORY_HINTS) {
    if (re.test(text)) return name;
  }
  return null;
}
