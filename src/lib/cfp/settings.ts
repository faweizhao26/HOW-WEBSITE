import { z } from "zod"

export const cfpSessionTypes = ["talk", "workshop", "panel"] as const
export const cfpDurations = [15, 30, 45, 60] as const
export const defaultCFPSettings: Record<string, string> = {
  cfp_enabled: "true",
  cfp_deadline: "",
  cfp_types: JSON.stringify(cfpSessionTypes),
  cfp_durations: JSON.stringify(cfpDurations),
  cfp_intro: "",
  cfp_intro_zh: "",
  cfp_requirements: "",
  cfp_requirements_zh: "",
  cfp_review_notes: "",
  cfp_review_notes_zh: "",
  cfp_contact_email: "",
}

const copySchema = z.object({ en: z.string().max(10000), zh: z.string().max(10000) })
const policySchema = z.object({
  enabled: z.boolean(),
  deadline: z.iso.date().nullable(),
  sessionTypes: z.array(z.enum(cfpSessionTypes)).min(1).refine(values => new Set(values).size === values.length),
  durations: z.array(z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)])).min(1).refine(values => new Set(values).size === values.length),
  intro: copySchema,
  requirements: copySchema,
  reviewNotes: copySchema,
  contactEmail: z.email().max(320).or(z.literal("")),
})

export type CFPPolicy = z.infer<typeof policySchema>

export function parseCFPSettings(settings: Record<string, string>): CFPPolicy {
  const enabled = settings.cfp_enabled || "true"
  if (enabled !== "true" && enabled !== "false") throw new Error("invalid_cfp_settings")
  return policySchema.parse({
    enabled: enabled === "true",
    deadline: settings.cfp_deadline || null,
    sessionTypes: JSON.parse(settings.cfp_types || defaultCFPSettings.cfp_types),
    durations: JSON.parse(settings.cfp_durations || defaultCFPSettings.cfp_durations),
    intro: { en: settings.cfp_intro || "", zh: settings.cfp_intro_zh || "" },
    requirements: { en: settings.cfp_requirements || "", zh: settings.cfp_requirements_zh || "" },
    reviewNotes: { en: settings.cfp_review_notes || "", zh: settings.cfp_review_notes_zh || "" },
    contactEmail: settings.cfp_contact_email || settings.contact_email || "",
  })
}

export function cfpClosesAt(policy: CFPPolicy): number | null {
  return policy.deadline ? Date.parse(`${policy.deadline}T00:00:00+08:00`) + 86_400_000 : null
}

export function getCFPState(policy: CFPPolicy, now = Date.now()): "open" | "closed" | "expired" {
  if (!policy.enabled) return "closed"
  const closesAt = cfpClosesAt(policy)
  return closesAt !== null && now >= closesAt ? "expired" : "open"
}
