import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { therapyInputsSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

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

  if (access.session.status !== 'borrador') {
    return NextResponse.json(
      {
        error:
          'La sesión ya no está en borrador; los datos de captura no se pueden modificar.',
      },
      { status: 403 }
    )
  }

  const { cofounders, ...inputFields } = result.data

  const { error: inputError } = await supabase
    .from('therapy_session_inputs')
    .upsert(inputFields, { onConflict: 'session_id' })

  if (inputError) {
    console.error('[therapy/inputs] Supabase error:', inputError)
    return NextResponse.json(
      { error: 'No se pudieron guardar los inputs' },
      { status: 500 }
    )
  }

  if (cofounders !== undefined) {
    const { error: deleteError } = await supabase
      .from('therapy_session_cofounders')
      .delete()
      .eq('session_id', result.data.session_id)

    if (deleteError) {
      console.error('[therapy/inputs] Error limpiando cofundadores:', deleteError)
    }

    if (cofounders.length > 0) {
      const cofoundersWithSession = cofounders.map((c, i) => ({
        session_id: result.data.session_id,
        nombre: c.nombre,
        whatsapp: c.whatsapp || null,
        correo: c.correo || null,
        orden: c.orden ?? i,
      }))

      const { error: insertError } = await supabase
        .from('therapy_session_cofounders')
        .insert(cofoundersWithSession)

      if (insertError) {
        console.error('[therapy/inputs] Error insertando cofundadores:', insertError)
        return NextResponse.json(
          { error: 'No se pudieron guardar los fundadores' },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
