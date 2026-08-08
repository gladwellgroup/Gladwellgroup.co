import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { educationInputsSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'

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

  if (access.session.status !== 'borrador') {
    return NextResponse.json(
      {
        error:
          'La sesión ya no está en borrador; los datos de captura no se pueden modificar.',
      },
      { status: 403 }
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
    console.error('[education/inputs] Supabase error:', inputError)
    return NextResponse.json(
      { error: 'No se pudieron guardar los datos de la sesión' },
      { status: 500 }
    )
  }

  // Reemplazo completo: la lista que llega del formulario es la verdad.
  if (tools !== undefined) {
    const { error: deleteError } = await supabase
      .from('education_tools')
      .delete()
      .eq('session_id', result.data.session_id)

    if (deleteError) {
      console.error('[education/inputs] Error limpiando herramientas:', deleteError)
    }

    if (tools.length > 0) {
      const rows = tools.map((tool, i) => ({
        session_id: result.data.session_id,
        nombre: tool.nombre,
        descripcion: tool.descripcion || null,
        url: tool.url || null,
        orden: tool.orden ?? i,
      }))

      const { error: insertError } = await supabase
        .from('education_tools')
        .insert(rows)

      if (insertError) {
        console.error('[education/inputs] Error insertando herramientas:', insertError)
        return NextResponse.json(
          { error: 'No se pudieron guardar las herramientas' },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
