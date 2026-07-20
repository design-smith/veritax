"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { LoadingIndicator } from "./indicator"

type Size = "3xs" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
type Variant = "soft" | "outline" | "ghost"

const S: Record<Size, { h: string; px: string; fs: string; r: string }> = {
  "3xs": { h: "var(--control-size-3xs)", px: "var(--control-gutter-2xs)", fs: "var(--control-font-size-sm)", r: "var(--control-radius-sm)" },
  "2xs": { h: "var(--control-size-2xs)", px: "var(--control-gutter-xs)",  fs: "var(--control-font-size-sm)", r: "var(--control-radius-sm)" },
  "xs":  { h: "var(--control-size-xs)",  px: "var(--control-gutter-xs)",  fs: "var(--control-font-size-md)", r: "var(--control-radius-sm)" },
  "sm":  { h: "var(--control-size-sm)",  px: "var(--control-gutter-sm)",  fs: "var(--control-font-size-md)", r: "var(--control-radius-md)" },
  "md":  { h: "var(--control-size-md)",  px: "var(--control-gutter-md)",  fs: "var(--control-font-size-md)", r: "var(--control-radius-md)" },
  "lg":  { h: "var(--control-size-lg)",  px: "var(--control-gutter-md)",  fs: "var(--control-font-size-md)", r: "var(--control-radius-md)" },
  "xl":  { h: "var(--control-size-xl)",  px: "var(--control-gutter-lg)",  fs: "var(--control-font-size-md)", r: "var(--control-radius-lg)" },
  "2xl": { h: "var(--control-size-2xl)", px: "var(--control-gutter-xl)",  fs: "var(--control-font-size-lg)", r: "var(--control-radius-xl)" },
  "3xl": { h: "var(--control-size-3xl)", px: "var(--control-gutter-xl)",  fs: "var(--control-font-size-lg)", r: "var(--control-radius-xl)" },
}

function SelectControl({
  size = "md", variant = "outline", pill = false, block = false,
  placeholder, loading = false, disabled, value, defaultValue, onValueChange, children, className,
}: {
  size?: Size; variant?: Variant; pill?: boolean; block?: boolean; placeholder?: string
  loading?: boolean; disabled?: boolean; value?: string; defaultValue?: string
  onValueChange?: (v: string) => void; children: React.ReactNode; className?: string
}) {
  const s = S[size]
  return (
    <SelectPrimitive.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled || loading}>
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex items-center justify-between gap-2 cursor-pointer outline-none",
          "font-[var(--select-control-font-weight)] leading-none",
          "transition-[background-color,border-color,color] duration-[var(--transition-duration-basic)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1",
          "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
          variant === "outline" && "border border-[var(--input-outline-border-color)] bg-transparent text-[var(--color-text)] hover:border-[var(--input-outline-border-color-hover)]",
          variant === "soft"    && "border border-transparent bg-[var(--color-background-primary-soft-alpha)] text-[var(--color-text)] hover:bg-[var(--color-background-primary-soft-alpha-hover)]",
          variant === "ghost"   && "border border-transparent bg-transparent text-[var(--color-text)] hover:bg-[var(--color-background-primary-ghost-hover)]",
          block && "w-full",
          className,
        )}
        style={{ height: s.h, paddingLeft: s.px, paddingRight: s.px, fontSize: s.fs, borderRadius: pill ? "9999px" : s.r }}
      >
        <SelectPrimitive.Value placeholder={
          <span style={{ color: "var(--input-placeholder-text-color)" }}>{placeholder}</span>
        } />
        {loading
          ? <LoadingIndicator size={14} strokeWidth={2} />
          : <SelectPrimitive.Icon asChild>
              <ChevronDown size={14} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
            </SelectPrimitive.Icon>}
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden",
            "rounded-[var(--menu-radius)] bg-[var(--color-surface-elevated)]",
            "border border-[var(--color-border)] shadow-[var(--shadow-300)]",
            "p-[var(--menu-gutter)] text-[var(--menu-font-size)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
          position="popper" sideOffset={4}
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1">
            <ChevronUp size={12} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1">
            <ChevronDown size={12} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

function SelectControlItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <SelectPrimitive.Item value={value} className={cn(
      "relative flex items-center gap-[var(--menu-item-gap)] select-none cursor-pointer outline-none",
      "rounded-[var(--radius-md)] px-2 py-[var(--menu-gutter)]",
      "text-[var(--color-text)] data-[highlighted]:bg-[var(--menu-item-background-color)]",
      "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
      className,
    )}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ml-auto">
        <Check size={12} strokeWidth={2.5} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectControlGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <SelectPrimitive.Group>
      {label && (
        <SelectPrimitive.Label className="px-2 py-1 text-[var(--font-text-xs-size)] font-[var(--font-weight-semibold)] text-[var(--color-text-tertiary)]">
          {label}
        </SelectPrimitive.Label>
      )}
      {children}
    </SelectPrimitive.Group>
  )
}

SelectControl.Item = SelectControlItem
SelectControl.Group = SelectControlGroup

export { SelectControl, SelectControlItem, SelectControlGroup }
