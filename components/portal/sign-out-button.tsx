'use client'

import { LogOut } from 'lucide-react'
import { useSignOut } from '@/hooks/use-sign-out'
import { BrandButton } from '@/components/brand/brand-button'

/** En móvil/tablet "Salir" ya no vive en el navbar (ese espacio lo ocupa
 *  el menú hamburguesa) — acá es donde queda accesible en esos tamaños;
 *  en escritorio convive con el botón que sigue en el navbar. */
export function SignOutButton() {
  const { signOut, signingOut } = useSignOut()

  return (
    <BrandButton
      type="button"
      variant="secondary"
      size="sm"
      className="w-auto"
      onClick={signOut}
      disabled={signingOut}
    >
      <LogOut className="size-4" />
      Cerrar sesión
    </BrandButton>
  )
}
