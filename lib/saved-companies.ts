"use client"

// Saved companies pinned to the left panel. Persisted in localStorage; a window event keeps the sidebar and
// the search page in sync when either toggles a save.
import { useEffect, useState } from "react"

const KEY = "veritax.savedCompanies"
const EVENT = "veritax:saved-changed"

export function getSaved(): string[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") } catch { return [] }
}

function write(slugs: string[]) {
  localStorage.setItem(KEY, JSON.stringify(slugs))
  window.dispatchEvent(new Event(EVENT))
}

export function isSaved(slug: string): boolean {
  return getSaved().includes(slug)
}

export function toggleSaved(slug: string): boolean {
  const cur = getSaved()
  const next = cur.includes(slug) ? cur.filter(s => s !== slug) : [...cur, slug]
  write(next)
  return next.includes(slug)
}

// React hook: [savedSet, toggle] — re-renders on any change from anywhere in the app.
export function useSavedCompanies(): [Set<string>, (slug: string) => void] {
  const [saved, setSaved] = useState<Set<string>>(new Set())
  useEffect(() => {
    const sync = () => setSaved(new Set(getSaved()))
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener("storage", sync)   // cross-tab
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync) }
  }, [])
  return [saved, (slug: string) => toggleSaved(slug)]
}
