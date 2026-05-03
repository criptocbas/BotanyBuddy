import { useCallback, useEffect, useState } from "react";

export type SortMode = "smart" | "name" | "recent";
export type GroupMode = "none" | "location";

export interface UiPrefs {
  sort: SortMode;
  group: GroupMode;
}

const KEY = "grokgarden:ui-prefs";

const DEFAULTS: UiPrefs = { sort: "smart", group: "none" };

function read(): UiPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function useUiPrefs() {
  const [prefs, setPrefs] = useState<UiPrefs>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* noop */
    }
  }, [prefs]);

  const update = useCallback(
    <K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) =>
      setPrefs((p) => ({ ...p, [key]: value })),
    [],
  );

  return { prefs, update };
}
