'use client'

import { LogOut } from 'lucide-react'
import { useAppRouter } from '@/hooks/use-app-router'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { BrandButton } from '@/components/brand/brand-button'

/** En móvil/tablet "Salir" ya no vive en el navbar (ese espacio lo ocupa
 *  el menú hamburguesa) — acá es donde queda accesible en esos tamaños;
 *  en escritorio convive con el botón que sigue en el navbar. */
export function SignOutButton() {
  const router = useAppRouter()

  async function handleSignOut() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <BrandButton
      type="button"
      variant="secondary"
      size="sm"
      className="w-auto"
      onClick={handleSignOut}
    >
      <LogOut className="size-4" />
      Cerrar sesión
    </BrandButton>
  )
}
