"use client"

// One-shot confetti burst, e.g. when the demo walkthrough finishes. Self-clears after the fall completes.

import { useEffect, useMemo } from "react"
import { createPortal } from "react-dom"

const COLORS = ["#0285ff", "#04b84c", "#ffc300", "#e02e2a", "#8046d9", "#ff66ad", "#fb6a22"]

export default function Confetti({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  const pieces = useMemo(() => Array.from({ length: 110 }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 1.8 + Math.random() * 1.3,
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    round: Math.random() > 0.5,
  })), [])

  if (typeof document === "undefined") return null

  return createPortal(
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 10001, pointerEvents: "none", overflow: "hidden" }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: "absolute", bottom: "-24px", left: `${p.left}%`,
          width: p.size, height: p.round ? p.size : p.size * 1.6,
          background: p.color, borderRadius: p.round ? "50%" : 2,
          animation: `vt-confetti-rise ${p.dur}s cubic-bezier(0.2, 0.6, 0.4, 1) ${p.delay}s forwards`,
        }} />
      ))}
    </div>,
    document.body,
  )
}
