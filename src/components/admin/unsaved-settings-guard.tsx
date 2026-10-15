"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

export function UnsavedSettingsGuard({ active, locale }: { active: boolean; locale: "en" | "zh" }) {
  const router = useRouter()
  const [destination, setDestination] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return
      const url = new URL(anchor.href)
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return
      event.preventDefault()
      event.stopPropagation()
      setDestination(`${url.pathname}${url.search}${url.hash}`)
    }
    window.addEventListener("beforeunload", unload)
    document.addEventListener("click", navigate, true)
    return () => {
      window.removeEventListener("beforeunload", unload)
      document.removeEventListener("click", navigate, true)
    }
  }, [active])

  return <AlertDialog open={destination !== null} onOpenChange={open => { if (!open) setDestination(null) }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{locale === "zh" ? "离开设置页面？" : "Leave settings?"}</AlertDialogTitle>
        <AlertDialogDescription>{locale === "zh" ? "未保存的修改会丢失。正在上传的文件不会自动保存到草稿。" : "Unsaved changes will be lost. Uploads are not automatically saved to the draft."}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{locale === "zh" ? "继续编辑" : "Keep editing"}</AlertDialogCancel>
        <AlertDialogAction onClick={() => { if (destination) { setDestination(null); router.push(destination) } }}>{locale === "zh" ? "放弃修改并离开" : "Discard and leave"}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
