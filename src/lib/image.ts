// Client-side image resize before upload. Phones produce 3–5 MB photos that
// don't need to be that big for plant identification — the model gets the
// same answer at 1600px and we save user storage, bandwidth, and Grok input
// size. Falls back to the original file on any failure so a resize bug can
// never block an upload.

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.85;

export async function resizeImage(
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE,
  quality: number = DEFAULT_QUALITY,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    try {
      const { width, height } = bitmap;
      const longest = Math.max(width, height);
      if (longest <= maxEdge) return file;

      const scale = maxEdge / longest;
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob || blob.size >= file.size) return file;

      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
      return new File([blob], `${baseName}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close?.();
    }
  } catch {
    return file;
  }
}
