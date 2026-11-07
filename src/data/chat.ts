/** Repositório do chat: conversas, mensagens (com fila offline) e memória. */

import type { ChatAction, Conversation, Memory, Message } from "./db";
import { db, newId } from "./db";

export async function createConversation(): Promise<Conversation> {
  const c: Conversation = { id: newId("conv"), startedAt: new Date().toISOString() };
  await db.conversations.add(c);
  return c;
}

export async function latestConversation(): Promise<Conversation | undefined> {
  return db.conversations.orderBy("startedAt").reverse().first();
}

export async function currentConversation(): Promise<Conversation> {
  return (await latestConversation()) ?? (await createConversation());
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  return db.messages.where("conversationId").equals(conversationId).toArray();
}

export async function addMessage(
  input: Omit<Message, "id" | "createdAt">,
): Promise<Message> {
  const m: Message = {
    ...input,
    id: newId("msg"),
    createdAt: new Date().toISOString(),
  };
  if (input.status === "queued") {
    await db.messages.add(m);
    return m;
  }
  await db.messages.add(m);
  return m;
}

/** Fila offline: mensagens do usuário "queued" de todas as conversas. */
export async function queuedMessages(): Promise<Message[]> {
  return db.messages.filter((m) => m.status === "queued" && m.role === "user").toArray();
}

export async function setMessageStatus(
  id: string,
  status: Message["status"],
): Promise<Message | undefined> {
  await db.messages.update(id, { status });
  return db.messages.get(id);
}

/** Confirmações de cartão de ação persistidas (recarregar a página mantém estado). */
export async function setCardActionStatus(
  messageId: string,
  index: number,
  status: ChatAction["status"],
  error?: string,
): Promise<void> {
  const m = await db.messages.get(messageId);
  if (!m?.actions?.[index]) return;
  const actions = [...m.actions];
  actions[index] = { ...actions[index]!, status, error };
  await db.messages.update(messageId, { actions });
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await db.conversations.update(id, { title });
}

// ── Memória (direito ao esquecimento) ────────────────────────────────────

export async function listMemories(activeOnly = true): Promise<Memory[]> {
  const all = await db.memories.orderBy("createdAt").toArray();
  return activeOnly ? all.filter((m) => m.active) : all;
}

export async function addMemory(content: string): Promise<Memory> {
  const m: Memory = {
    id: newId("mem"),
    content: content.trim().slice(0, 500),
    active: true,
    createdAt: new Date().toISOString(),
  };
  await db.memories.add(m);
  return m;
}

export async function deactivateMemory(id: string): Promise<void> {
  await db.memories.update(id, { active: false });
}

export async function deleteMemory(id: string): Promise<void> {
  await db.memories.delete(id);
}
