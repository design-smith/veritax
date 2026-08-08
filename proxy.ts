import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Refreshes the Supabase session cookie on every request and gates the app: unauthenticated users are
// sent to /login; authenticated users on /login are sent home. Auth routes + static assets pass through.
// (Next 16 "proxy" convention — formerly "middleware".)
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
  // Public routes: the login page and the no-login demo. Everything else requires auth.
  const isAuthRoute = path.startsWith("/login")
  const isPublic = isAuthRoute || path.startsWith("/demo")
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
      url.pathname = "/login"
      url.searchParams.set("reason", "auth-unavailable")
      return NextResponse.redirect(url)
    }
    return response
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
  if (user && path.startsWith("/login")) {
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
