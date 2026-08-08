'use client'

import { useRouter } from 'next/navigation'
import { useTopLoader } from 'nextjs-toploader'

/** Envuelve useRouter() para que `.push()` dispare la barra de progreso antes
 *  de navegar. Los <Link> ya la disparan solos (nextjs-toploader detecta el
 *  click en el <a>); esto cubre router.push() imperativo — filas de tabla,
 *  botones, handlers tras un fetch — que no nace de ningún <a>. */
export function useAppRouter() {
  const router = useRouter()
  const { start } = useTopLoader()

  return {
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => {
      start()
      router.push(href, options)
    },
  }
}
