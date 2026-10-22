import { describe, expect, it } from "vitest";
import { checkDimensions, checkFile, checkMatchingDimensions, LIMITS, readHeaderSize, sniffFormat } from "@/lib/engine/validate";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);

describe("image validation", () => {
  it("identifies PNG, JPG and WebP by their bytes, not their name", () => {
    expect(sniffFormat(PNG)).toBe("png");
    expect(sniffFormat(JPEG)).toBe("jpeg");
    expect(sniffFormat(WEBP)).toBe("webp");
    expect(sniffFormat(GIF)).toBeNull();
    expect(sniffFormat(new TextEncoder().encode("hello world!"))).toBeNull();
  });

  it("accepts supported files within the size limit", () => {
    expect(checkFile({ size: 1024 }, PNG)).toEqual({ ok: true, format: "png" });
  });

  it("rejects unsupported formats with a recovery action", () => {
    const result = checkFile({ size: 1024 }, GIF);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.code).toBe("unsupported-format");
      expect(result.problem.action).toMatch(/PNG/);
    }
  });

  it("rejects empty and oversized files", () => {
    const empty = checkFile({ size: 0 }, PNG);
    expect(!empty.ok && empty.problem.code).toBe("empty");
    const big = checkFile({ size: LIMITS.maxBytes + 1 }, PNG);
    expect(!big.ok && big.problem.code).toBe("too-large");
    expect(!big.ok && big.problem.message).toMatch(/50\.0 MB/);
  });

  it("accepts long landing pages and limits only extreme sizes", () => {
    expect(checkDimensions(1440, 4000)).toBeNull();
    expect(checkDimensions(2312, 9040)).toBeNull(); // the 20.9 MP Figma export that used to be rejected
    expect(checkDimensions(1440, 30_000)).toBeNull();
    expect(checkDimensions(2880, 22_000)).toBeNull();
    expect(checkDimensions(8000, 8001)?.code).toBe("too-many-pixels");
    expect(checkDimensions(1440, 40_000)?.code).toBe("side-too-long");
    expect(checkDimensions(8, 8)?.code).toBe("too-small");
  });

  it("reads the pixel size from PNG, JPEG and WebP headers without decoding", () => {
    const png = new Uint8Array(32);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x05, 0xa0, 0, 0, 0x75, 0x30]);
    expect(readHeaderSize(png, "png")).toEqual({ width: 1440, height: 30_000 });

    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x23, 0x50, 0x05, 0xa0, 0x03, 0, 0, 0, 0, 0, 0]);
    expect(readHeaderSize(jpeg, "jpeg")).toEqual({ width: 1440, height: 9040 });

    const webp = new Uint8Array(32);
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58]);
    webp.set([0x9f, 0x05, 0x00, 0x2f, 0x75, 0x00], 24); // VP8X canvas 1440 × 30,000 (stored minus one, 24-bit LE)
    expect(readHeaderSize(webp, "webp")).toEqual({ width: 1440, height: 30_000 });
  });

  it("doesn't trust the size of a damaged PNG", () => {
    const corrupt = new Uint8Array(32);
    corrupt.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    corrupt.set(new TextEncoder().encode("this is not image data"), 8);
    expect(readHeaderSize(corrupt, "png")).toBeNull();
  });

  it("requires matching dimensions and explains Retina captures", () => {
    expect(checkMatchingDimensions({ width: 1440, height: 900 }, { width: 1440, height: 900 })).toBeNull();
    const retina = checkMatchingDimensions({ width: 1440, height: 900 }, { width: 2880, height: 1800 });
    expect(retina?.message).toMatch(/1440 × 900/);
    expect(retina?.action).toMatch(/2x/);
    const height = checkMatchingDimensions({ width: 1440, height: 3200 }, { width: 1440, height: 3184 });
    expect(height?.action).toMatch(/heights don't/);
    const width = checkMatchingDimensions({ width: 1440, height: 900 }, { width: 1280, height: 900 });
    expect(width?.action).toMatch(/viewport width/);
  });
});
