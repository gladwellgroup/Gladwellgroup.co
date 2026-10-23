import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Desde Next 16 el archivo se llama `proxy.ts` (antes `middleware.ts`). La lógica vive en lib/supabase/middleware.ts.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/login',
    '/invite/:path*',
    '/dashboard',
    '/perfil',
    '/super/:path*',
    '/admin/:path*',
    '/comunidad/:path*',
  ],
}
