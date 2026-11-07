/**
 * Dinheiro no Sagaz: sempre centavos inteiros. Nada de float em valores.
 * Parser aceita números ("35", "1.234,56", "R$ 35,50") e cardinais em
 * português ("trinta e cinco reais", "mil e quinhentos").
 */

const UNITS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  dezanove: 19,
};

const TENS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
};

/** Converte cardinais por extenso (até 999.999) em número. null se inválido. */
export function parseNumberWords(words: string[]): number | null {
  const tokens = words.map((w) => w.toLowerCase().trim()).filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  let group = 0;
  let sawWord = false;

  for (const tok of tokens) {
    if (/^(e|com)$/i.test(tok)) continue;
    if (tok === "mil") {
      if (group === 0) group = 1;
      total += group * 1000;
      group = 0;
      sawWord = true;
      continue;
    }
    const unit = UNITS[tok];
    if (unit !== undefined) {
      group += unit;
      sawWord = true;
      continue;
    }
    const ten = TENS[tok];
    if (ten !== undefined) {
      group += ten;
      sawWord = true;
      continue;
    }
    const hundred = HUNDREDS[tok];
    if (hundred !== undefined) {
      // "cem" só vale sozinho; "cento" implica continuar (101..199)
      if (hundred === 100 && group > 0) return null;
      group += hundred;
      sawWord = true;
      continue;
    }
    // palavra desconhecida = não é só número
    if (sawWord) return null;
    return null;
  }
  if (!sawWord) return null;
  return total + group;
}

/** Normaliza um trecho numérico com separadores pt-BR (e tolera en-US). */
export function normalizeNumericToken(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // pt-BR: último separador é vírgula decimal, ponto é milhar
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    return Number(normalized);
  }
  if (hasComma) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1]!.length <= 2) {
      // vírgula decimal: "35,5"
      return Number(cleaned.replace(",", "."));
    }
    // múltiplas vírgulas: tratar como milhar
    return Number(cleaned.replace(/,/g, ""));
  }
  if (hasDot) {
    const parts = cleaned.split(".");
    const last = parts[parts.length - 1]!;
    if (parts.length === 2 && last.length <= 2) {
      return Number(cleaned); // decimal simples: "35.5" → 35.5
    }
    if (parts.length > 2 || (last.length === 3 && cleaned.length > 4)) {
      // "1.234" ou "1.234.567": milhar
      return Number(cleaned.replace(/\./g, ""));
    }
    return Number(cleaned);
  }
  return Number(cleaned);
}

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export interface MoneyParseResult {
  amountCents: number;
  matchedText: string;
}

/**
 * Encontra o primeiro valor monetário em um texto natural pt-BR.
 * Retorna null quando não há valor claro — nunca inventa um valor.
 */
export function extractMoneyCents(text: string): MoneyParseResult | null {
  const lower = text.toLowerCase();

  // 1) números com dígitos
  const numeric = /(?:(?:r\$|rs)\s*)?\d[\d.,]*\s*(?:reais?|centavos)?/i.exec(lower);
  if (numeric) {
    const value = normalizeNumericToken(numeric[0]);
    if (value !== null && !Number.isNaN(value) && value > 0) {
      let cents = toCents(value);
      if (/centavos?/i.test(numeric[0])) {
        // "50 centavos" → literal, não 50,00
        cents = Math.round(value);
      }
      return {
        amountCents: cents,
        matchedText: text.slice(numeric.index, numeric.index + numeric[0].length),
      };
    }
  }

  // 2) números por extenso: exigir palavra monetária na vizinhança
  const moneyNear = (word: string, textWords: string[], idx: number): boolean =>
    /^reais?$|^r\$$|^rs$|gast|paguei|recebi|passei|cust/.test(word) ||
    textWords
      .slice(Math.max(0, idx - 3), idx + 4)
      .some((w) => /^reais?$|^r\$$|^rs$/.test(w) || /^(gast|paguei|recebi|passei)/.test(w));

  const lowerWords = lower.split(/\s+/);
  const regexWord = /^[\wà-úÀ-Ú]+$/;
  for (let start = 0; start < lowerWords.length; start++) {
    if (!regexWord.test(lowerWords[start]!)) continue;
    for (let len = Math.min(6, lowerWords.length - start); len >= 1; len--) {
      const slice = lowerWords.slice(start, start + len);
      const value = parseNumberWords(slice);
      if (value !== null && value > 0) {
        // palavra da ponta precisa estar perto de contexto monetário
        const head = moneyNear(slice[0]!, lowerWords, start);
        if (head) {
          return {
            amountCents: toCents(value),
            matchedText: slice.join(" "),
          };
        }
      }
    }
  }
  return null;
}

export function formatMoney(cents: number, mask = false): string {
  if (mask) return "R$ ••••";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
}

export function formatMoneyShort(cents: number, mask = false): string {
  if (mask) return "•••";
  const sign = cents < 0 ? "−" : "+";
  const abs = Math.abs(cents);
  if (abs % 100 === 0) {
    return `${sign}R$ ${Intl.NumberFormat("pt-BR").format(abs / 100)}`;
  }
  return `${sign}R$ ${Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs / 100)}`;
}
