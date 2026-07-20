"use client"

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { cn } from "@/lib/utils"

type Size = "3xs" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"

const SIZES: Record<Size, { h: string; r: string; px: string; fs: string }> = {
  "3xs": { h: "var(--control-size-3xs)", r: "var(--control-radius-sm)", px: "var(--control-gutter-xs)", fs: "var(--control-font-size-sm)" },
  "2xs": { h: "var(--control-size-2xs)", r: "var(--control-radius-sm)", px: "var(--control-gutter-xs)", fs: "var(--control-font-size-sm)" },
  "xs":  { h: "var(--control-size-xs)",  r: "var(--control-radius-sm)", px: "var(--control-gutter-xs)", fs: "var(--control-font-size-md)" },
  "sm":  { h: "var(--control-size-sm)",  r: "var(--control-radius-md)", px: "var(--control-gutter-sm)", fs: "var(--control-font-size-md)" },
  "md":  { h: "var(--control-size-md)",  r: "var(--control-radius-md)", px: "var(--control-gutter-md)", fs: "var(--control-font-size-md)" },
  "lg":  { h: "var(--control-size-lg)",  r: "var(--control-radius-md)", px: "var(--control-gutter-md)", fs: "var(--control-font-size-md)" },
  "xl":  { h: "var(--control-size-xl)",  r: "var(--control-radius-lg)", px: "var(--control-gutter-lg)", fs: "var(--control-font-size-md)" },
  "2xl": { h: "var(--control-size-2xl)", r: "var(--control-radius-xl)", px: "var(--control-gutter-xl)", fs: "var(--control-font-size-lg)" },
  "3xl": { h: "var(--control-size-3xl)", r: "var(--control-radius-xl)", px: "var(--control-gutter-xl)", fs: "var(--control-font-size-lg)" },
}

type SegmentedControlProps<T extends string> = {
  value: T
  onChange?: (v: T) => void
  "aria-label": string
  size?: Size
  pill?: boolean
  block?: boolean
  disabled?: boolean
  className?: string
  children: React.ReactNode
}

function SegmentedControl<T extends string>({
  value, onChange, children, pill = true, size = "md", block, className,
  "aria-label": ariaLabel, ...rest
}: SegmentedControlProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const s = SIZES[size]

  const applyThumb = useCallback(() => {
    const root = rootRef.current; const thumb = thumbRef.current
    if (!root || !thumb) return
    const active = root.querySelector<HTMLElement>('[data-state="on"]')
    if (!active) return
    const rootW = root.clientWidth
    let w = Math.floor(active.clientWidth)
    const left = active.offsetLeft
    if (rootW - (w + left) < 2) w -= 1
    thumb.style.width = `${w}px`
    thumb.style.transform = `translateX(${left}px)`
  }, [])

  useLayoutEffect(() => {
    const thumb = thumbRef.current; if (!thumb) return
    applyThumb()
    if (!thumb.style.transition) {
      requestAnimationFrame(() => {
        if (thumbRef.current) thumbRef.current.style.transition =
          "width 300ms var(--cubic-enter), transform 300ms var(--cubic-enter)"
      })
    }
  }, [applyThumb, value, size, pill])

  useEffect(() => {
    const root = rootRef.current; const thumb = thumbRef.current
    if (!root || !thumb) return
    const ro = new ResizeObserver(() => {
      const prev = thumb.style.transition; thumb.style.transition = ""
      applyThumb(); thumb.style.transition = prev
    })
    ro.observe(root); return () => ro.disconnect()
  }, [applyThumb])

  return (
    <ToggleGroupPrimitive.Root
      ref={rootRef} type="single" value={value} loop={false} aria-label={ariaLabel}
      onValueChange={(v) => { if (v && onChange) onChange(v as T) }}
      className={cn(
        "relative inline-flex flex-nowrap overflow-auto align-middle whitespace-nowrap",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "bg-[var(--segmented-control-background)] font-[var(--segmented-control-font-weight)]",
        block && "flex w-full overflow-hidden",
        className,
      )}
      style={{
        gap: "var(--segmented-control-gap)",
        padding: "var(--segmented-control-gutter)",
        height: s.h,
        borderRadius: pill ? "9999px" : s.r,
        fontSize: s.fs,
      }}
      {...rest}
    >
      <div
        ref={thumbRef} aria-hidden="true"
        className="pointer-events-none absolute left-0 will-change-transform"
        style={{
          top: "var(--segmented-control-gutter)",
          bottom: "var(--segmented-control-gutter)",
          borderRadius: "inherit",
          background: "var(--segmented-control-thumb-background)",
          boxShadow: "var(--segmented-control-thumb-shadow)",
        }}
      />
      {children}
    </ToggleGroupPrimitive.Root>
  )
}

function Segment({ children, className, value, disabled, "aria-label": ariaLabel }: {
  value: string; children: React.ReactNode; disabled?: boolean
  "aria-label"?: string; className?: string
}) {
  return (
    <ToggleGroupPrimitive.Item
      value={value} disabled={disabled} aria-label={ariaLabel}
      className={cn(
        "relative cursor-pointer rounded-[inherit]",
        "px-[var(--segmented-control-option-gutter,var(--control-gutter-md))]",
        "text-[var(--color-text-secondary)] transition-[opacity,background-color,color]",
        "duration-[var(--transition-duration-basic)] focus:outline-none",
        "data-[state=on]:text-[var(--color-text)]",
        "data-[state=off]:hover:text-[var(--color-text)]",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        "flex-1 [.block_&]:flex-1",
        className,
      )}
    >
      <span className="relative">{children}</span>
    </ToggleGroupPrimitive.Item>
  )
}

SegmentedControl.Option = Segment

export { SegmentedControl, Segment }
