/** Perfil local: nome, PIN de bloqueio, configuração de IA, backup. */

import type { Profile } from "./db";
import { db } from "./db";

export async function getProfile(): Promise<Profile> {
  const p = await db.profiles.get("local");
  if (!p) {
    const fresh: Profile = {
      id: "local",
      name: "Você",
      theme: "dark",
      weeklySummaryOn: true,
    };
    await db.profiles.put(fresh);
    return fresh;
  }
  return p;
}

export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  await db.profiles.update("local", patch);
}

export async function setAIConfig(cfg: Profile["aiConfig"]): Promise<void> {
  await updateProfile({ aiConfig: cfg });
}

// ── PIN (hash simples: SHA-256 de salt+pin, sem lib externa) ─────────────

interface PinRecord {
  salt: string;
  hash: string;
}

function b64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return b64(digest);
}

function encodeRecord(rec: PinRecord): string {
  return `${rec.salt}:${rec.hash}`;
}

function decodeRecord(value?: string): PinRecord | null {
  if (!value) return null;
  const [salt, hash] = value.split(":");
  if (!salt || !hash) return null;
  return { salt, hash };
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN precisa de 4 a 8 dígitos");
  const salt = Math.random().toString(36).slice(2, 12);
  const hash = await sha256(`${salt}|sagaz|${pin}`);
  await updateProfile({ pinHash: encodeRecord({ salt, hash }) });
}

export async function clearPin(): Promise<void> {
  await updateProfile({ pinHash: undefined });
}

export async function hasPin(): Promise<boolean> {
  const p = await getProfile();
  return Boolean(p.pinHash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const p = await getProfile();
  const rec = decodeRecord(p.pinHash);
  if (!rec) return false;
  const hash = await sha256(`${rec.salt}|sagaz|${pin}`);
  return hash === rec.hash;
}

// ── Backup (export/import JSON pelo usuário) ─────────────────────────────

export interface BackupFile {
  format: "sagaz-backup";
  version: 1;
  exportedAt: string;
  tables: {
    contexts: unknown[];
    categories: unknown[];
    transactions: unknown[];
    budgets: unknown[];
    subscriptions: unknown[];
    goals: unknown[];
    goalSteps: unknown[];
    reminders: unknown[];
    habits: unknown[];
    habitLogs: unknown[];
    conversations: unknown[];
    messages: unknown[];
    memories: unknown[];
    profiles: unknown[];
  };
}

const BACKUP_TABLES = [
  "contexts",
  "categories",
  "transactions",
  "budgets",
  "subscriptions",
  "goals",
  "goalSteps",
  "reminders",
  "habits",
  "habitLogs",
  "conversations",
  "messages",
  "memories",
  "profiles",
] as const;

export async function exportBackup(): Promise<BackupFile> {
  const tables: BackupFile["tables"] = {} as BackupFile["tables"];
  for (const name of BACKUP_TABLES) {
    tables[name] = await db.table(name).toArray();
  }
  return {
    format: "sagaz-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/**
 * Importa backup (opção: substituir tudo). A chave de IA do perfil atual
 * é preservada quando o arquivo não traz perfil.
 */
export async function importBackup(
  file: BackupFile,
  replace = true,
): Promise<{ imported: number }> {
  if (file?.format !== "sagaz-backup" || file.version !== 1) {
    throw new Error("arquivo de backup inválido");
  }
  let imported = 0;
  await db.transaction("rw", db.tables, async () => {
    if (replace) {
      for (const name of BACKUP_TABLES) await db.table(name).clear();
    }
    for (const name of BACKUP_TABLES) {
      const rows = file.tables[name];
      if (!Array.isArray(rows)) continue;
      // replace=true limpa antes; replace=false faz upsert (bulkPut)
      await db.table(name).bulkPut(rows);
      imported += rows.length;
    }
    // garante perfil consistente: sem perfil no arquivo → devolve o "Você" default
    if (!file.tables.profiles?.length) {
      await db.profiles.put(await getProfile());
    }
  });
  return { imported };
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    db.tables,
    async () => {
      for (const name of BACKUP_TABLES) {
        if (name === "contexts") continue; // sementes ficam
        if (name === "categories") continue;
        await db.table(name).clear();
      }
      const profile = await getProfile();
      await db.profiles.put({ ...profile, pinHash: undefined, aiConfig: profile.aiConfig });
    },
  );
}
