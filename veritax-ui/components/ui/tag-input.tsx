"use client"

import { X } from "lucide-react"
import { useCallback, useRef, useState, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

export type Tag = { value: string; valid: boolean }

type TagInputProps = {
  value?: Tag[]
  defaultValue?: Tag[]
  onChange?: (tags: Tag[]) => void
  placeholder?: string
  validator?: (value: string) => boolean
  maxTags?: number
  disabled?: boolean
  autoFocus?: boolean
  delimiters?: string[]
  className?: string
  id?: string
}

function TagInput({
  value: controlled, defaultValue = [], onChange, placeholder, validator,
  maxTags, disabled, autoFocus, delimiters = [",", " "], className, id,
}: TagInputProps) {
  const isControlled = controlled !== undefined
  const [internal, setInternal] = useState<Tag[]>(defaultValue)
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const tags = isControlled ? controlled! : internal

  const setTags = useCallback((next: Tag[]) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }, [isControlled, onChange])

  const add = useCallback((raw: string) => {
    const v = raw.trim()
    if (!v || (maxTags && tags.length >= maxTags)) return
    setTags([...tags, { value: v, valid: validator ? validator(v) : true }])
  }, [tags, maxTags, validator, setTags])

  const remove = useCallback((i: number) => setTags(tags.filter((_, j) => j !== i)), [tags, setTags])

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || delimiters.includes(e.key)) {
      e.preventDefault(); if (input.trim()) { add(input); setInput("") }
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      remove(tags.length - 1)
    }
  }, [input, tags, delimiters, add, remove])

  const atLimit = maxTags !== undefined && tags.length >= maxTags

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex flex-wrap items-start gap-1.5 p-2 min-h-[var(--control-size-xl)]",
          "rounded-[var(--control-radius-md)] cursor-text",
          "border border-[var(--input-outline-border-color)] bg-transparent",
          "hover:border-[var(--input-outline-border-color-hover)]",
          "focus-within:border-[var(--input-outline-border-color-focus)]",
          "transition-[border-color] duration-[var(--transition-duration-basic)]",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {tags.map((tag, i) => (
          <span key={i} className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-xs)]",
            "text-[var(--font-text-sm-size)] font-[var(--font-weight-medium)]",
            tag.valid
              ? "bg-[var(--color-background-primary-soft)] text-[var(--color-text)]"
              : "bg-[var(--color-background-danger-soft)] text-[var(--color-text-danger-soft)]",
          )}>
            {tag.value}
            {!disabled && (
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(i) }}
                className="flex items-center opacity-60 hover:opacity-100 transition-opacity"
                aria-label={`Remove ${tag.value}`}>
                <X size={11} strokeWidth={2.5} />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef} id={id} type="text" value={input}
          onChange={(e) => {
            const v = e.target.value; const last = v[v.length - 1]
            if (last && delimiters.includes(last)) { add(v.slice(0, -1)); setInput("") }
            else setInput(v)
          }}
          onKeyDown={onKeyDown}
          placeholder={tags.length === 0 ? placeholder : undefined}
          disabled={disabled || atLimit} autoFocus={autoFocus}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-[var(--input-text-color)] text-[var(--font-text-sm-size)] placeholder:text-[var(--input-placeholder-text-color)]"
        />
      </div>
      {maxTags !== undefined && (
        <div className="flex justify-end text-[var(--font-text-xs-size)] text-[var(--color-text-tertiary)]">
          {tags.length} / {maxTags}
        </div>
      )}
    </div>
  )
}

export { TagInput }
