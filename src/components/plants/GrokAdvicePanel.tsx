import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Droplets, Sun, Cloud, AlertTriangle, Sprout } from "lucide-react";
import type { GrokAdviceRecord } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

function toneFor(status: string | null | undefined) {
  if (!status) return "neutral";
  if (status === "Healthy" || status === "Recovering") return "good";
  if (status.startsWith("Needs water")) return "warn";
  if (status === "Unclear") return "neutral";
  return "bad";
}

interface Props {
  advice: GrokAdviceRecord | null;
}

export function GrokAdvicePanel({ advice }: Props) {
  if (!advice) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Sparkles className="h-5 w-5 text-leaf-500" />
          Snap a photo to get Grok's read on this plant.
        </CardContent>
      </Card>
    );
  }

  const a = advice.raw ?? {};
  const tone = toneFor(advice.status);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-leaf-600" />
            Grok's read
          </CardTitle>
          <Badge variant={tone as "good" | "warn" | "bad" | "neutral"}>
            {advice.status ?? "—"}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {advice.model} · {fmtDate(advice.created_at)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {a.summary && <p className="leading-relaxed">{a.summary}</p>}

        {a.next_action && (
          <div className="rounded-lg bg-leaf-50 dark:bg-leaf-900/30 border border-leaf-200 dark:border-leaf-800 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-leaf-700 dark:text-leaf-300">
              Next action
            </div>
            <div className="font-medium mt-0.5">{a.next_action}</div>
          </div>
        )}

        <Section icon={Droplets} title="Watering">{a.watering}</Section>
        <Section icon={Sun} title="Light">{a.light}</Section>
        <Section icon={Cloud} title="Humidity">{a.humidity}</Section>

        {a.observations && a.observations.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Observations
            </div>
            <ul className="list-disc list-inside space-y-1">
              {a.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        {a.problems && a.problems.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-amber-600 mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Problems
            </div>
            <ul className="list-disc list-inside space-y-1">
              {a.problems.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        {a.repotting && (
          <Section icon={Sprout} title="Repotting">{a.repotting}</Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Droplets;
  title: string;
  children?: string;
}) {
  if (!children) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
