import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { expect, test, type Page } from "@playwright/test"

const url = process.env.PUBLICATION_TEST_SUPABASE_URL
const key = process.env.PUBLICATION_TEST_SUPABASE_ANON_KEY
const cleanupKey = process.env.PUBLICATION_TEST_SUPABASE_SERVICE_ROLE_KEY
const email = process.env.PUBLICATION_TEST_ADMIN_EMAIL
const password = process.env.PUBLICATION_TEST_ADMIN_PASSWORD
const enabled = Boolean(url && key && cleanupKey && email && password && process.env.PUBLICATION_TEST_ISOLATED_PROJECT === "true")

test.describe("authenticated publication lifecycle", () => {
  test.describe.configure({ mode: "serial" })
  test("draft isolation, republish, agenda/settings release and rollback", async ({ page }, info) => {
    test.skip(!enabled, "Requires an isolated migrated Supabase test project and admin credentials")
    test.skip(info.project.name !== "desktop-chromium", "One writer per isolated project")
    test.setTimeout(180_000)
    const db = createClient(url!, key!, { auth: { persistSession: false } })
    const cleanupDB = createClient(url!, cleanupKey!, { auth: { persistSession: false } })
    const auth = await db.auth.signInWithPassword({ email: email!, password: password! })
    expect(auth.error).toBeNull()
    const user = auth.data.user!
    const profile = await db.from("profiles").select("role").eq("id", user.id).single()
    expect(profile.data?.role).toBe("admin")

    const [agendaRows, settingsRows, settingsDraft, speakerRows] = await Promise.all([
      db.from("agenda_slots").select("id"),
      db.from("site_settings_releases").select("*").eq("is_current", true).single(),
      db.from("site_settings").select("key,value"),
      db.from("speakers").select("id"),
    ])
    for (const result of [agendaRows, settingsRows, settingsDraft, speakerRows]) expect(result.error).toBeNull()
    expect(agendaRows.data).toEqual([])
    expect(speakerRows.data).toEqual([])
    const existingAgenda = await db.from("agenda_releases").select("id")
    expect(existingAgenda.error).toBeNull()
    expect(existingAgenda.data).toEqual([])

    const suffix = randomUUID()
    const name = `QA speaker ${suffix}`
    const edited = `${name} revised`
    const speakerId = randomUUID(), sessionId = randomUUID()
    const slotIds = [randomUUID(), randomUUID()]
    const releaseIds: string[] = []
    const settingsReleaseIds: string[] = []
    const oldSettings = settingsRows.data!
    const publicName = async (value: string, visible: boolean) => {
      await page.goto("/speakers")
      const heading = page.getByRole("heading", { name: value, exact: true })
      if (visible) await expect(heading).toBeVisible()
      else await expect(heading).toHaveCount(0)
    }
    const publishAgenda = async () => {
      await page.goto("/admin/agenda")
      await page.getByRole("button", { name: "Publish complete agenda", exact: true }).click()
      await expect(page.getByText("Complete agenda published", { exact: true })).toBeVisible()
      const release = await db.from("agenda_releases").select("id,version").eq("is_current", true).single()
      expect(release.error).toBeNull()
      releaseIds.push(release.data!.id)
      return release.data!
    }
    const restore = async (target: Page, route: string, version: number) => {
      await target.goto(route)
      const history = target.locator("section").filter({ has: target.getByRole("heading", { name: "Release history" }) })
      const row = history.locator(".divide-y > div").filter({ hasText: `v${version} ·` })
      await row.getByRole("button", { name: "Restore", exact: true }).click()
      await target.getByRole("button", { name: "Confirm", exact: true }).click()
      await expect(target.getByText("Release restored", { exact: true })).toBeVisible()
    }

    try {
      const inserted = await db.from("speakers").insert({ id: speakerId, name, bio: "Initial public biography" })
      expect(inserted.error).toBeNull()
      await page.context().addCookies([{ name: "lang", value: "en", url: info.project.use.baseURL as string }])
      await page.goto("/auth/login")
      await page.locator("#email").fill(email!)
      await page.locator("#password").fill(password!)
      await page.getByRole("button", { name: "Sign In", exact: true }).click()
      await expect(page).not.toHaveURL(/auth\/login/)
      await publicName(name, false)
      await page.goto("/admin/speakers")
      await page.getByRole("button", { name: "Publish", exact: true }).click()
      await expect(page.getByText("Published", { exact: true }).last()).toBeVisible()
      await publicName(name, true)

      expect((await db.from("speakers").update({ name: edited }).eq("id", speakerId)).error).toBeNull()
      await publicName(name, true)
      await publicName(edited, false)
      await page.goto("/admin/speakers")
      await page.getByRole("button", { name: "Publish changes", exact: true }).click()
      await publicName(edited, true)
      await publicName(name, false)

      expect((await db.from("sessions").insert({ id: sessionId, user_id: user.id, title: `QA session ${suffix}`, abstract: "Published session abstract", duration: 30, type: "talk", status: "pending" })).error).toBeNull()
      expect((await db.from("sessions").update({ status: "approved", speaker_id: speakerId }).eq("id", sessionId)).error).toBeNull()
      await page.goto("/admin/sessions")
      await page.getByRole("combobox").first().click()
      await page.getByRole("option", { name: "Approved", exact: true }).click()
      const card = page.locator("[data-slot=card]").filter({ hasText: `QA session ${suffix}` })
      await card.getByRole("button", { name: "Publish", exact: true }).click()
      await expect.poll(async () => (await db.from("published_sessions").select("id").eq("id", sessionId)).data?.length).toBe(1)

      expect((await db.from("agenda_slots").insert({ id: slotIds[0], date: "2027-04-16", start_time: "09:00", end_time: "09:30", label: `Opening ${suffix}`, type: "opening" })).error).toBeNull()
      const first = await publishAgenda()
      expect((await db.from("agenda_slots").insert({ id: slotIds[1], date: "2027-04-16", start_time: "09:30", end_time: "10:00", label: "", type: "session", session_id: sessionId })).error).toBeNull()
      await page.goto("/schedule")
      await expect(page.getByRole("heading", { name: `QA session ${suffix}` })).toHaveCount(0)
      await publishAgenda()
      await page.goto("/schedule")
      await expect(page.getByRole("heading", { name: `QA session ${suffix}` })).toBeVisible()
      await restore(page, "/admin/agenda", first.version)
      await page.goto("/schedule")
      await expect(page.getByRole("heading", { name: `QA session ${suffix}` })).toHaveCount(0)

      await page.goto("/admin/settings")
      await page.locator("#setting-hero_title").fill(`QA hero ${suffix}`)
      await page.getByRole("button", { name: "Save draft", exact: true }).click()
      await expect(page.getByText("Settings draft saved", { exact: true })).toBeVisible()
      await page.goto("/")
      await expect(page.getByRole("heading", { name: new RegExp(`QA hero ${suffix}`) })).toHaveCount(0)
      await page.goto("/admin/settings")
      await page.getByRole("button", { name: "Publish complete settings", exact: true }).click()
      await expect(page.getByText("Complete settings published", { exact: true })).toBeVisible()
      const newSettings = await db.from("site_settings_releases").select("id").eq("is_current", true).single()
      expect(newSettings.error).toBeNull()
      settingsReleaseIds.push(newSettings.data!.id)
      await page.goto("/")
      await expect(page.getByRole("heading", { name: new RegExp(`QA hero ${suffix}`) })).toBeVisible()
      await restore(page, "/admin/settings", oldSettings.version)
      await page.goto("/")
      await expect(page.getByRole("heading", { name: new RegExp(`QA hero ${suffix}`) })).toHaveCount(0)
    } finally {
      // This test owns only its generated records; the original settings snapshot is restored.
      const cleanupErrors: string[] = []
      const clean = async (query: PromiseLike<{ error: { message: string } | null }>) => {
        const result = await query
        if (result.error) cleanupErrors.push(result.error.message)
      }
      await clean(cleanupDB.from("site_settings").upsert(settingsDraft.data!))
      await clean(db.rpc("rollback_site_settings_release", { p_release_id: oldSettings.id }))
      if (settingsReleaseIds.length) await clean(cleanupDB.from("site_settings_releases").delete().in("id", settingsReleaseIds))
      if (releaseIds.length) await clean(cleanupDB.from("agenda_releases").delete().in("id", releaseIds))
      await clean(cleanupDB.from("agenda_slots").delete().in("id", slotIds))
      await clean(cleanupDB.from("published_sessions").delete().eq("id", sessionId))
      await clean(cleanupDB.from("sessions").delete().eq("id", sessionId))
      await clean(cleanupDB.from("published_speakers").delete().eq("id", speakerId))
      await clean(cleanupDB.from("speakers").delete().eq("id", speakerId))
      await db.auth.signOut({ scope: "local" })
      expect(cleanupErrors).toEqual([])
    }
  })
})
