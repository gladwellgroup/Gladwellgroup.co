import { AuthNavbar } from '@/components/layout/auth-navbar'
import { BrandPageBackground } from '@/components/brand/brand-page-background'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <BrandPageBackground>
      <AuthNavbar />
      <main className="flex min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-8">
        {children}
      </main>
    </BrandPageBackground>
  )
}
