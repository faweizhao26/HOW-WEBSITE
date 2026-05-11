"use client"

import { useEffect, useState } from "react"

export function Countdown({ target, locale }: { target: string; locale: string }) {
  const targetMs = (() => {
    const t = (target || "2027-04-26").replace(/\./g, "-").split(",")[0].trim()
    const d = new Date(t)
    return isNaN(d.getTime()) ? null : d.getTime()
  })()

  function calc() {
    if (!targetMs) return null
    const diff = targetMs - Date.now()
    if (diff <= 0) return null
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    }
  }

  const [time, setTime] = useState(calc)

  useEffect(() => {
    if (!targetMs) return
    const interval = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(interval)
  }, [targetMs])

  if (!time) return null

  const labels = locale === "zh" ? ["天", "时", "分", "秒"] : ["D", "H", "M", "S"]
  const nums = [time.days, time.hours, time.minutes, time.seconds]

  return (
    <div className="mt-10 flex items-center gap-2 sm:gap-4">
      {nums.map((n, i) => (
        <div key={i} className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center">
            <span className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums bg-gradient-to-b from-white to-zinc-300 bg-clip-text text-transparent">
              {String(n).padStart(2, "0")}
            </span>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 mt-1">{labels[i]}</span>
          </div>
          {i < 3 && <span className="text-xl sm:text-2xl text-zinc-800 font-light">:</span>}
        </div>
      ))}
    </div>
  )
}
