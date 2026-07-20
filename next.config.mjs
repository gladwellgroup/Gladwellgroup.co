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
