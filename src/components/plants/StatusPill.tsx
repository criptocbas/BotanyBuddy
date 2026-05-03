import { Badge } from "@/components/ui/badge";
import type { PlantStatus } from "@/lib/reminders";
import { Droplets, Heart, Leaf, AlertTriangle, HelpCircle, Sparkles } from "lucide-react";

const ICONS: Record<string, typeof Leaf> = {
  Healthy: Heart,
  "Needs water soon": Droplets,
  "Needs water now": Droplets,
  Overwatered: Droplets,
  Concern: AlertTriangle,
  Pest: AlertTriangle,
  "Repot soon": Sparkles,
  Recovering: Leaf,
  Unclear: HelpCircle,
  "New plant": Sparkles,
};

export function StatusPill({ status }: { status: PlantStatus }) {
  const Icon = ICONS[status.label] ?? Leaf;
  return (
    <Badge variant={status.tone}>
      <Icon className="h-3 w-3" />
      {status.label}
    </Badge>
  );
}
