"use client"

import { createContext, useContext, useId, useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { inspectMediaFile, MediaUploadError, uploadSiteMedia } from "@/lib/admin/media-upload"
import type { MediaKind } from "@/lib/admin/media-upload"

export const MediaUploadContext = createContext<(busy: boolean) => void>(() => {})

const errors: Record<string, { zh: string; en: string }> = {
  invalid_file: { zh: "文件为空或格式不正确。", en: "The file is empty or invalid." },
  too_large: { zh: "图片不能超过 5 MB，PDF 不能超过 10 MB。", en: "Images must be under 5 MB and PDFs under 10 MB." },
  unsupported_type: { zh: "请选择 PNG、JPEG、WebP、GIF 图片或 PDF 附件。", en: "Choose a PNG, JPEG, WebP, GIF image or PDF attachment." },
  admin_required: { zh: "请使用管理员账号登录后上传。", en: "Sign in as an administrator to upload." },
  account_changed: { zh: "登录账号已变化，请重新登录后上传。", en: "Your account changed. Sign in again before uploading." },
  upload_failed: { zh: "上传失败，原链接已保留，请重试。", en: "Upload failed. The previous URL is retained. Please retry." },
}

export function SiteMediaField({ label, path, value, onChange, locale, kind }: {
  label: string; path: string; value: string; onChange: (value: string) => void; locale: "en" | "zh"; kind: MediaKind
}) {
  const id = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const active = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const reportBusy = useContext(MediaUploadContext)

  async function upload(file: File) {
    if (active.current) return
    active.current = true
    setBusy(true)
    reportBusy(true)
    setMessage("")
    setFailed(false)
    try {
      await inspectMediaFile(file, kind)
      if (kind === "image") {
        const url = URL.createObjectURL(file)
        try {
          const image = new Image()
          image.src = url
          await image.decode()
        } catch { throw new MediaUploadError("invalid_file") }
        finally { URL.revokeObjectURL(url) }
      }
      const result = await uploadSiteMedia(createClient(), file, kind)
      onChange(result.url)
      setMessage(locale === "zh" ? `已上传：${file.name}` : `Uploaded: ${file.name}`)
    } catch (error) {
      const code = error instanceof MediaUploadError ? error.code : "upload_failed"
      setFailed(true)
      setMessage((errors[code] || errors.upload_failed)[locale])
    } finally {
      active.current = false
      setBusy(false)
      reportBusy(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex flex-wrap gap-2">
      <Input id={id} data-setting-path={path} className="min-w-0 flex-1 basis-64" value={value} maxLength={2048} disabled={busy} onChange={event => onChange(event.target.value)} />
      <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label={locale === "zh" ? `${label}上传文件` : `Upload ${label}`} accept={kind === "image" ? "image/png,image/jpeg,image/webp,image/gif" : "application/pdf"} disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
      <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <Upload />}{busy ? (locale === "zh" ? "上传中" : "Uploading") : kind === "image" ? (locale === "zh" ? "上传图片" : "Upload image") : (locale === "zh" ? "上传 PDF" : "Upload PDF")}</Button>
    </div>
    {message && <p role={failed ? "alert" : "status"} className={`break-words text-sm ${failed ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>{message}</p>}
  </div>
}
