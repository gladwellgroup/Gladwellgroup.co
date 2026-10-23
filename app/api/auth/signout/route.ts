import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerSession } from '@/lib/auth/session'
import { isSessionCookie } from '@/lib/auth/session-cookies'
import { loadSessionUser } from '@/lib/auth/session-user'
import { isAuthUnavailable } from '@/lib/auth/unavailable'

/** Cierra la sesión de una cuenta que entró pero NO tiene perfil (un alta a medias) y la lleva a /login con el aviso.
 *
 *  Sin esto no había salida: `requireAuth` la mandaba a /login y el middleware devuelve de /login a /perfil a quien
 *  tiene sesión, en bucle. A propósito es un GET que solo actúa si de verdad no hay perfil: un enlace puesto en otra
 *  página (`<img src=".../api/auth/signout">`) no puede cerrarle la sesión a quien sí lo tiene. */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl
  const supabase = await getSupabaseServerSession()

  // No se lee el header `x-gladwell-user-id` del middleware: esta ruta no pasa por él, y un header así lo puede escribir
  // cualquiera. Se verifica la sesión aquí.
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) {
    // Auth no contestó: no se sabe si hay sesión. /dashboard lo vuelve a intentar y, si sigue fallando, muestra «Reintentar».
    return NextResponse.redirect(`${origin}${isAuthUnavailable(error) ? '/dashboard' : '/login'}`)
  }

  const lookup = await loadSessionUser(supabase, userId)
  // Con perfil —o sin poder saberlo— no se cierra nada.
  if (lookup.status !== 'sin-perfil') return NextResponse.redirect(`${origin}/dashboard`)

  // Cerrar la sesión revoca el token en Auth y borra las cookies. Si Auth no contesta, las cookies se borran igual: si
  // quedaran, el middleware devolvería a esta persona al portal y volvería a caer aquí.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  const cookieStore = await cookies()
  for (const { name } of cookieStore.getAll()) {
    if (isSessionCookie(name)) cookieStore.delete(name)
  }

  return NextResponse.redirect(`${origin}/login?error=perfil`)
}
