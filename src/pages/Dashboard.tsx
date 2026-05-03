import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search, Sprout, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlantCard } from "@/components/plants/PlantCard";
import { AddPlantPhotoFirst } from "@/components/plants/AddPlantPhotoFirst";
import { TodayDigest } from "@/components/plants/TodayDigest";
import { SortControl } from "@/components/plants/SortControl";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { usePlants } from "@/hooks/usePlants";
import { useAuth } from "@/hooks/useAuth";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { supabase } from "@/lib/supabase";
import type { CareLog, PlantWithStatus } from "@/lib/types";
import { derivePlantStatus, type DerivedStatus } from "@/lib/reminders";

const STATUS_PRIORITY: Record<DerivedStatus, number> = {
  "Needs water now": 0,
  Concern: 1,
  Pest: 2,
  Overwatered: 3,
  "Repot soon": 4,
  "Needs water soon": 5,
  Recovering: 6,
  Healthy: 7,
  Unclear: 8,
  "New plant": 9,
};

export default function Dashboard() {
  const { user } = useAuth();
  const { plants, loading, refresh, quickLog } = usePlants();
  const { prefs, update } = useUiPrefs();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [logsByPlant, setLogsByPlant] = useState<Record<string, CareLog[]>>({});

  // Fetch recent care logs per plant once for status derivation.
  useEffect(() => {
    if (!user || plants.length === 0) {
      setLogsByPlant({});
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = plants.map((p) => p.id);
      const { data } = await supabase
        .from("care_logs")
        .select("*")
        .in("plant_id", ids)
        .order("acted_at", { ascending: false });
      if (cancelled || !data) return;
      const grouped: Record<string, CareLog[]> = {};
      for (const log of data as CareLog[]) {
        (grouped[log.plant_id] ||= []).push(log);
      }
      setLogsByPlant(grouped);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, plants]);

  const filtered = useMemo(() => {
    if (!query.trim()) return plants;
    const q = query.toLowerCase();
    return plants.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.species ?? "").toLowerCase().includes(q) ||
        (p.location ?? "").toLowerCase().includes(q),
    );
  }, [plants, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (prefs.sort === "name") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else if (prefs.sort === "recent") {
      arr.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else {
      // smart
      arr.sort((a, b) => {
        const sa = derivePlantStatus(a, logsByPlant[a.id] ?? []).label;
        const sb = derivePlantStatus(b, logsByPlant[b.id] ?? []).label;
        const diff = (STATUS_PRIORITY[sa] ?? 99) - (STATUS_PRIORITY[sb] ?? 99);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });
    }
    return arr;
  }, [filtered, prefs.sort, logsByPlant]);

  const grouped = useMemo<Array<{ key: string; items: PlantWithStatus[] }>>(() => {
    if (prefs.group !== "location") {
      return [{ key: "", items: sorted }];
    }
    const map = new Map<string, PlantWithStatus[]>();
    for (const p of sorted) {
      const display = p.location?.trim() || "Unspecified";
      if (!map.has(display)) map.set(display, []);
      map.get(display)!.push(p);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [sorted, prefs.group]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Up late";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const onWater = (plantId: string) => quickLog(plantId, "water");

  return (
    <div>
      <header className="flex items-end justify-between mb-4">
        <div>
          <div className="text-xs text-muted-foreground">{greeting},</div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Your garden
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
          <AddPlantPhotoFirst
            trigger={
              <Button size="sm" className="rounded-full px-4">
                <Plus className="h-4 w-4" /> Add
              </Button>
            }
          />
        </div>
      </header>

      <InstallPrompt />

      {!loading && plants.length > 0 && (
        <div className="mb-3">
          <TodayDigest
            plants={plants}
            logsByPlant={logsByPlant}
            onWater={onWater}
          />
        </div>
      )}

      {plants.length > 0 && (
        <div className="mb-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plants"
              className="pl-9"
            />
          </div>
          <SortControl
            sort={prefs.sort}
            group={prefs.group}
            onSort={(s) => update("sort", s)}
            onGroup={(g) => update("group", g)}
          />
        </div>
      )}

      {loading && (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!loading && plants.length === 0 && <FirstRunEmptyState />}

      {!loading && plants.length > 0 && filtered.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-10">
          No plants match "{query}".
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-5">
          {grouped.map(({ key, items }) => (
            <section key={key || "all"}>
              {key && (
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 px-1">
                  {key}
                </div>
              )}
              <div className="grid gap-3">
                {items.map((plant) => (
                  <PlantCard
                    key={plant.id}
                    plant={plant}
                    recentLogs={logsByPlant[plant.id] ?? []}
                    onQuickWater={onWater}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FirstRunEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed p-6 sm:p-8 text-center bg-card/40">
      <div className="h-14 w-14 mx-auto mb-3 rounded-2xl bg-leaf-100 dark:bg-leaf-900/40 flex items-center justify-center text-leaf-600 animate-in zoom-in-50 duration-500">
        <Sprout className="h-7 w-7" />
      </div>
      <h2 className="font-display text-xl font-semibold mb-1">
        Plant your first sprout
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-5">
        Add a plant, snap a photo, and let Grok read the room.
      </p>
      <ol className="text-left max-w-sm mx-auto space-y-2 mb-5">
        <Step n={1} title="Snap a photo" body="Front-and-center is best." />
        <Step n={2} title="Grok identifies it" body="Species, condition, next action." />
        <Step n={3} title="Name it and you're set" body="Care advice tailored from day one." />
      </ol>
      <AddPlantPhotoFirst
        trigger={
          <Button size="lg">
            <Plus className="h-5 w-5" /> Add a plant
          </Button>
        }
      />
      <div className="mt-4 text-[11px] text-muted-foreground inline-flex items-center gap-1">
        <Wand2 className="h-3 w-3" /> Powered by Grok
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-leaf-100 dark:bg-leaf-900/40 text-leaf-700 dark:text-leaf-200 text-xs font-semibold flex items-center justify-center">
        {n}
      </span>
      <div>
        <div className="text-sm font-medium leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground">{body}</div>
      </div>
    </li>
  );
}
