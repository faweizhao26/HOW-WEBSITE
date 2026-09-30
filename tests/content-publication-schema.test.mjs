import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")
const migrationPath = "supabase/migrations/20260929000100_content_publication_workflow.sql"
const publicationTables = ["published_speakers", "published_sessions", "published_sponsors", "published_news_posts", "agenda_releases", "site_settings_releases"]
const publicationRpcs = ["publish_speaker", "unpublish_speaker", "publish_session", "unpublish_session", "publish_sponsor", "unpublish_sponsor", "publish_news_post", "unpublish_news_post", "publish_agenda", "rollback_agenda_release", "publish_site_settings", "rollback_site_settings_release"]

function functionDefinition(sql, schema, name) {
  const match = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION ${schema}\\.${name}\\([\\s\\S]*?^\\$\\$;`, "mi"))
  assert.ok(match, `${schema}.${name} must exist`)
  return match[0]
}

test("full schema embeds the exact publication migration", () => {
  const schema = read("supabase-schema.sql")
  assert.equal(schema.split("-- --- Draft/public content publication workflow ---\n")[1], read(migrationPath))
})

test("publication writes require guarded private helpers behind invoker RPCs", () => {
  const sql = read(migrationPath)
  for (const name of publicationRpcs) {
    const entrypoint = functionDefinition(sql, "public", name)
    assert.match(entrypoint, /SECURITY INVOKER\s+SET search_path = ''/)
    assert.match(entrypoint, new RegExp(`SELECT private\\.${name}\\(`))
    assert.doesNotMatch(entrypoint, /\b(INSERT|UPDATE|DELETE|LOCK)\b/)
    const helper = functionDefinition(sql, "private", name)
    assert.match(helper, /SECURITY DEFINER\s+SET search_path = ''/)
    assert.match(helper, /IF NOT private\.is_admin\(\) THEN/)
    assert.match(helper, /PERFORM private\.lock_publication_tables\(\);/)
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION private\\.${name}\\([^;]*FROM PUBLIC, anon, authenticated;`))
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION private\\.${name}\\([^;]*TO authenticated;`))
  }
  assert.doesNotMatch(sql, /current_setting|set_config/)
  for (const table of publicationTables) {
    assert.match(sql, new RegExp(`REVOKE ALL ON public\\.${table} FROM PUBLIC, anon, authenticated;`))
    assert.doesNotMatch(sql, new RegExp(`GRANT [^;]*(?:INSERT|UPDATE|DELETE|TRUNCATE)[^;]*ON public\\.${table}\\b`))
    assert.doesNotMatch(sql, new RegExp(`ON public\\.${table}\\s+FOR ALL`))
  }
})

test("trusted publication helpers stabilise drafts and serialise releases", () => {
  const sql = read(migrationPath)
  const lock = functionDefinition(sql, "private", "lock_publication_tables")
  assert.match(lock, /SECURITY DEFINER\s+SET search_path = ''/)
  assert.match(lock, /IF NOT private\.is_admin\(\) THEN/)
  const tables = lock.match(/LOCK TABLE\s+([\s\S]*?)\s+IN SHARE ROW EXCLUSIVE MODE;/)?.[1]
  assert.ok(tables, "publication lock must block concurrent draft writes and other publications")
  assert.deepEqual(tables.split(",").map((table) => table.trim()), [
    "public.profiles", "public.speakers", "public.sessions", "public.agenda_slots", "public.sponsors", "public.news_posts", "public.site_settings",
    "public.published_speakers", "public.published_sessions", "public.published_sponsors", "public.published_news_posts", "public.agenda_releases", "public.site_settings_releases",
  ])
  for (const name of publicationRpcs) {
    const helper = functionDefinition(sql, "private", name)
    const firstDataAccess = helper.match(/\n  (?:SELECT|INSERT|UPDATE|DELETE|IF (?:NOT )?EXISTS)/)?.index
    assert.ok(firstDataAccess !== undefined && helper.indexOf("PERFORM private.lock_publication_tables();") < firstDataAccess, `${name} must lock before accessing publication data`)
  }
})

test("own-profile updates cannot grant administrator privileges", () => {
  const sql = read(migrationPath)
  assert.match(sql, /REVOKE UPDATE ON public\.profiles FROM PUBLIC, anon, authenticated;/)
  assert.match(sql, /REVOKE UPDATE \(role\) ON public\.profiles FROM PUBLIC, anon, authenticated;/)
  const columns = sql.match(/GRANT UPDATE \(([^)]*)\) ON public\.profiles TO authenticated;/)?.[1]
  assert.ok(columns)
  assert.deepEqual(columns.split(",").map((column) => column.trim()), ["full_name", "company", "bio", "bio_zh", "avatar_url", "phone", "wechat"])
})

test("public registration reads do not evaluate administrator profile policies", () => {
  const sql = read(migrationPath)
  for (const [name, table] of [["ticket types", "ticket_types"], ["channel codes", "channel_codes"]]) {
    assert.match(sql, new RegExp(`DROP POLICY IF EXISTS "Admins can manage ${name}" ON public\\.${table};`))
    assert.match(sql, new RegExp(`CREATE POLICY "Admins can manage ${name}" ON public\\.${table}\\s+FOR ALL TO authenticated\\s+USING \\(\\(SELECT private\\.is_admin\\(\\)\\)\\)\\s+WITH CHECK \\(\\(SELECT private\\.is_admin\\(\\)\\)\\)`))
  }
})

test("release UUIDs do not depend on an extension search path", () => {
  const sql = read(migrationPath)
  for (const name of ["publish_agenda", "publish_site_settings"]) {
    assert.match(functionDefinition(sql, "private", name), /v_release_id UUID := pg_catalog\.gen_random_uuid\(\);/)
  }
  for (const table of ["agenda_releases", "site_settings_releases"]) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table} \\(\\s+id UUID PRIMARY KEY DEFAULT pg_catalog\\.gen_random_uuid\\(\\)`))
  }
})

test("initial settings fill blank fields and validate the canonical conference dates", () => {
  const sql = read(migrationPath)
  assert.match(sql, /ON CONFLICT \(key\) DO UPDATE SET[\s\S]*EXCLUDED\.key = 'conference_date'[\s\S]*btrim\(public\.site_settings\.value\) = ''/)
  assert.match(sql, /SELECT 1, private\.validated_site_settings_payload\(\), true;/)
  const validation = functionDefinition(sql, "private", "validated_site_settings_payload")
  assert.match(validation, /v_required_count <> 9/)
  assert.match(validation, /conference_date must describe 2027-04-16 through 2027-04-18/)
  assert.match(functionDefinition(sql, "private", "publish_site_settings"), /v_payload := private\.validated_site_settings_payload\(\);/)
  assert.match(read("supabase-schema.sql"), /IF pg_catalog\.to_regprocedure\('public\.rls_auto_enable\(\)'\) IS NOT NULL THEN/)
})

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
