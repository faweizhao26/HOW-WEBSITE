import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isMockMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !url || url.includes("placeholder")
}
