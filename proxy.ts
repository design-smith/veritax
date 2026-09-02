import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Refreshes the Supabase session cookie on every request and gates the app: unauthenticated users are
// sent to /auth (the real login); authenticated users on /auth are sent home. Public routes + static
// assets pass through. (Next 16 "proxy" convention — formerly "middleware".)
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const path = request.nextUrl.pathname
  // Public routes: the app entry + waitlist (/login, /signup), the no-login demo, and the real login (/auth).
  // /companies serves the standardized company-research JSON (public SEC data) the no-login demo reads.
  // Everything else requires auth.
  const isPublic = ["/login", "/signup", "/demo", "/auth", "/companies"].some(p => path.startsWith(p))
  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
    if (result.error) {
      console.warn("[veritax] supabase getUser returned error", {
        name: result.error.name,
        status: result.error.status,
        code: result.error.code,
        message: result.error.message,
      })
    }
  } catch (error) {
    console.warn("[veritax] supabase getUser fetch failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    })
    if (!isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth"
      url.searchParams.set("reason", "auth-unavailable")
      return NextResponse.redirect(url)
    }
    return response
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    return NextResponse.redirect(url)
  }
  if (user && path.startsWith("/auth")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  // Run on everything except Next internals and static image assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
