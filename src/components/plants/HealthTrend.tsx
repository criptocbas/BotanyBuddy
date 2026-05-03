import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import type { GrokAdviceRecord } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

// Map Grok status → 0..4 score so we can plot a wellness line.
const SCORE: Record<string, number> = {
  Healthy: 4,
  Recovering: 3.2,
  "Needs water soon": 2.5,
  "Repot soon": 2.5,
  Unclear: 2,
  "Needs water now": 1.2,
  Overwatered: 1,
  Concern: 0.7,
  Pest: 0.4,
};

const COLOR: Record<string, string> = {
  Healthy: "#3f834f",
  Recovering: "#5ea16c",
  "Needs water soon": "#e0a800",
  "Repot soon": "#e0a800",
  Unclear: "#94a3b8",
  "Needs water now": "#dc2626",
  Overwatered: "#dc2626",
  Concern: "#ef4444",
  Pest: "#7f1d1d",
};

interface Props {
  advice: GrokAdviceRecord[];
}

export function HealthTrend({ advice }: Props) {
  const points = useMemo(() => {
    return [...advice]
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .map((a) => ({
        t: new Date(a.created_at).getTime(),
        score: SCORE[a.status ?? ""] ?? 2,
        status: a.status ?? "Unclear",
        date: a.created_at,
      }));
  }, [advice]);

  if (points.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-leaf-600" /> Health trend
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Take {points.length === 0 ? "a couple of" : "another"} photo
          {points.length === 0 ? "s" : ""} so Grok can build a trend over time.
        </CardContent>
      </Card>
    );
  }

  // Geometry
  const W = 320;
  const H = 90;
  const PAD = 8;
  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const span = Math.max(1, maxT - minT);
  const x = (t: number) => PAD + ((t - minT) / span) * (W - PAD * 2);
  const y = (s: number) => PAD + (1 - s / 4) * (H - PAD * 2);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(1)} ${y(p.score).toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${x(maxT).toFixed(1)} ${H - PAD} L ${x(minT).toFixed(1)} ${H - PAD} Z`;

  const latest = points[points.length - 1];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-leaf-600" /> Health trend
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {fmtDate(points[0].date)} → now
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[90px]"
          role="img"
          aria-label="Plant health trend over time"
        >
          <defs>
            <linearGradient id="hg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3f834f" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3f834f" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Reference line at "Healthy" score */}
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(4)}
            y2={y(4)}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray="3 3"
          />
          <path d={area} fill="url(#hg)" />
          <path
            d={path}
            fill="none"
            stroke="#3f834f"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p) => (
            <circle
              key={p.t}
              cx={x(p.t)}
              cy={y(p.score)}
              r={3}
              fill={COLOR[p.status] ?? "#94a3b8"}
              stroke="hsl(var(--card))"
              strokeWidth="1.2"
            >
              <title>{`${p.status} · ${fmtDate(p.date)}`}</title>
            </circle>
          ))}
        </svg>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span>{points.length} reading{points.length === 1 ? "" : "s"}</span>
          <span>
            Latest:{" "}
            <span className="text-foreground font-medium">{latest.status}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
