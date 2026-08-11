"use client"

// Public request-access page reached from the demo's "Access Veritax Live" button. Collects a few details
// and shows a success/waitlist screen. UI only — it does not create an account.

import { useState } from "react"
import { Check } from "lucide-react"

const INPUT: React.CSSProperties = {
  width: "100%", height: 42, padding: "0 0.875rem", borderRadius: 8, border: "1px solid #e5e5e5",
  background: "#fff", color: "#000", fontSize: 14, outline: "none", boxSizing: "border-box",
}
const PRIMARY: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: "100%", height: 42, borderRadius: 8, border: "1px solid #000",
  background: "#000", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer",
}

export default function SignupPage() {
  const [name, setName] = useState("")
  const [country, setCountry] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [done, setDone] = useState(false)
  const canSubmit = [name, country, email, company].every(v => v.trim().length > 0)

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", color: "#000", padding: "1.5rem" }}>
      <div style={{ width: 380, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
          <img src="/VeritaxLogo.png" alt="Veritax" style={{ width: 26, height: 26, objectFit: "contain" }} />
          <span style={{ fontFamily: "var(--font-wordmark)", fontSize: 22, fontWeight: 300, letterSpacing: 0, lineHeight: 1 }}>Veritax</span>
        </div>

        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.875rem", textAlign: "center", padding: "0.5rem 0 0.25rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 9999, background: "#ecfdf3", color: "#027a48" }}>
              <Check size={24} />
            </span>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>You&rsquo;re on the list</h1>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "#555", margin: 0 }}>
              Thanks, {name.trim().split(" ")[0] || "there"} — you&rsquo;ve been added to the growing list of Veritax users.
              We review new requests and will get back to you with access within <strong>24&ndash;48 hours</strong>.
            </p>
            <a href="/demo" style={{ fontSize: 13, color: "#555", textDecoration: "underline", textUnderlineOffset: 2 }}>Back to the demo</a>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 0.25rem" }}>Access Veritax Live</h1>
              <p style={{ fontSize: 13, color: "#888", margin: 0 }}>Request access to the live app.</p>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (canSubmit) setDone(true) }} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input style={INPUT} type="text" required autoComplete="name" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
              <input style={INPUT} type="text" required autoComplete="country-name" placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} />
              <input style={INPUT} type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              <input style={INPUT} type="text" required autoComplete="organization" placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
              <button type="submit" style={{ ...PRIMARY, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }} disabled={!canSubmit}>
                Access
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
