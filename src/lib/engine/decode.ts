import type { ImageSource } from "./types";

/*
 * Browser decoding (PRD §9.2: Canvas APIs). Works on the main thread and inside a worker.
 * Embedded colour profiles are converted to sRGB, so a Display P3 macOS screenshot and an sRGB Figma
 * export are compared in the same colour space.
 */

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function makeCanvas(width: number, height: number): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: Canvas2D } {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
    if (ctx) return { canvas, ctx };
  }
  if (typeof document === "undefined") throw new Error("No canvas available in this environment.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
  if (!ctx) throw new Error("Canvas 2D is not available.");
  return { canvas, ctx };
}

export async function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

export interface OpenedSource {
  source: ImageSource;
  close: () => void;
}

/**
 * Decodes an image once and hands out pixels band by band through one reusable canvas, so a very long
 * page never needs a full-size canvas or a full RGBA copy at the same time as everything else.
 */
export async function openBitmapSource(blob: Blob): Promise<OpenedSource> {
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "default", imageOrientation: "from-image" });
  let surface: ReturnType<typeof makeCanvas> | null = null;

  function surfaceFor(width: number, height: number) {
    if (!surface || surface.canvas.width < width || surface.canvas.height < height) {
      const w = Math.max(width, surface?.canvas.width ?? 0);
      const h = Math.max(height, surface?.canvas.height ?? 0);
      if (surface) {
        surface.canvas.width = w;
        surface.canvas.height = h;
      } else {
        surface = makeCanvas(w, h);
      }
      surface.ctx.imageSmoothingEnabled = false;
    }
    return surface;
  }

  const source: ImageSource = {
    width: bitmap.width,
    height: bitmap.height,
    readRect(x, y, width, height) {
      const { ctx } = surfaceFor(width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height, { colorSpace: "srgb" }).data;
    },
  };

  return {
    source,
    close: () => {
      bitmap.close();
      surface = null;
    },
  };
}

export async function encodePng(rgba: Uint8ClampedArray, width: number, height: number): Promise<Blob> {
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png"));
}
