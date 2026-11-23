import crypto from "crypto";
import sharp from "sharp";

export class InvalidImageError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidImageError";
  }
}

/**
 * Detects image MIME type from real file bytes (magic numbers).
 * Rejects SVG, GIF, HTML, PDF, empty files, and renamed text.
 * @param {Buffer} buffer
 * @returns {"jpeg" | "png" | "webp" | null}
 */
export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return "webp";
  }

  return null;
}

/**
 * Re-encodes, auto-orients, crops to 512x512 square, and converts to WebP.
 * Strips all EXIF metadata (GPS, device details) for privacy.
 * Limits input pixels to 25 megapixels to protect against decompression bombs.
 * @param {Buffer} buffer
 */
export async function processAvatar(buffer) {
  try {
    const processedBuffer = await sharp(buffer, {
      failOn: "error",
      limitInputPixels: 25000000, // ~25 MP cap
    })
      .rotate() // Auto-orient based on EXIF before stripping
      .resize(512, 512, {
        fit: "cover",
        position: "centre",
      })
      .webp({
        quality: 80,
      })
      .toBuffer();

    return {
      buffer: processedBuffer,
      contentType: "image/webp",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to process image";
    throw new InvalidImageError(`Corrupt or invalid image file: ${msg}`);
  }
}

/**
 * Builds a deterministic avatar filename with user UUID and 16 hex chars.
 * Format: <userId>-<16 lowercase hex chars>.webp
 */
export function buildAvatarFileName(userId, randomHex) {
  const hex = randomHex || crypto.randomBytes(8).toString("hex").toLowerCase();
  return `${userId}-${hex}.webp`;
}

/**
 * Strict regex validation for avatar file names:
 * User UUID (8-4-4-4-12 hex) + "-" + 16 lowercase hex + ".webp".
 * Blocks directory traversal (.., /, \), uppercase, or non-webp extensions.
 */
const AVATAR_FILE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}\.webp$/;

export function isValidAvatarFileName(fileName) {
  if (!fileName || typeof fileName !== "string") return false;
  return AVATAR_FILE_REGEX.test(fileName);
}

/**
 * Validates an avatar URL string for user profile updates.
 * Accepts:
 * 1. Empty string, null, or undefined.
 * 2. Absolute http(s) URL (e.g. Unsplash).
 * 3. Exact local path `/api/avatars/<validFileName>` starting with the caller's userId.
 * Rejects other users' avatar files and any other relative path.
 */
export function isValidAvatarUrl(url, callerUserId) {
  if (!url || url.trim() === "") return true;

  const trimmed = url.trim();

  // 1. External http(s) URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      new URL(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  // 2. Local avatar endpoint path: must start with /api/avatars/
  const prefix = "/api/avatars/";
  if (trimmed.startsWith(prefix)) {
    const fileName = trimmed.slice(prefix.length);
    if (!isValidAvatarFileName(fileName)) {
      return false;
    }
    // Caller ownership check: fileName must begin with caller's userId
    if (callerUserId) {
      if (!fileName.startsWith(`${callerUserId}-`)) {
        return false;
      }
    }
    return true;
  }

  // Reject all other relative paths (e.g. /etc/passwd, ../file, etc.)
  return false;
}

