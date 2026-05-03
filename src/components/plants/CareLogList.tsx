import {
  Droplet,
  FlaskConical,
  Leaf,
  Scissors,
  Sprout,
  RotateCw,
  Eye,
  PlusCircle,
} from "lucide-react";
import type { CareLog } from "@/lib/types";
import { fmtDate, timeAgo } from "@/lib/utils";

const ACTION_META: Record<
  CareLog["action_type"],
  { label: string; icon: typeof Leaf; tone: string }
> = {
  water:       { label: "Watered",      icon: Droplet,      tone: "text-sky-600" },
  fertilize:   { label: "Fertilized",   icon: FlaskConical, tone: "text-amber-600" },
  repot:       { label: "Repotted",     icon: Sprout,       tone: "text-leaf-600" },
  prune:       { label: "Pruned",       icon: Scissors,     tone: "text-rose-600" },
  mist:        { label: "Misted",       icon: Droplet,      tone: "text-sky-500" },
  rotate:      { label: "Rotated",      icon: RotateCw,     tone: "text-violet-600" },
  observation: { label: "Observation",  icon: Eye,          tone: "text-muted-foreground" },
  other:       { label: "Other",        icon: PlusCircle,   tone: "text-muted-foreground" },
};

export function CareLogList({ logs }: { logs: CareLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No care entries yet. Log your first watering to start tracking.
      </div>
    );
  }
  return (
    <ol className="relative border-l border-border ml-3 space-y-4 py-1">
      {logs.map((log) => {
        const meta = ACTION_META[log.action_type] ?? ACTION_META.other;
        const Icon = meta.icon;
        return (
          <li key={log.id} className="ml-4">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border">
              <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-medium text-sm">{meta.label}</div>
              <div className="text-xs text-muted-foreground">{timeAgo(log.acted_at)}</div>
            </div>
            <div className="text-xs text-muted-foreground">{fmtDate(log.acted_at)}</div>
            {log.notes && <p className="text-sm mt-1">{log.notes}</p>}
          </li>
        );
      })}
    </ol>
  );
}
