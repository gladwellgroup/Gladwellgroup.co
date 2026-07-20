import { SITE_URL } from '@/lib/site'

export interface DeliverableContent {
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
}

const PURPLE = '#7C3AED'
const CYAN = '#06B6D4'
const INK = '#18181B'
const MUTED = '#71717A'
const HAIRLINE = '#E4E4E7'
const TINT = '#F8F6FF'
const LOGO_URL = `${SITE_URL}/brand/gladwell-logo-wordmark-tight.png`

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragraphsHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) {
    return `<p style="margin:0;color:${MUTED};font-style:italic;">Sin contenido</p>`
  }
  return trimmed
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 12px;color:#3F3F46;">${escapeHtml(block).replace(/\n/g, '<br />')}</p>`
    )
    .join('\n')
}

function bulletsHtml(text: string): string {
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
        `<li style="margin:0 0 8px;color:#3F3F46;"><span style="color:${PURPLE};font-weight:700;">•</span>&nbsp;&nbsp;${escapeHtml(item)}</li>`
    )
    .join('\n')
  return `<ul style="margin:0;padding:0;list-style:none;">${lis}</ul>`
}

function section(heading: string, bodyHtml: string): string {
  return `
    <tr>
      <td style="padding:0 0 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:16px;vertical-align:middle;">
              <div style="width:6px;height:6px;border-radius:3px;background:${PURPLE};"></div>
            </td>
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:15px;font-weight:700;color:${INK};">${escapeHtml(heading)}</p>
            </td>
          </tr>
        </table>
        <div style="margin-top:8px;font-size:14px;line-height:1.6;">${bodyHtml}</div>
      </td>
    </tr>`
}

/** HTML semántico para correo y content_html (4 bloques). */
export function buildDeliverableHtml(content: DeliverableContent): string {
  const dateLine = content.sessionDate
    ? `<p style="margin:0 0 20px;color:${MUTED};font-size:13px;">${escapeHtml(content.sessionDate)}</p>`
    : ''

  const greetingLine = content.invitadoNombre?.trim()
    ? `<p style="margin:0 0 20px;font-size:14px;color:${INK};">Estimado equipo de ${escapeHtml(content.invitadoNombre.trim())},</p>`
    : ''

  const audioBlock = content.audioUrl
    ? `<a href="${escapeHtml(content.audioUrl)}" style="display:inline-block;margin-top:10px;padding:8px 16px;border-radius:20px;background:${TINT};color:${PURPLE};font-size:13px;font-weight:700;text-decoration:none;">Escuchar audio de la sesión</a>`
    : ''

  const sections = [
    section('Recordar el problema', paragraphsHtml(content.problemaRecordatorio)),
    section(
      'Resumen del audio',
      bulletsHtml(content.resumenAudio) + audioBlock
    ),
    section(
      'Recomendaciones incómodas',
      paragraphsHtml(content.recomendacionesIncomodas)
    ),
  ].join('\n')

  const fotoBlock = content.fotoSesionUrl
    ? `<tr>
        <td style="padding:0 0 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="width:16px;vertical-align:middle;">
                <div style="width:6px;height:6px;border-radius:3px;background:${PURPLE};"></div>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-size:15px;font-weight:700;color:${INK};">Foto del grupo</p>
              </td>
            </tr>
          </table>
          <img src="${escapeHtml(content.fotoSesionUrl)}" alt="Foto de la sesión" style="display:block;width:100%;max-width:552px;margin-top:10px;border-radius:8px;border:1px solid ${HAIRLINE};" />
        </td>
      </tr>`
    : ''

  const fraseBlock = content.fraseTexto?.trim()
    ? `<tr>
        <td style="padding:20px 0 4px;border-top:1px solid ${HAIRLINE};">
          <p style="margin:16px 0 6px;font-size:14px;font-style:italic;color:${INK};text-align:center;">“${escapeHtml(content.fraseTexto.trim())}”</p>
          ${
            content.fraseAutor?.trim()
              ? `<p style="margin:0 0 8px;font-size:12px;color:${MUTED};text-align:center;">— ${escapeHtml(content.fraseAutor.trim())}</p>`
              : ''
          }
        </td>
      </tr>`
    : ''

  return `
<div style="background:#F4F4F5;padding:32px 16px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td style="padding:32px 32px 0;text-align:center;">
        <img src="${LOGO_URL}" alt="Gladwell" width="120" style="display:block;height:auto;margin:0 auto 20px;" />
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:${PURPLE};text-align:center;">RESUMEN DE LA SESIÓN</p>
        <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:${INK};text-align:center;">${escapeHtml(content.sessionTitle)}</h1>
        <div style="text-align:center;">${dateLine}</div>
        ${greetingLine}
        <div style="height:3px;border-radius:2px;margin-bottom:28px;background:linear-gradient(90deg, ${PURPLE} 0%, ${CYAN} 100%);"></div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${sections}
          ${fotoBlock}
          ${fraseBlock}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 28px;border-top:1px solid ${HAIRLINE};">
        <p style="margin:0;font-size:11px;color:${MUTED};">Gladwell — Terapia Organizacional</p>
      </td>
    </tr>
  </table>
</div>
`.trim()
}
