import { Camera, Clock, Leaf } from "lucide-react";
import type { Plant, PlantPhoto } from "@/lib/types";
import type { PlantStatus } from "@/lib/reminders";
import { PhotoUploader } from "./PhotoUploader";
import { cn, timeAgo } from "@/lib/utils";

interface Props {
  plant: Plant;
  latestPhoto: PlantPhoto | null;
  status: PlantStatus | null;
  onPhotoClick: () => void;
  onUpload: (file: File) => Promise<void>;
  analyzing: boolean;
}

const TONE_DOT: Record<PlantStatus["tone"], string> = {
  good: "bg-leaf-400 shadow-[0_0_0_5px] shadow-leaf-400/15 dark:shadow-leaf-400/10",
  warn: "bg-amber-400 shadow-[0_0_0_5px] shadow-amber-400/15",
  bad: "bg-rose-400 shadow-[0_0_0_5px] shadow-rose-400/15",
  neutral: "bg-muted-foreground/60",
};

function ageBlurb(createdAt: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000),
  );
  if (days < 3) return "new arrival";
  if (days < 14) return `${days} days together`;
  if (days < 60) return `${Math.round(days / 7)} weeks together`;
  if (days < 730) return `${Math.round(days / 30)} months together`;
  const years = days / 365;
  return `${years < 10 ? years.toFixed(1) : Math.floor(years)} years together`;
}

export function PlantHero({
  plant,
  latestPhoto,
  status,
  onPhotoClick,
  onUpload,
  analyzing,
}: Props) {
  const dotClass = TONE_DOT[status?.tone ?? "neutral"];
  const captured = latestPhoto ? timeAgo(latestPhoto.uploaded_at) : null;

  return (
    <section className="anim-fade-up">
      {/* Kicker — species + relationship age, letterspaced */}
      <div className="flex items-center gap-2.5 mb-2.5 px-1">
        <Leaf
          className="h-3 w-3 text-leaf-600 dark:text-leaf-400 shrink-0"
          aria-hidden
        />
        <span className="text-[10px] font-semibold tracking-[0.22em] uppercase text-leaf-700 dark:text-leaf-300 truncate">
          {plant.species ?? "Unknown species"}
        </span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        <span className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground whitespace-nowrap">
          {ageBlurb(plant.created_at)}
        </span>
      </div>

      {/* Name — the moment */}
      <h1 className="font-display font-semibold tracking-[-0.02em] leading-[0.92] text-[clamp(2.5rem,12vw,4.5rem)] mb-1 px-1">
        {plant.name}
      </h1>

      {/* Location aside — handwritten feel */}
      {plant.location ? (
        <div className="text-sm text-muted-foreground italic mt-1 mb-5 px-1">
          {plant.location}
        </div>
      ) : (
        <div className="mb-5" aria-hidden />
      )}

      {/* Photo — print, not card */}
      <button
        type="button"
        onClick={onPhotoClick}
        disabled={!latestPhoto}
        aria-label={latestPhoto ? "View latest photo" : "No photo yet"}
        className={cn(
          "group relative block w-full overflow-hidden rounded-3xl mb-5",
          "aspect-[4/5] bg-leaf-100 dark:bg-leaf-950/60",
          "ring-1 ring-leaf-900/5 dark:ring-leaf-200/[0.04]",
          "shadow-[0_30px_60px_-30px_rgba(20,40,30,0.45)] dark:shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]",
          "transition-shadow duration-500",
          latestPhoto
            ? "active:shadow-[0_15px_40px_-25px_rgba(20,40,30,0.4)]"
            : "cursor-default",
        )}
      >
        {plant.cover_photo_url ? (
          <>
            <img
              src={plant.cover_photo_url}
              alt={plant.name}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:scale-[1.03] group-active:scale-[1.01]"
            />
            {/* Top veil so timestamp reads */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 via-black/10 to-transparent"
            />
            {captured && (
              <div className="pointer-events-none absolute top-4 left-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-white/95 tracking-wide drop-shadow-sm">
                <Clock className="h-3 w-3" aria-hidden />
                {captured}
              </div>
            )}
            {/* Bottom signature */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 via-black/15 to-transparent"
            />
            <div className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-white/85" />
              latest
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-leaf-500/80 dark:text-leaf-300/60">
            <Camera className="h-8 w-8" aria-hidden />
            <div className="text-xs tracking-wide">
              No photo yet — add one below
            </div>
          </div>
        )}
      </button>

      {/* Status as prose — tone dot + sentence */}
      {status && (
        <div className="flex items-start gap-3 mb-5 px-1">
          <span
            aria-hidden
            className={cn(
              "mt-[7px] h-2 w-2 rounded-full shrink-0",
              dotClass,
            )}
          />
          <p className="text-[15px] leading-snug">
            <span className="font-medium tracking-tight">{status.label}.</span>{" "}
            <span className="text-muted-foreground">
              {status.detail || "Quiet for now. Snap a photo for a fresh read."}
            </span>
          </p>
        </div>
      )}

      {/* Hairline that fades at edges */}
      <div
        aria-hidden
        className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-4"
      />

      {/* Existing uploader — kept intact */}
      <PhotoUploader onUpload={onUpload} analyzing={analyzing} />
    </section>
  );
}
