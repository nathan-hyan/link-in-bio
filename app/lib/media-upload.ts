// Fixed KV key for the background image. A single key means each upload
// overwrites the previous bytes — the old image is gone, only one ever exists.
export const BG_KV_KEY = "background";
// Same-origin path that serves the KV object (see routes/bg-image.tsx). Stored
// in the `bg_image_url` setting with a `?v=<timestamp>` cache-buster on upload.
export const BG_IMAGE_PATH = "/media/bg";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
];

/**
 * Validate an uploaded background image before writing it to KV. Returns an
 * error message string, or null when the upload is acceptable. Size is checked
 * in the app (KV's own hard limit is 25 MB); we cap well below that so a
 * background image stays small enough to serve quickly.
 */
export function validateImageUpload({
  contentType,
  size,
}: {
  contentType: string;
  size: number;
}): string | null {
  if (size <= 0) return "Choose an image file to upload.";
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return "File must be a PNG, JPEG, WebP, GIF, or AVIF image.";
  }
  if (size > MAX_UPLOAD_BYTES) return "Image is too large (max 5 MB).";
  return null;
}
