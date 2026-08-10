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
        destination: '/super/entregables',
        permanent: true,
      },
      {
        source: '/admin/terapia-organizacional',
        destination: '/admin/entregables',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
