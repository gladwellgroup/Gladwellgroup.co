'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/** `false` en el servidor y durante la hidratación; `true` ya en el navegador.
 *
 *  Para texto que solo el navegador sabe escribir bien: una hora local o un formato
 *  regional. El servidor (Node) y Safari NO escriben igual «2:42 p. m.» —uno con espacio
 *  antes de «p. m.», el otro con «p.m.»—, y esa diferencia basta para que React descarte
 *  el HTML del servidor con el error de hidratación #418 (y lo pinte de nuevo entero en
 *  el cliente). Con este hook el servidor deja el hueco vacío y el navegador lo llena
 *  con SU formato y SU zona horaria, que además es lo correcto para quien lo lee.
 *
 *  `useSyncExternalStore` y no un `useState` + `useEffect`: es la vía que React da para
 *  tener un valor distinto en el servidor y en el cliente sin avisar de un desajuste, y
 *  no dispara un render en cascada desde un efecto. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
