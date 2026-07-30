"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Mode = "login" | "signup"

// Lazily create the browser client on first use (in the browser) — never during the build's prerender,
// so a missing NEXT_PUBLIC_SUPABASE_* var can't crash the build.
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

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [stage, setStage] = useState<"form" | "code">("form")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault(); setError(null); setBusy(true)
    // If middleware could not validate auth during a weak-network moment, the user may reach
    // /login while an old local session cookie still exists. Clear it before starting OTP.
    await supa().auth.signOut({ scope: "local" }).catch(error => {
      console.warn("[veritax] local sign-out before OTP failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      })
    })
    // Sign up creates the account and stores the name; login only sends a code to an existing account.
    const options = mode === "signup"
      ? { shouldCreateUser: true, data: { full_name: name.trim() } }
      : { shouldCreateUser: false }
    const { error } = await supa().auth.signInWithOtp({ email: email.trim(), options })
    setBusy(false)
    if (error) setError(mode === "login" && /not (allowed|found)|signup/i.test(error.message)
      ? "No account found for that email — switch to Sign up."
      : error.message)
    else setStage("code")
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setError(null); setBusy(true)
    const token = code.trim()
    const em = email.trim()
    // signInWithOtp codes verify as type "email"; a brand-new sign-up confirmation may need "signup".
    let res = await supa().auth.verifyOtp({ email: em, token, type: "email" })
    if (res.error) {
      const alt = await supa().auth.verifyOtp({ email: em, token, type: "signup" })
      if (!alt.error) res = alt
    }
    setBusy(false)
    if (res.error) setError(res.error.message)
    else router.replace("/")
  }

  function switchMode(m: Mode) {
    setMode(m); setStage("form"); setCode(""); setError(null)
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", color: "#000" }}>
      <div style={{ width: 360, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
          <img src="/VeritaxLogo.png" alt="Veritax" style={{ width: 26, height: 26, objectFit: "contain" }} />
          <span style={{ fontFamily: "var(--font-wordmark)", fontSize: 22, fontWeight: 300, letterSpacing: 0, lineHeight: 1 }}>Veritax</span>
        </div>

        {/* Mode toggle */}
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
              {busy ? "Sending…" : "Email me a code"}
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
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <button type="button" onClick={() => { setStage("form"); setCode(""); setError(null) }}
              style={{ height: 34, border: "none", background: "transparent", color: "#888", fontSize: 12, cursor: "pointer" }}>
              Use a different email
            </button>
          </form>
        )}

        {error && <p style={{ fontSize: 12, color: "#b00020", margin: 0, textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  )
}
