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

  // Healthy streak: days since the most recent BAD reading. If there have
  // never been any bad readings, count from the very first reading (the
  // start of tracking).
  const sortedAdvice = [...advice].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const isBad = (tone: string | null) =>
    tone === "Concern" ||
    tone === "Pest" ||
    tone === "Overwatered" ||
    tone === "Needs water now";

  let healthyStreakDays = 0;
  if (sortedAdvice.length > 0) {
    // If the latest reading is bad, no streak.
    if (!isBad(sortedAdvice[0].status)) {
      const lastBad = sortedAdvice.find((a) => isBad(a.status));
      const streakBoundary = lastBad
        ? new Date(lastBad.created_at).getTime()
        : new Date(sortedAdvice[sortedAdvice.length - 1].created_at).getTime();
      healthyStreakDays = Math.max(0, Math.floor((now - streakBoundary) / DAY));
    }
  }

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
