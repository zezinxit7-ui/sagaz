/**
 * Notificações locais proativas — sem backend:
 * - lembretes únicos: no dueDate/dueTime (ou 09:00 se sem hora);
 * - recorrentes: próxima ocorrência calculada;
 * - assinaturas: 2 dias antes da cobrança (09:00).
 * Web/pwa: silenciosamente sem efeito (não native → nada agendado).
 */

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { db } from "@/data/db";
import { listSubscriptions } from "@/data/finance";
import { advanceOne, occurrencesBetween } from "@/domain/recurrence";
import { addDays, parseLocalDate, todayLocal } from "@/domain/dates";

interface ScheduleItem {
  id: number; // id numérico estável
  title: string;
  body: string;
  when: Date;
}

/** hash estável p/ icar id numérico de notificação */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 1_000_000_000;
}

function atFor(date: string, time?: string): Date {
  const d = parseLocalDate(date);
  const [h, m] = (time ?? "09:00").split(":").map(Number);
  const at = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    h ?? 9,
    m ?? 0,
    0,
    0,
  );
  return at;
}

async function collectSchedule(): Promise<ScheduleItem[]> {
  const out: ScheduleItem[] = [];
  const now = Date.now();
  const today = todayLocal();

  // lembretes
  const reminders = await db.reminders.where("status").equals("pending").toArray();
  for (const r of reminders) {
    if (r.kind === "once" && r.dueDate) {
      const at = atFor(r.dueDate, r.dueTime);
      if (at.getTime() > now) {
        out.push({
          id: hashCode(`rem:${r.id}`),
          title: `Lembrete: ${r.title}`,
          body: r.dueTime ? `Hoje às ${r.dueTime}` : "Vence hoje",
          when: at,
        });
      }
    } else if (r.kind === "recurring") {
      let next: string | undefined;
      if (r.recurrence === "weekly" && r.weekdays?.length) {
        const days = occurrencesBetween(
          today,
          "weekly",
          r.weekdays,
          today,
          addDays(today, 14),
        ).filter((d) => !(r.exceptionDates ?? []).includes(d));
        next = days.find((d) => d > today) ?? days[0];
      } else if (r.recurrence === "daily") {
        const t = atFor(today, r.dueTime);
        next = t.getTime() > now ? today : addDays(today, 1);
      } else if (r.recurrence === "monthly") {
        next = r.baseDate <= today ? advanceOne(today, "monthly") : r.baseDate;
      }
      if (next) {
        const at = atFor(next, r.dueTime);
        if (at.getTime() > now) {
          out.push({
            id: hashCode(`remc:${r.id}`),
            title: `Lembrete: ${r.title}`,
            body: "Está chegando a hora",
            when: at,
          });
        }
      }
    }
  }

  // assinaturas: 2 dias antes da cobrança
  const subs = await listSubscriptions();
  for (const s of subs) {
    const warnDate = addDays(s.nextChargeDate, -Math.min(2, s.remindBeforeDays || 2));
    const at = atFor(warnDate, "09:00");
    if (s.nextChargeDate >= today && at.getTime() > now) {
      out.push({
        id: hashCode(`sub:${s.id}`),
        title: `Assinatura: ${s.name}`,
        body: `Cobrança em ${s.nextChargeDate.slice(8)}/${s.nextChargeDate.slice(5, 7)}`,
        when: at,
      });
    }
  }
  return out.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 24);
}

export async function scheduleAll(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return 0;
  } catch {
    return 0;
  }
  const items = await collectSchedule();
  // cancela agendados antigos e agenda de novo (idempotente no conjunto atual)
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }
  } catch {
    // sem problema: cancel não é obrigatório
  }
  if (items.length === 0) return 0;
  await LocalNotifications.schedule({
    notifications: items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      schedule: {
        at: n.when,
        allowWhileIdle: true,
      },
      channelId: "sagaz-reminders",
    })),
  });
  return items.length;
}

/** cria o canal de notificações (Android 8+) */
export async function ensureChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: "sagaz-reminders",
      name: "Lembretes e assinaturas",
      description: "Lembretes do Sagaz e avisos de cobrança",
      importance: 4, // DEFAULT_VISIBLE
      visibility: 0,
      lights: true,
      lightColor: "#8b7bff",
      vibration: true,
    });
  } catch {
    // canal já existe
  }
}
