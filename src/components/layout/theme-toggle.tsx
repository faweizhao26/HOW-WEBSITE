"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"

type Theme = "dark" | "light"

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light")
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    applyTheme(nextTheme)
    localStorage.setItem("theme", nextTheme)
    document.cookie = `theme=${nextTheme};path=/;max-age=31536000;SameSite=Lax`
    setTheme(nextTheme)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
      title={theme === "dark" ? "Day mode" : "Night mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
