import { NextRequest, NextResponse } from "next/server"

type Point = { t: number; c: number }

function yahooSymbol(ticker: string, exchange?: string | null): string[] {
  const t = ticker.replace(/\s+/g, "").toUpperCase()
  const ex = (exchange || "").toLowerCase()
  const out = [t]
  if (ex.includes("lse") || ex.includes("london")) out.unshift(`${t}.L`)
  else if (ex.includes("tsx") || ex.includes("toronto")) out.unshift(`${t}.TO`)
  else if (ex.includes("hk") || ex.includes("hong kong")) out.unshift(t.includes(".") ? t : `${t}.HK`)
  else if (ex.includes("frankfurt") || ex.includes("xetra") || ex.includes("etr")) out.unshift(`${t}.DE`)
  else if (ex.includes("paris") || ex.includes("epa")) out.unshift(`${t}.PA`)
  else if (ex.includes("amsterdam") || ex.includes("ams")) out.unshift(`${t}.AS`)
  return [...new Set(out)]
}

async function fromYahoo(symbol: string, period1: number, period2: number, interval: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${interval}`
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  })
  if (!res.ok) return null
  const json = await res.json() as {
    chart?: { result?: Array<{
      timestamp?: number[]
      meta?: { currency?: string; regularMarketPrice?: number; chartPreviousClose?: number }
      indicators?: { quote?: Array<{ close?: Array<number | null> }> }
    }> }
  }
  const result = json.chart?.result?.[0]
  const ts = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (!ts || !closes) return null
  const points: Point[] = []
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (c != null && Number.isFinite(c)) points.push({ t: ts[i], c })
  }
  if (!points.length) return null
  return {
    symbol,
    currency: result.meta?.currency || "USD",
    last: result.meta?.regularMarketPrice ?? points[points.length - 1].c,
    prev: result.meta?.chartPreviousClose ?? null,
    points,
  }
}

async function fromStooq(ticker: string, period1: number, period2: number) {
  const s = `${ticker.toLowerCase()}.us`
  const res = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Veritax/1.0)" },
  })
  if (!res.ok) return null
  const text = await res.text()
  const points: Point[] = []
  for (const line of text.trim().split("\n").slice(1)) {
    const [date, , , , close] = line.split(",")
    const c = Number(close)
    if (!date || !Number.isFinite(c)) continue
    const t = Math.floor(new Date(date + "T00:00:00Z").getTime() / 1000)
    if (t < period1 || t > period2) continue
    points.push({ t, c })
  }
  if (!points.length) return null
  return { symbol: ticker.toUpperCase(), currency: "USD", last: points[points.length - 1].c, prev: points[0]?.c ?? null, points }
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim()
  const exchange = req.nextUrl.searchParams.get("exchange")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")
  if (!symbol || !from || !to) return NextResponse.json({ error: "missing" }, { status: 400 })
  const period1 = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000)
  const period2 = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000)
  if (!Number.isFinite(period1) || !Number.isFinite(period2) || period2 <= period1) {
    return NextResponse.json({ error: "bad dates" }, { status: 400 })
  }
  const interval = period2 - period1 > 86400 * 400 ? "1wk" : "1d"
  for (const sym of yahooSymbol(symbol, exchange)) {
    const hit = await fromYahoo(sym, period1, period2, interval).catch(() => null)
    if (hit) return NextResponse.json(hit)
  }
  const stooq = await fromStooq(symbol, period1, period2).catch(() => null)
  if (stooq) return NextResponse.json(stooq)
  return NextResponse.json({ error: "unavailable" }, { status: 404 })
}
