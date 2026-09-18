"use client"

// Click-time gate for account actions (save company, download). Search stays public.
import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function useRequireAuth(): () => Promise<boolean> {
  const router = useRouter()
  return useCallback(async () => {
    const { data } = await createClient().auth.getSession()
    if (data.session?.access_token) return true
    router.replace("/auth")
    return false
  }, [router])
}
