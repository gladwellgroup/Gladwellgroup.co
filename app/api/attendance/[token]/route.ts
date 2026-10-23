import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { isQueryFailure } from '@/lib/supabase/must'
import { attendanceFormSchema } from '@/lib/validations/attendees'
import { withApiErrors } from '@/lib/api/with-errors'
import { logError } from '@/lib/log'

export const runtime = 'nodejs'

/** Registro público de asistencia — sin login, como /invite/[token]. La
 *  protección real es la coincidencia exacta de token + expires_at vigente,
 *  revalidada aquí aunque la página ya la haya validado al cargar: el
 *  formulario pudo quedar abierto más tiempo del que dura el link. */
export const POST = withApiErrors(async (
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) => {
  const { token } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = attendanceFormSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()
  const { data: link, error: linkError } = await supabase
    .from('session_attendance_links')
    .select('therapy_session_id, education_session_id, charla_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  // Si la base no contestó NO es «enlace no válido»: quien escanea el QR en vivo creería que el QR está mal. Un 503
  // le dice que reintente.
  if (isQueryFailure(linkError)) {
    logError('[attendance] link lookup failed', linkError.message)
    return NextResponse.json(
      { error: 'No pudimos cargar el enlace. Intenta de nuevo en unos segundos.' },
      { status: 503 }
    )
  }

  if (!link) {
    return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 })
  }

  if (new Date(link.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Este enlace ya venció' }, { status: 410 })
  }

  const { nombre, correo } = parsed.data

  // Cada programa guarda a sus asistentes en su propia tabla. La charla no manda
  // ningún entregable, así que su fila no lleva ni `source` (todos llegan por QR)
  // ni estado de envío.
  const { error } = link.charla_id
    ? await supabase.from('charla_attendees').insert({
        charla_id: link.charla_id,
        nombre,
        correo: correo.toLowerCase(),
      })
    : await supabase
        .from(link.therapy_session_id ? 'therapy_session_attendees' : 'education_attendees')
        .insert({
          session_id: link.therapy_session_id ?? link.education_session_id,
          nombre,
          correo: correo.toLowerCase(),
          source: 'qr',
        })

  // 23505 = unique_violation: ya se había registrado con este correo en esta
  // sesión — reenviar el formulario es idempotente, no un error.
  if (error && error.code !== '23505') {
    logError('[attendance] insert error', error)
    return NextResponse.json(
      { error: 'No se pudo registrar la asistencia' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
})
