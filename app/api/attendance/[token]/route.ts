import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const bodySchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  correo: z.string().trim().email('Correo inválido'),
})

/** Registro público de asistencia — sin login, como /invite/[token]. La
 *  protección real es la coincidencia exacta de token + expires_at vigente,
 *  revalidada aquí aunque la página ya la haya validado al cargar: el
 *  formulario pudo quedar abierto más tiempo del que dura el link. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()
  const { data: link } = await supabase
    .from('session_attendance_links')
    .select('therapy_session_id, education_session_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 })
  }

  if (new Date(link.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Este enlace ya venció' }, { status: 410 })
  }

  const { nombre, correo } = parsed.data
  const isTherapy = Boolean(link.therapy_session_id)
  const table = isTherapy ? 'therapy_session_attendees' : 'education_attendees'
  const sessionId = link.therapy_session_id ?? link.education_session_id

  const row: Record<string, unknown> = {
    session_id: sessionId,
    nombre,
    correo: correo.toLowerCase(),
    source: 'qr',
  }

  const { error } = await supabase.from(table).insert(row)

  // 23505 = unique_violation: ya se había registrado con este correo en esta
  // sesión — reenviar el formulario es idempotente, no un error.
  if (error && error.code !== '23505') {
    console.error('[attendance] insert error:', error)
    return NextResponse.json(
      { error: 'No se pudo registrar la asistencia' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
