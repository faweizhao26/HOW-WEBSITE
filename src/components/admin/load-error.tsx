"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/lib/i18n/provider"

export function AdminLoadError({ onRetry }: { onRetry: () => void }) {
  const locale = useLocale()
  return <div role="alert" className="flex flex-wrap items-center gap-3 border-y py-6">
    <p className="text-sm text-muted-foreground">{locale === "zh" ? "数据加载失败，请重试。" : "Unable to load data. Please try again."}</p>
    <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="size-4" />{locale === "zh" ? "重试" : "Retry"}</Button>
  </div>
}
