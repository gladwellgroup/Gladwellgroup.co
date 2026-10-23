import { AuthNavbar } from '@/components/layout/auth-navbar'
import { BrandPageBackground } from '@/components/brand/brand-page-background'

/** Una tarjeta centrada sobre el fondo de marca, con la barra de arriba: login, invitación, asistencia y audio, y
 *  las pantallas de error y de «no encontrado» que reemplazan toda la página. */
export function CenteredPage({ children }: { children: React.ReactNode }) {
  return (
    <BrandPageBackground>
      <AuthNavbar />
      {/* La barra es `fixed` y no ocupa espacio: su alto (4rem, 5rem desde md) se reserva
          aquí como padding. Antes `main` empezaba en y=0 con un `min-h` que le restaba el
          alto de la barra, y cualquier tarjeta alta (la del login en un iPhone SE o en un
          portátil de 720 px, la de asistencia con foto) se metía por debajo de ella y
          quedaba ~60 px por encima del centro real. Si no cabe, ahora la página se desplaza. */}
      <main className="flex min-h-screen items-center justify-center px-4 pb-8 pt-20 md:pt-28">
        {children}
      </main>
    </BrandPageBackground>
  )
}
