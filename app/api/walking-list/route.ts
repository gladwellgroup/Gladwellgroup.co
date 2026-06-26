import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { walkingListSchema } from '@/lib/validations/walking-list'

export async function POST(request: NextRequest) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const result = walkingListSchema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]?.message ?? 'Datos inválidos'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const {
    nombre,
    apellidos,
    correo,
    red_social,
    perfil,
    whatsapp_pais,
    whatsapp_indicativo,
    whatsapp_numero,
    whatsapp_e164,
  } = result.data

  const supabase = getSupabaseServer()
  const { error } = await supabase
    .from('walking_list_leads')
    .insert({
      nombre,
      apellidos,
      correo,
      red_social,
      perfil: perfil || null,
      whatsapp_pais,
      whatsapp_indicativo,
      whatsapp_numero,
      whatsapp_e164,
    })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Este correo ya está en la Walking List' },
        { status: 409 }
      )
    }
    console.error('[walking-list] Supabase error:', error)
    return NextResponse.json(
      { error: 'No pudimos registrar tu solicitud. Intenta de nuevo.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
