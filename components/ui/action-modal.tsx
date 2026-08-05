"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Animate } from "@/components/ui/transition"
import { type ActionableIssue, copyDiagnostics } from "@/lib/actionable-errors"

function focusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ))
}

export function ActionModal({ issue, onClose }: {
  issue: ActionableIssue | null
  onClose?: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = "veritax-action-modal-title"
  const descId = "veritax-action-modal-description"

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!issue) return
    const previous = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => {
      focusableElements(dialogRef.current ?? document.body)[0]?.focus()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      previous?.focus?.()
    }
  }, [issue])

  useEffect(() => {
    if (!issue) return
    const currentIssue = issue
    function onKeyDown(event: KeyboardEvent) {
      const root = dialogRef.current
      if (!root) return
      if (event.key === "Escape" && currentIssue.dismissible !== false) {
        event.preventDefault()
        onClose?.()
        return
      }
      if (event.key !== "Tab") return
      const nodes = focusableElements(root)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [issue, onClose])

  if (!mounted || !issue) return null

  async function runAction(label: string, closeOnClick: boolean | undefined, action: () => void | Promise<void>) {
    if (closeOnClick !== false) onClose?.()
    setPendingAction(label)
    try {
      await action()
    } finally {
      setPendingAction(null)
    }
  }

  const stripColor = issue.tone === "danger"
    ? "var(--color-background-danger-solid)"
    : "var(--color-background-caution-solid)"
  const diagnosticsAction = issue.diagnostics ? {
    label: "Copy diagnostics",
    onClick: () => copyDiagnostics(issue),
    variant: "ghost" as const,
    closeOnClick: false,
  } : null
  const secondary = issue.secondaryAction ?? diagnosticsAction

  return createPortal(
    <div
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && issue.dismissible !== false) onClose?.()
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        background: "rgba(0,0,0,0.22)",
      }}
    >
      <Animate enter="scale" duration={150}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          style={{
            width: "min(440px, calc(100vw - 2rem))",
            overflow: "hidden",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            boxShadow: "var(--shadow-500)",
          }}
        >
          <div style={{ height: 4, background: stripColor }} />
          <div style={{ padding: "1.125rem 1.25rem 1.25rem" }}>
            <h2 id={titleId} style={{ margin: "0 0 0.5rem", fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", lineHeight: 1.3 }}>
              {issue.title}
            </h2>
            <p id={descId} style={{ margin: 0, fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              {issue.message}
            </p>
            {issue.detail && (
              <p style={{ margin: "0.625rem 0 0", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", lineHeight: 1.55 }}>
                {issue.detail}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.125rem" }}>
              {secondary && (
                <Button
                  type="button"
                  size="sm"
                  variant={secondary.variant ?? "ghost"}
                  loading={pendingAction === secondary.label}
                  onClick={() => void runAction(secondary.label, secondary.closeOnClick, secondary.onClick)}
                >
                  {secondary.label}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant={issue.primaryAction.variant ?? (issue.tone === "danger" ? "danger" : "solid")}
                loading={pendingAction === issue.primaryAction.label}
                onClick={() => void runAction(issue.primaryAction.label, issue.primaryAction.closeOnClick, issue.primaryAction.onClick)}
              >
                {issue.primaryAction.label}
              </Button>
            </div>
          </div>
        </div>
      </Animate>
    </div>,
    document.body,
  )
}
