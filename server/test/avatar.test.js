import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  detectImageType,
  processAvatar,
  buildAvatarFileName,
  isValidAvatarFileName,
  isValidAvatarUrl,
  InvalidImageError,
} from "../src/lib/avatar.js";
import {
  LocalDiskAvatarStorage,
  MongoAvatarStorage,
  createAvatarStorage,
} from "../src/lib/avatar-storage.js";

describe("detectImageType (Magic Number Validation)", () => {
  it("detects JPEG buffers via FF D8 FF signature", async () => {
    const jpegBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    expect(detectImageType(jpegBuffer)).toBe("jpeg");
  });

  it("detects PNG buffers via 89 50 4E 47 signature", async () => {
    const pngBuffer = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();

    expect(detectImageType(pngBuffer)).toBe("png");
  });

  it("detects WebP buffers via RIFF....WEBP signature", async () => {
    const webpBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .webp()
      .toBuffer();

    expect(detectImageType(webpBuffer)).toBe("webp");
  });

  it("rejects SVG XML text", () => {
    const svgBuffer = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script></svg>`
    );
    expect(detectImageType(svgBuffer)).toBeNull();
  });

  it("rejects GIF images", async () => {
    const gifBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 255, b: 0 } },
    })
      .gif()
      .toBuffer();

    expect(detectImageType(gifBuffer)).toBeNull();
  });

  it("rejects PDF documents (%PDF header)", () => {
    const pdfBuffer = Buffer.from("%PDF-1.4\n%...\n1 0 obj\n<<>>\nendobj");
    expect(detectImageType(pdfBuffer)).toBeNull();
  });

  it("rejects empty buffers and short byte sequences", () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it("rejects text files renamed to .png", () => {
    const textBuffer = Buffer.from("Hello world, this is a plain text file pretending to be an image.");
    expect(detectImageType(textBuffer)).toBeNull();
  });
});

describe("processAvatar (Re-encoding, Resizing, & Metadata Stripping)", () => {
  it("processes a non-square image to a 512x512 WebP image", async () => {
    const input = await sharp({
      create: { width: 800, height: 400, channels: 3, background: { r: 120, g: 150, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const result = await processAvatar(input);

    expect(result.contentType).toBe("image/webp");
    expect(detectImageType(result.buffer)).toBe("webp");

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
  });

  it("strips all EXIF metadata including GPS coordinates from photos", async () => {
    // Construct a JPEG with custom EXIF tags including GPS
    const rawWithExif = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg()
      .withExif({
        IFD0: {
          Make: "SkillSwapCamera",
          Model: "TestPhone12",
        },
        IFD3: {
          GPSLatitudeRef: "N",
          GPSLatitude: "12/1 58/1 0/1",
          GPSLongitudeRef: "E",
          GPSLongitude: "77/1 35/1 0/1",
        },
      })
      .toBuffer();

    // Verify input actually contains EXIF data
    const inputMeta = await sharp(rawWithExif).metadata();
    expect(inputMeta.exif).toBeDefined();

    // Process avatar
    const processed = await processAvatar(rawWithExif);

    // Verify output has zero EXIF or GPS metadata
    const outputMeta = await sharp(processed.buffer).metadata();
    expect(outputMeta.exif).toBeUndefined();
    expect(outputMeta.format).toBe("webp");
  });

  it("throws InvalidImageError on corrupt image buffer", async () => {
    // Starts with JPEG magic bytes but has corrupted payload
    const corruptBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x00]);

    await expect(processAvatar(corruptBuffer)).rejects.toThrow(InvalidImageError);
  });
});

describe("buildAvatarFileName & isValidAvatarFileName", () => {
  const userId = "35a575ce-0109-4591-9f5e-97bb9b100442";

  it("generates deterministic filename with provided random hex", () => {
    const fileName = buildAvatarFileName(userId, "0123456789abcdef");
    expect(fileName).toBe("35a575ce-0109-4591-9f5e-97bb9b100442-0123456789abcdef.webp");
    expect(isValidAvatarFileName(fileName)).toBe(true);
  });

  it("generates valid random filename when hex is omitted", () => {
    const fileName = buildAvatarFileName(userId);
    expect(fileName.startsWith(`${userId}-`)).toBe(true);
    expect(fileName.endsWith(".webp")).toBe(true);
    expect(isValidAvatarFileName(fileName)).toBe(true);
  });

  it("rejects path traversal attempts", () => {
    expect(isValidAvatarFileName("../x.webp")).toBe(false);
    expect(isValidAvatarFileName("..%2fx.webp")).toBe(false);
    expect(isValidAvatarFileName("/35a575ce-0109-4591-9f5e-97bb9b100442-0123456789abcdef.webp")).toBe(false);
    expect(isValidAvatarFileName("dir/35a575ce-0109-4591-9f5e-97bb9b100442-0123456789abcdef.webp")).toBe(false);
  });

  it("rejects non-webp extensions or uppercase characters", () => {
    expect(isValidAvatarFileName("35a575ce-0109-4591-9f5e-97bb9b100442-0123456789abcdef.png")).toBe(false);
    expect(isValidAvatarFileName("35a575ce-0109-4591-9f5e-97bb9b100442-0123456789abcdef.jpeg")).toBe(false);
    expect(isValidAvatarFileName("35a575ce-0109-4591-9f5e-97bb9b100442-0123456789ABCDEF.webp")).toBe(false);
  });

  it("rejects malformed UUIDs or invalid hex lengths", () => {
    expect(isValidAvatarFileName("short-id-0123456789abcdef.webp")).toBe(false);
    expect(isValidAvatarFileName(`${userId}-shorthex.webp`)).toBe(false);
    expect(isValidAvatarFileName(`${userId}-toolong0123456789abcdef12.webp`)).toBe(false);
  });
});

describe("isValidAvatarUrl (Profile PUT Validation)", () => {
  const myUserId = "35a575ce-0109-4591-9f5e-97bb9b100442";
  const otherUserId = "236bd8b3-f28b-4381-bc18-fdc301cc8744";

  it("accepts null, undefined, and empty string", () => {
    expect(isValidAvatarUrl(null, myUserId)).toBe(true);
    expect(isValidAvatarUrl(undefined, myUserId)).toBe(true);
    expect(isValidAvatarUrl("", myUserId)).toBe(true);
    expect(isValidAvatarUrl("   ", myUserId)).toBe(true);
  });

  it("accepts external http(s) URLs (e.g. Unsplash)", () => {
    expect(
      isValidAvatarUrl(
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        myUserId
      )
    ).toBe(true);
    expect(isValidAvatarUrl("http://example.com/avatar.jpg", myUserId)).toBe(true);
  });

  it("accepts the caller's own /api/avatars/ path", () => {
    const ownPath = `/api/avatars/${myUserId}-0123456789abcdef.webp`;
    expect(isValidAvatarUrl(ownPath, myUserId)).toBe(true);
  });

  it("rejects another user's /api/avatars/ path", () => {
    const othersPath = `/api/avatars/${otherUserId}-0123456789abcdef.webp`;
    expect(isValidAvatarUrl(othersPath, myUserId)).toBe(false);
  });

  it("rejects arbitrary relative or local file paths", () => {
    expect(isValidAvatarUrl("/etc/passwd", myUserId)).toBe(false);
    expect(isValidAvatarUrl("../storage/secret.webp", myUserId)).toBe(false);
    expect(isValidAvatarUrl("/images/avatar.jpg", myUserId)).toBe(false);
    expect(isValidAvatarUrl("/api/avatars/malicious.js", myUserId)).toBe(false);
  });
});

describe("MongoAvatarStorage Unit Tests", () => {
  it("saves, reads, and deletes avatar bytes via Prisma AvatarFile model", async () => {
    const store = new Map();
    const fakePrisma = {
      avatarFile: {
        upsert: async ({ where, update, create }) => {
          const doc = { ...(store.get(where.id) || create), ...update };
          store.set(where.id, doc);
          return doc;
        },
        findUnique: async ({ where }) => store.get(where.id) || null,
        delete: async ({ where }) => {
          if (!store.has(where.id)) {
            const err = new Error("Record not found");
            err.code = "P2025";
            throw err;
          }
          store.delete(where.id);
          return { id: where.id };
        },
      },
    };

    const storage = new MongoAvatarStorage(fakePrisma);
    const fileName = "35a575ce-0109-4591-9f5e-97bb9b100442-0123456789abcdef.webp";
    const buffer = Buffer.from("fake-webp-image-data");

    // Save
    await storage.save(fileName, buffer, { userId: "35a575ce-0109-4591-9f5e-97bb9b100442" });
    expect(store.has(fileName)).toBe(true);
    expect(store.get(fileName).size).toBe(buffer.length);

    // Read
    const readBuffer = await storage.read(fileName);
    expect(readBuffer).toEqual(buffer);

    // Delete
    const deleted = await storage.delete(fileName);
    expect(deleted).toBe(true);
    expect(store.has(fileName)).toBe(false);

    // Read non-existent
    const readAfterDelete = await storage.read(fileName);
    expect(readAfterDelete).toBeNull();

    // Delete non-existent
    const deleteAgain = await storage.delete(fileName);
    expect(deleteAgain).toBe(false);
  });

  it("createAvatarStorage returns MongoAvatarStorage by default and LocalDiskAvatarStorage when strategy is disk", () => {
    const defaultStorage = createAvatarStorage("mongo");
    expect(defaultStorage).toBeInstanceOf(MongoAvatarStorage);

    const diskStorage = createAvatarStorage("disk");
    expect(diskStorage).toBeInstanceOf(LocalDiskAvatarStorage);
  });
});

