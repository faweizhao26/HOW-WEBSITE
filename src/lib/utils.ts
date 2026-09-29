import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getContentMode } from "@/lib/content/mode"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isMockMode(): boolean {
  return getContentMode() === "mock"
}
