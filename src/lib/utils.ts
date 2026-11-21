import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom text sizes (tailwind.config.ts → fontSize).
// Without this, `text-body` looks like a text *color* and silently removes
// classes like `text-primary-foreground` (e.g. white text on buttons).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["large-title", "title", "headline", "body", "footnote", "caption"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
