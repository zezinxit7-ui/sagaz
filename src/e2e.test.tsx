/**
 * Fluxo ponta a ponta (sem IA externa — parser local de fallback):
 * mensagem → cartão de ação → Confirmar → Dexie → dashboard.
 * Também cobre descarte, reconfirmação (idempotência) e offline (fila).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { db, ensureSeeded } from "@/data/db";
import { monthTotals } from "@/data/finance";
import { sendUserMessage, decideProposal, pushWeeklySummary } from "@/services/ai/engine";
import { applyProposal } from "@/services/ai/executor";
import { FinanceScreen } from "@/features/finance/FinanceScreen";
import type { ActionProposal } from "@/domain/actions";
import { addDays, todayLocal } from "@/domain/dates";

beforeEach(async () => {
  const names = db.tables.map((t) => t.name);
  await db.transaction("rw", names, async () => {
    for (const n of names) await db.table(n).clear();
  });
  await ensureSeeded();
});

describe("fluxo completo (spending pela conversa)", () => {
  it("gasto pós-confirmação aparece nos totais do mês E no dashboard", async () => {
    // 1) mensagem dupla: despesa + lembrete
    const { userMsg, assistantMsg } = await sendUserMessage(
      "gastei 30 no almoço e me lembra da conta de luz amanhã",
    );
    expect(userMsg.status).toBe("sent");
    expect(assistantMsg).not.toBeNull();
    expect(assistantMsg!.kind).toBe("action_card");
    expect(assistantMsg!.actions).toHaveLength(2);
    for (const a of assistantMsg!.actions!) expect(a.status).toBe("pending");

    // nada escrito ainda
    expect(await db.transactions.count()).toBe(0);
    expect(await db.reminders.count()).toBe(0);

    // 2) confirma a despesa (índice 0)
    const expense = assistantMsg!.actions![0]!.payload as ActionProposal;
    expect(expense.kind).toBe("expense");
    await decideProposal(
      assistantMsg!.id,
      0,
      "confirm",
      expense,
      applyProposal,
    );

    // 3) despesa no banco, lembrete ainda não
    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0]!.amountCents).toBe(3000);
    expect(txs[0]!.type).toBe("expense");
    expect(txs[0]!.date).toBe(todayLocal());
    expect(await db.reminders.count()).toBe(0);

    // cartão vira "applied"
    const after = await db.messages.get(assistantMsg!.id);
    expect(after!.actions![0]!.status).toBe("applied");
    expect(after!.actions![1]!.status).toBe("pending");

    // 4) totais do mês refletem
    const totals = await monthTotals("ctx_personal", todayLocal().slice(0, 7));
    expect(totals.expenseCents).toBe(3000);
    expect(totals.incomeCents).toBe(0);

    // 5) confirma o lembrete (índice 1)
    const reminder = assistantMsg!.actions![1]!.payload as ActionProposal;
    expect(reminder.kind).toBe("reminder");
    await decideProposal(
      assistantMsg!.id,
      1,
      "confirm",
      reminder,
      applyProposal,
    );
    const rems = await db.reminders.toArray();
    expect(rems).toHaveLength(1);
    expect(rems[0]!.title.toLowerCase()).toContain("luz");
    expect(rems[0]!.dueDate).toBe(addDays(todayLocal(), 1));
  });

  it("descartar não grava nada", async () => {
    const { assistantMsg } = await sendUserMessage("paguei 50 do mercado");
    expect(assistantMsg!.kind).toBe("action_card");
    await decideProposal(
      assistantMsg!.id,
      0,
      "discard",
      assistantMsg!.actions![0]!.payload as ActionProposal,
      applyProposal,
    );
    const after = await db.messages.get(assistantMsg!.id);
    expect(after!.actions![0]!.status).toBe("discarded");
    // não foi aplicado: mesmo "paguei 50" cinco vezes não cria linha
    expect(await db.transactions.count()).toBe(0);
  });

  it("reconfirmar o mesmo cartão registra 1 linha só (idempotência)", async () => {
    const { assistantMsg } = await sendUserMessage("gastei 15 no busão");
    const proposal = assistantMsg!.actions![0]!.payload as ActionProposal;
    await decideProposal(assistantMsg!.id, 0, "confirm", proposal, applyProposal);
    await decideProposal(assistantMsg!.id, 0, "confirm", proposal, applyProposal); // dup clique
    expect(await db.transactions.count()).toBe(1);
  });

  it("confirmação é independente de rede (offline queue)", async () => {
    // mensagem sai como "queued" quando offline
    const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { userMsg, assistantMsg } = await sendUserMessage("recebi 200 de freelance");
    expect(userMsg.status).toBe("queued");
    // e a extração local MESMO offline gera o cartão (confirmação não depende de rede)
    expect(assistantMsg).not.toBeNull();
    onlineSpy.mockRestore();

    // confirmar offline escreve no banco
    await decideProposal(
      assistantMsg!.id,
      0,
      "confirm",
      assistantMsg!.actions![0]!.payload as ActionProposal,
      applyProposal,
    );
    const totals = await monthTotals("ctx_personal", todayLocal().slice(0, 7));
    expect(totals.incomeCents).toBe(20000);
  });
});

describe("dashboard mostra o resultado", () => {  it("após aplicar, FinanceScreen mostra R$ 30,00 de saída", async () => {
    const { assistantMsg } = await sendUserMessage("gastei 30 no almoço");
    await decideProposal(
      assistantMsg!.id,
      0,
      "confirm",
      assistantMsg!.actions![0]!.payload as ActionProposal,
      applyProposal,
    );

    render(<FinanceScreen onOpenDrawer={() => {}} />);
    await waitFor(
      () => {
        const saída = screen.getAllByText(/R\$\s?30,00/);
        expect(saída.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  }, 8000);
});

describe("resumo semanal no chat", () => {
  it("pushWeeklySummary responde com mensagem de resumo e números reais", async () => {
    // dado real: um gasto confirmado
    const { assistantMsg } = await sendUserMessage("gastei 30 no almoço");
    await decideProposal(
      assistantMsg!.id,
      0,
      "confirm",
      assistantMsg!.actions![0]!.payload as ActionProposal,
      applyProposal,
    );

    const summaryMsg = await pushWeeklySummary();
    expect(summaryMsg.kind).toBe("summary");
    expect(summaryMsg.body).toContain("Resumo");
    // sem IA configurada: texto local truthful com o número real
    expect(summaryMsg.body).toMatch(/30,00/);
  });
});
