import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate } from "@/lib/utils";
import type { CareLog } from "@/lib/types";
import { Loader2, NotebookPen } from "lucide-react";
import { toast } from "sonner";

interface Props {
  logs: CareLog[];
  onAddNote: (notes: string) => Promise<void>;
}

export function JournalTab({ logs, onAddNote }: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const entries = useMemo(
    () =>
      logs
        .filter(
          (l) =>
            (l.action_type === "observation" || l.action_type === "other") &&
            l.notes,
        )
        .slice(0, 100),
    [logs],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await onAddNote(text);
      setDraft("");
      toast.success("Note saved.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What did you notice today? New leaf, wilting, repotting plans, etc."
            rows={3}
            disabled={busy}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <NotebookPen className="h-3.5 w-3.5" />
              )}
              Save note
            </Button>
          </div>
        </form>

        {entries.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No notes yet. Quick observations help Grok learn your plant's
            rhythm.
          </div>
        ) : (
          <ol className="space-y-3">
            {entries.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-border/60 bg-background/50 p-3"
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {fmtDate(e.acted_at)}
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {e.notes}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
