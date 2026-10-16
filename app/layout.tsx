import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import NextTopLoader from 'nextjs-toploader'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { ServiceWorkerRegistration } from '@/components/providers/service-worker-registration'
import { SITE_URL, SITE_NAME, SITE_LOCALE, SITE_DESCRIPTION } from '@/lib/site'
import './globals.css'

// Fuentes servidas desde el repo (app/fonts, licencia OFL junto a cada archivo)
// en vez de pedirlas a Google: el build ya no depende de que Google Fonts
// responda (falló una vez por eso) y la página no hace pedidos a terceros.
// Aquí va SOLO lo que usa toda la app: Geist, variable (100–900), subconjunto
// latino. Playfair Display se declara en la landing (video-section.tsx), la
// única que la usa, para que el portal no la precargue; y Geist Mono se retiró:
// solo la usaba el cronómetro de audio, que ahora usa la mono del sistema.
const geist = localFont({
  src: './fonts/Geist-latin.woff2',
  variable: '--font-geist',
  weight: '100 900',
  display: 'swap',
})

// viewport-fit: 'cover' es lo que activa de verdad el env(safe-area-inset-*)
// que portal-bottom-nav.tsx y portal-navbar.tsx ya usan — sin esto, esas
// variables resuelven siempre a 0 y el contenido queda tapado por el
// notch/home indicator en iOS al abrir el portal como app instalada.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a14',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} | Apasionados por la Estrategia`,
  description: SITE_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },
  other: {
    'geo.region': 'CO-DC',
    'geo.placename': 'Bogotá',
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: `${SITE_NAME} | Apasionados por la Estrategia`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: '/og/gladwell-og.png',
        width: 1200,
        height: 630,
        alt: 'Gladwell — Apasionados por la Estrategia',
      },
    ],
    locale: SITE_LOCALE,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Apasionados por la Estrategia`,
    description: SITE_DESCRIPTION,
    images: ['/og/gladwell-og.png'],
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)', sizes: '32x32', type: 'image/png' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={geist.variable}
    >
      <body className="font-sans antialiased bg-background">
        <NextTopLoader
          color="linear-gradient(90deg, #7C3AED, #06B6D4)"
          height={3}
          showSpinner={false}
          shadow={false}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
          {process.env.NODE_ENV === 'production' && <ServiceWorkerRegistration />}
        </ThemeProvider>
      </body>
    </html>
  )
}
