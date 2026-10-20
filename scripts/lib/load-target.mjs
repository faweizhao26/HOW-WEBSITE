import assert from "node:assert/strict"

export function localLoadOrigin(value) {
  const url = new URL(value)
  assert.ok(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    && url.port && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash,
  "Load tests only accept explicit loopback HTTP origins with a port")
  return url.origin
}

export function loadLevels(value = "50,100,300,500") {
  const levels = value.split(",").map(Number)
  assert.ok(levels.length > 0 && levels.length <= 4 && levels.every(level => Number.isInteger(level) && level >= 1 && level <= 500), "Use at most four levels of 1–500 connections")
  return [...new Set(levels)].sort((a, b) => a - b)
}
