import { NextResponse } from 'next/server'
import type { MutationResult } from '@/lib/parrilla/mutations'

/** Una sola traducción del resultado de una escritura a respuesta HTTP, para
 *  que PATCH, fecha y DELETE contesten igual ante un 404 o un conflicto. */
export function respond(outcome: MutationResult): NextResponse {
  return outcome.ok
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: outcome.error }, { status: outcome.status })
}
