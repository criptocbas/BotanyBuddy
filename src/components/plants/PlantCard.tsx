import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { StatusPill } from "./StatusPill";
import { derivePlantStatus } from "@/lib/reminders";
import type { CareLog, PlantWithStatus } from "@/lib/types";
import { ChevronRight, Sprout } from "lucide-react";

interface Props {
  plant: PlantWithStatus;
  recentLogs?: CareLog[];
}

export function PlantCard({ plant, recentLogs = [] }: Props) {
  const status = derivePlantStatus(plant, recentLogs);

  return (
    <Link to={`/plants/${plant.id}`} className="block">
      <Card className="overflow-hidden hover:shadow-md transition-shadow active:scale-[0.99]">
        <div className="flex items-stretch gap-3">
          <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-leaf-100 dark:bg-leaf-900/40 flex items-center justify-center overflow-hidden">
            {plant.cover_photo_url ? (
              <img
                src={plant.cover_photo_url}
                alt={plant.name}
                className="h-full w-full object-cover"
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
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <StatusPill status={status} />
              <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[55%] text-right">
                {status.detail}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
