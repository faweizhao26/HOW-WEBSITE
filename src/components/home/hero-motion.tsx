"use client"

import { useEffect, useRef } from "react"

type Dot = {
  x: number
  y: number
  vx: number
  vy: number
}

function makeDots(width: number, height: number) {
  const count = width < 760 ? 30 : 54

  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.18,
  }))
}

export function HeroMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const glow = glowRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !glow || !ctx) return
    const canvasElement = canvas
    const glowElement = glow
    const context = ctx

    const pointer = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let animationFrame = 0
    let tick = 0
    let width = 0
    let height = 0
    let dots: Dot[] = []

    function resize() {
      const rect = canvasElement.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)

      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvasElement.width = Math.floor(width * ratio)
      canvasElement.height = Math.floor(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      dots = makeDots(width, height)
    }

    function drawGrid(isLight: boolean) {
      const spacing = 64
      context.lineWidth = 1
      context.strokeStyle = isLight ? "rgba(15, 23, 42, 0.07)" : "rgba(148, 163, 184, 0.09)"

      for (let x = (tick * 0.18) % spacing; x < width; x += spacing) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }

      for (let y = (tick * 0.12) % spacing; y < height; y += spacing) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(width, y)
        context.stroke()
      }
    }

    function moveDot(dot: Dot) {
      dot.x += dot.vx
      dot.y += dot.vy

      if (pointer.active) {
        const dx = dot.x - pointer.x
        const dy = dot.y - pointer.y
        const distance = Math.hypot(dx, dy)

        if (distance > 0 && distance < 240) {
          const force = 1 - distance / 240
          dot.x += (dx / distance) * force * 1.6
          dot.y += (dy / distance) * force * 1.6
        }
      }

      if (dot.x < -20) dot.x = width + 20
      if (dot.x > width + 20) dot.x = -20
      if (dot.y < -20) dot.y = height + 20
      if (dot.y > height + 20) dot.y = -20
    }

    function render() {
      const isLight = document.documentElement.classList.contains("light")
      const base = context.createLinearGradient(0, 0, width, height)
      tick += reducedMotion ? 0 : 1
      if (pointer.active) {
        pointer.x += (pointer.targetX - pointer.x) * 0.18
        pointer.y += (pointer.targetY - pointer.y) * 0.18
      }

      base.addColorStop(0, isLight ? "#f8fafc" : "#020617")
      base.addColorStop(0.48, isLight ? "#ecfdf5" : "#042f2e")
      base.addColorStop(1, isLight ? "#ecfeff" : "#07111f")
      context.fillStyle = base
      context.fillRect(0, 0, width, height)

      drawGrid(isLight)

      const scanY = (tick * 1.35) % (height + 160) - 80
      const scan = context.createLinearGradient(0, scanY - 48, 0, scanY + 48)
      scan.addColorStop(0, "rgba(20, 184, 166, 0)")
      scan.addColorStop(0.5, isLight ? "rgba(8, 145, 178, 0.12)" : "rgba(45, 212, 191, 0.18)")
      scan.addColorStop(1, "rgba(20, 184, 166, 0)")
      context.fillStyle = scan
      context.fillRect(0, scanY - 48, width, 96)

      if (!reducedMotion) dots.forEach(moveDot)

      const linkDistance = width < 760 ? 120 : 165
      for (let i = 0; i < dots.length; i += 1) {
        const current = dots[i]

        for (let j = i + 1; j < dots.length; j += 1) {
          const next = dots[j]
          const distance = Math.hypot(current.x - next.x, current.y - next.y)
          if (distance >= linkDistance) continue

          const alpha = (1 - distance / linkDistance) * 0.34
          context.strokeStyle = isLight ? `rgba(6, 95, 70, ${alpha})` : `rgba(94, 234, 212, ${alpha})`
          context.beginPath()
          context.moveTo(current.x, current.y)
          context.lineTo(next.x, next.y)
          context.stroke()
        }

        context.fillStyle = isLight ? "rgba(5, 150, 105, 0.82)" : "rgba(94, 234, 212, 0.88)"
        context.fillRect(current.x - 1.5, current.y - 1.5, 3, 3)
      }

      if (pointer.active) {
        const light = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 340)
        light.addColorStop(0, isLight ? "rgba(6, 182, 212, 0.38)" : "rgba(45, 212, 191, 0.42)")
        light.addColorStop(0.34, isLight ? "rgba(16, 185, 129, 0.18)" : "rgba(34, 211, 238, 0.18)")
        light.addColorStop(1, "rgba(45, 212, 191, 0)")
        context.fillStyle = light
        context.fillRect(pointer.x - 340, pointer.y - 340, 680, 680)

        context.lineWidth = 1.4
        for (const dot of dots) {
          const distance = Math.hypot(dot.x - pointer.x, dot.y - pointer.y)
          if (distance > 260) continue
          const alpha = (1 - distance / 260) * 0.62
          context.strokeStyle = isLight ? `rgba(8, 145, 178, ${alpha})` : `rgba(125, 249, 255, ${alpha})`
          context.beginPath()
          context.moveTo(pointer.x, pointer.y)
          context.lineTo(dot.x, dot.y)
          context.stroke()
        }

        context.strokeStyle = isLight ? "rgba(8, 145, 178, 0.55)" : "rgba(94, 234, 212, 0.7)"
        context.beginPath()
        context.arc(pointer.x, pointer.y, 18 + Math.sin(tick / 12) * 4, 0, Math.PI * 2)
        context.stroke()
      }

      if (!reducedMotion) animationFrame = requestAnimationFrame(render)
    }

    function movePointer(event: PointerEvent) {
      const rect = canvasElement.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const active = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height

      pointer.active = active
      glowElement.style.opacity = active ? "1" : "0"
      if (!active) return
      pointer.targetX = x
      pointer.targetY = y
      glowElement.style.transform = `translate3d(${x - 160}px, ${y - 160}px, 0)`
      if (pointer.x < 0 || pointer.y < 0) {
        pointer.x = x
        pointer.y = y
      }
    }

    function leavePointer() {
      pointer.active = false
      glowElement.style.opacity = "0"
    }

    resize()
    render()

    window.addEventListener("resize", resize)
    window.addEventListener("pointermove", movePointer)
    window.addEventListener("pointerleave", leavePointer)
    glowElement.dataset.motionReady = "true"

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener("resize", resize)
      window.removeEventListener("pointermove", movePointer)
      window.removeEventListener("pointerleave", leavePointer)
      delete glowElement.dataset.motionReady
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
      <div
        ref={glowRef}
        aria-hidden="true"
        data-testid="hero-pointer-glow"
        className="pointer-events-none absolute left-0 top-0 z-[2] h-80 w-80 rounded-full opacity-0 blur-2xl mix-blend-screen transition-opacity duration-150 will-change-transform"
        style={{
          background:
            "radial-gradient(circle, rgba(34, 211, 238, 0.58) 0%, rgba(16, 185, 129, 0.3) 36%, rgba(16, 185, 129, 0) 70%)",
        }}
      />
    </>
  )
}
