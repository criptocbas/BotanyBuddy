import { Card, CardContent } from "@/components/ui/card";
import { Droplet, FlaskConical, Flame, Heart } from "lucide-react";
import type { CareStats as CareStatsT } from "@/lib/stats";

interface Props {
  stats: CareStatsT;
}

export function CareStats({ stats }: Props) {
  const items: Array<{
    icon: typeof Droplet;
    label: string;
    value: string;
    sub?: string;
    tint: string;
  }> = [
    {
      icon: Droplet,
      label: "Waterings (30d)",
      value: String(stats.wateringsLast30d),
      sub:
        stats.daysSinceLastWater != null
          ? `${stats.daysSinceLastWater}d since last`
          : "—",
      tint: "text-sky-600",
    },
    {
      icon: FlaskConical,
      label: "Fertilizings (30d)",
      value: String(stats.fertilizingsLast30d),
      tint: "text-amber-600",
    },
    {
      icon: Flame,
      label: "Avg interval",
      value:
        stats.averageWaterIntervalDays != null
          ? `${stats.averageWaterIntervalDays}d`
          : "—",
      sub: "between waterings",
      tint: "text-rose-600",
    },
    {
      icon: Heart,
      label: "Healthy streak",
      value: stats.healthyStreakDays > 0 ? `${stats.healthyStreakDays}d` : "—",
      sub: stats.healthyStreakDays > 0 ? "in a row" : "snap a photo",
      tint: "text-leaf-600",
    },
  ];

  return (
    <Card>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.label}
                className="rounded-lg border border-border/60 bg-background/60 p-3"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${it.tint}`} />
                  <div className="text-xs text-muted-foreground">{it.label}</div>
                </div>
                <div className="mt-1 font-display text-2xl font-semibold leading-none">
                  {it.value}
                </div>
                {it.sub && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {it.sub}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
