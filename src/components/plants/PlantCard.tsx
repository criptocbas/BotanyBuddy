import { Link } from "react-router-dom";
import { useState } from "react";
import { ChevronRight, Droplet, Loader2, Sprout } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "./StatusPill";
import { derivePlantStatus } from "@/lib/reminders";
import { haptic } from "@/lib/haptics";
import { timeUntil } from "@/lib/utils";
import type { PlantWithStatus } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  plant: PlantWithStatus;
  onQuickWater?: (plantId: string) => Promise<void>;
}

export function PlantCard({ plant, onQuickWater }: Props) {
  const status = derivePlantStatus(plant, plant.last_watered_at ?? null);
  const [busy, setBusy] = useState(false);

  const showWater =
    !!onQuickWater &&
    (status.label === "Needs water now" || status.label === "Needs water soon");

  const handleWater = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onQuickWater) return;
    haptic("success");
    setBusy(true);
    try {
      await onQuickWater(plant.id);
      toast.success(`Watered ${plant.name}.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link to={`/plants/${plant.id}`} className="block group">
      <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0">
        <div className="flex items-stretch gap-3">
          <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-leaf-100 dark:bg-leaf-900/40 flex items-center justify-center overflow-hidden">
            {plant.cover_photo_url ? (
              <img
                src={plant.cover_photo_url}
                alt={plant.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-[1.04]"
                loading="lazy"
              />
            ) : (
              <Sprout className="h-10 w-10 text-leaf-500" />
            )}
          </div>
          <div className="flex-1 min-w-0 py-3 pr-3 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-lg font-semibold leading-tight truncate">
                  {plant.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {plant.species ?? "—"}
                  {plant.location ? ` · ${plant.location}` : ""}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <StatusPill status={status} />
              {showWater ? (
                <Button
                  size="sm"
                  variant={status.label === "Needs water now" ? "default" : "outline"}
                  onClick={handleWater}
                  disabled={busy}
                  className="h-7 px-2 text-xs"
                >
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Droplet className="h-3 w-3" />
                  )}
                  Water
                </Button>
              ) : (
                <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[55%] text-right">
                  {status.nextActionAt && status.label === "Healthy"
                    ? `Next water ${timeUntil(status.nextActionAt)}`
                    : status.detail}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
