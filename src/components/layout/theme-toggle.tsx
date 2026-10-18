"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"

type Theme = "dark" | "light"

function currentTheme(fallback: Theme): Theme {
  const classes = document.documentElement.classList
  if (classes.contains("light")) return "light"
  if (classes.contains("dark")) return "dark"
  return fallback
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light")
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const theme = useSyncExternalStore(subscribeTheme, () => currentTheme(initialTheme), () => initialTheme)

  function toggleTheme() {
    const nextTheme = currentTheme(initialTheme) === "dark" ? "light" : "dark"
    applyTheme(nextTheme)
    localStorage.setItem("theme", nextTheme)
    document.cookie = `theme=${nextTheme};path=/;max-age=31536000;SameSite=Lax`
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
      title={theme === "dark" ? "Day mode" : "Night mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
