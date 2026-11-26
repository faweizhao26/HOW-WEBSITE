import { newContentBlock } from "./site-content.ts"
import type { ContentBlock } from "./site-content.ts"

export const pastConferencesId = "past"
const entryPrefix = "past-edition:"

export function isPastConferenceEntry(row: ContentBlock) {
  return row.id.startsWith(entryPrefix)
}

export function newPastConferenceEntry(id: string) {
  return newContentBlock(entryPrefix + id)
}

export function newPastConferencesSection() {
  return { ...newContentBlock(pastConferencesId), title: { en: "Past Conferences", zh: "往届回顾" } }
}

export function visiblePastConferenceEntries(rows: ContentBlock[]) {
  return rows.filter(row => isPastConferenceEntry(row) && row.enabled && row.linkUrl && (row.title.en.trim() || row.title.zh.trim()))
}
