"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type CodeBlockProps = {
  children: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  className?: string
}

function CodeBlock({ children, language, filename, showLineNumbers, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const lines = children.trimEnd().split("\n")

  return (
    <div className={cn(
      "relative rounded-[var(--radius-xl)] overflow-hidden",
      "bg-[var(--codeblock-background-color)] border border-[var(--color-border)]",
      "font-mono text-[var(--font-text-sm-size)]",
      className,
    )}>
      {filename && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] text-[var(--color-text-secondary)] text-[var(--font-text-xs-size)]">
          {language && (
            <span className="rounded-[var(--radius-xs)] bg-[var(--alpha-08)] px-1.5 py-0.5 text-[var(--font-text-2xs-size)] uppercase tracking-wider font-[var(--font-weight-semibold)]">
              {language}
            </span>
          )}
          <span>{filename}</span>
        </div>
      )}

      <div className="relative">
        <button onClick={copy} aria-label="Copy code" className={cn(
          "absolute right-3 top-3 z-10 flex items-center justify-center size-7",
          "rounded-[var(--radius-md)] text-[var(--color-text-tertiary)]",
          "bg-[var(--color-surface-elevated)] border border-[var(--color-border)]",
          "hover:text-[var(--color-text)] hover:bg-[var(--alpha-08)]",
          "transition-[background-color,color] duration-[var(--transition-duration-basic)]",
          "shadow-[var(--shadow-100)]",
        )}>
          {copied
            ? <Check size={13} strokeWidth={2.5} style={{ color: "var(--green-500)" }} />
            : <Copy size={13} strokeWidth={2} />}
        </button>

        <pre className="overflow-x-auto p-4 leading-[1.6]">
          {!filename && language && (
            <div className="mb-2 text-[var(--font-text-2xs-size)] uppercase tracking-wider text-[var(--color-text-tertiary)] font-[var(--font-weight-semibold)]">
              {language}
            </div>
          )}
          <code className="text-[var(--color-text)]">
            {showLineNumbers
              ? lines.map((line, i) => (
                  <span key={i} className="flex">
                    <span className="mr-4 min-w-[2ch] text-right text-[var(--color-text-tertiary)] select-none">{i + 1}</span>
                    <span>{line}</span>
                  </span>
                ))
              : children.trimEnd()}
          </code>
        </pre>
      </div>
    </div>
  )
}

export { CodeBlock }
