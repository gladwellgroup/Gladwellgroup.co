import type { Metadata } from 'next'
import { CenteredPage } from '@/components/layout/centered-page'

/** Login, invitación, asistencia y audio: páginas con enlace secreto o de acceso; no deben aparecer en buscadores. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <CenteredPage>{children}</CenteredPage>
}
