import type { PlantWithStatus } from "./types";

export type DerivedStatus =
  | "Healthy"
  | "Needs water soon"
  | "Needs water now"
  | "Overwatered"
  | "Concern"
  | "Pest"
  | "Repot soon"
  | "Recovering"
  | "Unclear"
  | "New plant";

export interface PlantStatus {
  label: DerivedStatus;
  tone: "good" | "warn" | "bad" | "neutral";
  detail: string;        // short line for the dashboard card
  nextActionAt: Date | null;
}

// Default species-specific watering interval (days), used when the user hasn't
// set one and Grok hasn't suggested one yet. Tuned for typical indoor conditions.
const SPECIES_DEFAULTS: Record<string, number> = {
  "snake plant": 21,
  "sansevieria": 21,
  "zz plant": 21,
  "pothos": 7,
  "pothos (no drainage)": 9,
  "prayer plant": 5,
  "maranta": 5,
  "calathea": 5,
  "parlor palm": 7,
  "chamaedorea": 7,
  "monstera": 8,
  "fiddle leaf fig": 9,
  "succulent": 14,
  "cactus": 21,
};

export function defaultWaterInterval(
  species: string | null,
  drainage: boolean,
): number {
  const key = (species ?? "").trim().toLowerCase();
  let base = SPECIES_DEFAULTS[key];
  if (!base) {
    // crude partial match
    for (const k of Object.keys(SPECIES_DEFAULTS)) {
      if (key.includes(k)) {
        base = SPECIES_DEFAULTS[k];
        break;
      }
    }
  }
  if (!base) base = 7;
  // No drainage = water less often.
  if (!drainage) base = Math.round(base * 1.25);
  return base;
}

/**
 * Derive a plant's current status combining (a) the latest Grok advice and
 * (b) the local watering schedule. We trust Grok when it has spoken recently;
 * otherwise we fall back to "due to water in X days".
 *
 * `lastWateredAt` comes from the `plants_with_status` view's `last_watered_at`
 * column, or — for places that have the full log array — from
 * `logs.find(l => l.action_type === 'water')?.acted_at`.
 */
export function derivePlantStatus(
  plant: PlantWithStatus,
  lastWateredAt: string | null,
): PlantStatus {
  const interval =
    plant.watering_interval_days ??
    defaultWaterInterval(plant.species, plant.drainage);

  const nextWaterAt = lastWateredAt
    ? new Date(new Date(lastWateredAt).getTime() + interval * 86_400_000)
    : null;

  // 1. If we have recent Grok advice (< 5 days old), trust its status.
  const adviceAge = plant.latest_advice_at
    ? (Date.now() - new Date(plant.latest_advice_at).getTime()) / 86_400_000
    : Infinity;

  if (plant.latest_status && adviceAge < 5) {
    const label = plant.latest_status as DerivedStatus;
    const tone =
      label === "Healthy" || label === "Recovering"
        ? "good"
        : label === "Needs water soon"
        ? "warn"
        : label === "Unclear"
        ? "neutral"
        : "bad";
    return {
      label,
      tone,
      detail: plant.latest_next_action ?? plant.latest_summary ?? "",
      nextActionAt: plant.latest_next_action_at
        ? new Date(plant.latest_next_action_at)
        : nextWaterAt,
    };
  }

  // 2. Otherwise compute from watering schedule.
  if (!lastWateredAt) {
    return {
      label: "New plant",
      tone: "neutral",
      detail: "Take a photo to get personalized advice.",
      nextActionAt: null,
    };
  }
  const daysUntil = nextWaterAt
    ? Math.round((nextWaterAt.getTime() - Date.now()) / 86_400_000)
    : null;

  if (daysUntil !== null && daysUntil <= 0) {
    return {
      label: "Needs water now",
      tone: "bad",
      detail: `Last watered ${Math.abs(daysUntil)}d past due.`,
      nextActionAt: nextWaterAt,
    };
  }
  if (daysUntil !== null && daysUntil <= 2) {
    return {
      label: "Needs water soon",
      tone: "warn",
      detail: `Water in ~${daysUntil}d.`,
      nextActionAt: nextWaterAt,
    };
  }
  return {
    label: "Healthy",
    tone: "good",
    detail: nextWaterAt ? `Next water in ${daysUntil}d.` : "",
    nextActionAt: nextWaterAt,
  };
}

// ---------------------------------------------------------------------------
// Notifications: lightweight web-push reminders. Service worker + permission
// based; we schedule via setTimeout when the app is open and ask the SW to
// show a notification at the right time.
// ---------------------------------------------------------------------------

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

export function scheduleLocalReminder(
  plantName: string,
  action: string,
  when: Date,
): () => void {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return () => {};
  }
  const delay = when.getTime() - Date.now();
  if (delay <= 0) return () => {};
  // setTimeout only fires while a tab is alive. The PWA service worker is
  // limited in pure web push without a server; this is a best-effort reminder
  // that works for as long as the user has the app open or installed.
  const id = window.setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        reg.showNotification(`${plantName} — ${action}`, {
          body: "Tap to open BotanyBuddy.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `plant-${plantName}`,
        });
      } else {
        new Notification(`${plantName} — ${action}`, { body: "Tap to open." });
      }
    } catch {
      /* noop */
    }
  }, Math.min(delay, 2_147_000_000));
  return () => window.clearTimeout(id);
}
