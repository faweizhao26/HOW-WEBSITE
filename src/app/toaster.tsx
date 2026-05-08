"use client"

import { Toaster as Sonner } from "sonner"

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#27272a",
          color: "#fafafa",
          border: "1px solid #3f3f46",
        },
      }}
    />
  )
}
