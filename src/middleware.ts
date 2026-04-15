import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Subdomain routing
 *
 * Set NEXT_PUBLIC_ROOT_DOMAIN=portal.swipeupco.com in Vercel env vars.
 * Then add a wildcard domain *.portal.swipeupco.com in Vercel → Domains.
 *
 * bhf.portal.swipeupco.com  → client slug "bhf" stored in cookie
 * otrv.portal.swipeupco.com → client slug "otrv" stored in cookie
 * portal.swipeupco.com      → no client slug (SwipeUp fallback)
 */

function extractSubdomain(hostname: string): string | null {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (!rootDomain) return null
  const host = hostname.split(':')[0] // strip port
  if (host === rootDomain) return null
  if (host.endsWith(`.${rootDomain}`)) {
    const sub = host.slice(0, -(rootDomain.length + 1))
    if (sub && sub !== 'www') return sub
  }
  return null
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const clientSlug = extractSubdomain(hostname)

  let response = NextResponse.next({ request: { headers: request.headers } })

  // ── Supabase session refresh ────────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthRoute    = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isPublicAsset  = pathname.startsWith('/_next') || pathname.startsWith('/favicon')
  const isShareRoute   = pathname.startsWith('/share')
  const isApiRoute     = pathname.startsWith('/api')

  // ── Store client slug in cookie so client components can read it ─────────
  if (clientSlug) {
    response.cookies.set('x-client-slug', clientSlug, {
      path: '/',
      sameSite: 'lax',
      // Not httpOnly — client components need to read it
    })
  }

  // ── Auth guards ─────────────────────────────────────────────────────────────
  if (!isPublicAsset && !isAuthRoute && !isShareRoute && !isApiRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && user && !pathname.startsWith('/auth/callback')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
