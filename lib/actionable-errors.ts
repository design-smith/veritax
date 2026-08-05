"use client"

import { createClient } from "@/lib/supabase/client"
import { API_BASE } from "@/lib/api"

export type ActionableTone = "danger" | "caution"
export type ActionVariant = "solid" | "soft" | "outline" | "ghost" | "danger" | "success" | "info"

export interface ActionableErrorAction {
  label: string
  onClick: () => void | Promise<void>
  variant?: ActionVariant
  closeOnClick?: boolean
}

export interface ActionableIssueBase {
  title: string
  message: string
  detail?: string
  tone: ActionableTone
  diagnostics?: Record<string, unknown>
  dismissible?: boolean
}

export interface ActionableIssue extends ActionableIssueBase {
  primaryAction: ActionableErrorAction
  secondaryAction?: ActionableErrorAction
}

export interface ParsedApiError {
  name: string
  message: string
  status?: number
  url?: string
  bodyText?: string
  detail?: string
  isNetworkFailure: boolean
  isAbort: boolean
}

interface DiagnoseContext {
  operation?: string
  engagementId?: string | null
  jurisdiction?: string | null
}

interface RetryOptions {
  retries?: number
  delayMs?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number) => void | Promise<unknown>
  recover?: () => void | Promise<unknown>
}

const TRANSIENT_STATUS = new Set([408, 429, 502, 503, 504])

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError"
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function parseDetail(bodyText?: string) {
  if (!bodyText) return undefined
  try {
    const parsed = JSON.parse(bodyText)
    if (typeof parsed.detail === "string") return parsed.detail
    if (Array.isArray(parsed.detail)) return parsed.detail.map((item: unknown) => {
      if (typeof item === "string") return item
      if (item && typeof item === "object" && "msg" in item) return String((item as { msg: unknown }).msg)
      return JSON.stringify(item)
    }).join("; ")
  } catch {
    return bodyText
  }
  return bodyText
}

export function parseApiError(error: unknown): ParsedApiError {
  const name = errorName(error)
  const message = errorMessage(error)
  const match = message.match(/^API (\d{3}) (.*?): ([\s\S]*)$/)
  const status = match ? Number(match[1]) : undefined
  const url = match?.[2]
  const bodyText = match?.[3]
  const isAbort = name === "AbortError" || message.toLowerCase().includes("aborted")
  const isNetworkFailure =
    !status &&
    (message.includes("Failed to fetch") ||
      message.includes("fetch failed") ||
      message.includes("NetworkError") ||
      message.includes("Load failed"))

  return {
    name,
    message,
    status,
    url,
    bodyText,
    detail: parseDetail(bodyText),
    isNetworkFailure,
    isAbort,
  }
}

export function isTransientError(error: unknown) {
  const parsed = parseApiError(error)
  if (parsed.isNetworkFailure || parsed.isAbort) return true
  return parsed.status !== undefined && TRANSIENT_STATUS.has(parsed.status)
}

export async function runWithRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 2
  const delayMs = options.delayMs ?? 450
  const shouldRetry = options.shouldRetry ?? isTransientError
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const willRetry = attempt < retries && shouldRetry(error, attempt + 1)
      if (!willRetry) break
      console.warn("[veritax:error-retry] retrying operation", {
        attempt: attempt + 1,
        nextAttempt: attempt + 2,
        error: {
          name: errorName(error),
          message: errorMessage(error),
          status: parseApiError(error).status,
        },
      })
      await options.onRetry?.(error, attempt + 1)
      if (attempt === 0) await options.recover?.()
      await sleep(delayMs * Math.pow(1.7, attempt))
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Operation failed")
}

async function probeJson(path: "/health" | "/ready") {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4500)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      signal: controller.signal,
    })
    const text = await res.text().catch(() => "")
    let body: unknown = null
    try { body = text ? JSON.parse(text) : null } catch { body = text }
    return { ok: res.ok, status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

async function probeNoCorsHealth() {
  try {
    await fetch(`${API_BASE}/health`, { cache: "no-store", mode: "no-cors" })
    return true
  } catch {
    return false
  }
}

async function readSessionDiagnostics() {
  try {
    const { data, error } = await createClient().auth.getSession()
    return {
      sessionPresent: Boolean(data.session?.access_token),
      sessionError: error?.message ?? null,
    }
  } catch (error) {
    return {
      sessionPresent: false,
      sessionError: errorMessage(error),
    }
  }
}

function baseDiagnostics(parsed: ParsedApiError, context?: DiagnoseContext): Record<string, unknown> {
  return {
    operation: context?.operation ?? null,
    engagementId: context?.engagementId ?? null,
    jurisdiction: context?.jurisdiction ?? null,
    apiBase: API_BASE,
    browserOnline: typeof navigator === "undefined" ? null : navigator.onLine,
    error: {
      name: parsed.name,
      message: parsed.message,
      status: parsed.status ?? null,
      url: parsed.url ?? null,
      detail: parsed.detail ?? null,
    },
  }
}

function issueForStatus(parsed: ParsedApiError, context?: DiagnoseContext): ActionableIssueBase | null {
  const detail = parsed.detail ?? parsed.bodyText
  const diagnostics = baseDiagnostics(parsed, context)
  switch (parsed.status) {
    case 401:
      return {
        title: "Your session needs a refresh",
        message: "The backend rejected this request because the login token is missing or expired.",
        detail: detail || "Sign in again, then retry the step.",
        tone: "caution",
        diagnostics,
      }
    case 404:
      return {
        title: "This item is no longer available",
        message: "The app asked for a record the backend could not find.",
        detail: detail || "Refresh the current step so Veritax can reload the latest project state.",
        tone: "caution",
        diagnostics,
      }
    case 409:
      return {
        title: "This step is not ready yet",
        message: detail || "A prerequisite has not finished or the evidence gate is blocking this action.",
        detail: "Open the earlier step, resolve the blocker, then retry.",
        tone: "caution",
        diagnostics,
      }
    case 413:
      return {
        title: "That file is too large",
        message: "The backend rejected the upload before it could be processed.",
        detail: detail || "Upload a smaller file or split the source into smaller documents.",
        tone: "caution",
        diagnostics,
      }
    case 422:
      return {
        title: "Something needs to be corrected",
        message: "The backend could not use part of this request.",
        detail: detail || "Check the input and retry.",
        tone: "caution",
        diagnostics,
      }
    case 429:
      return {
        title: "The service is temporarily rate limited",
        message: "Veritax received too many requests too quickly.",
        detail: detail || "Wait a moment, then retry the action.",
        tone: "caution",
        diagnostics,
      }
    default:
      if (parsed.status && parsed.status >= 500) {
        return {
          title: parsed.status === 502 || parsed.status === 503 || parsed.status === 504
            ? "The backend is waking up or overloaded"
            : "The backend hit an internal error",
          message: "The request reached the backend, but the backend could not complete it.",
          detail: detail || "Retry once. If it repeats, copy diagnostics for the backend logs.",
          tone: "danger",
          diagnostics,
        }
      }
      return null
  }
}

export async function diagnoseApiFailure(error: unknown, context?: DiagnoseContext): Promise<ActionableIssueBase> {
  const parsed = parseApiError(error)
  const statusIssue = issueForStatus(parsed, context)
  if (statusIssue) return statusIssue

  const diagnostics = baseDiagnostics(parsed, context)
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      title: "You appear to be offline",
      message: "Your browser reports no network connection, so Veritax cannot reach the backend.",
      detail: "Reconnect, then retry.",
      tone: "caution",
      diagnostics,
    }
  }

  let health: Awaited<ReturnType<typeof probeJson>> | null = null
  let ready: Awaited<ReturnType<typeof probeJson>> | null = null
  let healthError: string | null = null
  let readyError: string | null = null

  try { health = await probeJson("/health") } catch (e) { healthError = errorMessage(e) }
  diagnostics.health = health ?? { error: healthError }

  if (!health?.ok) {
    const noCorsReachable = await probeNoCorsHealth()
    diagnostics.noCorsHealthReachable = noCorsReachable
    if (noCorsReachable) {
      return {
        title: "The browser blocked the backend response",
        message: "The backend appears reachable, but this browser could not read the response.",
        detail: "This is usually an origin/CORS setting, privacy extension, or browser blocker issue.",
        tone: "caution",
        diagnostics,
      }
    }
    return {
      title: "The backend is unreachable",
      message: "Veritax could not reach the API server from this browser.",
      detail: "Retry first. If it repeats, check the backend deployment and API URL.",
      tone: "danger",
      diagnostics,
    }
  }

  try { ready = await probeJson("/ready") } catch (e) { readyError = errorMessage(e) }
  diagnostics.ready = ready ?? { error: readyError }

  if (!ready?.ok) {
    return {
      title: "The database is not ready",
      message: "The backend is online, but its readiness check is failing.",
      detail: "Retry shortly. If it repeats, the backend database connection or migrations need attention.",
      tone: "danger",
      diagnostics,
    }
  }

  const session = await readSessionDiagnostics()
  diagnostics.session = session
  if (!session.sessionPresent) {
    return {
      title: "Sign in again",
      message: "The backend is healthy, but this browser does not have a usable login session.",
      detail: session.sessionError || "Sign in again, then retry.",
      tone: "caution",
      diagnostics,
    }
  }

  return {
    title: "This request failed",
    message: parsed.isNetworkFailure
      ? "The backend is healthy, but this request failed before the browser could read the response."
      : "Veritax could not complete this action.",
    detail: parsed.detail || parsed.message,
    tone: parsed.isNetworkFailure ? "caution" : "danger",
    diagnostics,
  }
}

export function withActions(
  base: ActionableIssueBase,
  primaryAction: ActionableErrorAction,
  secondaryAction?: ActionableErrorAction,
): ActionableIssue {
  return { ...base, primaryAction, secondaryAction }
}

export async function copyDiagnostics(issue: Pick<ActionableIssueBase, "diagnostics" | "title" | "message" | "detail">) {
  const payload = JSON.stringify({
    title: issue.title,
    message: issue.message,
    detail: issue.detail ?? null,
    diagnostics: issue.diagnostics ?? {},
    copiedAt: new Date().toISOString(),
  }, null, 2)
  await navigator.clipboard?.writeText(payload)
}
