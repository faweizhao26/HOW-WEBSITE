"use client"

import { useEffect, useState } from "react"

export function Countdown({ target, locale }: { target: string; locale: string }) {
  const [time, setTime] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)

  useEffect(() => {
    // Parse: "2027.4.26" or "2027-04-26" -> Date
    const raw = target || "2027-04-26"
    const nums = raw.split(/[.\-/]/).map(Number).filter(n => !isNaN(n))
    let targetMs = Date.UTC(2027, 3, 26) // fallback
    if (nums.length >= 3) {
      targetMs = Date.UTC(nums[0], nums[1] - 1, nums[2])
    }

    function tick() {
      const diff = targetMs - Date.now()
      if (diff <= 0) { setTime(null); return }
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [target])

  if (!time) return null

  const labels = locale === "zh" ? ["天", "时", "分", "秒"] : ["D", "H", "M", "S"]

  return (
    <div className="mt-10 flex items-center gap-2 sm:gap-4">
      {[{ v: time.days, l: labels[0] }, { v: time.hours, l: labels[1] }, { v: time.minutes, l: labels[2] }, { v: time.seconds, l: labels[3] }].map((item, i) => (
        <div key={i} className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center">
            <span className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums bg-gradient-to-b from-white to-zinc-300 bg-clip-text text-transparent">
              {String(item.v).padStart(2, "0")}
            </span>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 mt-1">{item.l}</span>
          </div>
          {i < 3 && <span className="text-xl sm:text-2xl text-zinc-800 font-light self-start mt-1">:</span>}
        </div>
      ))}
    </div>
  )
}
