import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { isAuthUnavailable } from '@/lib/auth/unavailable'
import { fetchWithTimeout } from '@/lib/supabase/fetch'
import { decideRoute } from '@/lib/supabase/route-guard'

/** Header con el id ya verificado de la persona: `getSession` (lib/auth/session.ts) lo lee y se ahorra volver a
 *  verificar la sesión. Solo vale el que pone ESTE middleware: uno que llegue del navegador se descarta. */
const USER_ID_HEADER = 'x-gladwell-user-id'

export async function updateSession(request: NextRequest) {
  // Un header con el id de otra persona no puede llegar a la página: se borra antes de nada y solo se pone después
  // de verificar la sesión (si la verificación falla y la petición pasa, tampoco llevaría uno inventado).
  request.headers.delete(USER_ID_HEADER)
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
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

  // `getClaims()` y no `getUser()`: con llave de firma asimétrica verifica el JWT en local, sin el viaje a Supabase
  // Auth que costaba ~200 ms (hasta 1,5 s) en CADA navegación y precarga; con el secreto HS256 heredado, auth-js
  // cae solo a `getUser()`, como antes. Si el token venció, lo renueva (y las cookies nuevas salen en la respuesta).
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub ?? null
  const sessionUnknown = !userId && isAuthUnavailable(error)

  const decision = decideRoute({ pathname: request.nextUrl.pathname, userId, sessionUnknown })
  if (decision !== 'continue') {
    const url = request.nextUrl.clone()
    url.pathname = decision === 'to-login' ? '/login' : '/perfil'
    const redirect = NextResponse.redirect(url)
    // Las cookies que Supabase renovó o borró en esta petición viajan también con la redirección; sin copiarlas, un
    // token renovado se perdía y la siguiente petición tenía que renovarlo otra vez.
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (userId) {
    request.headers.set(USER_ID_HEADER, userId)
    const responseWithHeader = NextResponse.next({ request })
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      responseWithHeader.cookies.set(cookie)
    })
    supabaseResponse = responseWithHeader
  }

  return supabaseResponse
}
