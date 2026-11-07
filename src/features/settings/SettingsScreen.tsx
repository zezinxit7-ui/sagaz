/** Configurações: perfil, IA, bloqueio por PIN, memória e backup. */

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, KeyRound, Upload } from "lucide-react";
import { Btn, EmptyState, Field, Sheet, TopBar } from "@/components/ui";
import {
  clearAllData,
  clearPin,
  exportBackup,
  getProfile,
  hasPin,
  importBackup,
  setPin as setPinProfile,
  updateProfile,
} from "@/data/profile";
import type { Profile } from "@/data/db";
import { addMemory, deactivateMemory, listMemories } from "@/data/chat";
import { OFFICIAL_DEFAULT, resolveAI } from "@/services/ai/config";

export function SettingsScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const profile = useLiveQuery(() => getProfile());
  const ai = useLiveQuery(() => resolveAI());

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar variant="sub" title="Configurações" onMenu={onOpenDrawer} />
      <div className="flex-1 space-y-4 px-3 py-4 pb-safe">
        <section className="card p-3">
          <h2 className="mb-2 text-sm font-semibold">Perfil</h2>
          <Btn
            variant="secondary"
            className="w-full"
            onClick={async () => {
              const current = await getProfile();
              const name = window.prompt("Como o Sagaz deve te chamar?", current.name);
              if (name && name.trim().length >= 2) {
                await updateProfile({ name: name.trim() });
              }
            }}
          >
            Nome: {profile?.name ?? "…"}
          </Btn>
          <p className="mt-2 text-xs text-muted">
            Sem cadastro em nuvem na v1 — os dados vivem neste dispositivo.
          </p>
        </section>

        <section className="card p-3">
          <h2 className="mb-1 text-sm font-semibold">IA</h2>
          <p className="mb-2 text-xs text-muted">
            Provedor compatível com API de chat completions (OpenAI, Groq, Gemini-compatível ou servidor local).{" "}
            Status:{" "}
            <strong>{ai?.source === "none" ? "não configurado" : ai?.source === "env" ? "por variáveis de ambiente" : "configurado"}</strong>.
          </p>
          <p className="text-xs text-muted">Modelo sugerido: {OFFICIAL_DEFAULT.model} (ou equivalente no seu provedor).</p>
          <OpenAISheet />
        </section>

        <section className="card p-3">
          <h2 className="mb-2 text-sm font-semibold">Memória do assistente</h2>
          <MemoriesEditor />
        </section>

        <section className="card p-3">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <KeyRound size={15} /> Bloqueio por PIN
          </h2>
          <PinEditor />
        </section>

        <section className="card p-3">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">Backup</h2>
          <p className="mb-2 text-xs text-muted">
            Exporta TODOS os dados (incluindo chat) em JSON. Guarde em local seguro; o arquivo fica sem criptografia.
          </p>
          <div className="flex gap-2">
            <Btn
              variant="secondary"
              className="flex-1"
              onClick={async () => {
                const bak = await exportBackup();
                const blob = new Blob([JSON.stringify(bak, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `sagaz-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={15} /> Exportar
            </Btn>
            <ImportBackupButton />
          </div>
            <Btn
              variant="ghost"
              className="mt-2 w-full text-danger"
              onClick={async () => {
                if (window.confirm("Apagar transações, lembretes, hábitos, metas e chat? Isso não volta.")) {
                  await clearAllData();
                  window.location.reload();
                }
              }}
            >
              Apagar dados
            </Btn>
        </section>

        <p className="pb-4 text-center text-xs text-muted">
          Sagaz v1 · seus dados, suas regras.
        </p>
      </div>
    </div>
  );
}

function OpenAISheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn className="mt-2" variant="secondary" onClick={() => setOpen(true)}>
        Configurar provedor
      </Btn>
      <AISheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AISheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useLiveQuery(() => getProfile());
  const cfg = profile?.aiConfig;
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBaseUrl(cfg?.baseUrl ?? OFFICIAL_DEFAULT.baseUrl);
      setApiKey(cfg?.apiKey ?? "");
      setModel(cfg?.model ?? OFFICIAL_DEFAULT.model);
    }
  }, [open, cfg?.baseUrl, cfg?.apiKey, cfg?.model]);

  return (
    <Sheet open={open} onClose={onClose} title="Configurar IA">
      <div className="space-y-3">
        <Field
          placeholder="URL base (https://api.openai.com/v1)"
          aria-label="URL base"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <Field
          type="password"
          placeholder="chave de API (fica só no seu aparelho)"
          aria-label="Chave de API"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <Field
          placeholder="modelo (ex.: gpt-4o-mini)"
          aria-label="Modelo"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <p className="text-xs text-muted">
          A chave fica só no seu aparelho e trafega direto para o provedor que você configurar — nada passa por servidores proprietários do Sagaz.
        </p>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex gap-2">
          <Btn
            className="flex-1"
            onClick={() => {
              if (!/^https:\/\/.+/.test(baseUrl)) {
                setError("Use uma URL https.");
                return;
              }
              const clean: Profile["aiConfig"] = apiKey.trim()
                ? { baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() }
                : undefined;
              void updateProfile({ aiConfig: clean });
              onClose();
            }}
          >
            Salvar
          </Btn>
          {cfg?.apiKey ? (
            <Btn
              variant="secondary"
              className="flex-1"
              onClick={() => {
                void updateProfile({ aiConfig: undefined });
                onClose();
              }}
            >
              Remover
            </Btn>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

function PinEditor() {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const present = useLiveQuery(() => hasPin());

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Field
          className="flex-1 num"
          inputMode="numeric"
          type="password"
          maxLength={8}
          placeholder="4 a 8 dígitos"
          aria-label="Novo PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <Btn
          onClick={async () => {
            if (pin.length < 4) {
              setMsg("Mínimo de 4 dígitos.");
              return;
            }
            await setPinProfile(pin);
            setPin("");
            setMsg("PIN definido.");
          }}
        >
          Definir
        </Btn>
      </div>
      {present ? (
        <Btn
          variant="ghost"
          className="text-danger"
          onClick={async () => {
            await clearPin();
            setMsg("PIN removido.");
          }}
        >
          Remover PIN
        </Btn>
      ) : null}
      {msg ? <p className="text-xs text-muted">{msg}</p> : null}
    </div>
  );
}

function MemoriesEditor() {
  const memories = useLiveQuery(() => listMemories(false), []) ?? [];
  const [text, setText] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Field
          className="flex-1"
          placeholder="ex.: sou vegetariano · pago cartão no dia 5"
          aria-label="Nova memória"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Btn
          onClick={() => {
            if (text.trim().length >= 3) {
              void addMemory(text.trim());
              setText("");
            }
          }}
        >
          +
        </Btn>
      </div>
      {memories.length === 0 ? (
        <EmptyState
          icon={<KeyRound size={18} />}
          title="Sem memórias"
          hint="Fatos fixos que o Sagaz levará em conta nas respostas."
        />
      ) : (
        <ul className="divide-y divide-line">
          {memories.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2">
              <span className={`min-w-0 flex-1 text-sm ${m.active ? "" : "text-muted line-through"}`}>
                {m.content}
              </span>
              {m.active ? (
                <button
                  className="text-xs text-muted hover:text-danger"
                  onClick={() => void deactivateMemory(m.id)}
                  aria-label="Esquecer memória"
                >
                  esquecer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ImportBackupButton() {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            await verifyBackupAndImport(text);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Falha ao importar.");
          }
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <Btn
        variant="secondary"
        className="flex-1"
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={15} /> Importar
      </Btn>
    </>
  );
}

async function verifyBackupAndImport(text: string): Promise<void> {
  const parsed = JSON.parse(text) as { format?: string };
  if (parsed.format !== "sagaz-backup") {
    throw new Error("Arquivo não é um backup do Sagaz.");
  }
  if (window.confirm("Importar e SUBSTITUIR todos os dados atuais?")) {
    const data = JSON.parse(text);
    await importBackup(data, true);
    window.location.reload();
  }
}
