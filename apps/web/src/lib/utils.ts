import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Birbiriyle çakışan Tailwind sınıflarını güvenle birleştirir. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
