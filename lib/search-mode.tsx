"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

export type SearchMode = "night" | "day"

const KEY = "veritax.searchMode"
const EVENT = "veritax:search-mode"

export function readSearchMode(): SearchMode {
  if (typeof window === "undefined") return "night"
  return localStorage.getItem(KEY) === "day" ? "day" : "night"
}

export function writeSearchMode(mode: SearchMode) {
  localStorage.setItem(KEY, mode)
  window.dispatchEvent(new Event(EVENT))
}

export function useSearchMode(): [SearchMode, (mode: SearchMode) => void] {
  const [mode, setMode] = useState<SearchMode>("night")
  useEffect(() => {
    const sync = () => setMode(readSearchMode())
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])
  return [mode, (next: SearchMode) => { writeSearchMode(next); setMode(next) }]
}

export function SearchSkin({ mode, onChange }: { mode: SearchMode; onChange: (mode: SearchMode) => void }) {
  const toDay = mode === "night"
  return (
    <button
      type="button"
      className="vt-search-skin"
      aria-label={toDay ? "Switch to day" : "Switch to night"}
      title={toDay ? "Day" : "Night"}
      onClick={() => onChange(toDay ? "day" : "night")}
    >
      {toDay ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
    </button>
  )
}
