// Toda la plataforma se opera desde Colombia y las fechas de sesión se
// guardan sin hora (columna `date`, sin zona horaria). Sin esto, el servidor
// corre en la zona que le asigne el hosting (en Vercel, UTC) mientras el
// navegador corre en America/Bogota (UTC-5): un mismo "hoy" puede diferir
// hasta 5 horas entre el render inicial en el servidor y la hidratación en
// el cliente, lo que en el calendario alcanza a mover en qué celda cae "hoy".
// Se fija aquí, no en una variable de entorno de Vercel, para que aplique
// igual en desarrollo, preview y producción sin depender de configurarla
// aparte en cada entorno.
process.env.TZ = 'America/Bogota'

/** @type {import('next').NextConfig} */
const nextConfig = {
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
