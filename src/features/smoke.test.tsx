/** Smoke: cada tela renderiza sem quebrar (dados via fake-indexeddb). */

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { db, ensureSeeded } from "@/data/db";
import { App } from "@/app/App";
import { FinanceScreen } from "@/features/finance/FinanceScreen";
import { RemindersScreen } from "@/features/productivity/RemindersScreen";
import { HabitsScreen } from "@/features/productivity/HabitsScreen";
import { GoalsScreen } from "@/features/productivity/GoalsScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";

beforeEach(async () => {
  const names = db.tables.map((t) => t.name);
  await db.transaction("rw", names, async () => {
    for (const n of names) await db.table(n).clear();
  });
  await ensureSeeded();
});

describe("smoke de telas", () => {
  it("App abre no chat com estado vazio", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/o que registramos hoje/i)).toBeTruthy(), {
      timeout: 3000,
    });
  }, 8000);

  it("Finanças renderiza dual ledger", async () => {
    render(<FinanceScreen onOpenDrawer={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Meu Negócio")).toBeTruthy();
      expect(screen.getByText("Pessoa Física")).toBeTruthy();
    });
  });

  it("Lembretes renderiza segmentos", async () => {
    render(<RemindersScreen onOpenDrawer={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Únicos/i)).toBeTruthy());
  });

  it("Hábitos renderiza estado vazio", async () => {
    render(<HabitsScreen onOpenDrawer={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Comece um hábito/i)).toBeTruthy());
  });

  it("Metas renderiza estado vazio", async () => {
    render(<GoalsScreen onOpenDrawer={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Defina uma meta/i)).toBeTruthy());
  });

  it("Configurações renderiza seções", async () => {
    render(<SettingsScreen onOpenDrawer={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Bloqueio por PIN/i)).toBeTruthy());
  });
});
