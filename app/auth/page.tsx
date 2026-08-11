"use client"

// The real email-code (OTP) login/signup for the live app. Moved here from /login so the public /login
// route can show the "Access Veritax Live" waitlist form pre-launch. Sign in here to reach the app at "/".

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ActionModal } from "@/components/ui/action-modal"
import { createClient } from "@/lib/supabase/client"
import { diagnoseApiFailure, withActions, type ActionableIssue, type ActionableIssueBase } from "@/lib/actionable-errors"

type Mode = "login" | "signup"

// Lazily create the browser client on first use in the browser. This keeps the build prerender
// safe even when NEXT_PUBLIC_SUPABASE_* is not available locally.
let _supa: ReturnType<typeof createClient> | null = null
const supa = () => (_supa ??= createClient())

const PRIMARY: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: "100%", height: 42, borderRadius: 8, border: "1px solid #000",
  background: "#000", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer",
}
const INPUT: React.CSSProperties = {
  width: "100%", height: 42, padding: "0 0.875rem", borderRadius: 8, border: "1px solid #e5e5e5",
  background: "#fff", color: "#000", fontSize: 14, outline: "none", boxSizing: "border-box",
}

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [stage, setStage] = useState<"form" | "code">("form")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [issue, setIssue] = useState<ActionableIssue | null>(null)

  function openIssue(
    base: ActionableIssueBase,
    primaryAction: ActionableIssue["primaryAction"] = { label: "Try again", onClick: requestCode },
    secondaryAction?: ActionableIssue["secondaryAction"],
  ) {
    setIssue(withActions(base, primaryAction, secondaryAction))
  }

  function useDifferentEmail() {
    setStage("form")
    setCode("")
    setIssue(null)
  }

  async function requestCode() {
    setIssue(null)
    setBusy(true)
    await supa().auth.signOut({ scope: "local" }).catch(error => {
      console.warn("[veritax] local sign-out before OTP failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      })
    })

    const options = mode === "signup"
      ? { shouldCreateUser: true, data: { full_name: name.trim() } }
      : { shouldCreateUser: false }

    try {
      const { error } = await supa().auth.signInWithOtp({ email: email.trim(), options })
      if (!error) {
        setStage("code")
        return
      }

      if (mode === "login" && /not (allowed|found)|signup/i.test(error.message)) {
        openIssue(
          {
            title: "No account found",
            message: "That email is not registered for Veritax yet.",
            detail: "Switch to Sign up, or use the email tied to your existing account.",
            tone: "caution",
            diagnostics: { operation: "send login code", email: email.trim(), authError: error.message },
          },
          { label: "Switch to Sign up", onClick: () => switchMode("signup") },
          { label: "Use different email", onClick: useDifferentEmail, variant: "ghost" },
        )
        return
      }

      openIssue(
        {
          title: "Could not send the code",
          message: "Supabase Auth rejected the code request.",
          detail: error.message,
          tone: "caution",
          diagnostics: { operation: "send login code", email: email.trim(), authError: error.message },
        },
        { label: "Try again", onClick: requestCode },
        { label: "Use different email", onClick: useDifferentEmail, variant: "ghost" },
      )
    } catch (error) {
      const base = await diagnoseApiFailure(error, { operation: "send login code" })
      openIssue(
        base,
        { label: "Try again", onClick: requestCode },
        { label: "Refresh", onClick: () => window.location.reload(), variant: "ghost" },
      )
    } finally {
      setBusy(false)
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    await requestCode()
  }

  async function verifyCode() {
    setIssue(null)
    setBusy(true)
    const token = code.trim()
    const em = email.trim()

    try {
      let res = await supa().auth.verifyOtp({ email: em, token, type: "email" })
      if (res.error) {
        const alt = await supa().auth.verifyOtp({ email: em, token, type: "signup" })
        if (!alt.error) res = alt
      }

      if (!res.error) {
        router.replace("/")
        return
      }

      openIssue(
        {
          title: "Code did not verify",
          message: "The code was rejected or has expired.",
          detail: res.error.message,
          tone: "caution",
          diagnostics: { operation: "verify login code", email: em, authError: res.error.message },
        },
        { label: "Try code again", onClick: () => setCode("") },
        { label: "Use different email", onClick: useDifferentEmail, variant: "ghost" },
      )
    } catch (error) {
      const base = await diagnoseApiFailure(error, { operation: "verify login code" })
      openIssue(
        base,
        { label: "Try again", onClick: verifyCode },
        { label: "Use different email", onClick: useDifferentEmail, variant: "ghost" },
      )
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    await verifyCode()
  }

  function switchMode(m: Mode) {
    setMode(m)
    setStage("form")
    setCode("")
    setIssue(null)
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", color: "#000" }}>
      <div style={{ width: 360, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
          <img src="/VeritaxLogo.png" alt="Veritax" style={{ width: 26, height: 26, objectFit: "contain" }} />
          <span style={{ fontFamily: "var(--font-wordmark)", fontSize: 22, fontWeight: 300, letterSpacing: 0, lineHeight: 1 }}>Veritax</span>
        </div>

        <div style={{ display: "flex", gap: 4, background: "#f2f2f2", borderRadius: 9999, padding: 3 }}>
          {(["login", "signup"] as const).map(m => (
            <button key={m} type="button" onClick={() => switchMode(m)} style={{
              flex: 1, height: 32, borderRadius: 9999, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
              background: mode === m ? "#fff" : "transparent",
              color: mode === m ? "#000" : "#888",
              boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}>{m === "login" ? "Log in" : "Sign up"}</button>
          ))}
        </div>

        {stage === "form" ? (
          <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {mode === "signup" && (
              <input style={INPUT} type="text" required autoComplete="name" placeholder="Full name"
                value={name} onChange={e => setName(e.target.value)} />
            )}
            <input style={INPUT} type="email" required autoComplete="email" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)} />
            <button type="submit" style={PRIMARY} disabled={busy || !email || (mode === "signup" && !name.trim())}>
              {busy ? "Sending..." : "Email me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p style={{ fontSize: 12, color: "#888", margin: 0, textAlign: "center" }}>
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            <input style={{ ...INPUT, textAlign: "center", letterSpacing: "0.2em", fontSize: 18 }}
              type="text" autoComplete="one-time-code" placeholder="Enter code" maxLength={12}
              value={code} onChange={e => setCode(e.target.value.replace(/\s+/g, ""))} />
            <button type="submit" style={PRIMARY} disabled={busy || code.trim().length < 6}>
              {busy ? "Verifying..." : "Verify and continue"}
            </button>
            <button type="button" onClick={useDifferentEmail}
              style={{ height: 34, border: "none", background: "transparent", color: "#888", fontSize: 12, cursor: "pointer" }}>
              Use a different email
            </button>
          </form>
        )}
      </div>
      <ActionModal issue={issue} onClose={() => setIssue(null)} />
    </div>
  )
}
