"use client"

// Public, no-login demo. This IS the real app (components/workspace) with every step component unchanged.
// The only difference: on the /demo route the `api` singleton serves canned data from lib/demo-api
// instead of hitting the backend, so behavior is identical but nothing actually runs. Demo mode keeps the
// URL at /demo (no path sync) so demo-api's route check and the guided tour stay intact.

import Workspace from "@/components/workspace"
import { DEMO_ENGAGEMENT_ID } from "@/lib/demo-api"

// Seed the resume pointer before the app's boot effect reads it, so the demo opens on the prefilled
// Veritax (Qatar) file. Runs at module load — before any React effect.
if (typeof window !== "undefined") {
  window.localStorage.setItem("veritax.engagementId", DEMO_ENGAGEMENT_ID)
}

export default function DemoPage() {
  return <Workspace enableTour />
}
