// Zona horaria: aquí NO se fija. Una línea `process.env.TZ = 'America/Bogota'` solo se ejecuta al compilar y
// en `next dev` / `next start`: las funciones de Vercel no vuelven a cargar este archivo, corren en UTC y `TZ`
// es una variable reservada de su entorno. El «hoy» de la plataforma (Bogotá, UTC-5) lo calcula
// `todayKey()` en lib/date.ts con una zona explícita, igual en el servidor y en el navegador.

// Cabeceras de seguridad de TODAS las respuestas. Sin CSP completa a propósito: con Next (scripts en línea), el video de
// YouTube y Vercel Analytics, una política de contenido pide una pasada propia con pruebas en el navegador.
//  - X-Frame-Options: el portal no se puede enmarcar en otro sitio (clickjacking). El sitio mismo no usa iframes propios.
//  - nosniff: el navegador no «adivina» el tipo de un archivo subido.
//  - Referrer-Policy: a otros sitios solo viaja el origen, nunca la ruta (los enlaces de asistencia llevan un token).
//  - Permissions-Policy: el micrófono solo para este sitio (la grabadora de audio); geolocalización, pagos y USB, nunca.
//    La cámara no se lista: la subida de fotos puede abrirla desde el selector de archivos.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'microphone=(self), geolocation=(), payment=(), usb=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sin `X-Powered-By: Next.js`: no hay razón para anunciar el framework.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
  // Las fotos de la landing no cambian entre despliegues. En Vercel cada MISS o STALE de /_next/image
  // se factura como una transformación (plan Hobby: 5 000 al mes) y con el TTL por defecto (4 h) cada
  // variante se rehace hasta 6 veces al día. 31 días es lo que recomienda Vercel; la clave de las
  // imágenes locales es el hash del contenido, así que cambiar la foto y redesplegar la invalida.
  images: {
    minimumCacheTTL: 2678400,
  },
  async redirects() {
    return [
      {
        source: '/super/terapia-organizacional',
        destination: '/super/encuentros',
        permanent: true,
      },
      {
        source: '/admin/terapia-organizacional',
        destination: '/admin/encuentros',
        permanent: true,
      },
      // La sección «Entregables» pasó a llamarse «Encuentros» (suma las charlas,
      // que no tienen entregable). Los enlaces guardados con la ruta vieja
      // —favoritos, el `?estado=` del dashboard— siguen llegando a su destino.
      // `:path*` también cubre la raíz de la sección.
      {
        source: '/super/entregables/:path*',
        destination: '/super/encuentros/:path*',
        permanent: true,
      },
      {
        source: '/admin/entregables/:path*',
        destination: '/admin/encuentros/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
