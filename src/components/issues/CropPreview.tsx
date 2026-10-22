"use client";

import type { Rect } from "@/lib/engine/types";
import { cn } from "@/lib/cn";
import { useImageUrl } from "@/lib/store/hooks";

interface CropPreviewProps {
  imageId: string;
  image: { width: number; height: number };
  region: Rect;
  width: number;
  height: number;
  alt: string;
  outline?: boolean;
  className?: string;
}

/*
 * A crop of a stored screenshot around one region, drawn with a CSS transform — no extra images are stored.
 * A little context around the region is kept so you can tell where it sits.
 */
export function CropPreview({ imageId, image, region, width, height, alt, outline = true, className }: CropPreviewProps) {
  const { url, failed } = useImageUrl(imageId);
  const padX = Math.max(12, region.width * 0.2);
  const padY = Math.max(12, region.height * 0.2);
  const vx = Math.max(0, region.x - padX);
  const vy = Math.max(0, region.y - padY);
  const vw = Math.min(image.width, region.x + region.width + padX) - vx;
  const vh = Math.min(image.height, region.y + region.height + padY) - vy;
  const scale = Math.min(width / vw, height / vh, 4);
  const ox = (width - vw * scale) / 2 - vx * scale;
  const oy = (height - vh * scale) / 2 - vy * scale;

  return (
    <div role="img" aria-label={alt} className={cn("relative shrink-0 overflow-hidden rounded-control border border-line bg-white", className)} style={{ width, height }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: image.width,
            height: image.height,
            maxWidth: "none",
            transformOrigin: "0 0",
            transform: `translate(${ox}px, ${oy}px) scale(${scale})`,
            imageRendering: scale >= 2 ? "pixelated" : "auto",
          }}
        />
      ) : failed ? (
        <div className="absolute inset-0 bg-cool" />
      ) : (
        <div className="skeleton absolute inset-0 rounded-none" />
      )}
      {outline && (
        <div
          aria-hidden
          className="absolute border border-ruby-600"
          style={{ left: region.x * scale + ox, top: region.y * scale + oy, width: region.width * scale, height: region.height * scale }}
        />
      )}
    </div>
  );
}
