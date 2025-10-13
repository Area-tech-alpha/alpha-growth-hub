import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect the configured matchers below
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  const isApi = pathname.startsWith('/api')
  const loginUrl = new URL('/login', req.url)

  if (!token) {
    // No session: redirect to login for pages, 401 for API
    if (isApi) return new NextResponse('Unauthorized', { status: 401 })
    return NextResponse.redirect(loginUrl)
  }

  const role = (token as unknown as { role?: string }).role || 'user'
  if (role !== 'admin') {
    // Non-admin: forbid API, redirect pages
    if (isApi) return new NextResponse('Forbidden', { status: 403 })
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

