import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { educationInputsSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { withApiErrors } from '@/lib/api/with-errors'
import { replaceSessionRows } from '@/lib/supabase/replace-rows'
import { logError } from '@/lib/log'

export const POST = withApiErrors(async (request: NextRequest) => {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const supabase = getSupabaseServer()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = educationInputsSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const access = await resolveEducationAccess(
    supabase,
    user,
    result.data.session_id
  )

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  // Un creador puro (no admin_id/coadministrador) no puede ni ver notas del
  // moderador, transcripción ni audio (se redactan del lado del servidor en
  // la página) — tampoco puede escribirlos, o estaría sobrescribiendo a
  // ciegas algo que ni siquiera puede leer. Mismo criterio que
  // recomendaciones_incomodas en Terapia.
  const touchesNotas =
    result.data.notas_moderador !== undefined ||
    result.data.transcripcion_texto !== undefined ||
    result.data.audio_url !== undefined
  if (touchesNotas && !access.isAdminOrCoAdminOrSuper) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  if (access.session.status !== 'borrador') {
    return NextResponse.json(
      {
        error:
          'La sesión ya no está en borrador; los datos de captura no se pueden modificar.',
      },
      { status: 409 }
    )
  }

  const { tools, ...inputFields } = result.data

  const { error: inputError } = await supabase
    .from('education_session_inputs')
    .upsert(
      { ...inputFields, updated_at: new Date().toISOString() },
      { onConflict: 'session_id' }
    )

  if (inputError) {
    logError('[education/inputs] Supabase error', inputError)
    return NextResponse.json(
      { error: 'No se pudieron guardar los datos de la sesión' },
      { status: 500 }
    )
  }

  // Reemplazo completo: la lista que llega del formulario es la verdad.
  if (tools !== undefined) {
    // Sin dejar nunca la lista vacía: inserta lo nuevo y después borra lo de antes (ver replaceSessionRows).
    const replaced = await replaceSessionRows(
      supabase,
      'education_tools',
      result.data.session_id,
      tools.map((tool, i) => ({
        session_id: result.data.session_id,
        nombre: tool.nombre,
        descripcion: tool.descripcion || null,
        url: tool.url || null,
        orden: tool.orden ?? i,
      }))
    )

    if (!replaced.ok) {
      return NextResponse.json(
        {
          error:
            replaced.step === 'insert'
              ? 'No se pudieron guardar las herramientas'
              : 'Las herramientas se guardaron, pero no se pudo quitar la lista anterior. Vuelve a guardar.',
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ success: true }, { status: 200 })
})
