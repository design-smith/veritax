"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type EnterVariant = "fade" | "slide-up" | "slide-down" | "scale" | "none"

const KF: Record<EnterVariant, string> = {
  fade:       "oai-fade-enter",
  "slide-up": "oai-slide-up-enter",
  "slide-down":"oai-slide-down-enter",
  scale:      "oai-scale-enter",
  none:       "",
}

const KF_CSS = `
@keyframes oai-fade-enter{from{opacity:0}to{opacity:1}}
@keyframes oai-slide-up-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes oai-slide-down-enter{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes oai-scale-enter{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
`

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return reduced
}

function Animate({ children, className, style, enter = "fade", duration = 150, delay = 0, as: Tag = "div" }: {
  children: ReactNode; className?: string; enter?: EnterVariant
  style?: CSSProperties; duration?: number; delay?: number
  as?: "div" | "span" | "section" | "article" | "aside" | "main" | "nav"
}) {
  const reduced = useReducedMotion()
  const Comp = Tag as React.ElementType
  const shouldAnimate = enter !== "none" && !reduced
  return (
    <>
      {shouldAnimate && <style>{KF_CSS}</style>}
      <Comp
        className={cn(className)}
        style={{
          ...style,
          ...(shouldAnimate ? {
            animationName: KF[enter],
            animationDuration: `${duration}ms`,
            animationDelay: delay ? `${delay}ms` : undefined,
            animationTimingFunction: "var(--cubic-enter,cubic-bezier(0.19,1,0.22,1))",
            animationFillMode: "both",
          } : {}),
        }}
      >
        {children}
      </Comp>
    </>
  )
}

function TransitionGroup({ children, className, enterDuration = 150, exitDuration = 150 }: {
  children: ReactNode; className?: string; enterDuration?: number; exitDuration?: number
}) {
  return (
    <>
      <style>{`
        @keyframes oai-tg-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes oai-tg-out{from{opacity:1}to{opacity:0;transform:translateY(-4px)}}
        .oai-enter{animation:oai-tg-in ${enterDuration}ms var(--cubic-enter,cubic-bezier(0.19,1,0.22,1)) both}
        .oai-exit{animation:oai-tg-out ${exitDuration}ms var(--cubic-exit,cubic-bezier(0.8,0,0.4,1)) both;pointer-events:none}
      `}</style>
      <div className={className}>{children}</div>
    </>
  )
}

export { Animate, TransitionGroup }
