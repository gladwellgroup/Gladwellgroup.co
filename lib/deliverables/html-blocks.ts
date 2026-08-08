import { SITE_URL } from '@/lib/site'

/** Primitivas de maquetado compartidas por las plantillas de correo de los dos
 *  programas de entregables. HTML tabular con estilos inline: es lo único que
 *  renderiza igual en Gmail, Outlook y Apple Mail. */

export const PURPLE = '#7C3AED'
export const CYAN = '#06B6D4'
export const INK = '#18181B'
export const MUTED = '#71717A'
export const HAIRLINE = '#E4E4E7'
export const TINT = '#F8F6FF'
export const BODY = '#3F3F46'
export const LOGO_URL = `${SITE_URL}/brand/gladwell-logo-wordmark-tight.png`

export const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function paragraphsHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) {
    return `<p style="margin:0;color:${MUTED};font-style:italic;">Sin contenido</p>`
  }
  return trimmed
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 12px;color:${BODY};">${escapeHtml(block).replace(/\n/g, '<br />')}</p>`
    )
    .join('\n')
}

/** Cada línea del texto es una viñeta. Tolera que vengan con `-`, `•` o
 *  numeración delante, que es como las devuelve a veces el modelo. */
export function bulletsHtml(text: string): string {
  const items = text
    .trim()
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean)

  if (items.length === 0) {
    return `<p style="margin:0;color:${MUTED};font-style:italic;">Sin contenido</p>`
  }

  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;color:${BODY};"><span style="color:${PURPLE};font-weight:700;">•</span>&nbsp;&nbsp;${escapeHtml(item)}</li>`
    )
    .join('\n')

  return `<ul style="margin:0;padding:0;list-style:none;">${lis}</ul>`
}

export function sectionHeading(heading: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:16px;vertical-align:middle;">
              <div style="width:6px;height:6px;border-radius:3px;background:${PURPLE};"></div>
            </td>
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:15px;font-weight:700;color:${INK};">${escapeHtml(heading)}</p>
            </td>
          </tr>
        </table>`
}

export function section(heading: string, bodyHtml: string): string {
  return `
    <tr>
      <td style="padding:0 0 28px;">
        ${sectionHeading(heading)}
        <div style="margin-top:8px;font-size:14px;line-height:1.6;">${bodyHtml}</div>
      </td>
    </tr>`
}

export function quoteBlock(
  texto?: string | null,
  autor?: string | null
): string {
  if (!texto?.trim()) return ''

  const autorLine = autor?.trim()
    ? `<p style="margin:0 0 8px;font-size:12px;color:${MUTED};text-align:center;">— ${escapeHtml(autor.trim())}</p>`
    : ''

  return `<tr>
        <td style="padding:20px 0 4px;border-top:1px solid ${HAIRLINE};">
          <p style="margin:16px 0 6px;font-size:14px;font-style:italic;color:${INK};text-align:center;">“${escapeHtml(texto.trim())}”</p>
          ${autorLine}
        </td>
      </tr>`
}

export function imageBlock(
  heading: string,
  url?: string | null,
  alt = heading
): string {
  if (!url) return ''

  return `<tr>
        <td style="padding:0 0 8px;">
          ${sectionHeading(heading)}
          <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:552px;margin-top:10px;border-radius:8px;border:1px solid ${HAIRLINE};" />
        </td>
      </tr>`
}

export function pillLink(label: string, href?: string | null): string {
  if (!href) return ''
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:10px;padding:8px 16px;border-radius:20px;background:${TINT};color:${PURPLE};font-size:13px;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a>`
}

/** Píldora centrada como bloque propio: una llamada a la acción gana fuerza
 *  separada del texto en vez de pegada al margen izquierdo. Devuelve cadena
 *  vacía sin href, para no dejar un contenedor suelto. */
export function centeredPillLink(label: string, href?: string | null): string {
  if (!href) return ''
  return `<div style="text-align:center;">${pillLink(label, href)}</div>`
}

/** Envoltura común: fondo, tarjeta blanca, logo, eyebrow, título, fecha y pie. */
export function emailShell(params: {
  eyebrow: string
  title: string
  dateLine?: string | null
  introHtml?: string
  bodyRows: string
  footer: string
}): string {
  const dateLine = params.dateLine
    ? `<p style="margin:0 0 20px;color:${MUTED};font-size:13px;">${escapeHtml(params.dateLine)}</p>`
    : ''

  return `
<div style="background:#F4F4F5;padding:32px 16px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;font-family:${FONT_STACK};">
    <tr>
      <td style="padding:32px 32px 0;text-align:center;">
        <img src="${LOGO_URL}" alt="Gladwell" width="120" style="display:block;height:auto;margin:0 auto 30px;" />
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:${PURPLE};text-align:center;">${escapeHtml(params.eyebrow)}</p>
        <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:${INK};text-align:center;">${escapeHtml(params.title)}</h1>
        <div style="text-align:center;">${dateLine}</div>
        ${params.introHtml ?? ''}
        <div style="height:3px;border-radius:2px;margin-bottom:28px;background:linear-gradient(90deg, ${PURPLE} 0%, ${CYAN} 100%);"></div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${params.bodyRows}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 28px;border-top:1px solid ${HAIRLINE};">
        <p style="margin:0;font-size:11px;color:${MUTED};text-align:center;">${escapeHtml(params.footer)}</p>
      </td>
    </tr>
  </table>
</div>
`.trim()
}
