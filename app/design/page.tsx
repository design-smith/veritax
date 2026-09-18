"use client"

import { IBM_Plex_Mono, Newsreader } from "next/font/google"
import { Search } from "lucide-react"
import { SearchSkin, useSearchMode } from "@/lib/search-mode"
import { WireGlobe } from "@/components/company/SearchPage"

const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--vt-display",
  display: "swap",
})

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--vt-mono",
  display: "swap",
})

const companies = [
  ["Apple Inc.", "AAPL", "3571", "Electronic Computers", "United States", "394.3B"],
  ["ASML Holding N.V.", "ASML", "3559", "Special Industry Machinery", "Netherlands", "28.3B"],
  ["Samsung Electronics", "005930", "3674", "Semiconductors", "Korea, Republic of", "198.1B"],
  ["Nestlé S.A.", "NESN", "2000", "Food and Kindred Products", "Switzerland", "94.4B"],
  ["Toyota Motor Corporation", "7203", "3711", "Motor Vehicles", "Japan", "308.1B"],
  ["Siemens AG", "SIE", "3600", "Electrical Industrial Apparatus", "Germany", "83.8B"],
]

export default function DesignSpecimen() {
  const [mode, setMode] = useSearchMode()
  return (
    <div className={`${display.variable} ${mono.variable} vt-ds`}>
      <style>{css}</style>

      <section id="ledger" className={mode === "night" ? "vt-app vt-app--night vt-ds-ledger" : "vt-app vt-ds-ledger"} data-mode={mode}>
        <aside className="vt-app-rail" aria-hidden>
          <p className="vt-app-rail-mark">Veritax</p>
          <span className="vt-app-rail-btn is-on">Search</span>
          <span className="vt-app-rail-btn">Saved companies</span>
          <span className="vt-app-rail-btn">Local file</span>
          <span className="vt-app-rail-btn vt-app-rail-out">Sign out</span>
        </aside>
        <div className="vt-search vt-search--split vt-search--specimen is-idle" data-mode={mode}>
          <SearchSkin mode={mode} onChange={setMode} />
          <WireGlobe />
          <div className="vt-search-main">
            <header className="vt-search-hero">
              <h1>Global <em>Search</em></h1>
              <form className="vt-search-bar" onSubmit={e => e.preventDefault()}>
                <div className="vt-search-instrument">
                  <span className="vt-search-submit" aria-hidden><Search size={18} strokeWidth={1.5} /></span>
                  <input className="vt-search-input" placeholder="A name, ticker, industry, or country" readOnly />
                </div>
              </form>
            </header>
          </div>
        </div>
      </section>

      <section className="vt-ds-night">
        <p className="vt-ds-kicker">Veritax · type</p>
        <h1>
          Theory of
          <br />
          <em>comparables</em>
        </h1>
        <p className="vt-ds-quote">
          Newsreader names the company. IBM Plex Mono carries the facts. Search is night.
          The record is daylight.
        </p>
      </section>

      <main className="vt-ds-day">
        <header className="vt-ds-head">
          <p className="vt-ds-mono">Pairing</p>
          <h2>Newsreader + IBM Plex Mono</h2>
          <p className="vt-ds-lede">
            Sharp roman for titles. Regular mono for work. Light canvas for a desk in daylight.
            Display type never enters chrome.
          </p>
        </header>

        <div className="vt-ds-faces">
          <figure>
            <span className="vt-ds-roman vt-ds-sample">Ag</span>
            <figcaption>
              <strong>Newsreader</strong>
              400 / italic · optical size
              <br />
              Page titles, legal names, empty states
            </figcaption>
          </figure>
          <figure>
            <span className="vt-ds-work vt-ds-sample">Ag</span>
            <figcaption>
              <strong>IBM Plex Mono</strong>
              400 / 500 · tabular nums
              <br />
              Body, tables, filters, buttons, captions
            </figcaption>
          </figure>
        </div>

        <section>
          <p className="vt-ds-mono">On a record</p>
          <div className="vt-ds-record">
            <p className="vt-ds-mono vt-ds-eyebrow">Company record</p>
            <h3>Apple Inc.</h3>
            <p className="vt-ds-meta">Cupertino, United States · AAPL (Nasdaq) · SIC 3571</p>
            <p className="vt-ds-body">
              Designs, manufactures, and markets smartphones, computers, and wearables. Sells related
              services. Operates through Americas, Europe, Greater China, Japan, and Rest of Asia Pacific.
            </p>
          </div>
        </section>

        <section>
          <p className="vt-ds-mono">In a screen</p>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Ticker</th>
                <th>SIC</th>
                <th>HQ</th>
                <th className="num">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {companies.slice(0, 4).map((row) => (
                <tr key={row[1]}>
                  <td className="name">{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>{row[4]}</td>
                  <td className="num">{row[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="vt-ds-rules">
          <p className="vt-ds-mono">Rules</p>
          <ul>
            <li>Roman on titles and legal names. Mono everywhere a practitioner works.</li>
            <li>Do not put Newsreader on 12px labels. Serifs collapse.</li>
            <li>Search is a ledger in night or day. Records and Local File stay daylight.</li>
            <li>No Inter, Playfair, Instrument Serif, or Geist.</li>
          </ul>
        </section>
      </main>
    </div>
  )
}

const css = `
.vt-ds {
  min-height: 100vh;
  background: #fcfcfc;
  color: #0d0d0d;
  --display: var(--vt-display), "Iowan Old Style", Palatino, Georgia, serif;
  --mono: var(--vt-mono), ui-monospace, "SFMono-Regular", Menlo, monospace;
}
.vt-ds-ledger {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.vt-ds-rail {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 1.5rem 0.75rem;
  background: #101010;
  border-right: 1px solid rgb(228 213 196 / 14%);
  color: #e4d5c4;
  font-family: var(--font-plex), var(--mono);
  font-size: 13px;
}
.vt-ds-rail-mark {
  font-family: var(--font-newsreader), var(--display);
  font-size: 1.15rem;
  font-weight: 400;
  letter-spacing: -0.02em;
  margin: 0 0.75rem 1.5rem;
  font-optical-sizing: auto;
}
.vt-ds-rail span {
  display: block;
  padding: 0.6rem 0.75rem;
  border-radius: 2px;
  color: rgb(228 213 196 / 70%);
}
.vt-ds-rail-on {
  background: rgb(228 213 196 / 8%);
  color: #e4d5c4 !important;
}
.vt-ds-rail-out {
  margin-top: auto;
  border: 1px solid rgb(228 213 196 / 14%);
}
.vt-ds-ledger[data-mode="day"] .vt-ds-rail {
  background: #fafafa;
  border-right-color: #e5e5e5;
  color: #0d0d0d;
}
.vt-ds-ledger[data-mode="day"] .vt-ds-rail span {
  color: #5d5d5d;
}
.vt-ds-ledger[data-mode="day"] .vt-ds-rail-on {
  background: #ececec;
  color: #0d0d0d !important;
}
.vt-ds-ledger[data-mode="day"] .vt-ds-rail-out {
  border-color: #e5e5e5;
}
.vt-ds-night {
  background: #141414;
  color: #e4d5c4;
  padding: 4.5rem 3rem 4rem;
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
  overflow: hidden;
}
.vt-ds-night::before {
  content: "";
  position: absolute;
  inset: -20% -10% auto auto;
  width: min(80vw, 720px);
  height: min(80vw, 720px);
  border: 1px solid rgb(228 213 196 / 12%);
  border-radius: 50%;
  pointer-events: none;
}
.vt-ds-night::after {
  content: "";
  position: absolute;
  inset: -8% 8% auto auto;
  width: min(55vw, 480px);
  height: min(55vw, 480px);
  border: 1px solid rgb(228 213 196 / 10%);
  border-radius: 50%;
  pointer-events: none;
}
.vt-ds-kicker {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 2rem;
  color: rgb(228 213 196 / 55%);
}
.vt-ds-night h1 {
  font-family: var(--display);
  font-size: clamp(3rem, 8vw, 5.5rem);
  font-weight: 400;
  line-height: 1.02;
  letter-spacing: -0.03em;
  margin: 0;
  text-wrap: balance;
  font-optical-sizing: auto;
  position: relative;
}
.vt-ds-night h1 em {
  font-style: italic;
  font-weight: 400;
}
.vt-ds-quote {
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
  max-width: 36rem;
  margin: 2rem 0 0;
  color: rgb(228 213 196 / 70%);
  position: relative;
}
.vt-ds-day {
  max-width: 920px;
  margin: 0 auto;
  padding: 3.5rem 1.5rem 5rem;
  display: grid;
  gap: 3rem;
}
.vt-ds-mono {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5d5d5d;
  margin: 0 0 0.75rem;
}
.vt-ds-head h2 {
  font-family: var(--display);
  font-size: 2rem;
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin: 0 0 0.75rem;
  font-optical-sizing: auto;
}
.vt-ds-lede {
  font-family: var(--mono);
  font-size: 14px;
  line-height: 1.5;
  max-width: 62ch;
  margin: 0;
  color: #303030;
}
.vt-ds-faces {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: #dfdfdf;
  border: 1px solid #dfdfdf;
}
.vt-ds-faces figure {
  margin: 0;
  padding: 1.5rem 1.25rem 1.25rem;
  background: #fff;
}
.vt-ds-sample {
  display: block;
  font-size: 4.5rem;
  line-height: 1;
  color: #0d0d0d;
}
.vt-ds-roman { font-family: var(--display); font-optical-sizing: auto; }
.vt-ds-work { font-family: var(--mono); }
.vt-ds-faces figcaption {
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.45;
  color: #5d5d5d;
  margin-top: 1.25rem;
}
.vt-ds-faces figcaption strong {
  display: block;
  color: #0d0d0d;
  font-weight: 500;
  margin-bottom: 0.2rem;
}
.vt-ds-record {
  border: 1px solid #dfdfdf;
  background: #fff;
  padding: 1.5rem 1.5rem 1.35rem;
}
.vt-ds-eyebrow {
  margin-bottom: 0.35rem;
}
.vt-ds-record h3 {
  font-family: var(--display);
  font-size: 2rem;
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 0;
  font-optical-sizing: auto;
}
.vt-ds-meta {
  font-family: var(--mono);
  font-size: 12px;
  color: #5d5d5d;
  margin: 0.45rem 0 1rem;
}
.vt-ds-body {
  font-family: var(--mono);
  font-size: 14px;
  line-height: 1.5;
  max-width: 65ch;
  margin: 0;
  color: #212121;
}
.vt-ds-day table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--mono);
  font-size: 13px;
  background: #fff;
  font-variant-numeric: tabular-nums;
}
.vt-ds-day th, .vt-ds-day td {
  text-align: left;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid #ededed;
}
.vt-ds-day th {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5d5d5d;
  border-bottom-color: #dfdfdf;
}
.vt-ds-day td.name {
  font-family: var(--display);
  font-size: 16px;
  font-weight: 400;
  letter-spacing: -0.015em;
  font-optical-sizing: auto;
}
.vt-ds-day td.num, .vt-ds-day th.num { text-align: right; }
.vt-ds-rules ul {
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.55;
  color: #303030;
}
.vt-ds-rules li + li { margin-top: 0.4rem; }
@media (max-width: 640px) {
  .vt-ds-night { padding: 3rem 1.25rem 2.5rem; min-height: 60vh; }
  .vt-ds-faces { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .vt-ds * { transition: none !important; }
}
`
