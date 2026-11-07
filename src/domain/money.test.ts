import { describe, expect, it } from "vitest";
import { extractMoneyCents, formatMoney, parseNumberWords, normalizeNumericToken } from "./money";

describe("formatMoney", () => {
  const norm = (s: string) => s.replace(/\u00a0/g, " ");
  it("formata centavos em BRL", () => {
    expect(norm(formatMoney(3550))).toBe("R$ 35,50");
    expect(norm(formatMoney(0))).toBe("R$ 0,00");
  });
  it("mascara quando pedido", () => {
    expect(formatMoney(3550, true)).toBe("R$ ••••");
  });
});

describe("normalizeNumericToken", () => {
  it("pt-BR com milhar e decimal", () => {
    expect(normalizeNumericToken("1.234,56")).toBe(1234.56);
    expect(normalizeNumericToken("35,50")).toBe(35.5);
    expect(normalizeNumericToken("35")).toBe(35);
    expect(normalizeNumericToken("1.234")).toBe(1234);
  });
});

describe("parseNumberWords", () => {
  it("cardinais simples", () => {
    expect(parseNumberWords(["trinta", "e", "cinco"])).toBe(35);
    expect(parseNumberWords(["cem"])).toBe(100);
    expect(parseNumberWords(["mil", "e", "quinhentos"])).toBe(1500);
  });
  it("retorna null em lixo", () => {
    expect(parseNumberWords(["banana"])).toBeNull();
  });
});

describe("extractMoneyCents", () => {
  it("extrai valor digitado", () => {
    expect(extractMoneyCents("gastei 30 no almoço")?.amountCents).toBe(3000);
    expect(extractMoneyCents("gastei R$ 35,50 no mercado")?.amountCents).toBe(3550);
    expect(extractMoneyCents("recebi 1.200 reais")?.amountCents).toBe(120000);
  });
  it("extrai valor por extenso perto de moeda", () => {
    expect(extractMoneyCents("gastei trinta e cinco reais no almoço")?.amountCents).toBe(3500);
  });
  it("extrai centavos literais", () => {
    expect(extractMoneyCents("gastei 50 centavos")?.amountCents).toBe(50);
  });
  it("não inventa valor sem contexto monetário", () => {
    expect(extractMoneyCents("lavar carro")).toBeNull();
  });
});
