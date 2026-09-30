"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { EyeOff, RefreshCw, RotateCcw, Send } from "lucide-react"
import { toast } from "sonner"
import {
  publishNewsPost,
  publishSession,
  publishSpeaker,
  publishSponsor,
  rollbackAgenda,
  rollbackSiteSettings,
  unpublishNewsPost,
  unpublishSession,
  unpublishSpeaker,
  unpublishSponsor,
  type PublicationActionResult,
} from "@/app/admin/actions/publication"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n/utils"

type ItemKind = "speaker" | "session" | "sponsor" | "news"
type ReleaseKind = "agenda-release" | "settings-release"

type PublicationActionsProps = {
  id: string
  locale: Locale
  kind: ItemKind | ReleaseKind
  status?: "draft" | "published"
  hasPendingChanges?: boolean
  publishDisabled?: boolean
  onCompleted?: () => void
}

const publishActions = {
  speaker: publishSpeaker,
  session: publishSession,
  sponsor: publishSponsor,
  news: publishNewsPost,
} as const

const unpublishActions = {
  speaker: unpublishSpeaker,
  session: unpublishSession,
  sponsor: unpublishSponsor,
  news: unpublishNewsPost,
} as const

export function PublicationActions({
  id,
  locale,
  kind,
  status = "draft",
  hasPendingChanges = false,
  publishDisabled = false,
  onCompleted,
}: PublicationActionsProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const isRelease = kind === "agenda-release" || kind === "settings-release"

  function complete(result: PublicationActionResult, successMessage: string) {
    if (result.ok) {
      toast.success(successMessage)
      onCompleted?.()
      router.refresh()
      return
    }
    toast.error(result.message)
  }

  function publish() {
    if (isRelease) return
    startTransition(async () => {
      const result = await publishActions[kind](id)
      complete(result, locale === "zh" ? "发布成功" : "Published")
    })
  }

  function runDestructive() {
    startTransition(async () => {
      const result = kind === "agenda-release"
        ? await rollbackAgenda(id)
        : kind === "settings-release"
          ? await rollbackSiteSettings(id)
          : await unpublishActions[kind](id)
      complete(
        result,
        isRelease
          ? (locale === "zh" ? "已回滚到所选版本" : "Release restored")
          : (locale === "zh" ? "已撤销发布" : "Unpublished")
      )
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isRelease && (
        <Button size="sm" onClick={publish} disabled={isPending || publishDisabled}>
          {status === "published" ? <RefreshCw /> : <Send />}
          {status === "published"
            ? (locale === "zh" ? (hasPendingChanges ? "发布更改" : "重新发布") : (hasPendingChanges ? "Publish changes" : "Republish"))
            : (locale === "zh" ? "发布" : "Publish")}
        </Button>
      )}

      {(status === "published" || isRelease) && (
        <AlertDialog>
          <AlertDialogTrigger render={<Button size="sm" variant="outline" disabled={isPending} />}>
            {isRelease ? <RotateCcw /> : <EyeOff />}
            {isRelease ? (locale === "zh" ? "回滚" : "Restore") : (locale === "zh" ? "撤销发布" : "Unpublish")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{locale === "zh" ? "确认此操作？" : "Confirm this action?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {isRelease
                  ? (locale === "zh" ? "公开内容将恢复为这个历史版本。" : "Public content will be restored to this release.")
                  : (locale === "zh" ? "此内容将从公开网站移除，草稿会保留。" : "This content will be removed from the public site while its draft is kept.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{locale === "zh" ? "取消" : "Cancel"}</AlertDialogCancel>
              <AlertDialogAction onClick={runDestructive} disabled={isPending}>
                {locale === "zh" ? "确认" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
