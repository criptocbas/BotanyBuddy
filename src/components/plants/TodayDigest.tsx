import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Droplet,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { CareLog, PlantWithStatus } from "@/lib/types";
import { derivePlantStatus } from "@/lib/reminders";
import { haptic } from "@/lib/haptics";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  plants: PlantWithStatus[];
  logsByPlant: Record<string, CareLog[]>;
  onWater: (plantId: string) => Promise<void>;
}

interface DigestItem {
  plant: PlantWithStatus;
  reason: string;
  severity: "now" | "soon" | "concern";
}

function buildDigest(plants: PlantWithStatus[], logsByPlant: Record<string, CareLog[]>): DigestItem[] {
  const items: DigestItem[] = [];
  for (const p of plants) {
    const status = derivePlantStatus(p, logsByPlant[p.id] ?? []);
    if (status.label === "Needs water now") {
      items.push({ plant: p, reason: status.detail || "Water now", severity: "now" });
    } else if (status.label === "Needs water soon") {
      items.push({ plant: p, reason: status.detail || "Water soon", severity: "soon" });
    } else if (
      status.label === "Concern" ||
      status.label === "Pest" ||
      status.label === "Overwatered" ||
      status.label === "Repot soon"
    ) {
      items.push({
        plant: p,
        reason: p.latest_next_action || status.label,
        severity: "concern",
      });
    }
  }
  // Sort: now > concern > soon
  const order = { now: 0, concern: 1, soon: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);
  return items;
}

export function TodayDigest({ plants, logsByPlant, onWater }: Props) {
  const items = buildDigest(plants, logsByPlant);
  const [busyPlantId, setBusyPlantId] = useState<string | null>(null);

  if (plants.length === 0) return null;

  if (items.length === 0) {
    return (
      <Card className="bg-leaf-50/80 dark:bg-leaf-900/30 border-leaf-200/70 dark:border-leaf-800/70">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-leaf-100 dark:bg-leaf-800/60 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-leaf-700 dark:text-leaf-200" />
          </div>
          <div>
            <div className="font-display text-base font-semibold">All caught up</div>
            <div className="text-xs text-muted-foreground">
              Nothing needs attention today. Snap a photo if you want a check-up.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleWater = async (plantId: string) => {
    haptic("success");
    setBusyPlantId(plantId);
    try {
      await onWater(plantId);
      toast.success("Watering logged.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyPlantId(null);
    }
  };

  const headline =
    items.length === 1
      ? "1 plant needs attention"
      : `${items.length} plants need attention`;

  return (
    <Card className="border-amber-200/70 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          <div className="font-display text-base font-semibold">{headline}</div>
        </div>
        <ul className="divide-y divide-border/50">
          {items.slice(0, 5).map((it) => {
            const Icon = it.severity === "concern" ? AlertTriangle : Droplet;
            const tint =
              it.severity === "now"
                ? "text-red-600"
                : it.severity === "concern"
                ? "text-amber-600"
                : "text-sky-600";
            return (
              <li key={it.plant.id} className="py-2 flex items-center gap-3">
                <Icon className={`h-4 w-4 shrink-0 ${tint}`} />
                <Link
                  to={`/plants/${it.plant.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="text-sm font-medium truncate">
                    {it.plant.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {it.reason}
                  </div>
                </Link>
                {(it.severity === "now" || it.severity === "soon") && (
                  <Button
                    size="sm"
                    variant={it.severity === "now" ? "default" : "outline"}
                    disabled={busyPlantId === it.plant.id}
                    onClick={() => handleWater(it.plant.id)}
                  >
                    {busyPlantId === it.plant.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Droplet className="h-3.5 w-3.5" />
                    )}
                    Water
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {items.length > 5 && (
          <div className="text-xs text-muted-foreground mt-2">
            +{items.length - 5} more — see your full list below.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
