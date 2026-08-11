"use client"

// The "Access Veritax Live" request form. Rendered at both /signup (reached from the demo CTA) and /login
// (the app's public entry). Collects a few details and shows a success/waitlist screen. UI only — it does
// not create an account. Waitlist analytics fire only on the demo surface (/signup), not on /login.

import { useState, useEffect, useMemo } from "react"
import { usePathname } from "next/navigation"
import { Check } from "lucide-react"
import { api } from "@/lib/api"
import { isDemoSurface, waitlistStarted, waitlistCompleted, waitlistSubmissionFailed } from "@/lib/analytics"

// ISO 3166-1 alpha-2 codes → localized country names via Intl.DisplayNames (no dependency, no 200-line name list).
const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW".split(" ")

const INPUT: React.CSSProperties = {
  width: "100%", height: 42, padding: "0 0.875rem", borderRadius: 8, border: "1px solid #e5e5e5",
  background: "#fff", color: "#000", fontSize: 14, outline: "none", boxSizing: "border-box",
}
const PRIMARY: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: "100%", height: 42, borderRadius: 8, border: "1px solid #000",
  background: "#000", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer",
}

export default function AccessLiveForm() {
  const track = isDemoSurface(usePathname())   // only the demo entry (/signup) feeds the waitlist funnel
  const [name, setName] = useState("")
  const [country, setCountry] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const canSubmit = [name, country, email, company].every(v => v.trim().length > 0)
  const countries = useMemo(() => {
    const dn = new Intl.DisplayNames(["en"], { type: "region" })
    return COUNTRY_CODES.map(c => dn.of(c) ?? c).sort((a, b) => a.localeCompare(b))
  }, [])

  useEffect(() => { if (track) waitlistStarted() }, [track])   // form opened (once per run)

  // Acquisition attribution from the entry URL (opaque lead id + UTMs), never PII in the URL.
  function attributionFromUrl(): { lead_id?: string; attribution?: Record<string, string> } {
    if (typeof window === "undefined") return {}
    const q = new URLSearchParams(window.location.search)
    const attribution: Record<string, string> = {}
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const v = q.get(k)
      if (v) attribution[k] = v
    }
    const lead_id = q.get("lead_id") ?? undefined
    return { lead_id, attribution: Object.keys(attribution).length ? attribution : undefined }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError("")
    try {
      const res = await api.submitWaitlist({
        name: name.trim(), country: country.trim(), email: email.trim(), company: company.trim(),
        ...attributionFromUrl(),
      })
      if (track) waitlistCompleted(res.waitlist_user_id)   // fires waitlist_completed + identify() by the opaque id
      setDone(true)
    } catch {
      if (track) waitlistSubmissionFailed()
      setError("Something went wrong submitting your request. Please try again.")
    } finally {
      setBusy(false)
    }
  }

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
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input style={INPUT} type="text" required autoComplete="name" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
              <select style={{ ...INPUT, cursor: "pointer", color: country ? "#000" : "#888", appearance: "auto" }}
                required autoComplete="country-name" value={country} onChange={e => setCountry(e.target.value)}>
                <option value="" disabled>Country</option>
                {countries.map(c => <option key={c} value={c} style={{ color: "#000" }}>{c}</option>)}
              </select>
              <input style={INPUT} type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              <input style={INPUT} type="text" required autoComplete="organization" placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
              {error && <p style={{ margin: 0, fontSize: 12, color: "#e02e2a" }}>{error}</p>}
              <button type="submit" style={{ ...PRIMARY, opacity: canSubmit && !busy ? 1 : 0.5, cursor: canSubmit && !busy ? "pointer" : "not-allowed" }} disabled={!canSubmit || busy}>
                {busy ? "Submitting…" : "Access"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
