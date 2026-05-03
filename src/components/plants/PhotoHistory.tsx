import type { PlantPhoto } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

interface Props {
  photos: PlantPhoto[];
  onSelect?: (photo: PlantPhoto) => void;
}

export function PhotoHistory({ photos, onSelect }: Props) {
  if (photos.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No photos yet. Snap one above to get Grok's first read.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect?.(p)}
          className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
        >
          <img
            src={p.url}
            alt={p.caption ?? "plant photo"}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {timeAgo(p.uploaded_at)}
          </span>
        </button>
      ))}
    </div>
  );
}
