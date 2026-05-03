// Tiny haptics helper. Uses the Vibration API where available; degrades to a
// no-op on iOS where vibration is unsupported in PWAs (still safe to call).

type Pattern = "tick" | "success" | "warn" | "error";

const PATTERNS: Record<Pattern, number | number[]> = {
  tick: 8,
  success: [10, 30, 12],
  warn: [20, 40, 20],
  error: [40, 60, 40],
};

export function haptic(pattern: Pattern = "tick") {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    vibrate?: (p: number | number[]) => boolean;
  };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(PATTERNS[pattern]);
  } catch {
    /* noop */
  }
}
