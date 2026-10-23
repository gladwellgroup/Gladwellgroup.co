'use client'

import { useRef, useState } from 'react'
import { useAppRouter } from '@/hooks/use-app-router'
import { isSessionCookie } from '@/lib/auth/session-cookies'
import { getSupabaseBrowser } from '@/lib/supabase/browser'

/** Borra a mano las cookies de sesión de Supabase (las lee el cliente del navegador, así que no son httpOnly). */
function clearSessionCookies() {
  for (const entry of document.cookie.split('; ')) {
    const name = entry.split('=')[0]
    if (isSessionCookie(name)) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

/** Cierra la sesión y lleva a /login, pase lo que pase con la red.
 *
 *  `signOut()` de Supabase llama primero a Auth para revocar el token y solo después borra la sesión local: si esa
 *  llamada falla o tarda de más, devuelve el error y la sesión se queda en las cookies. Antes el botón no hacía nada
 *  (el `await` lanzaba y la navegación no corría) o, con `finally`, navegaba a /login y el middleware devolvía a la
 *  persona al portal. Ahora, si Auth no pudo revocarla, se borran las cookies a mano y se recarga la página entera
 *  (la sesión que el cliente aún guarda en memoria la volvería a escribir al renovar el token). */
export function useSignOut() {
  const router = useAppRouter()
  const [signingOut, setSigningOut] = useState(false)
  // Un ref y no solo el estado: dos toques seguidos entran antes de que React vuelva a pintar.
  const busy = useRef(false)

  async function signOut() {
    if (busy.current) return
    busy.current = true
    setSigningOut(true)

    let revoked = false
    try {
      const { error } = await getSupabaseBrowser().auth.signOut()
      revoked = !error
    } catch {
      // La red: se limpia a mano justo abajo.
    }

    if (!revoked) {
      clearSessionCookies()
      // Navegación completa a propósito (no `router.push`): descarta la sesión que el cliente aún guarda en memoria.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login'
      return
    }

    router.push('/login')
    router.refresh()
  }

  return { signOut, signingOut }
}
