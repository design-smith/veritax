"use client"

// Guided coach-marks for the /demo walkthrough. Dims the page, spotlights one target element (found by its
// data-tour attribute) with a pulsing ring, and shows a small text box. The dimmed area is a click-to-exit
// frame with a hole over the target, so the visitor can still interact with the highlighted element. Exiting
// remembers the current step (reported via onStepChange) so the graduation-cap icon can resume it.

import { useEffect, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"

export interface TourStep {
  target: string          // matches [data-tour="..."]
  title: string
  text: string
  appStep?: 1 | 2 | 3 | 4  // switch to this workflow tab before locating the target
  placement?: "auto" | "top" | "bottom-end"  // where the text box sits relative to the highlight
}

const PAD = 8
const TIP_W = 300

export default function DemoTour({ steps, initialStep = 0, goToStep, onStepChange, onExit, onFinish }: {
  steps: TourStep[]
  initialStep?: number
  goToStep: (s: 1 | 2 | 3 | 4) => void
  onStepChange: (i: number) => void
  onExit: () => void
  onFinish: () => void
}) {
  const [index, setIndex] = useState(() => Math.min(Math.max(0, initialStep), steps.length - 1))
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  useEffect(() => { onStepChange(index) }, [index, onStepChange])

  // Switch to the step's tab, then continuously locate + track the target (it may move as the app updates,
  // or appear after a brief generating beat).
  useEffect(() => {
    let cancelled = false
    setRect(null)
    if (step.appStep) goToStep(step.appStep)
    const t0 = setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, 60)
    let waited = 0
    const iv = setInterval(() => {
      if (cancelled) return
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      const r = el?.getBoundingClientRect()
      if (r && r.width > 0 && r.height > 0) {
        waited = 0
        setRect(prev => (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height ? prev : r))
      } else {
        setRect(null)
        waited += 200
        if (waited > 20000) { clearInterval(iv); setIndex(i => (i < steps.length - 1 ? i + 1 : i)) }
      }
    }, 200)
    return () => { cancelled = true; clearInterval(iv); clearTimeout(t0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit()
      else if (e.key === "ArrowRight") setIndex(i => (i < steps.length - 1 ? i + 1 : i))
      else if (e.key === "ArrowLeft") setIndex(i => Math.max(0, i - 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [steps.length, onExit])

  if (typeof document === "undefined") return null

  const next = () => (last ? onFinish() : setIndex(i => i + 1))
  const back = () => setIndex(i => Math.max(0, i - 1))
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Tooltip placement: below the target if it fits (or above), clamped to the viewport. A step can force
  // "top" or "bottom-end" (below, right-aligned) to stay clear of things like an open dropdown.
  let tip: CSSProperties
  if (rect) {
    const place = step.placement ?? "auto"
    const above = place === "top" || (place === "auto" && rect.bottom + 12 + 150 >= vh)
    const top = above ? Math.max(12, rect.top - 172) : rect.bottom + 14
    const left = place === "bottom-end"
      ? Math.min(Math.max(12, rect.right - TIP_W), vw - TIP_W - 12)
      : Math.min(Math.max(12, rect.left), vw - TIP_W - 12)
    tip = { position: "fixed", top, left, width: TIP_W }
  } else {
    tip = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: TIP_W }
  }

  const btn = (primary: boolean): CSSProperties => ({
    height: 30, padding: "0 0.75rem", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 500,
    border: primary ? "none" : "1px solid #e5e5e5",
    background: primary ? "#000" : "#fff", color: primary ? "#fff" : "#555", pointerEvents: "auto",
  })

  // Four transparent click-to-exit panels around the spotlight, leaving the target hole open + interactive.
  const b = rect ? { top: rect.top - PAD, left: rect.left - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 } : null
  const frame = b ? [
    { top: 0, left: 0, width: vw, height: Math.max(0, b.top) },
    { top: b.top + b.h, left: 0, width: vw, height: Math.max(0, vh - (b.top + b.h)) },
    { top: b.top, left: 0, width: Math.max(0, b.left), height: b.h },
    { top: b.top, left: b.left + b.w, width: Math.max(0, vw - (b.left + b.w)), height: b.h },
  ] : []

  return createPortal(
    // Container is click-through; only the frame panels and the tooltip capture clicks.
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none" }}>
      {b ? (
        <>
          <div style={{
            position: "fixed", top: b.top, left: b.left, width: b.w, height: b.h,
            borderRadius: 10, boxShadow: "0 0 0 9999px rgb(15 15 15 / 55%)", pointerEvents: "none", transition: "all 160ms ease",
          }} />
          <div className="vt-tour-ring" style={{
            position: "fixed", top: b.top, left: b.left, width: b.w, height: b.h,
            borderRadius: 10, border: "2px solid rgb(255 255 255 / 90%)", pointerEvents: "none", transition: "all 160ms ease",
          }} />
          {frame.map((f, i) => (
            <div key={i} onClick={onExit} style={{ position: "fixed", top: f.top, left: f.left, width: f.width, height: f.height, cursor: "pointer", pointerEvents: "auto" }} />
          ))}
        </>
      ) : (
        <div onClick={onExit} style={{ position: "absolute", inset: 0, background: "rgb(15 15 15 / 55%)", cursor: "pointer", pointerEvents: "auto" }} />
      )}

      {/* Text box */}
      <div style={{ ...tip, zIndex: 10000, background: "#fff", borderRadius: 12, padding: "1rem 1.1rem", boxShadow: "0 12px 40px rgb(0 0 0 / 25%)", pointerEvents: "auto" }}>
        {rect ? (
          <>
            <p style={{ margin: "0 0 0.375rem", fontSize: 14, fontWeight: 600, color: "#000" }}>{step.title}</p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "#555" }}>{step.text}</p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "#555" }}>Loading this step…</p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.875rem" }}>
          <span style={{ fontSize: 11, color: "#aaa" }}>{index + 1} / {steps.length}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.375rem" }}>
            {index > 0 && <button type="button" onClick={back} style={btn(false)}>Back</button>}
            <button type="button" onClick={next} style={btn(true)}>{last ? "Done" : "Next"}</button>
          </div>
        </div>
        <p style={{ margin: "0.625rem 0 0", fontSize: 11, color: "#bbb" }}>Click outside to exit — resume later from the cap icon.</p>
      </div>
    </div>,
    document.body,
  )
}
