import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const PORTAL_PREFIXES = ['/dashboard', '/perfil', '/super', '/admin', '/comunidad']
  const isPortalRoute = PORTAL_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  )
  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/invite')

  if (!user && isPortalRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/perfil'
    return NextResponse.redirect(url)
  }

  if (user) {
    request.headers.set('x-gladwell-user-id', user.id)
    const responseWithHeader = NextResponse.next({ request })
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      responseWithHeader.cookies.set(cookie)
    })
    supabaseResponse = responseWithHeader
  }

  return supabaseResponse
}
