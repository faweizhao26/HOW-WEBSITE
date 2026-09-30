export function inspectPageQuality() {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const context = canvas.getContext("2d", { willReadFrequently: true })
  const color = (value) => {
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    return { r, g, b, a: a / 255 }
  }
  const composite = (front, back) => ({
    r: front.r * front.a + back.r * (1 - front.a),
    g: front.g * front.a + back.g * (1 - front.a),
    b: front.b * front.a + back.b * (1 - front.a),
    a: 1,
  })
  const luminance = (rgb) => {
    const channel = (value) => {
      const n = value / 255
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
    }
    return channel(rgb.r) * 0.2126 + channel(rgb.g) * 0.7152 + channel(rgb.b) * 0.0722
  }
  const contrastProblems = []
  for (const element of document.querySelectorAll("h1,h2,h3,h4,p,li,label,a,button,span,summary")) {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
    if (!ownText || rect.width === 0 || rect.height === 0 || style.visibility === "hidden" || element.closest("[disabled],[aria-disabled=true]") || (element.closest("details:not([open])") && !element.closest("summary"))) continue
    const ancestors = []
    for (let current = element; current; current = current.parentElement) ancestors.unshift(current)
    if (ancestors.some((ancestor) => getComputedStyle(ancestor).backgroundImage !== "none")) continue
    let background = { r: 255, g: 255, b: 255, a: 1 }
    for (const ancestor of ancestors) background = composite(color(getComputedStyle(ancestor).backgroundColor), background)
    const foreground = composite(color(style.color), background)
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    const ratio = (lighter + 0.05) / (darker + 0.05)
    const size = parseFloat(style.fontSize)
    const threshold = size >= 24 || (parseInt(style.fontWeight, 10) >= 700 && size >= 18.66) ? 3 : 4.5
    if (ratio + 0.05 < threshold) contrastProblems.push(`${element.tagName}: ${element.textContent.trim().slice(0, 60)} (${ratio.toFixed(2)}:1)`)
  }
  const brokenImages = [...document.querySelectorAll("main img")]
    .filter((image) => { const rect = image.getBoundingClientRect(); return !image.closest("details:not([open])") && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && (!image.complete || image.naturalWidth === 0) }).map((image) => image.alt)
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    heading: document.querySelector("main h1")?.textContent,
    contentState: document.querySelector("main [data-content-state]")?.getAttribute("data-content-state"),
    contrastProblems: contrastProblems.slice(0, 15),
    brokenImages,
  }
}
