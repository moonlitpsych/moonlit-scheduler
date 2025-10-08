import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const host = request.headers.get('host')

  // Temporary logging to debug middleware execution
  console.log('[MW]', host, pathname)

  // 1. Host redirect: trymoonlit.com → booking.trymoonlit.com (301)
  // Redirect all traffic from trymoonlit.com to booking.trymoonlit.com preserving path and query
  if (host === 'trymoonlit.com') {
    const redirectUrl = new URL(`https://booking.trymoonlit.com${pathname}${search}`)
    return NextResponse.redirect(redirectUrl, 301)
  }

  // 2. Route redirect: /book/* → /see-a-psychiatrist-widget (301)
  // Redirect old booking routes to new native widget page
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    const redirectUrl = new URL(`/see-a-psychiatrist-widget${search}`, request.url)
    return NextResponse.redirect(redirectUrl, 301)
  }

  // Allow all other requests to proceed normally
  return NextResponse.next()
}

// Configure matcher to run on all routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}