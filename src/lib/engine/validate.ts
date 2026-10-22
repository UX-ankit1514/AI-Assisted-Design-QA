/* Stage A — validation (PRD §9.3). Pure functions so they can be unit-tested without a browser. */

/*
 * Limits sized for long landing pages: a 1440 px page up to ~44,000 px tall, or a 2x export up to ~22,000 px.
 * (The PRD's 10 MB / 12 MP suggestion blocked real full-page captures, so they were raised.) Comparison runs
 * in horizontal bands, so memory stays flat; the remaining caps keep decoding within what browsers allow.
 */
export const LIMITS = {
  maxBytes: 50 * 1024 * 1024,
  maxPixels: 64_000_000,
  /** Canvas side limit in Chrome, Edge, Firefox and Safari is 32,767 px; stay just under it. */
  maxSide: 32_000,
  minSide: 16,
} as const;

export type ImageFormat = "png" | "jpeg" | "webp";

export const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export const ACCEPT_ATTRIBUTE = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

export type FileProblemCode = "empty" | "unsupported-format" | "too-large" | "too-many-pixels" | "too-small" | "side-too-long" | "unreadable";

export interface FileProblem {
  code: FileProblemCode;
  /** What happened, in one sentence. */
  message: string;
  /** What to do about it. */
  action: string;
}

export type FileCheck = { ok: true; format: ImageFormat } | { ok: false; problem: FileProblem };

/** Identifies the real format from the file's first bytes; the extension and MIME type can lie. */
export function sniffFormat(head: Uint8Array): ImageFormat | null {
  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a) {
    return "png";
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (
    head.length >= 12 &&
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && // RIFF
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50 // WEBP
  ) {
    return "webp";
  }
  return null;
}

function u16be(b: Uint8Array, i: number) {
  return (b[i] << 8) | b[i + 1];
}
function u32be(b: Uint8Array, i: number) {
  return ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
}
function u24le(b: Uint8Array, i: number) {
  return b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
}

const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * Pixel size from the file header, without decoding — lets an oversized image be rejected instantly instead
 * of after a slow, memory-hungry decode. Returns null if the header isn't in the bytes provided.
 */
export function readHeaderSize(head: Uint8Array, format: ImageFormat): { width: number; height: number } | null {
  if (format === "png") {
    // IHDR is always the first chunk: width and height follow the chunk type. A damaged file has no IHDR.
    const isIhdr = head.length >= 24 && head[12] === 0x49 && head[13] === 0x48 && head[14] === 0x44 && head[15] === 0x52;
    return isIhdr ? { width: u32be(head, 16), height: u32be(head, 20) } : null;
  }
  if (format === "webp") {
    if (head.length < 30) return null;
    const chunk = String.fromCharCode(head[12], head[13], head[14], head[15]);
    if (chunk === "VP8X") return { width: u24le(head, 24) + 1, height: u24le(head, 27) + 1 };
    if (chunk === "VP8 ") return { width: (head[26] | (head[27] << 8)) & 0x3fff, height: (head[28] | (head[29] << 8)) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = head[21] | (head[22] << 8) | (head[23] << 16) | (head[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  // JPEG: walk the markers to the first start-of-frame.
  let i = 2;
  while (i + 9 < head.length) {
    if (head[i] !== 0xff) return null;
    const marker = head[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (JPEG_SOF.has(marker)) return { width: u16be(head, i + 7), height: u16be(head, i + 5) };
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    i += 2 + u16be(head, i + 2);
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Checks size and real format before anything is decoded. */
export function checkFile(file: { size: number }, head: Uint8Array): FileCheck {
  if (file.size === 0) {
    return { ok: false, problem: { code: "empty", message: "This file is empty.", action: "Export the screenshot again and upload the new file." } };
  }
  if (file.size > LIMITS.maxBytes) {
    return {
      ok: false,
      problem: {
        code: "too-large",
        message: `This file is ${formatBytes(file.size)}. The limit is ${formatBytes(LIMITS.maxBytes)}.`,
        action: "Export at 1x instead of 2x, or save it as WebP or JPG to make it smaller.",
      },
    };
  }
  const format = sniffFormat(head);
  if (!format) {
    return {
      ok: false,
      problem: {
        code: "unsupported-format",
        message: "This isn't a PNG, JPG or WebP image.",
        action: "Export the screen from Figma or your browser as PNG and try again.",
      },
    };
  }
  return { ok: true, format };
}

/** Checks the decoded pixel dimensions of one image. */
export function checkDimensions(width: number, height: number): FileProblem | null {
  if (width < LIMITS.minSide || height < LIMITS.minSide) {
    return { code: "too-small", message: `This image is only ${width} × ${height} px.`, action: "Upload a full screen or section screenshot." };
  }
  if (width > LIMITS.maxSide || height > LIMITS.maxSide) {
    return {
      code: "side-too-long",
      message: `This image is ${width.toLocaleString("en-GB")} × ${height.toLocaleString("en-GB")} px — one side is longer than ${LIMITS.maxSide.toLocaleString("en-GB")} px.`,
      action: "Export at 1x instead of 2x, or split the page into two comparisons (top half and bottom half).",
    };
  }
  if (width * height > LIMITS.maxPixels) {
    return {
      code: "too-many-pixels",
      message: `This image has ${((width * height) / 1_000_000).toFixed(1)} megapixels (${width.toLocaleString("en-GB")} × ${height.toLocaleString("en-GB")} px). The limit is ${LIMITS.maxPixels / 1_000_000}.`,
      action: "Export at 1x instead of 2x, or split the page into two comparisons (top half and bottom half).",
    };
  }
  return null;
}

export interface DimensionMismatch {
  message: string;
  action: string;
}

/** Both screenshots must have identical pixel dimensions — we never stretch or crop to force a match (PRD Step 2). */
export function checkMatchingDimensions(design: { width: number; height: number }, build: { width: number; height: number }): DimensionMismatch | null {
  if (design.width === build.width && design.height === build.height) return null;
  const message = `The design is ${design.width} × ${design.height} px but the website screenshot is ${build.width} × ${build.height} px.`;
  const ratioW = build.width / design.width;
  const ratioH = build.height / design.height;
  const isScale = (r: number) => Math.abs(r - 2) < 0.01 || Math.abs(r - 0.5) < 0.01 || Math.abs(r - 3) < 0.01 || Math.abs(r - 1 / 3) < 0.01;
  if (isScale(ratioW) && Math.abs(ratioW - ratioH) < 0.01) {
    return {
      message,
      action:
        ratioW > 1
          ? `The website screenshot looks like a ${Math.round(ratioW)}x (Retina) capture. Export the Figma frame at ${Math.round(ratioW)}x, or capture the website at 1x.`
          : `The design looks like a ${Math.round(1 / ratioW)}x export. Export the Figma frame at 1x, or capture the website at ${Math.round(1 / ratioW)}x.`,
    };
  }
  if (design.width === build.width) {
    return {
      message,
      action: "The widths match but the heights don't. Capture the full page at the same height as the Figma frame, or crop both to the same section.",
    };
  }
  return {
    message,
    action: "Capture the website at the same viewport width as the Figma frame (for example 1440 px), then upload both again.",
  };
}
