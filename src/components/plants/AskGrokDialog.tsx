import { useState, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GrokAdvice, PlantPhoto } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  trigger: ReactNode;
  latestPhoto: PlantPhoto | null;
  onAsk: (photo: PlantPhoto, question: string) => Promise<GrokAdvice>;
}

const SUGGESTIONS = [
  "Are these brown leaf tips a watering issue or humidity?",
  "Is it time to repot?",
  "Why are the lower leaves yellowing?",
  "Should I move it to a brighter spot?",
];

export function AskGrokDialog({ trigger, latestPhoto, onAsk }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latestPhoto) {
      toast.error("Take a photo first so Grok has something to look at.");
      return;
    }
    if (!question.trim()) return;
    setBusy(true);
    try {
      await onAsk(latestPhoto, question.trim());
      toast.success("Grok answered.");
      setQuestion("");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-leaf-600" /> Ask Grok
          </DialogTitle>
          <DialogDescription>
            Grok will re-look at the most recent photo with your question and
            full plant history.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What would you like to ask?"
            rows={4}
            autoFocus
            disabled={busy}
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => setQuestion(s)}
                className="text-xs rounded-full border border-border bg-secondary/50 hover:bg-secondary px-2.5 py-1"
              >
                {s}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !question.trim()}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Ask
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
