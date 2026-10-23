import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { therapyInputsSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
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

  const result = therapyInputsSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const access = await resolveDeliverableAccess(
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

  if (!access.isCreatorModeratorOrSuper) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Un creador que no es moderador ni coadministrador no puede ni ver
  // "Recomendaciones incómodas" (se redacta del lado del servidor en la
  // página) — tampoco puede escribirla, o estaría sobrescribiendo a ciegas
  // algo que ni siquiera puede leer.
  if (
    result.data.recomendaciones_incomodas !== undefined &&
    !access.isModeratorOrSuper
  ) {
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

  const { cofounders, ...inputFields } = result.data

  const { error: inputError } = await supabase
    .from('therapy_session_inputs')
    .upsert(inputFields, { onConflict: 'session_id' })

  if (inputError) {
    logError('[therapy/inputs] Supabase error', inputError)
    return NextResponse.json(
      { error: 'No se pudieron guardar los inputs' },
      { status: 500 }
    )
  }

  if (cofounders !== undefined) {
    // Sin dejar nunca la lista vacía: inserta lo nuevo y después borra lo de antes (ver replaceSessionRows).
    const replaced = await replaceSessionRows(
      supabase,
      'therapy_session_cofounders',
      result.data.session_id,
      cofounders.map((c, i) => ({
        session_id: result.data.session_id,
        nombre: c.nombre,
        whatsapp: c.whatsapp || null,
        correo: c.correo || null,
        orden: c.orden ?? i,
      }))
    )

    if (!replaced.ok) {
      return NextResponse.json(
        {
          error:
            replaced.step === 'insert'
              ? 'No se pudieron guardar los fundadores'
              : 'Los fundadores se guardaron, pero no se pudo quitar la lista anterior. Vuelve a guardar.',
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ success: true }, { status: 200 })
})
