import assert from "node:assert/strict"
import { test } from "node:test"
import { component, environment } from "./helpers/ui-reliability-harness.mjs"

function hero(reduced = true) {
  const env = environment({ reduced }), paints = [], transforms = []
  let width = 900, height = 600
  const gradient = () => ({ colors: [], addColorStop(offset, color) { this.colors.push([offset, color]) } })
  const context = {
    setTransform: (...args) => transforms.push(args),
    createLinearGradient: gradient, createRadialGradient: gradient,
    fillRect(x, y, w, h) { if (x === 0 && y === 0 && w === width && h === height) paints.push(this.fillStyle.colors[0][1]) },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {},
  }
  const canvas = { width: 0, height: 0, getContext: () => context, getBoundingClientRect: () => ({ width, height, left: 0, top: 0 }) }
  const glow = { style: {}, dataset: {} }
  const h = component("../../src/components/home/hero-motion.tsx", "HeroMotion", {}, env, {}, node => node.type === "canvas" ? canvas : glow)
  return { ...h, env, paints, transforms, canvas, glow, size(w, h) { width = w; height = h; env.resize() } }
}

test("reduced-motion Canvas repaints theme and size without scheduling animation", () => {
  const h = hero()
  assert.deepEqual(h.paints, ["#020617"])
  assert.equal(h.env.frames.size, 0)
  h.env.document.documentElement.classList.toggle("dark", false)
  h.env.document.documentElement.classList.toggle("light", true)
  h.env.flushMutations(); h.env.nextFrame()
  assert.equal(h.paints.at(-1), "#f8fafc")
  assert.equal(h.env.frames.size, 0)
  const count = h.paints.length
  h.size(480, 720); h.env.nextFrame()
  assert.ok(h.paints.length > count, "Resizing must repaint the cleared Canvas")
  assert.equal(h.canvas.width, 480)
  assert.equal(h.canvas.height, 720)
  assert.equal(h.paints.at(-1), "#f8fafc")
  assert.equal(h.env.frames.size, 0)
  h.unmount()
  assert.equal(h.env.observers.size, 0)
  assert.equal(h.env.resizeObservers.size, 0)
  assert.equal(h.env.window.listenerCount(), 0)
  assert.equal(h.env.preference.listenerCount(), 0)
})

test("motion preference changes stop and restart exactly one animation loop", () => {
  const h = hero(false)
  assert.equal(h.env.frames.size, 1)
  h.env.nextFrame()
  assert.equal(h.env.frames.size, 1)
  h.env.setReduced(true)
  assert.equal(h.env.frames.size, 0, "Enabling reduced motion must cancel the pending frame")
  const count = h.paints.length
  h.env.nextFrame()
  assert.equal(h.paints.length, count)
  h.env.setReduced(false)
  assert.equal(h.env.frames.size, 1)
  h.size(800, 500)
  h.env.document.documentElement.classList.toggle("light", true)
  h.env.flushMutations(); h.env.nextFrame()
  assert.equal(h.env.frames.size, 1, "Redraws must not create a second loop")
  h.unmount()
  assert.equal(h.env.frames.size, 0)
  assert.equal(h.glow.dataset.motionReady, undefined)
})

test("resizing a reduced-motion Canvas immediately restores its static painting", () => {
  const h = hero()
  const count = h.paints.length
  h.size(390, 700); h.env.nextFrame()
  assert.ok(h.paints.length > count, "Resizing cleared the backing store without repainting")
  assert.equal(h.canvas.width, 390)
  assert.equal(h.canvas.height, 700)
  assert.equal(h.env.frames.size, 0)
  h.unmount()
})

test("offscreen or hidden hero stops painting and resumes exactly one loop when both visible", () => {
  const h = hero(false)
  assert.equal(h.env.frames.size, 1)
  h.env.setIntersecting(false)
  assert.equal(h.env.frames.size, 0, "Offscreen Canvas must cancel the pending frame")
  const paused = h.paints.length
  h.env.setVisible(false)
  h.size(480, 700)
  h.env.nextFrame()
  assert.equal(h.paints.length, paused)
  h.env.setIntersecting(true)
  assert.equal(h.env.frames.size, 0, "Intersection alone cannot resume a hidden tab")
  h.env.setVisible(true)
  assert.equal(h.env.frames.size, 1)
  assert.ok(h.paints.length > paused)
  h.env.setVisible(true); h.env.setIntersecting(true)
  h.env.nextFrame()
  assert.equal(h.env.frames.size, 1)
  h.env.setVisible(false)
  assert.equal(h.env.frames.size, 0)
  h.unmount()
  assert.equal(h.env.intersectionObservers.size, 0)
  assert.equal(h.env.document.listenerCount(), 0)
})

test("paused reduced-motion hero defers theme and size paint until visible without an animation loop", () => {
  const h = hero(true)
  h.env.setIntersecting(false)
  const paused = h.paints.length
  h.env.document.documentElement.classList.toggle("light", true)
  h.env.flushMutations()
  h.size(390, 700)
  assert.equal(h.paints.length, paused)
  h.env.setReduced(false)
  assert.equal(h.env.frames.size, 0)
  h.env.setReduced(true)
  h.env.setIntersecting(true)
  assert.equal(h.paints.at(-1), "#f8fafc")
  assert.ok(h.paints.length > paused)
  assert.equal(h.env.frames.size, 0)
  h.unmount()
})

test("zero-area edge intersection resumes without needing a second threshold notification", () => {
  const h = hero(false)
  h.env.setIntersecting(false)
  assert.equal(h.env.frames.size, 0)
  // At threshold 0, entering at the boundary may be the only intersection notification.
  h.env.setIntersecting(true, 0)
  assert.equal(h.env.frames.size, 1)
  h.env.nextFrame()
  h.env.window.emit("pointermove", { clientX: 50, clientY: 50 })
  assert.equal(h.glow.style.opacity, "1")
  assert.equal(h.env.frames.size, 1)
  h.unmount()
})
