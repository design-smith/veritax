"use client"

// The "Access Veritax Live" request form. Rendered at both /signup (reached from the demo CTA) and /login
// (the app's public entry). Collects a few details and shows a success/waitlist screen. UI only — it does
// not create an account. Waitlist analytics fire only on the demo surface (/signup), not on /login.

import { useState, useEffect, useMemo } from "react"
import { usePathname } from "next/navigation"
import { api } from "@/lib/api"
import { isDemoSurface, waitlistStarted, waitlistCompleted, waitlistSubmissionFailed } from "@/lib/analytics"

// ISO 3166-1 alpha-2 codes → localized country names via Intl.DisplayNames (no dependency, no 200-line name list).
const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW".split(" ")

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
    <div className="vt-auth" style={{ padding: "1.5rem" }}>
      <div className="vt-auth-card" style={{ width: 380 }}>
        <h1 className="vt-auth-mark">Veritax</h1>

        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.875rem", textAlign: "center", padding: "0.5rem 0 0.25rem" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 400, margin: 0 }}>You&rsquo;re on the list</h1>
            <p>
              Thanks, {name.trim().split(" ")[0] || "there"} — you&rsquo;ve been added to the growing list of Veritax users.
              We review new requests and will get back to you with access within <strong>24&ndash;48 hours</strong>.
            </p>
            <a href="/demo" className="vt-auth-ghost" style={{ display: "inline-flex", alignItems: "center" }}>Back to the demo</a>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 400, margin: "0 0 0.25rem" }}>Access Veritax Live</h1>
              <p>Request access to the live app.</p>
            </div>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input type="text" required autoComplete="name" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
              <select required autoComplete="country-name" value={country} onChange={e => setCountry(e.target.value)}
                style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: 2, border: "1px solid #dfdfdf", background: "#fff", color: country ? "#0d0d0d" : "#5d5d5d", font: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                <option value="" disabled>Country</option>
                {countries.map(c => <option key={c} value={c} style={{ color: "#0d0d0d" }}>{c}</option>)}
              </select>
              <input type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              <input type="text" required autoComplete="organization" placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
              {error && <p style={{ color: "#e02e2a" }}>{error}</p>}
              <button type="submit" className="vt-auth-go" disabled={!canSubmit || busy}>
                {busy ? "Submitting…" : "Access"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
