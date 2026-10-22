import type { RasterImage, Rect } from "@/lib/engine/types";

/* Tiny drawing kit for controlled comparison fixtures (PRD §15). Everything is drawn in memory. */

export type RGB = [number, number, number];
export const WHITE: RGB = [255, 255, 255];
export const INK: RGB = [33, 39, 42];
export const BRAND: RGB = [46, 46, 163];
export const BRAND_OFF: RGB = [57, 57, 204];

export function blank(width: number, height: number, bg: RGB = WHITE, alpha = 255): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bg[0];
    data[i + 1] = bg[1];
    data[i + 2] = bg[2];
    data[i + 3] = alpha;
  }
  return { width, height, data };
}

export function clone(img: RasterImage): RasterImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

export function fillRect(img: RasterImage, x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = Math.max(0, y); yy < Math.min(img.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(img.width, x + w); xx++) {
      const i = (yy * img.width + xx) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
}

/** A line of "text": glyph-like blocks of the given height with small gaps. */
export function textLine(img: RasterImage, x: number, y: number, chars: number, glyph: number, c: RGB = INK): Rect {
  const advance = Math.round(glyph * 0.7);
  for (let i = 0; i < chars; i++) {
    if (i % 6 === 5) continue; // word gap
    fillRect(img, x + i * advance, y, Math.max(1, advance - Math.max(1, Math.round(glyph / 6))), glyph, c);
  }
  return { x, y, width: chars * advance, height: glyph };
}

export interface PageOptions {
  headingGlyph?: number;
  buttonColour?: RGB;
  cardsOffsetY?: number;
  showIcon?: boolean;
  footerLink?: RGB;
}

/** An 800 × 640 landing page: nav, hero heading, paragraph, CTA, three cards with icons, footer links. */
export function page(opts: PageOptions = {}): RasterImage {
  const img = blank(800, 640);
  fillRect(img, 0, 0, 800, 56, [245, 245, 255]);
  textLine(img, 40, 20, 8, 14, BRAND);
  textLine(img, 520, 22, 18, 12);
  textLine(img, 40, 96, 22, opts.headingGlyph ?? 32, [22, 22, 122]);
  textLine(img, 40, 150, 40, 12);
  textLine(img, 40, 170, 34, 12);
  fillRect(img, 40, 208, 180, 44, opts.buttonColour ?? BRAND);
  textLine(img, 64, 222, 12, 14, WHITE);
  const cy = 300 + (opts.cardsOffsetY ?? 0);
  for (let i = 0; i < 3; i++) {
    const x = 40 + i * 250;
    fillRect(img, x, cy, 220, 160, [242, 244, 248]);
    if (opts.showIcon !== false || i !== 1) {
      fillRect(img, x + 20, cy + 20, 36, 36, [235, 235, 255]);
      fillRect(img, x + 29, cy + 29, 18, 18, BRAND);
    }
    textLine(img, x + 20, cy + 76, 18, 14);
    textLine(img, x + 20, cy + 100, 26, 10, [105, 112, 119]);
    textLine(img, x + 20, cy + 116, 22, 10, [105, 112, 119]);
  }
  fillRect(img, 0, 560, 800, 80, [247, 243, 242]);
  textLine(img, 40, 590, 12, 12, opts.footerLink ?? INK);
  textLine(img, 240, 590, 12, 12);
  return img;
}

/** Moves the whole image content by (dx, dy), filling the exposed edge with white. */
export function shift(img: RasterImage, dx: number, dy: number): RasterImage {
  const out = blank(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= img.height) continue;
    for (let x = 0; x < img.width; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= img.width) continue;
      const s = (sy * img.width + sx) * 4;
      const d = (y * img.width + x) * 4;
      out.data[d] = img.data[s];
      out.data[d + 1] = img.data[s + 1];
      out.data[d + 2] = img.data[s + 2];
      out.data[d + 3] = img.data[s + 3];
    }
  }
  return out;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Deterministic pseudo-random generator so noise fixtures are repeatable. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
