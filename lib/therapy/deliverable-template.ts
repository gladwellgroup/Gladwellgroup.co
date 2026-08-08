import { SITE_URL } from '@/lib/site'
import { firstName } from '@/lib/deliverables/names'
import {
  BODY,
  INK,
  bulletsHtml,
  centeredPillLink,
  emailShell,
  escapeHtml,
  imageBlock,
  paragraphsHtml,
  pillLink,
  quoteBlock,
  section,
} from '@/lib/deliverables/html-blocks'

export interface DeliverableContent {
  /** Necesario para armar el enlace a la página de audio con marca. */
  sessionId: string
  sessionTitle: string
  sessionDate?: string
  problemaRecordatorio: string
  resumenAudio: string
  recomendacionesIncomodas: string
  fotoSesionUrl?: string | null
  audioUrl?: string | null
  invitadoNombre?: string | null
  fraseTexto?: string | null
  fraseAutor?: string | null
  pdfUrl?: string | null
  /** Nombre del asistente QR; se interpola al enviar, uno por destinatario.
   *  Cuando está presente reemplaza el saludo de empresa — un asistente QR
   *  no es parte de los cofundadores a quienes se dirige ese saludo. */
  attendeeNombre?: string | null
}

/** El correo no enlaza al archivo crudo de Storage sino a una página con
 *  marca (`/audio/[id]`) que muestra la foto y el nombre de la sesión junto
 *  al reproductor. `audioUrl` sigue siendo la señal de si hay audio. */
export function audioPageUrl(content: DeliverableContent): string | null {
  return content.audioUrl ? `${SITE_URL}/audio/${content.sessionId}` : null
}

/** Dos destinatarios distintos con dos relaciones distintas con la sesión: los
 *  cofundadores abrieron su operación, los asistentes QR vinieron a escuchar.
 *  Devuelve el saludo y la línea de contexto que le corresponde a cada uno. */
export function therapyIntro(
  content: DeliverableContent
): { greeting: string; intro: string } | null {
  const asistente = content.attendeeNombre?.trim()
  const empresa = content.invitadoNombre?.trim()

  if (asistente) {
    return {
      greeting: `Hola ${firstName(asistente)},`,
      intro: empresa
        ? `Gracias por acompañarnos en la sesión con ${empresa}. Esto es lo que se llevó la sala.`
        : 'Gracias por acompañarnos en esta sesión. Esto es lo que se llevó la sala.',
    }
  }

  if (empresa) {
    return {
      greeting: `Estimado equipo de ${empresa},`,
      intro:
        'Gracias por abrirle la puerta de su operación a la comunidad. Esto es lo que escuchamos y lo que creemos que sigue.',
    }
  }

  return null
}

/** HTML semántico para correo y content_html (4 bloques). */
export function buildDeliverableHtml(content: DeliverableContent): string {
  const intro = therapyIntro(content)
  const greetingLine = intro
    ? `<p style="margin:0 0 6px;font-size:14px;color:${INK};text-align:left;">${escapeHtml(intro.greeting)}</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${BODY};text-align:left;">${escapeHtml(intro.intro)}</p>`
    : ''

  const sections = [
    section('Recordar el problema', paragraphsHtml(content.problemaRecordatorio)),
    section(
      'Resumen del audio',
      bulletsHtml(content.resumenAudio) +
        centeredPillLink('Escuchar audio de la sesión', audioPageUrl(content))
    ),
    section(
      'Recomendaciones incómodas',
      paragraphsHtml(content.recomendacionesIncomodas)
    ),
  ].join('\n')

  return emailShell({
    eyebrow: 'RESUMEN DE LA SESIÓN',
    title: content.sessionTitle,
    dateLine: content.sessionDate,
    introHtml: greetingLine,
    bodyRows: [
      sections,
      imageBlock('Foto del grupo', content.fotoSesionUrl, 'Foto de la sesión'),
      quoteBlock(content.fraseTexto, content.fraseAutor),
      content.pdfUrl
        ? `<tr><td style="padding:8px 0 24px;text-align:center;">${pillLink('Descargar el entregable en PDF', content.pdfUrl)}</td></tr>`
        : '',
    ].join('\n          '),
    footer: 'Gladwell — Terapia Organizacional',
  })
}

/** El saludo cambia por destinatario; el resto del HTML es el mismo. */
export function buildDeliverableHtmlFor(
  content: DeliverableContent,
  attendeeNombre: string
): string {
  return buildDeliverableHtml({ ...content, attendeeNombre })
}
