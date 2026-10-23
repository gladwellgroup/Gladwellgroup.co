import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { educationSessionRefSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { loadEducationContentSource } from '@/lib/education/content'
import {
  rebuildEducationHtml,
  toEducationContent,
  uploadEducationPdf,
} from '@/lib/education/deliverable-render'
import { withApiErrors } from '@/lib/api/with-errors'
import { logError } from '@/lib/log'

export const maxDuration = 60
export const runtime = 'nodejs'

export const POST = withApiErrors(async (request: NextRequest) => {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = educationSessionRefSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { session_id } = parsed.data
  const supabase = getSupabaseServer()
  const access = await resolveEducationAccess(supabase, user, session_id)

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  const source = await loadEducationContentSource(supabase, access.session)

  let pdfUrl: string
  try {
    pdfUrl = await uploadEducationPdf({
      sessionId: session_id,
      content: toEducationContent(source),
    })
  } catch (err) {
    logError('[education/pdf] error', err)
    return NextResponse.json(
      { error: 'No se pudo generar el PDF' },
      { status: 500 }
    )
  }

  await supabase
    .from('education_deliverables')
    .update({
      pdf_url: pdfUrl,
      content_html: rebuildEducationHtml({ ...source, pdfUrl }),
    })
    .eq('session_id', session_id)

  return NextResponse.json({ pdf_url: pdfUrl })
})
