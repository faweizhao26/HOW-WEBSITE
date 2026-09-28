import type { Locale } from "@/lib/i18n/utils"

export const conference = {
  startDate: "2027-04-16",
  endDate: "2027-04-18",
  settingDate: "2027.4.16-4.18",
  days: ["2027-04-16", "2027-04-17", "2027-04-18"],
  dayCount: 3,
  venue: {
    en: "Jinan Shandong Hotel (Shungeng International Convention Center)",
    zh: "济南山东大厦（舜耕国际会议中心）",
  },
  address: {
    en: "2-1 Ma'anshan Road, Shizhong District, Jinan, Shandong, China",
    zh: "中国·山东·济南市中区马鞍山路 2-1 号",
  },
} as const

export function formatConferenceDateRange(value: string | undefined, locale: Locale) {
  const numbers = value?.match(/\d+/g)?.map(Number) || []
  let [year, startMonth, startDay, endMonth, endDay] = [2027, 4, 16, 4, 18]

  if (numbers.length >= 5) {
    ;[year, startMonth, startDay, endMonth, endDay] = numbers
  } else if (numbers.length === 4) {
    ;[year, startMonth, startDay, endDay] = numbers
    endMonth = startMonth
  }

  if (locale === "zh") {
    const end = startMonth === endMonth ? `${endDay} 日` : `${endMonth} 月 ${endDay} 日`
    return `${year} 年 ${startMonth} 月 ${startDay} 日至 ${end}`
  }

  const start = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, startMonth - 1, startDay)))
  const end = startMonth === endMonth
    ? String(endDay)
    : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(year, endMonth - 1, endDay)))

  return `${start}–${end}, ${year}`
}

export function getConferenceStartDate(value: string | undefined) {
  const [year = 2027, month = 4, day = 16] = value?.match(/\d+/g)?.map(Number) || []
  return [year, month, day].map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0")).join("-")
}
