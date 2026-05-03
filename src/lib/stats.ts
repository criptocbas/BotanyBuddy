import type { CareLog, GrokAdviceRecord } from "./types";

export interface CareStats {
  totalLogs: number;
  wateringsLast30d: number;
  fertilizingsLast30d: number;
  daysSinceLastWater: number | null;
  averageWaterIntervalDays: number | null;
  healthyStreakDays: number; // consecutive days the latest assessment ≠ "Concern" | "Pest"
  firstLoggedAt: string | null;
}

const DAY = 86_400_000;

export function computeCareStats(
  logs: CareLog[],
  advice: GrokAdviceRecord[],
): CareStats {
  const now = Date.now();
  const within30d = (iso: string) => now - new Date(iso).getTime() <= 30 * DAY;

  const waterings = logs
    .filter((l) => l.action_type === "water")
    .sort((a, b) => new Date(b.acted_at).getTime() - new Date(a.acted_at).getTime());

  const wateringsLast30d = waterings.filter((l) => within30d(l.acted_at)).length;
  const fertilizingsLast30d = logs.filter(
    (l) => l.action_type === "fertilize" && within30d(l.acted_at),
  ).length;

  const lastWater = waterings[0];
  const daysSinceLastWater = lastWater
    ? Math.floor((now - new Date(lastWater.acted_at).getTime()) / DAY)
    : null;

  // Average gap between waterings (using last 5 to keep recent rhythm).
  let averageWaterIntervalDays: number | null = null;
  if (waterings.length >= 2) {
    const sample = waterings.slice(0, 6);
    const gaps: number[] = [];
    for (let i = 0; i < sample.length - 1; i++) {
      const a = new Date(sample[i].acted_at).getTime();
      const b = new Date(sample[i + 1].acted_at).getTime();
      gaps.push((a - b) / DAY);
    }
    averageWaterIntervalDays = Math.round(
      gaps.reduce((s, g) => s + g, 0) / gaps.length,
    );
  }

  // Healthy streak: walking newest → oldest, find the start of the run of
  // consecutive non-bad advice. Streak length = days from that point to now.
  const sortedAdvice = [...advice].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const isBad = (tone: string | null) =>
    tone === "Concern" ||
    tone === "Pest" ||
    tone === "Overwatered" ||
    tone === "Needs water now";

  let streakStart: string | null = null;
  for (const a of sortedAdvice) {
    if (isBad(a.status)) break;
    streakStart = a.created_at;
  }
  const healthyStreakDays = streakStart
    ? Math.floor((now - new Date(streakStart).getTime()) / DAY)
    : 0;

  return {
    totalLogs: logs.length,
    wateringsLast30d,
    fertilizingsLast30d,
    daysSinceLastWater,
    averageWaterIntervalDays,
    healthyStreakDays,
    firstLoggedAt: logs[logs.length - 1]?.acted_at ?? null,
  };
}
