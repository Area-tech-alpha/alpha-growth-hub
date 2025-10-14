import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PREFIXES = ['/api/auth', '/api/webhook']

const PUBLIC_FILES = /\.(.*)$/

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip static files
  if (PUBLIC_FILES.test(pathname)) {
    return NextResponse.next()
  }

  // Skip explicitly public prefixes (webhooks, auth callbacks etc.)
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const isApi = pathname.startsWith('/api')

  const loginUrl = new URL('/login', req.url)
  const callback = req.nextUrl.pathname + req.nextUrl.search

  if (!token) {
    if (isApi) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    if (pathname !== '/login') {
      if (callback && callback !== '/login') {
        loginUrl.searchParams.set('callbackUrl', callback)
      }
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Authenticated users hitting /login -> redirect to home (optional UX)
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const role = (token as unknown as { role?: string }).role || 'user'
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
  if (isAdminRoute && role !== 'admin') {
    if (isApi) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
