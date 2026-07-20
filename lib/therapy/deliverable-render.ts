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

export function toDeliverableContent(params: {
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
}): DeliverableContent {
  return {
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
  }
}

export function rebuildHtmlFromFields(params: {
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
}): string {
  return buildDeliverableHtml(toDeliverableContent(params))
}
