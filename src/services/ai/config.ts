/**
 * Config de IA: ambiente (`VITE_AI_*`) tem prioridade sobre o perfil local?
 * Não — ao contrário: o que o usuário definiu na tela vence; env é o default.
 * Nunca logamos a chave.
 */

import { getProfile } from "@/data/profile";

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface EffectiveAI {
  config?: AIConfig;
  source: "settings" | "env" | "none";
}

const ENV_BASE_URL = import.meta.env.VITE_AI_BASE_URL as string | undefined;
const ENV_API_KEY = import.meta.env.VITE_AI_API_KEY as string | undefined;
const ENV_MODEL = import.meta.env.VITE_AI_MODEL as string | undefined;

/** Default público compatível (o usuário pode trocar por Groq/Gemini/local). */
export const OFFICIAL_DEFAULT: AIConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};

export async function resolveAI(): Promise<EffectiveAI> {
  const profile = await getProfile();
  const cfg = profile.aiConfig;
  if (cfg?.apiKey && cfg.baseUrl && cfg.model) {
    return { config: { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model }, source: "settings" };
  }
  if (ENV_API_KEY && ENV_BASE_URL && ENV_MODEL) {
    return { config: { baseUrl: ENV_BASE_URL, apiKey: ENV_API_KEY, model: ENV_MODEL }, source: "env" };
  }
  return { config: undefined, source: "none" };
}

/** Endpoint completo de chat completions. */
export function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}
