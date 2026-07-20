import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Usuario autenticado desde las cookies de sesión, para usar en API routes. */
export async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Read-only en fase de respuesta de un route handler
          }
        },
      },
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
