import * as React from "react"

// 1024px (no 768px) a propósito: en este portal "móvil" agrupa celulares
// Y tablets (los integrantes de la comunidad usan mucho tablet), dejando
// el riel de sidebar fijo solo para pantallas de laptop/monitor en adelante.
const MOBILE_BREAKPOINT = 1024

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT

// El servidor no conoce la pantalla: escritorio. El navegador corrige tras hidratar.
const getServerSnapshot = () => false

/** `useSyncExternalStore` y no un `useState` + `useEffect`: el ancho de la ventana es un valor externo, y así no hay un
 *  render extra en cascada al montar. */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
