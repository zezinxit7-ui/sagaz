/**
 * App shell: roteador por estado (sem react-router — 6 telas), bloqueio
 * por PIN e drawer de navegação (S03).
 */

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Banknote,
  CalendarCheck,
  ListChecks,
  MessageCircle,
  Settings as SettingsIcon,
  Target,
} from "lucide-react";
import { Drawer, DrawerCaption, DrawerItem } from "@/components/ui";
import { getProfile, hasPin, verifyPin } from "@/data/profile";
import { db } from "@/data/db";
import { ChatScreen } from "@/features/chat/ChatScreen";
import { FinanceScreen } from "@/features/finance/FinanceScreen";
import { RemindersScreen } from "@/features/productivity/RemindersScreen";
import { HabitsScreen } from "@/features/productivity/HabitsScreen";
import { GoalsScreen } from "@/features/productivity/GoalsScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";

export type Route =
  | "chat"
  | "finance"
  | "reminders"
  | "habits"
  | "goals"
  | "settings";

export function App() {
  const [route, setRoute] = useState<Route>("chat");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [locked, setLocked] = useState<boolean | null>(null);

  const profile = useLiveQuery(() => getProfile());

  // bloqueio: ao montar, se houver PIN → trava
  useEffect(() => {
    if (locked === null) {
      hasPin().then((has) => setLocked(has)).catch(() => setLocked(false));
    }
  }, []);
  useEffect(() => {
    if (locked === false) return;
    // novo PIN definido com app aberto → refletir no próximo início apenas
  }, [profile?.pinHash]);

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col">
        <CurrentRoute route={route} onOpenDrawer={() => setDrawerOpen(true)} />
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <DrawerContent
          route={route}
          onNavigate={(r) => {
            setRoute(r);
            setDrawerOpen(false);
          }}
          profileName={profile?.name ?? "Você"}
        />
      </Drawer>
    </div>
  );
}

function CurrentRoute({
  route,
  onOpenDrawer,
}: {
  route: Route;
  onOpenDrawer: () => void;
}) {
  switch (route) {
    case "chat":
      return <ChatScreen onOpenDrawer={onOpenDrawer} />;
    case "finance":
      return <FinanceScreen onOpenDrawer={onOpenDrawer} />;
    case "reminders":
      return <RemindersScreen onOpenDrawer={onOpenDrawer} />;
    case "habits":
      return <HabitsScreen onOpenDrawer={onOpenDrawer} />;
    case "goals":
      return <GoalsScreen onOpenDrawer={onOpenDrawer} />;
    case "settings":
      return <SettingsScreen onOpenDrawer={onOpenDrawer} />;
  }
}

// ── Drawer content ───────────────────────────────────────────────────────

function DrawerContent({
  route,
  onNavigate,
  profileName,
}: {
  route: Route;
  onNavigate: (r: Route) => void;
  profileName: string;
}) {
  const initials = profileName
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent"
          aria-hidden
        >
          {initials || "V"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{profileName}</p>
          <button
            className="text-sm text-accent"
            onClick={() => onNavigate("settings")}
          >
            Conta ›
          </button>
        </div>
      </div>

      <div className="p-2">
        <DrawerItem
          icon={<MessageCircle size={18} />}
          label="Falar com Sagaz"
          active={route === "chat"}
          onClick={() => onNavigate("chat")}
        />
        <DrawerCaption>Produtividade</DrawerCaption>
        <DrawerItem
          icon={<CalendarCheck size={18} />}
          label="Lembretes"
          active={route === "reminders"}
          onClick={() => onNavigate("reminders")}
        />
        <DrawerItem
          icon={<ListChecks size={18} />}
          label="Hábitos"
          active={route === "habits"}
          onClick={() => onNavigate("habits")}
        />
        <DrawerCaption>Vida</DrawerCaption>
        <DrawerItem
          icon={<Banknote size={18} />}
          label="Finanças"
          active={route === "finance"}
          onClick={() => onNavigate("finance")}
        />
        <DrawerItem
          icon={<Target size={18} />}
          label="Metas"
          active={route === "goals"}
          onClick={() => onNavigate("goals")}
        />
      </div>

      <div className="mt-auto p-2 pb-safe">
        <DrawerItem
          icon={<SettingsIcon size={18} />}
          label="Configurações"
          active={route === "settings"}
          onClick={() => onNavigate("settings")}
        />
      </div>
    </div>
  );
}

// ── LockScreen ───────────────────────────────────────────────────────────

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const ok = await verifyPin(pin);
    if (ok) onUnlock();
    else {
      setError("PIN incorreto.");
      setPin("");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg p-6">
      <LockGlyph />
      <h1 className="text-lg">Sagaz está bloqueado</h1>
      <form
        className="w-full max-w-[280px]"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          autoFocus
          className="field num text-center text-xl tracking-[0.5em]"
          inputMode="numeric"
          type="password"
          maxLength={8}
          placeholder={`••••`}
          aria-label="PIN"
          value={pin}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            setPin(digits);
            setError(null);
          }}
        />
        {error ? <p className="mt-2 text-center text-sm text-danger">{error}</p> : null}
        <button className="btn btn-primary mt-4 w-full" type="submit">
          Desbloquear
        </button>
      </form>
      <p className="text-xs text-muted">Seus dados ficam apenas neste dispositivo.</p>
    </div>
  );
}

function LockGlyph() {
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface shadow-card"
      aria-hidden
    >
      <svg width="30" height="30" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="10" fill="#0b0c0f" />
        <path
          d="M15 30c3 3 8 4 11 1.8 2.6-1.9 1.6-4.9-1.6-6L20 24.4c-3.5-1.3-4.6-4.3-2.4-6.5C20.2 15.3 25.4 15.4 29 18"
          fill="none"
          stroke="#8b7bff"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/** re-export p/ features precisarem de profile occacionalmente */
export { db as appDb };
