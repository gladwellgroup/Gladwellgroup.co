/** Destino interno seguro para un parámetro `?next=`: solo una ruta del propio sitio.
 *
 *  Armar la redirección con `${origin}${next}` dejaba abierta la puerta: con `next = "@otro.com"` el
 *  resultado es `https://www.gladwellgroup.co@otro.com`, que el navegador lee como el usuario
 *  `www.gladwellgroup.co` en el host `otro.com`; «//otro.com» y «/\otro.com» también los lee como otro
 *  origen. Todo lo que no sea una ruta que empiece por UNA barra cae al destino por defecto. */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  // Ni barras invertidas ni caracteres de control (un tabulador dentro de «//» se descarta al leer la URL).
  if (/[\p{Cc}\\]/u.test(next)) return fallback
  try {
    const url = new URL(next, 'https://sitio.invalid')
    const path = url.pathname + url.search + url.hash
    // «/..//otro.com» se normaliza a «//otro.com»: sola, esa ruta sería de otro origen.
    return path.startsWith('//') ? fallback : path
  } catch {
    return fallback
  }
}
