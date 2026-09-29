import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")

test("publication migration defines draft and public data boundaries", () => {
  const migrationsUrl = new URL("supabase/migrations/", root)
  assert.equal(existsSync(migrationsUrl), true, "supabase/migrations must exist")

  const migrationName = existsSync(migrationsUrl)
    ? readdirSync(migrationsUrl).find((name) => name.endsWith("_content_publication_workflow.sql"))
    : undefined
  assert.ok(migrationName, "content publication migration must be generated")

  const sql = read(`supabase/migrations/${migrationName}`)
  for (const table of [
    "speakers",
    "published_speakers",
    "published_sessions",
    "published_sponsors",
    "published_news_posts",
    "agenda_releases",
    "site_settings_releases",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table}\\b`, "i"))
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"))
  }

  for (const column of ["publication_status", "published_at", "published_by", "updated_at"]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`))
  }

  for (const rpc of [
    "publish_speaker",
    "unpublish_speaker",
    "publish_session",
    "unpublish_session",
    "publish_sponsor",
    "unpublish_sponsor",
    "publish_news_post",
    "unpublish_news_post",
    "publish_agenda",
    "rollback_agenda_release",
    "publish_site_settings",
    "rollback_site_settings_release",
  ]) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`, "i"))
  }

  assert.match(sql, /REVOKE SELECT ON public\.profiles FROM anon/i)
  assert.doesNotMatch(sql, /GRANT SELECT ON public\.profiles TO anon/i)
  assert.match(sql, /WITH CHECK\s*\(\s*\(select private\.is_admin\(\)\)\s*\)/i)
  assert.doesNotMatch(sql, /raw_user_meta_data[^;]*(admin|role)/i)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.protect_session_workflow_fields\(\)/i)
  assert.match(sql, /CREATE POLICY "Users can create own pending sessions"[\s\S]*?status = 'pending'[\s\S]*?publication_status = 'draft'/i)
  assert.match(sql, /NEW\.status IS DISTINCT FROM OLD\.status/i)
  assert.match(sql, /session workflow fields are managed by administrators/i)
})

test("published projections are public while draft tables are not granted to anon", () => {
  const schema = read("supabase-schema.sql")

  for (const table of ["published_speakers", "published_sessions", "published_sponsors", "published_news_posts"]) {
    assert.match(schema, new RegExp(`GRANT SELECT ON public\\.${table} TO anon, authenticated`, "i"))
  }

  for (const table of ["profiles", "sessions", "speakers", "sponsors", "news_posts", "site_settings", "agenda_slots"]) {
    assert.doesNotMatch(schema, new RegExp(`GRANT SELECT ON public\\.${table} TO anon`, "i"))
  }

  assert.match(schema, /CREATE POLICY "Current agenda release is public"/)
  assert.match(schema, /CREATE POLICY "Current settings release is public"/)
})

test("database types separate review state from publication state", () => {
  const types = read("src/lib/db/schema.ts")

  assert.match(types, /export type PublicationStatus = "draft" \| "published"/)
  assert.match(types, /status: "pending" \| "approved" \| "rejected"/)
  assert.match(types, /speaker_id: string \| null/)
  assert.match(types, /export type AgendaReleasePayload/)
  assert.match(types, /export type PublishedSiteSettings/)
  assert.match(types, /published_speakers:/)
  assert.match(types, /site_settings_releases:/)
})
