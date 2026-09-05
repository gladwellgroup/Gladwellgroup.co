import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import NextTopLoader from 'nextjs-toploader'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { ServiceWorkerRegistration } from '@/components/providers/service-worker-registration'
import { SITE_URL, SITE_NAME, SITE_LOCALE, SITE_DESCRIPTION } from '@/lib/site'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '600'],
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
      className={`${geist.variable} ${geistMono.variable} ${playfair.variable}`}
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
