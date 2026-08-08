import { getSupabaseServer } from '@/lib/supabase/server'
import { formatSessionDate } from '@/lib/therapy/deliverable-access'
import { buildEducationPdfBuffer } from '@/lib/education/deliverable-pdf'
import {
  buildEducationHtml,
  type EducationContent,
  type EducationTool,
} from '@/lib/education/deliverable-template'

const BUCKET = 'education-media'

export interface EducationContentSource {
  sessionTitle: string
  sessionDate: string
  ponenteNombre?: string | null
  ponenteRol?: string | null
  ponenteFotoUrl?: string | null
  conclusionesClave: string
  capsulas: string
  tools: EducationTool[]
  fotoSesionUrl?: string | null
  fraseTexto?: string | null
  fraseAutor?: string | null
  pdfUrl?: string | null
  attendeeNombre?: string | null
}

export function toEducationContent(
  source: EducationContentSource
): EducationContent {
  return {
    ...source,
    sessionDate: formatSessionDate(source.sessionDate),
  }
}

export function rebuildEducationHtml(source: EducationContentSource): string {
  return buildEducationHtml(toEducationContent(source))
}

export async function uploadEducationPdf(params: {
  sessionId: string
  content: EducationContent
}): Promise<string> {
  const supabase = getSupabaseServer()
  const buffer = await buildEducationPdfBuffer(params.content)
  const path = `${params.sessionId}/entregable/${Date.now()}.pdf`

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  })

  if (error) {
    console.error('[uploadEducationPdf]', error)
    throw new Error('No se pudo subir el PDF')
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
