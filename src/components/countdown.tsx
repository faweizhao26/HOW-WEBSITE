"use client"

import { useEffect, useState } from "react"

export function Countdown({ target, locale }: { target: string; locale: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isPast, setIsPast] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const dates = (target || "2027-04-26").replace(/\./g, "-").split(",").map(s => s.trim()).filter(Boolean)
    if (!dates.length) return
    const targetDate = new Date(dates[0])
    if (isNaN(targetDate.getTime())) return

    function tick() {
      const now = Date.now()
      const diff = targetDate.getTime() - now
      if (diff <= 0) { setIsPast(true); return }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
      setReady(true)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [target])

  if (isPast) return null
  if (!ready) {
    // Show placeholder while client initializes
    return (
      <div className="mt-10 flex items-center gap-2 sm:gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums text-white/20">00</span>
              <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-600 mt-1.5">··</span>
            </div>
            {i < 3 && <span className="text-xl sm:text-2xl text-zinc-800 font-light">:</span>}
          </div>
        ))}
      </div>
    )
  }

  const labels = locale === "zh" ? ["天", "时", "分", "秒"] : ["D", "H", "M", "S"]
  const nums = [timeLeft.days, timeLeft.hours, timeLeft.minutes, timeLeft.seconds]

  return (
    <div className="mt-10 flex items-center gap-2 sm:gap-4">
      {nums.map((n, i) => (
        <div key={i} className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center">
            <div className="relative">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums bg-gradient-to-b from-white to-zinc-300 bg-clip-text text-transparent">
                {String(n).padStart(2, "0")}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 mt-1">{labels[i]}</span>
          </div>
          {i < 3 && <span className="text-xl sm:text-2xl text-zinc-800 font-light">:</span>}
        </div>
      ))}
    </div>
  )
}
