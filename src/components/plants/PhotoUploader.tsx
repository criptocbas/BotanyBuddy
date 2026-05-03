import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  onUpload: (file: File) => Promise<void>;
  analyzing?: boolean;
  disabled?: boolean;
}

export function PhotoUploader({ onUpload, analyzing, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isBusy = busy || analyzing;

  return (
    <div className="grid grid-cols-2 gap-2">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        size="lg"
        disabled={isBusy || disabled}
        onClick={() => cameraRef.current?.click()}
      >
        {isBusy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Camera className="h-5 w-5" />
        )}
        {analyzing ? "Asking Grok…" : busy ? "Uploading…" : "Take photo"}
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        disabled={isBusy || disabled}
        onClick={() => fileRef.current?.click()}
      >
        <ImageIcon className="h-5 w-5" />
        Upload photo
      </Button>
      <div className="col-span-2 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        Grok will analyze the new photo with your plant's full history.
      </div>
    </div>
  );
}
