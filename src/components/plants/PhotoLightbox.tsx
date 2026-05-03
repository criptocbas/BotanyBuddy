import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import type { GrokAdviceRecord, PlantPhoto } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Props {
  photos: PlantPhoto[];
  startId: string | null;
  advice: GrokAdviceRecord[];
  onClose: () => void;
}

/**
 * Full-screen photo viewer with swipe + arrow keys. Overlays the Grok verdict
 * for the photo when one exists.
 */
export function PhotoLightbox({ photos, startId, advice, onClose }: Props) {
  const adviceByPhoto = useMemo(() => {
    const m = new Map<string, GrokAdviceRecord>();
    for (const a of advice) {
      if (a.photo_id && !m.has(a.photo_id)) m.set(a.photo_id, a);
    }
    return m;
  }, [advice]);

  const [index, setIndex] = useState(() =>
    Math.max(0, photos.findIndex((p) => p.id === startId)),
  );

  // Keep index valid as the photos list changes.
  useEffect(() => {
    if (index >= photos.length) setIndex(Math.max(0, photos.length - 1));
  }, [photos.length, index]);

  // Keyboard: ←/→/Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight")
        setIndex((i) => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, onClose]);

  // Swipe.
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const onTouchStart: React.TouchEventHandler = (e) =>
    setTouchStart(e.touches[0].clientX);
  const onTouchEnd: React.TouchEventHandler = (e) => {
    if (touchStart == null) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (dx > 60) setIndex((i) => Math.max(0, i - 1));
    else if (dx < -60) setIndex((i) => Math.min(photos.length - 1, i + 1));
    setTouchStart(null);
  };

  if (!photos.length) return null;
  const photo = photos[index];
  if (!photo) return null;
  const verdict = adviceByPhoto.get(photo.id);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 text-white flex flex-col animate-in fade-in-0"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="flex items-center justify-between p-3 safe-top">
        <div className="text-sm">
          <div className="font-medium">{fmtDate(photo.uploaded_at)}</div>
          <div className="text-xs text-white/60">
            {index + 1} / {photos.length}
            {photo.caption ? ` · ${photo.caption}` : ""}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close photo"
          className="rounded-full bg-white/10 hover:bg-white/20 p-2"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.caption ?? "plant"}
          className="max-h-full max-w-full object-contain animate-in fade-in-0"
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              aria-label="Previous photo"
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 p-2"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() =>
                setIndex((i) => Math.min(photos.length - 1, i + 1))
              }
              disabled={index === photos.length - 1}
              aria-label="Next photo"
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 p-2"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {verdict && (
        <div className="p-4 safe-bottom border-t border-white/10 bg-black/60 backdrop-blur">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-leaf-300" />
            <Badge
              variant={
                verdict.status === "Healthy" || verdict.status === "Recovering"
                  ? "good"
                  : verdict.status === "Unclear"
                  ? "neutral"
                  : verdict.status?.startsWith("Needs water")
                  ? "warn"
                  : "bad"
              }
            >
              {verdict.status ?? "—"}
            </Badge>
            <span className="text-xs text-white/60">
              Grok · {fmtDate(verdict.created_at)}
            </span>
          </div>
          {verdict.summary && (
            <p className="text-sm leading-relaxed">{verdict.summary}</p>
          )}
          {verdict.next_action && (
            <p className="text-xs text-white/70 mt-1">
              Next: {verdict.next_action}
            </p>
          )}
        </div>
      )}

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="overflow-x-auto safe-bottom border-t border-white/10 bg-black">
          <div className="flex gap-1 p-2">
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setIndex(i)}
                aria-label={`Photo ${i + 1}`}
                className={`shrink-0 h-12 w-12 rounded overflow-hidden border-2 ${
                  i === index ? "border-leaf-300" : "border-transparent opacity-60"
                }`}
              >
                <img
                  src={p.url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
