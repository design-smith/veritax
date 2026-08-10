"use client"

// Guided coach-marks for the /demo walkthrough. Dims the page, spotlights one target element (found by
// its data-tour attribute) with a pulsing ring, and shows a small text box. Steps can switch workflow tab
// first (goToStep) and wait for their target to appear (draft sections generate asynchronously).

import { useEffect, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"

export interface TourStep {
  target: string          // matches [data-tour="..."]
  title: string
  text: string
  appStep?: 1 | 2 | 3 | 4  // switch to this workflow tab before locating the target
}

const PAD = 8
const TIP_W = 300

export default function DemoTour({ steps, goToStep, onClose }: {
  steps: TourStep[]
  goToStep: (s: 1 | 2 | 3 | 4) => void
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  // Locate (and keep re-measuring) the current step's target; switch tab first if it lives elsewhere.
  useEffect(() => {
    let cancelled = false
    setRect(null)
    if (step.appStep) goToStep(step.appStep)

    const find = () => document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
    const measure = () => {
      const el = find()
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? r : null
    }

    let tries = 0
    const poll = setInterval(() => {
      if (cancelled) return
      const r = measure()
      tries += 1
      if (r) {
        clearInterval(poll)
        find()?.scrollIntoView({ block: "center", behavior: "smooth" })
        setTimeout(() => { if (!cancelled) setRect(find()?.getBoundingClientRect() ?? r) }, 320)
      } else if (tries > 240) {           // ~36s: give up and move on
        clearInterval(poll)
        if (!cancelled) setIndex(i => (i < steps.length - 1 ? i + 1 : i))
      }
    }, 150)

    const remeasure = () => { const r = measure(); if (r) setRect(r) }
    window.addEventListener("resize", remeasure)
    window.addEventListener("scroll", remeasure, true)
    return () => {
      cancelled = true
      clearInterval(poll)
      window.removeEventListener("resize", remeasure)
      window.removeEventListener("scroll", remeasure, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowRight" || e.key === "Enter") setIndex(i => (i < steps.length - 1 ? i + 1 : i))
      else if (e.key === "ArrowLeft") setIndex(i => Math.max(0, i - 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [steps.length, onClose])

  if (typeof document === "undefined") return null

  const next = () => (last ? onClose() : setIndex(i => i + 1))
  const back = () => setIndex(i => Math.max(0, i - 1))

  // Tooltip placement: below the target if it fits, else above; clamped to the viewport.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200
  let tip: CSSProperties
  if (rect) {
    const below = rect.bottom + 12 + 150 < vh
    const top = below ? rect.bottom + 14 : Math.max(12, rect.top - 14 - 160)
    const left = Math.min(Math.max(12, rect.left), vw - TIP_W - 12)
    tip = { position: "fixed", top, left, width: TIP_W }
  } else {
    tip = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: TIP_W }
  }

  const btn = (primary: boolean): CSSProperties => ({
    height: 30, padding: "0 0.75rem", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 500,
    border: primary ? "none" : "1px solid #e5e5e5",
    background: primary ? "#000" : "#fff", color: primary ? "#fff" : "#555",
  })

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      {/* Click-catcher: blocks the app underneath while the tour is open. */}
      <div style={{ position: "absolute", inset: 0, background: rect ? "transparent" : "rgb(15 15 15 / 55%)" }} />

      {/* Spotlight: the box-shadow spread dims everything except the target. */}
      {rect && (
        <>
          <div style={{
            position: "fixed",
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            borderRadius: 10, boxShadow: "0 0 0 9999px rgb(15 15 15 / 55%)",
            pointerEvents: "none", transition: "all 220ms ease",
          }} />
          <div className="vt-tour-ring" style={{
            position: "fixed",
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            borderRadius: 10, border: "2px solid rgb(255 255 255 / 90%)",
            pointerEvents: "none", transition: "all 220ms ease",
          }} />
        </>
      )}

      {/* Text box */}
      <div style={{
        ...tip, zIndex: 10000, background: "#fff", borderRadius: 12, padding: "1rem 1.1rem",
        boxShadow: "0 12px 40px rgb(0 0 0 / 25%)",
      }}>
        {rect ? (
          <>
            <p style={{ margin: "0 0 0.375rem", fontSize: 14, fontWeight: 600, color: "#000" }}>{step.title}</p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "#555" }}>{step.text}</p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="vt-tour-ring" style={{ width: 8, height: 8, borderRadius: 999, background: "#000", display: "inline-block" }} />
            One moment…
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.875rem" }}>
          <span style={{ fontSize: 11, color: "#aaa" }}>{index + 1} / {steps.length}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.375rem" }}>
            <button type="button" onClick={onClose} style={btn(false)}>Skip</button>
            {index > 0 && <button type="button" onClick={back} style={btn(false)}>Back</button>}
            <button type="button" onClick={next} style={btn(true)}>{last ? "Done" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
