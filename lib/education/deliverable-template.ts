import { firstName } from '@/lib/deliverables/names'
import {
  BODY,
  HAIRLINE,
  INK,
  MUTED,
  PURPLE,
  bulletsHtml,
  emailShell,
  escapeHtml,
  imageBlock,
  pillLink,
  quoteBlock,
  section,
} from '@/lib/deliverables/html-blocks'

export interface EducationTool {
  nombre: string
  descripcion?: string | null
  url?: string | null
}

export interface EducationContent {
  sessionTitle: string
  sessionDate?: string
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
  /** Nombre del asistente; se interpola al enviar, uno por destinatario. */
  attendeeNombre?: string | null
}

/** Ponente: foto circular + nombre y rol, centrados como una unidad, antes de
 *  las secciones de contenido. */
function ponenteBlock(content: EducationContent): string {
  const nombre = content.ponenteNombre?.trim()
  if (!nombre) return ''

  const rolLine = content.ponenteRol?.trim()
    ? `<p style="margin:2px 0 0;font-size:12px;color:${MUTED};text-align:center;">${escapeHtml(content.ponenteRol.trim())}</p>`
    : ''

  const foto = content.ponenteFotoUrl
    ? `<img src="${escapeHtml(content.ponenteFotoUrl)}" alt="${escapeHtml(nombre)}" width="64" height="64" style="display:block;width:64px;height:64px;margin:0 auto 12px;border-radius:32px;object-fit:cover;border:1px solid ${HAIRLINE};" />`
    : ''

  return `<tr>
        <td style="padding:0 0 26px;text-align:center;">
          ${foto}
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:1.2px;color:${PURPLE};text-align:center;">PONENTE</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:${INK};text-align:center;">${escapeHtml(nombre)}</p>
          ${rolLine}
        </td>
      </tr>`
}

/** Herramientas: nombre en negrita, descripción debajo y enlace si lo hay. */
function toolsHtml(tools: EducationTool[]): string {
  const valid = tools.filter((tool) => tool.nombre?.trim())
  if (valid.length === 0) {
    return `<p style="margin:0;color:${MUTED};font-style:italic;">Sin contenido</p>`
  }

  const items = valid
    .map((tool) => {
      const nombre = escapeHtml(tool.nombre.trim())
      const titulo = tool.url?.trim()
        ? `<a href="${escapeHtml(tool.url.trim())}" style="color:${PURPLE};font-weight:700;text-decoration:none;">${nombre}</a>`
        : `<span style="color:${INK};font-weight:700;">${nombre}</span>`

      const descripcion = tool.descripcion?.trim()
        ? `<span style="color:${BODY};"> — ${escapeHtml(tool.descripcion.trim())}</span>`
        : ''

      return `<li style="margin:0 0 10px;color:${BODY};"><span style="color:${PURPLE};font-weight:700;">•</span>&nbsp;&nbsp;${titulo}${descripcion}</li>`
    })
    .join('\n')

  return `<ul style="margin:0;padding:0;list-style:none;">${items}</ul>`
}

/** Nombre de pila + una línea que nombra la sesión: el saludo deja de ser un
 *  campo interpolado y pasa a sonar escrito para quien estuvo ahí. */
export function educationIntroText(content: EducationContent): string {
  const ponente = content.ponenteNombre?.trim()
  return ponente
    ? `Gracias por acompañarnos en la sesión con ${ponente}. Esto es lo que nos llevamos.`
    : 'Gracias por acompañarnos en esta sesión. Esto es lo que nos llevamos.'
}

export function buildEducationHtml(content: EducationContent): string {
  const nombre = content.attendeeNombre?.trim()
  const saludo = nombre
    ? `<p style="margin:0 0 6px;font-size:14px;color:${INK};text-align:left;">Hola ${escapeHtml(firstName(nombre))},</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${BODY};text-align:left;">${escapeHtml(educationIntroText(content))}</p>`
    : ''

  const bodyRows = [
    ponenteBlock(content),
    section('Conclusiones clave', bulletsHtml(content.conclusionesClave)),
    section('Herramientas recomendadas', toolsHtml(content.tools)),
    section('Cápsulas de emprendimiento', bulletsHtml(content.capsulas)),
    imageBlock('Foto de la sesión', content.fotoSesionUrl),
    quoteBlock(content.fraseTexto, content.fraseAutor),
    content.pdfUrl
      ? `<tr><td style="padding:8px 0 24px;text-align:center;">${pillLink('Descargar el entregable en PDF', content.pdfUrl)}</td></tr>`
      : '',
  ]
    .filter(Boolean)
    .join('\n          ')

  return emailShell({
    // No repite "GLADWELL": el wordmark ya está justo arriba: dos menciones
    // consecutivas de la marca competían por atención.
    eyebrow: 'ENTREGABLE DE LA SESIÓN',
    title: content.sessionTitle,
    dateLine: content.sessionDate,
    introHtml: saludo,
    bodyRows,
    footer: 'Gladwell Education',
  })
}

/** El saludo cambia por destinatario; el resto del HTML es el mismo. */
export function buildEducationHtmlFor(
  content: EducationContent,
  attendeeNombre: string
): string {
  return buildEducationHtml({ ...content, attendeeNombre })
}
