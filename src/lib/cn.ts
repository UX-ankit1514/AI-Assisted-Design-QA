import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge has to know the DS scale names, otherwise `text-p3 text-ink` reads as two colours and one is dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["p1", "p2", "p3", "p4", "sh6", "sh7", "sh8", "l3", "l4", "sph5"],
      radius: ["cta", "control", "tile", "card", "panel"],
      shadow: ["raised", "hover", "overlay"],
    },
  },
});

/** Joins class names, skipping falsy values, and lets later Tailwind classes win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
