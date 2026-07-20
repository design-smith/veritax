"use client"

import { useEffect, useState, type ElementType, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tag = "p" | "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div"

const SHIMMER: React.CSSProperties = {
  display: "inline-block",
  animationDelay: "0.6s",
  animationDuration: "3s",
  animationIterationCount: "infinite",
  animationName: "oai-shimmer",
  backgroundImage: "linear-gradient(to left, currentcolor, light-dark(var(--gray-200), var(--gray-900)) 50%, currentcolor)",
  backgroundClip: "text",
  backgroundPosition: "-100% top",
  backgroundRepeat: "no-repeat",
  backgroundSize: "50% 200%",
  WebkitTextFillColor: "transparent",
}

const IDLE: React.CSSProperties = { display: "inline-block" }

function ShimmerText({ as: Tag = "div", children, className, style }: {
  as?: Tag; children: ReactNode; className?: string; style?: React.CSSProperties
}) {
  const Comp = Tag as ElementType
  return <Comp className={cn("inline-block", className)} style={{ ...SHIMMER, ...style }}>{children}</Comp>
}

function ShimmerableText({ as: Tag = "div", children, className, shimmer = false, style }: {
  as?: Tag; children: ReactNode; className?: string; shimmer?: boolean; style?: React.CSSProperties
}) {
  const [paused, setPaused] = useState(!shimmer)
  const Comp = Tag as ElementType

  useEffect(() => { if (shimmer) setPaused(false) }, [shimmer])

  return (
    <Comp
      className={cn("inline-block", className)}
      style={paused ? { ...IDLE, ...style } : { ...SHIMMER, ...style }}
      onAnimationIteration={shimmer ? undefined : () => { if (!shimmer) setPaused(true) }}
      data-idle={paused ? "" : undefined}
    >
      {children}
    </Comp>
  )
}

export { ShimmerText, ShimmerableText }
