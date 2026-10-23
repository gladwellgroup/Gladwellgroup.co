/** La URL de un enlace que escribió una persona, lista para un `href`, o `null` si no se puede usar.
 *
 *  Solo se aceptan enlaces http(s). Un `javascript:` (o `data:`, `vbscript:`…) metido en el campo de una herramienta
 *  llegaba tal cual a `<a href>` en el correo y en la vista previa, y se ejecutaba al hacer clic. Los casos que el
 *  navegador «arregla» al leer el esquema (`JaVaScRiPt:`, `java\tscript:`, espacios delante) los resuelve el propio
 *  analizador de URL de la plataforma: lo que cuenta es el `protocol` que de verdad queda.
 *
 *  Sin esquema (`gladwell.co/herramienta`) se asume https, como hace la barra de direcciones; antes eso producía un enlace
 *  relativo roto. */
export function normalizeHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
