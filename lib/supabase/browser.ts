import { createBrowserClient } from '@supabase/ssr'
import { fetchWithTimeout } from '@/lib/supabase/fetch'

export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // El mismo tope que en el servidor: sin él, entrar o salir se quedaban colgados si Supabase no contestaba.
    { global: { fetch: fetchWithTimeout } }
  )
}
