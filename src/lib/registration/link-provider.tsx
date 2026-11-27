"use client"

import { createContext, useContext, type ReactNode } from "react"

const RegistrationLinkContext = createContext<string | null>(null)

export function RegistrationLinkProvider({ href, children }: { href: string | null; children: ReactNode }) {
  return <RegistrationLinkContext.Provider value={href}>{children}</RegistrationLinkContext.Provider>
}

export function useRegistrationHref() {
  return useContext(RegistrationLinkContext)
}
