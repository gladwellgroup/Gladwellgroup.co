import { createClient } from '@supabase/supabase-js'

let _client: ReturnType<typeof createClient> | null = null

/** Lazy init: throws only when first called (inside a request handler), not at build time. */
export function getSupabaseServer() {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  }
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}
