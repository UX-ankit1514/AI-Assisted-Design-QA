import type { ImageSource, RasterImage } from "./types";

export function isImageSource(image: RasterImage | ImageSource): image is ImageSource {
  return typeof (image as ImageSource).readRect === "function";
}

/** Wraps already-decoded pixels (tests, small images) in the same interface the browser decoder uses. */
export function rasterSource(image: RasterImage): ImageSource {
  const { width, height, data } = image;
  return {
    width,
    height,
    readRect(x, y, w, h) {
      if (x === 0 && w === width) return data.subarray(y * width * 4, (y + h) * width * 4);
      const out = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row++) {
        const start = ((y + row) * width + x) * 4;
        out.set(data.subarray(start, start + w * 4), row * w * 4);
      }
      return out;
    },
  };
}

export function toSource(image: RasterImage | ImageSource): ImageSource {
  return isImageSource(image) ? image : rasterSource(image);
}
