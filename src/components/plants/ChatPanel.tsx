import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, timeAgo } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import type { PlantPhoto } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  plantId: string;
  latestPhoto: PlantPhoto | null;
}

const SUGGESTIONS = [
  "How is it doing?",
  "Should I move it somewhere brighter?",
  "What does this leaf damage mean?",
  "Time to repot?",
];

export function ChatPanel({ plantId, latestPhoto }: Props) {
  const { messages, loading, sending, send } = useChat(plantId);
  const [draft, setDraft] = useState("");
  const [attach, setAttach] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      await send(text, attach ? latestPhoto : null);
    } catch (err) {
      toast.error((err as Error).message);
      setDraft(text); // restore so the user can retry
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div
          ref={scrollerRef}
          className="max-h-[60vh] overflow-y-auto p-4 space-y-3"
        >
          {loading ? (
            <>
              <Skeleton className="h-12 w-3/5" />
              <Skeleton className="h-16 w-4/5 ml-auto" />
              <Skeleton className="h-12 w-3/5" />
            </>
          ) : messages.length === 0 ? (
            <EmptyState
              onPick={(s) => setDraft(s)}
              hasPhoto={!!latestPhoto}
            />
          ) : (
            messages.map((m) => (
              <Bubble
                key={m.id}
                role={m.role}
                content={m.content}
                createdAt={m.created_at}
              />
            ))
          )}
          {sending && (
            <Bubble role="assistant" content="…" createdAt={new Date().toISOString()} typing />
          )}
        </div>

        <form
          onSubmit={submit}
          className="border-t border-border p-3 space-y-2"
        >
          {messages.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={attach}
                  onChange={(e) => setAttach(e.target.checked)}
                  className="rounded border-border"
                />
                Attach latest photo {latestPhoto ? "" : "(none yet)"}
              </label>
              <span className="text-[11px] text-muted-foreground">
                {messages.length} message{messages.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask Grok about this plant…"
              rows={2}
              className="min-h-[44px] resize-none"
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(e as unknown as React.FormEvent);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !draft.trim()}
              aria-label="Send"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Bubble({
  role,
  content,
  createdAt,
  typing,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  typing?: boolean;
}) {
  const mine = role === "user";
  return (
    <div className={cn("flex items-start gap-2", mine && "flex-row-reverse")}>
      <div
        className={cn(
          "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-white",
          mine ? "bg-primary" : "bg-leaf-700",
        )}
      >
        {mine ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div className={cn("max-w-[85%]", mine && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
            mine
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-secondary text-secondary-foreground rounded-tl-sm",
          )}
        >
          {typing ? (
            <span className="inline-flex gap-1">
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </span>
          ) : (
            content
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1 px-1">
          {timeAgo(createdAt)}
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function EmptyState({
  onPick,
  hasPhoto,
}: {
  onPick: (s: string) => void;
  hasPhoto: boolean;
}) {
  return (
    <div className="text-center py-6">
      <div className="h-10 w-10 mx-auto mb-2 rounded-full bg-leaf-100 dark:bg-leaf-900/40 flex items-center justify-center text-leaf-600">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="font-display text-base font-semibold">Chat with Grok</div>
      <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs mx-auto">
        Ask anything about this plant. {hasPhoto ? "Your latest photo is attached by default." : "Snap a photo to give Grok eyes."}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="text-xs rounded-full border border-border bg-secondary/50 hover:bg-secondary px-2.5 py-1"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
