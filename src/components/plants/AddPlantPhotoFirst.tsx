import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Image as ImageIcon, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePlants } from "@/hooks/usePlants";
import type { IdentifyResult } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  trigger: ReactNode;
  onCreated?: (plantId: string) => void;
}

type Step =
  | { kind: "pick"; attempt: 0 | 1 }
  | { kind: "working"; attempt: 0 | 1; photoPreview: string }
  | {
      kind: "low-confidence";
      photoPreview: string;
      result: IdentifyResult;
      storagePath: string;
      photoUrl: string;
    }
  | {
      kind: "confirm";
      photoPreview: string;
      result: IdentifyResult;
      storagePath: string;
      photoUrl: string;
      isUnknown: boolean;
    };

const initialStep: Step = { kind: "pick", attempt: 0 };

export function AddPlantPhotoFirst({ trigger, onCreated }: Props) {
  const { identifyFromFile, commitIdentifiedPlant, discardPendingPhoto } = usePlants();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(initialStep);
  const [name, setName] = useState("");
  const [committing, setCommitting] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Track the active object URL so we can revoke it when it's replaced or
  // when the dialog closes — otherwise each retake leaks a blob.
  const previewRef = useRef<string | null>(null);
  const releasePreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  };

  // Track the active uncommitted storage path so we can delete it from the
  // bucket on retry / dialog close / unmount. Cleared when the user commits.
  const pendingPathRef = useRef<string | null>(null);
  const releasePending = () => {
    if (pendingPathRef.current) {
      void discardPendingPhoto(pendingPathRef.current);
      pendingPathRef.current = null;
    }
  };

  // Reset internal state when the dialog closes so the next open is fresh.
  useEffect(() => {
    if (!open) {
      releasePreview();
      releasePending();
      setStep(initialStep);
      setName("");
      setCommitting(false);
    }
  }, [open]);

  // Make sure we don't leak the last preview / pending photo on unmount.
  useEffect(
    () => () => {
      releasePreview();
      releasePending();
    },
    [],
  );

  const openCamera = () => cameraRef.current?.click();
  const openGallery = () => galleryRef.current?.click();

  const handleFile = async (file: File, attempt: 0 | 1) => {
    releasePreview();
    releasePending();
    const preview = URL.createObjectURL(file);
    previewRef.current = preview;
    setStep({ kind: "working", attempt, photoPreview: preview });
    try {
      const { result, storagePath, photoUrl } = await identifyFromFile(file);
      pendingPathRef.current = storagePath;
      const lowConfidence = result.confidence === "low";
      if (lowConfidence && attempt === 0) {
        setStep({
          kind: "low-confidence",
          photoPreview: preview,
          result,
          storagePath,
          photoUrl,
        });
        return;
      }
      const isUnknown = lowConfidence || !result.species;
      setName(
        isUnknown
          ? "New plant"
          : (result.suggested_name?.trim() ||
              result.common_name?.trim() ||
              "New plant"),
      );
      setStep({
        kind: "confirm",
        photoPreview: preview,
        result,
        storagePath,
        photoUrl,
        isUnknown,
      });
    } catch (err) {
      toast.error((err as Error).message);
      setStep({ kind: "pick", attempt });
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const attempt =
      step.kind === "pick" ? step.attempt : step.kind === "working" ? step.attempt : 0;
    handleFile(file, attempt);
  };

  const onCommit = async () => {
    if (step.kind !== "confirm") return;
    if (!name.trim()) {
      toast.error("Give your plant a name.");
      return;
    }
    setCommitting(true);
    try {
      const id = await commitIdentifiedPlant({
        name: name.trim(),
        species: step.isUnknown ? null : step.result.species,
        result: step.result,
        storagePath: step.storagePath,
        photoUrl: step.photoUrl,
      });
      // Photo is now owned by the new plant — don't delete it on dialog close.
      pendingPathRef.current = null;
      toast.success(`${name.trim()} added.`);
      setOpen(false);
      onCreated?.(id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a plant</DialogTitle>
          <DialogDescription>
            Snap a photo and let Grok handle the rest.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFileSelected}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileSelected}
        />

        {step.kind === "pick" && (
          <PickStep
            attempt={step.attempt}
            onCamera={openCamera}
            onGallery={openGallery}
          />
        )}

        {step.kind === "working" && (
          <WorkingStep photoPreview={step.photoPreview} />
        )}

        {step.kind === "low-confidence" && (
          <LowConfidenceStep
            photoPreview={step.photoPreview}
            onCamera={openCamera}
            onGallery={openGallery}
            onAcceptUnknown={() => {
              setName("New plant");
              setStep({
                kind: "confirm",
                photoPreview: step.photoPreview,
                result: step.result,
                storagePath: step.storagePath,
                photoUrl: step.photoUrl,
                isUnknown: true,
              });
            }}
          />
        )}

        {step.kind === "confirm" && (
          <ConfirmStep
            photoPreview={step.photoPreview}
            result={step.result}
            isUnknown={step.isUnknown}
            name={name}
            setName={setName}
            committing={committing}
            onCommit={onCommit}
            onCamera={openCamera}
            onGallery={openGallery}
          />
        )}

      </DialogContent>
    </Dialog>
  );
}

function PickStep({
  attempt,
  onCamera,
  onGallery,
}: {
  attempt: 0 | 1;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    <div className="grid gap-4 py-2 min-w-0">
      <div className="rounded-2xl border-2 border-dashed border-leaf-300 dark:border-leaf-800 bg-leaf-50/50 dark:bg-leaf-950/30 px-4 py-6 text-leaf-700 dark:text-leaf-200">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <Camera className="h-8 w-8" aria-hidden />
          <div className="font-medium">
            {attempt === 0 ? "Add a photo" : "Try a clearer photo"}
          </div>
          <div className="text-xs text-muted-foreground max-w-[28ch] text-balance">
            {attempt === 0
              ? "Front-and-center works best. Grok will identify the species."
              : "Good light and a clear view of the leaves help a lot."}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" onClick={onCamera}>
          <Camera className="h-5 w-5" /> Take photo
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={onGallery}>
          <ImageIcon className="h-5 w-5" /> Upload photo
        </Button>
      </div>
    </div>
  );
}

function WorkingStep({ photoPreview }: { photoPreview: string }) {
  return (
    <div className="grid gap-4 py-2">
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
        <img
          src={photoPreview}
          alt="Selected plant"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white gap-2">
          <Loader2 className="h-7 w-7 animate-spin" />
          <div className="text-sm font-medium">Identifying…</div>
        </div>
      </div>
    </div>
  );
}

function LowConfidenceStep({
  photoPreview,
  onCamera,
  onGallery,
  onAcceptUnknown,
}: {
  photoPreview: string;
  onCamera: () => void;
  onGallery: () => void;
  onAcceptUnknown: () => void;
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
        <img
          src={photoPreview}
          alt="Selected plant"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="text-center">
        <div className="font-medium mb-1">Hmm, hard to tell from this one.</div>
        <p className="text-sm text-muted-foreground">
          Try a clearer photo with good light, or keep going as an unknown
          plant — you can rename it later.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onCamera}>
          <Camera className="h-4 w-4" /> Take photo
        </Button>
        <Button variant="outline" onClick={onGallery}>
          <ImageIcon className="h-4 w-4" /> Upload photo
        </Button>
      </div>
      <button
        type="button"
        onClick={onAcceptUnknown}
        className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline mx-auto"
      >
        Add as Unknown plant instead
      </button>
    </div>
  );
}

function ConfirmStep({
  photoPreview,
  result,
  isUnknown,
  name,
  setName,
  committing,
  onCommit,
  onCamera,
  onGallery,
}: {
  photoPreview: string;
  result: IdentifyResult;
  isUnknown: boolean;
  name: string;
  setName: (v: string) => void;
  committing: boolean;
  onCommit: () => void;
  onCamera: () => void;
  onGallery: () => void;
}) {
  const speciesLabel = isUnknown
    ? "Unknown plant"
    : (result.species ?? result.common_name ?? "Unknown plant");
  return (
    <div className="grid gap-4 py-1">
      <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
        <img
          src={photoPreview}
          alt="Plant"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-leaf-600" />
          <div className="text-sm text-muted-foreground">
            {isUnknown ? "Best guess" : "Looks like"}
          </div>
          {!isUnknown && result.confidence === "medium" && (
            <Badge variant="secondary" className="text-[10px]">
              Not 100% sure
            </Badge>
          )}
        </div>
        <div className="font-display text-xl font-semibold leading-tight">
          {speciesLabel}
        </div>
        {result.summary && (
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="plant-name">Name</Label>
        <Input
          id="plant-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Give your plant a name"
          autoFocus
        />
      </div>
      <Button onClick={onCommit} disabled={committing}>
        {committing ? "Adding…" : "Add plant"}
      </Button>
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <RefreshCcw className="h-3 w-3" /> Retake
        </span>
        <button
          type="button"
          onClick={onCamera}
          disabled={committing}
          className="hover:text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
        >
          <Camera className="h-3 w-3" /> Camera
        </button>
        <button
          type="button"
          onClick={onGallery}
          disabled={committing}
          className="hover:text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
        >
          <ImageIcon className="h-3 w-3" /> Gallery
        </button>
      </div>
    </div>
  );
}

