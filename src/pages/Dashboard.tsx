import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlantCard } from "@/components/plants/PlantCard";
import { AddPlantDialog } from "@/components/plants/AddPlantDialog";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { usePlants } from "@/hooks/usePlants";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { CareLog } from "@/lib/types";

export default function Dashboard() {
  const { user } = useAuth();
  const { plants, loading } = usePlants();
  const [query, setQuery] = useState("");
  const [logsByPlant, setLogsByPlant] = useState<Record<string, CareLog[]>>({});

  // Fetch recent watering logs per plant once for status derivation. This is
  // a single query for all plants — fine for personal-scale data.
  useEffect(() => {
    if (!user || plants.length === 0) return;
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

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Up late";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div>
      <header className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-muted-foreground">{greeting},</div>
          <h1 className="font-display text-2xl font-semibold">Your garden</h1>
        </div>
        <AddPlantDialog
          trigger={
            <Button size="lg" className="rounded-full px-5">
              <Plus className="h-5 w-5" /> Add
            </Button>
          }
        />
      </header>

      <InstallPrompt />

      {plants.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plants by name, species, or location"
            className="pl-9"
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

      {!loading && plants.length === 0 && (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <div className="h-14 w-14 mx-auto mb-3 rounded-2xl bg-leaf-100 dark:bg-leaf-900/40 flex items-center justify-center text-leaf-600">
            <Sprout className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-semibold mb-1">
            Plant your first sprout
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
            Add a plant to start logging care and getting personalized advice
            from Grok based on photos and your plant's history.
          </p>
          <AddPlantDialog
            trigger={
              <Button size="lg">
                <Plus className="h-5 w-5" /> Add a plant
              </Button>
            }
          />
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              recentLogs={logsByPlant[plant.id] ?? []}
            />
          ))}
        </div>
      )}

      {!loading && plants.length > 0 && filtered.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-10">
          No plants match "{query}".
        </div>
      )}
    </div>
  );
}
