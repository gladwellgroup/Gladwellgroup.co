import { getSupabaseServer } from '@/lib/supabase/server'
import {
  buildDeliverableHtml,
  type DeliverableContent,
} from '@/lib/therapy/deliverable-template'
import { buildDeliverablePdfBuffer } from '@/lib/therapy/deliverable-pdf'
import { formatSessionDate } from '@/lib/therapy/deliverable-access'

const BUCKET = 'therapy-media'

export async function uploadDeliverablePdf(params: {
  sessionId: string
  content: DeliverableContent
}): Promise<string> {
  const supabase = getSupabaseServer()
  const buffer = await buildDeliverablePdfBuffer(params.content)
  const path = `${params.sessionId}/entregable/${Date.now()}.pdf`

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  })

  if (error) {
    console.error('[uploadDeliverablePdf]', error)
    throw new Error('No se pudo subir el PDF')
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export interface DeliverableContentSource {
  sessionId: string
  sessionTitle: string
  sessionDate: string
  problemaRecordatorio: string
  resumenAudio: string
  recomendacionesIncomodas: string
  fotoSesionUrl?: string | null
  audioUrl?: string | null
  invitadoNombre?: string | null
  fraseTexto?: string | null
  fraseAutor?: string | null
  pdfUrl?: string | null
  attendeeNombre?: string | null
}

export function toDeliverableContent(
  params: DeliverableContentSource
): DeliverableContent {
  return {
    sessionId: params.sessionId,
    sessionTitle: params.sessionTitle,
    sessionDate: formatSessionDate(params.sessionDate),
    problemaRecordatorio: params.problemaRecordatorio,
    resumenAudio: params.resumenAudio,
    recomendacionesIncomodas: params.recomendacionesIncomodas,
    fotoSesionUrl: params.fotoSesionUrl,
    audioUrl: params.audioUrl,
    invitadoNombre: params.invitadoNombre,
    fraseTexto: params.fraseTexto,
    fraseAutor: params.fraseAutor,
    pdfUrl: params.pdfUrl,
    attendeeNombre: params.attendeeNombre,
  }
}

export function rebuildHtmlFromFields(params: DeliverableContentSource): string {
  return buildDeliverableHtml(toDeliverableContent(params))
}
