// Client-side image handling for the question editor.
//
// Uploaded images are compressed in the browser and stored as data URLs inside
// the question set (localStorage). When a game is created, the server extracts
// them and serves them from /api/games/[pin]/image/[id] so live-game polling
// stays lightweight.
"use client";

const MAX_FILE_BYTES = 12 * 1024 * 1024;
// Small files are kept as-is, preserving PNG transparency and GIF animation.
const KEEP_ORIGINAL_BYTES = 150 * 1024;
// Target ceiling for the encoded data URL (~350 KB of binary).
const MAX_DATAURL_CHARS = 480_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read that file"));
    r.readAsDataURL(file);
  });
}

async function loadImage(file: File): Promise<{ width: number; height: number; source: CanvasImageSource }> {
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file);
      return { width: bmp.width, height: bmp.height, source: bmp };
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That image could not be decoded"));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, source: img };
  } finally {
    // Safe to revoke after decode; canvas drawing keeps its own reference.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function encodeJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxDim: number,
  quality: number
): string {
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // JPEG has no alpha — composite transparent images onto white.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Turn an uploaded image file into a reasonably-sized data URL.
 * Accepts anything the browser can decode (png, jpg/jpeg, webp, gif, bmp, …).
 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image — use a PNG, JPG, WEBP, or GIF");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Image is too large (max 12 MB)");
  }
  if (file.size <= KEEP_ORIGINAL_BYTES) {
    return readAsDataUrl(file);
  }

  const { width, height, source } = await loadImage(file);
  const attempts: [number, number][] = [
    [1200, 0.82],
    [900, 0.7],
    [700, 0.6],
  ];
  for (const [maxDim, quality] of attempts) {
    const url = encodeJpeg(source, width, height, maxDim, quality);
    if (url.length <= MAX_DATAURL_CHARS) return url;
  }
  return encodeJpeg(source, width, height, 560, 0.5);
}
