"use client"

import { useEffect, useRef, useState } from "react"
import { Search, RefreshCw, ShieldPlus, ShieldMinus, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { useLocale } from "@/lib/i18n/provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { listAccounts, updateAccountRole } from "@/app/admin/actions/accounts"
import type { AccountErrorCode, AccountFilters, AccountWorkspace, ManagedAccount } from "@/lib/admin/accounts"

const errors: Record<AccountErrorCode, { zh: string; en: string }> = {
  invalid: { zh: "输入无效，请检查后重试。", en: "Check your input and try again." },
  forbidden: { zh: "当前账号没有管理权限，请重新登录。", en: "Administrator access is required. Please sign in again." },
  conflict: { zh: "这个账号的角色已被修改，请取消后刷新列表。", en: "This account's role has changed. Cancel and refresh the list." },
  last_admin: { zh: "不能撤销最后一名管理员。", en: "The last administrator cannot be removed." },
  self_revoke: { zh: "不能撤销自己的管理员权限。", en: "You cannot revoke your own administrator access." },
  not_found: { zh: "账号已不存在，请取消后刷新列表。", en: "This account no longer exists. Cancel and refresh the list." },
  failed: { zh: "操作失败，请重试。", en: "The request failed. Please try again." },
}

export default function AccountsPage() {
  const locale = useLocale()
  const zh = locale === "zh"
  const [query, setQuery] = useState("")
  const [role, setRole] = useState<"all" | "user" | "admin">("all")
  const [filters, setFilters] = useState<AccountFilters>({ query: "", role: "all", page: 1 })
  const [revision, setRevision] = useState(0)
  const [workspace, setWorkspace] = useState<AccountWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<AccountErrorCode | null>(null)
  const [target, setTarget] = useState<ManagedAccount | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<AccountErrorCode | null>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    let active = true
    void listAccounts(filters).then(result => {
      if (!active) return
      if (result.ok) setWorkspace(result.data)
      else { setWorkspace(null); setLoadError(result.code) }
    }).catch(() => { if (active) { setWorkspace(null); setLoadError("failed") } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, revision])

  function refresh(next?: AccountFilters) {
    setLoading(true)
    setLoadError(null)
    setWorkspace(null)
    if (next) setFilters(next)
    else setRevision(value => value + 1)
  }

  async function confirmRole() {
    if (!target || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const result = await updateAccountRole({ id: target.id, expectedRole: target.role, role: target.role === "admin" ? "user" : "admin" })
      if (!result.ok) {
        setSaveError(result.code)
        if (result.code === "forbidden") { setWorkspace(null); setLoadError("forbidden") }
        return
      }
      toast.success(zh ? "账号权限已更新" : "Account access updated")
      setTarget(null)
      refresh()
    } catch { setSaveError("failed") }
    finally { savingRef.current = false; setSaving(false) }
  }

  const roleLabel = (value: string) => value === "admin" ? (zh ? "管理员" : "Administrator") : (zh ? "普通用户" : "User")
  const date = (value: string) => new Date(value).toLocaleDateString(zh ? "zh-CN" : "en-GB")
  const grant = target?.role !== "admin"

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{zh ? "账号管理" : "Accounts"}</h1>
      <Button variant="outline" size="sm" disabled={loading || saving} onClick={() => refresh()}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />{zh ? "刷新" : "Refresh"}</Button>
    </div>

    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); refresh({ query, role, page: 1 }) }}>
      <div className="min-w-0 flex-1 basis-60 space-y-2">
        <Label htmlFor="account-search">{zh ? "邮箱或姓名" : "Email or name"}</Label>
        <Input id="account-search" type="search" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} disabled={saving} autoComplete="off" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="account-role">{zh ? "角色" : "Role"}</Label>
        <select id="account-role" value={role} disabled={saving} onChange={event => setRole(event.target.value as typeof role)} className="h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">{zh ? "全部角色" : "All roles"}</option>
          <option value="admin">{roleLabel("admin")}</option>
          <option value="user">{roleLabel("user")}</option>
        </select>
      </div>
      <Button type="submit" className="h-9" disabled={loading || saving}><Search className="size-4" />{zh ? "搜索" : "Search"}</Button>
    </form>

    {loading && <p role="status" className="border-y py-10 text-center text-sm text-muted-foreground">{zh ? "正在加载账号..." : "Loading accounts..."}</p>}
    {loadError && <div role="alert" className="flex flex-wrap items-center gap-3 border-y py-6">
      <p className="text-sm text-red-700 dark:text-red-300">{errors[loadError][locale]}</p>
      <Button variant="outline" size="sm" disabled={loading} onClick={() => refresh()}>{zh ? "重试" : "Retry"}</Button>
    </div>}
    {workspace && <>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-live="polite">
        <span>{zh ? `找到 ${workspace.total} 个账号` : `${workspace.total} accounts found`}</span>
        <span className="flex items-center gap-1.5"><ShieldCheck className="size-4" />{zh ? `管理员共 ${workspace.adminCount} 人` : `${workspace.adminCount} administrators in total`}</span>
      </div>
      {workspace.accounts.length === 0 ? <p className="border-y py-10 text-center text-sm text-muted-foreground">{zh ? "没有找到匹配的账号" : "No matching accounts"}</p> :
        <ul className="divide-y border-y" aria-label={zh ? "账号列表" : "Account list"}>
          {workspace.accounts.map(account => <li key={account.id} data-account-id={account.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-4 md:grid-cols-[minmax(0,1fr)_8rem_7rem_11rem]">
            <div className="min-w-0 space-y-1"><p className="break-words font-medium">{account.fullName || (zh ? "未填写姓名" : "Unnamed account")}</p><p className="break-all text-sm text-muted-foreground">{account.email || (zh ? "无邮箱" : "No email")}</p></div>
            <Badge variant={account.role === "admin" ? "default" : "secondary"} className="justify-self-end md:justify-self-start">{roleLabel(account.role)}</Badge>
            <time dateTime={account.createdAt} className="hidden text-sm text-muted-foreground md:block">{date(account.createdAt)}</time>
            <div className="col-span-2 md:col-span-1 md:justify-self-end">
              {account.id === workspace.currentUserId ? <span className="text-sm text-muted-foreground">{zh ? "当前账号" : "Current account"}</span> :
                <Button variant="outline" size="sm" className="h-9" disabled={saving} onClick={() => { setSaveError(null); setTarget(account) }}>
                  {account.role === "admin" ? <ShieldMinus className="size-4" /> : <ShieldPlus className="size-4" />}
                  {account.role === "admin" ? (zh ? "撤销管理员" : "Revoke admin") : (zh ? "授予管理员" : "Grant admin")}
                </Button>}
            </div>
          </li>)}
        </ul>}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" size="icon" title={zh ? "上一页" : "Previous page"} aria-label={zh ? "上一页" : "Previous page"} disabled={workspace.page <= 1 || saving} onClick={() => refresh({ ...filters, page: workspace.page - 1 })}><ChevronLeft className="size-4" /></Button>
        <span className="text-sm tabular-nums">{workspace.page} / {Math.max(1, Math.ceil(workspace.total / workspace.pageSize))}</span>
        <Button variant="outline" size="icon" title={zh ? "下一页" : "Next page"} aria-label={zh ? "下一页" : "Next page"} disabled={workspace.page * workspace.pageSize >= workspace.total || saving} onClick={() => refresh({ ...filters, page: workspace.page + 1 })}><ChevronRight className="size-4" /></Button>
      </div>

      <section className="space-y-3 pt-4">
        <h2 className="text-lg font-semibold">{zh ? "最近权限变更" : "Recent access changes"}</h2>
        {workspace.history.length === 0 ? <p className="text-sm text-muted-foreground">{zh ? "暂无变更记录" : "No changes yet"}</p> :
          <ol className="divide-y border-y">
            {workspace.history.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-x-6 gap-y-2 py-3 text-sm">
              <div className="min-w-0 flex-1 basis-60 break-words"><span className="font-medium">{item.targetName || item.targetEmail || (zh ? "未命名账号" : "Unnamed account")}</span>
                {item.targetEmail && <span className="ml-2 break-all text-muted-foreground">{item.targetEmail}</span>}
                <p className="mt-1 text-muted-foreground">{roleLabel(item.oldRole)} → {roleLabel(item.newRole)} · {item.actorName || (zh ? "管理员" : "Administrator")}</p>
              </div>
              <time dateTime={item.createdAt} className="text-muted-foreground">{new Date(item.createdAt).toLocaleString(zh ? "zh-CN" : "en-GB")}</time>
            </li>)}
          </ol>}
      </section>
    </>}

    <Dialog open={target !== null} onOpenChange={open => { if (!open && !savingRef.current) { setTarget(null); setSaveError(null) } }}>
      <DialogContent className="rounded-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{grant ? (zh ? "授予管理员权限" : "Grant administrator access") : (zh ? "撤销管理员权限" : "Revoke administrator access")}</DialogTitle>
          <DialogDescription>{grant ? (zh ? "该账号将能够管理网站内容和其他账号的权限。" : "This account will be able to manage site content and other accounts' access.") : (zh ? "该账号将恢复为普通用户，不能再访问管理后台。" : "This account will become a regular user and lose access to the admin area.")}</DialogDescription>
        </DialogHeader>
        {target && <div className="min-w-0 space-y-1"><p className="break-words font-medium">{target.fullName}</p><p className="break-all text-sm text-muted-foreground">{target.email}</p></div>}
        {saveError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errors[saveError][locale]}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => setTarget(null)}>{zh ? "取消" : "Cancel"}</Button>
          <Button variant={grant ? "default" : "destructive"} className={grant ? undefined : "text-red-700 dark:text-red-300"} disabled={saving || saveError === "conflict" || saveError === "not_found" || saveError === "forbidden"} onClick={() => void confirmRole()}>
            {saving ? <RefreshCw className="size-4 animate-spin" /> : grant ? <ShieldPlus className="size-4" /> : <ShieldMinus className="size-4" />}
            {saving ? (zh ? "提交中..." : "Updating...") : grant ? (zh ? "确认授予" : "Confirm grant") : (zh ? "确认撤销" : "Confirm revoke")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
