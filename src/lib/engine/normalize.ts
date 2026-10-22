import type { RasterImage } from "./types";

/*
 * Stage B — normalise (PRD §9.3). Both images are composited onto white so a transparent Figma export
 * and an opaque browser screenshot compare like for like. Nothing is ever cropped, resized or stretched.
 */
export function flattenPixels(src: Uint8ClampedArray | Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3];
    if (a === 255) {
      out[i] = src[i];
      out[i + 1] = src[i + 1];
      out[i + 2] = src[i + 2];
    } else {
      const k = a / 255;
      const w = 255 * (1 - k);
      out[i] = src[i] * k + w;
      out[i + 1] = src[i + 1] * k + w;
      out[i + 2] = src[i + 2] * k + w;
    }
    out[i + 3] = 255;
  }
  return out;
}

export function flattenOnWhite(image: RasterImage): RasterImage {
  return { width: image.width, height: image.height, data: flattenPixels(image.data) };
}

/** Rec. 709 luma of one flattened RGBA pixel, 0–255. */
export function lumaAt(data: Uint8ClampedArray | Uint8Array, i: number): number {
  return (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) | 0;
}
