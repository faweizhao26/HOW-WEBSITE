import { expect, test, type Page } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3019"

const publicRoutes = [
  "/",
  "/about",
  "/schedule",
  "/speakers",
  "/attend",
  "/sponsors",
  "/venue",
  "/updates",
  "/code-of-conduct",
  "/privacy",
  "/auth/login",
  "/auth/register",
]

async function useChineseLightTheme(page: Page) {
  await page.context().addCookies([
    { name: "lang", value: "zh", url: baseURL },
    { name: "theme", value: "light", url: baseURL },
  ])
}

test.describe("official conference facts", () => {
  test.beforeEach(async ({ page }) => useChineseLightTheme(page))

  test("uses April 16-18, 2027 as the three-day conference period", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("2027 年 4 月 16 日至 18 日")).toBeVisible()
    await expect(page.getByText("3", { exact: true }).first()).toBeVisible()

    await page.goto("/schedule")
    await expect(page.getByRole("tab", { name: /2027-04-16/ })).toBeVisible()
    await expect(page.getByRole("tab", { name: /2027-04-17/ })).toBeVisible()
    await expect(page.getByRole("tab", { name: /2027-04-18/ })).toBeVisible()
    await expect(page.getByText(/2027-04-14|2027-04-15/)).toHaveCount(0)
  })

  test("uses one venue name everywhere users see it", async ({ page }) => {
    await page.goto("/venue")
    await expect(page.getByRole("heading", { name: "济南山东大厦（舜耕国际会议中心）" })).toBeVisible()

    await page.goto("/")
    await expect(page.getByText("济南山东大厦（舜耕国际会议中心）")).toBeVisible()
  })
})

test.describe("published content in night mode", () => {
  for (const route of ["/schedule", "/speakers", "/sponsors", "/updates"]) {
    test(`${route} renders without overflow or runtime errors`, async ({ page }) => {
      await page.context().addCookies([{ name: "theme", value: "dark", url: baseURL }])
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()) })
      await page.goto(route)
      await expect(page.locator("html")).toHaveClass(/dark/)
      await expect(page.locator("main h1")).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
      expect(errors).toEqual([])
    })
  }
})

test.describe("light theme quality", () => {
  test.beforeEach(async ({ page }) => useChineseLightTheme(page))

  for (const route of publicRoutes) {
    test(`${route} has readable light-theme text and no horizontal overflow`, async ({ page }) => {
      const runtimeErrors: string[] = []
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text())
      })
      page.on("pageerror", (error) => runtimeErrors.push(error.message))

      await page.goto(route, { waitUntil: "domcontentloaded" })
      await expect(page.locator("html")).toHaveClass(/light/)

      const overflow = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth
        const amount = document.documentElement.scrollWidth - viewportWidth
        const elements = Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ element, rect }) => !element.closest("header") && (rect.right > viewportWidth + 1 || rect.left < -1))
          .slice(0, 16)
          .map(({ element, rect }) => `${element.tagName.toLowerCase()}.${element.className} right=${rect.right.toFixed(1)} text=${element.textContent?.trim().slice(0, 32) || ""}`)
        return { amount, elements }
      })
      expect(overflow.amount, overflow.elements.join("\n")).toBeLessThanOrEqual(1)

      const failures = await page.evaluate(() => {
        type RGB = { r: number; g: number; b: number; a: number }

        const parse = (value: string): RGB | null => {
          const match = value.match(/rgba?\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\)/)
            || value.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*(\d+(?:\.\d+)?))?\)/)
          if (match) {
            return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) }
          }

          const oklch = value.match(/oklch\((\d+(?:\.\d+)?)(%)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:deg)?(?:\s*\/\s*(\d+(?:\.\d+)?)(%)?)?\)/)
          if (!oklch) return null

          const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1)
          const chroma = Number(oklch[3])
          const hue = Number(oklch[4]) * Math.PI / 180
          const alpha = oklch[5] === undefined ? 1 : Number(oklch[5]) / (oklch[6] ? 100 : 1)
          const a = chroma * Math.cos(hue)
          const b = chroma * Math.sin(hue)
          const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b
          const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b
          const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b
          const l = lRoot ** 3
          const m = mRoot ** 3
          const s = sRoot ** 3
          const linear = [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
          ]
          const gamma = (channel: number) => {
            const converted = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
            return Math.max(0, Math.min(255, converted * 255))
          }

          return { r: gamma(linear[0]), g: gamma(linear[1]), b: gamma(linear[2]), a: alpha }
        }

        const composite = (front: RGB, back: RGB): RGB => {
          const a = front.a + back.a * (1 - front.a)
          if (a === 0) return { r: 255, g: 255, b: 255, a: 1 }
          return {
            r: (front.r * front.a + back.r * back.a * (1 - front.a)) / a,
            g: (front.g * front.a + back.g * back.a * (1 - front.a)) / a,
            b: (front.b * front.a + back.b * back.a * (1 - front.a)) / a,
            a,
          }
        }

        const luminance = ({ r, g, b }: RGB) => {
          const channel = (value: number) => {
            const normalized = value / 255
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
          }
          return channel(r) * 0.2126 + channel(g) * 0.7152 + channel(b) * 0.0722
        }

        const contrast = (a: RGB, b: RGB) => {
          const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
          return (lighter + 0.05) / (darker + 0.05)
        }

        const elements = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,p,li,label,a,button,span"))
        const problems: string[] = []

        for (const element of elements) {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          const ownText = Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
          if (!ownText || rect.width === 0 || rect.height === 0 || style.visibility === "hidden" || style.display === "none") continue
          if (element.closest("[aria-disabled='true'], [disabled]")) continue

          const ancestors: HTMLElement[] = []
          for (let current: HTMLElement | null = element; current; current = current.parentElement) ancestors.unshift(current)
          if (ancestors.some((ancestor) => getComputedStyle(ancestor).backgroundImage !== "none")) continue

          let background: RGB = { r: 255, g: 255, b: 255, a: 1 }
          for (const ancestor of ancestors) {
            const color = parse(getComputedStyle(ancestor).backgroundColor)
            if (color && color.a > 0) background = composite(color, background)
          }

          const foregroundRaw = parse(style.color)
          if (!foregroundRaw) continue
          const foreground = composite(foregroundRaw, background)
          const ratio = contrast(foreground, background)
          const fontSize = Number.parseFloat(style.fontSize)
          const bold = Number.parseInt(style.fontWeight, 10) >= 700
          const threshold = fontSize >= 24 || (bold && fontSize >= 18.66) ? 3 : 4.5

          if (ratio + 0.05 < threshold) {
            problems.push(`${element.tagName.toLowerCase()}: ${element.innerText.trim().slice(0, 48)} (${ratio.toFixed(2)}:1)`)
          }
        }

        return problems.slice(0, 12)
      })

      expect(failures, failures.join("\n")).toEqual([])
      expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([])
    })
  }
})

test("theme preference persists across navigation", async ({ page }, testInfo) => {
  await page.goto("/")
  const mobile = testInfo.project.name.includes("mobile")
  if (mobile) await page.getByRole("button", { name: "Open menu" }).click()
  await page.getByRole("button", { name: "Switch to day mode" }).click()
  await expect(page.locator("html")).toHaveClass(/light/)

  await page.goto("/venue")
  await expect(page.locator("html")).toHaveClass(/light/)
  if (mobile) await page.getByRole("button", { name: "Open menu" }).click()
  await expect(page.getByRole("button", { name: "Switch to night mode" })).toBeVisible()
})

test("desktop pointer movement visibly updates the hero effect", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Touch devices use ambient motion instead of pointer tracking")

  await page.goto("/", { waitUntil: "domcontentloaded" })
  const glow = page.locator("[data-testid='hero-pointer-glow']")
  await expect(glow).toBeAttached({ timeout: 20_000 })
  await expect(glow).toHaveAttribute("data-motion-ready", "true", { timeout: 20_000 })

  const before = await glow.evaluate((element) => getComputedStyle(element).transform)
  await page.mouse.move(900, 280)
  await expect(glow).toHaveCSS("opacity", "1")
  await expect.poll(() => glow.evaluate((element) => getComputedStyle(element).transform)).not.toBe(before)
})
