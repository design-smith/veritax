"use client"

// Initializes PostHog only on the public demo surfaces (/demo, /signup) and fires demo_started once per run.
// Rendered from the root layout; a no-op on every other route and whenever analytics is disabled.

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { initAnalytics, isDemoSurface, startEngagementTracking, trackDemoStarted } from "@/lib/analytics"

export default function AnalyticsProvider() {
  const pathname = usePathname()
  useEffect(() => {
    if (!isDemoSurface(pathname)) return
    initAnalytics()
    startEngagementTracking()
    if (pathname === "/demo" || pathname.startsWith("/demo/")) trackDemoStarted()
  }, [pathname])
  return null
}
