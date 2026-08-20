import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Keyboard users get nothing from hover styles, so every custom control carries this. */
export const focusRing =
  'outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring';
