import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { invitadoSchema } from '@/lib/validations/therapy'

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission('therapy:create')
  if (!auth.ok) return auth.response
  const { user, role } = auth

  const supabase = getSupabaseServer()

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  let query = supabase
    .from('invitados')
    .select('id, nombre, descripcion, red_social, pagina_web, created_at')
    .order('nombre')

  if (role !== 'super_admin') {
    query = query.eq('created_by', user.id)
  }
  if (q) {
    query = query.ilike('nombre', `%${q}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[invitados] GET error:', error)
    return NextResponse.json({ error: 'No se pudo buscar invitados' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission('therapy:create')
  if (!auth.ok) return auth.response
  const { user } = auth

  const supabase = getSupabaseServer()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = invitadoSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('invitados')
    .insert({ ...result.data, created_by: user.id })
    .select('id, nombre, descripcion, red_social, pagina_web, created_at')
    .single()

  if (error) {
    console.error('[invitados] POST error:', error)
    return NextResponse.json({ error: 'No se pudo crear el invitado' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
