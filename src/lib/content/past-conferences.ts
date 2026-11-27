import type { ContentBlock } from "./site-content.ts"

export const pastConferencesId = "past"
const entryPrefix = "past-edition:"

export function isPastConferenceEntry(row: ContentBlock) {
  return row.id.startsWith(entryPrefix)
}

export function pastConferenceEntryId(id: string) {
  return entryPrefix + id
}

export function visiblePastConferenceEntries(rows: ContentBlock[]) {
  return rows.filter(row => isPastConferenceEntry(row) && row.enabled && row.linkUrl && (row.title.en.trim() || row.title.zh.trim()))
}
