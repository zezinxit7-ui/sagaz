/** Cliente LLM — chamada única a /chat/completions, modo JSON estrito suave. */

import { chatCompletionsUrl, resolveAI } from "./config";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export class AIClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AIClientError";
  }
}

/**
 * Envia as mensagens e devolve o texto bruto do modelo.
 * Sem chave configurada → AIUnavailableError (o chamador usa o parser local).
 */
export async function complete(
  messages: ChatMsg[],
  opts?: { signal?: AbortSignal; forceJson?: boolean; maxTokens?: number },
): Promise<string> {
  const { config } = await resolveAI();
  if (!config) {
    throw new AIUnavailableError(
      "IA não configurada: informe provedor e chave em Configurações.",
    );
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: opts?.maxTokens ?? 900,
    temperature: 0.3,
  };
  if (opts?.forceJson) {
    body.response_format = { type: "json_object" };
  }

  let res: Response;
  try {
    res = await fetch(chatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });
  } catch (e) {
    // AbortError propaga como está (o chat trata cancelamento)
    throw new AIUnavailableError(
      `Falha de rede ao falar com a IA: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (!res.ok) {
    const snippet = await res.text().catch(() => "");
    throw new AIClientError(
      `O provedor respondeu ${res.status}. ${snippet.slice(0, 300)}`,
      res.status,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new AIClientError("Resposta do provedor sem conteúdo textual", 502);
  }
  return text;
}

/**
 * Parse JSON "tolerante": modelos às vezes cercam o JSON com ```json … ```
 * ou texto. Extrai o primeiro objeto JSON válido.
 */
export function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];

  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fence) candidates.push(fence[1]!.trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // próxima tentativa
    }
  }
  throw new AIClientError("IA respondeu algo que não é JSON estruturado", 502);
}
