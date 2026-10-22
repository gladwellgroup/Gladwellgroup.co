'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { CarouselApi } from '@/components/ui/carousel'

type Api = NonNullable<CarouselApi>

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
const getHidden = () => document.hidden

/** Mueve el carrusel `steps` posiciones hacia delante (1) o hacia atrás (-1). Con bucle, `scrollNext`
 *  siempre avanza; si embla no pudo activarlo y ya está en la última, vuelve a la primera. */
function move(api: Api, steps: number, direction: 1 | -1) {
  if (direction === 1 && !api.canScrollNext()) {
    api.scrollTo(0)
    return
  }
  for (let i = 0; i < steps; i++) {
    if (direction === 1) api.scrollNext()
    else api.scrollPrev()
  }
}

/** La región completa (con los controles), no solo el visor: pasar el ratón por las flechas también pausa. */
const regionOf = (api: Api) => api.rootNode().closest<HTMLElement>('[data-slot="carousel"]') ?? api.rootNode()

interface AutoplayOptions {
  /** Milisegundos entre un avance y el siguiente, contados desde que ARRANCA cada movimiento (el
   *  deslizamiento dura ~1 s): con 5000 las tarjetas cambian cada 5 s, no cada 6. */
  delay: number
  /** Posiciones que avanza cada paso. Se evalúa al moverse porque depende de cuántas tarjetas caben a la vista. */
  step: (api: Api) => number
}

/** Avance automático de un carrusel de embla, sin el plugin `embla-carousel-autoplay` (un paquete de
 *  runtime más). Se detiene mientras:
 *   - la persona lo pausó, o el foco de TECLADO entró en el carrusel (hasta pulsar «Reanudar», como
 *     pide el patrón de carrusel de WAI-ARIA);
 *   - el ratón está encima (solo ratón: en táctil un toque dejaría el «hover» pegado) o se arrastra;
 *   - la sección está fuera de pantalla (así quien llega ve la primera vista, no una cualquiera) o la
 *     pestaña está oculta;
 *   - el sistema pide menos movimiento (`prefers-reduced-motion`): ahí no hay avance automático.
 *  Cada movimiento, también el manual, reinicia la cuenta: la siguiente vista llega `delay` ms después
 *  de que ARRANCÓ ese movimiento (evento `select`). Con `settle`, que embla emite cuando el resorte
 *  termina de asentarse (~0,8 s después de que deja de verse moverse), cada vista duraba ~6,9 s. */
export function useCarouselAutoplay(api: CarouselApi, { delay, step }: AutoplayOptions) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
  const hidden = useSyncExternalStore(subscribeVisibility, getHidden, () => false)
  const [stopped, setStopped] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!api) return
    const region = regionOf(api)
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setHovered(true)
    }
    const leave = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setHovered(false)
    }
    const focusIn = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches(':focus-visible')) setStopped(true)
    }
    const down = () => setDragging(true)
    const up = () => setDragging(false)
    region.addEventListener('pointerenter', enter)
    region.addEventListener('pointerleave', leave)
    region.addEventListener('focusin', focusIn)
    api.on('pointerDown', down).on('pointerUp', up)
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 })
    observer.observe(region)
    return () => {
      region.removeEventListener('pointerenter', enter)
      region.removeEventListener('pointerleave', leave)
      region.removeEventListener('focusin', focusIn)
      api.off('pointerDown', down).off('pointerUp', up)
      observer.disconnect()
    }
  }, [api])

  // Red de seguridad del ratón: WebKit no emite `pointerleave` si el elemento que estaba bajo el puntero
  // desaparece, y al pulsar «Pausar» React cambia su icono por el de «Reanudar». Sin esto `hovered` se quedaba
  // pegado y el avance no volvía tras reanudar (Safari). Mientras el ratón está encima, el primer movimiento
  // fuera de la región lo suelta.
  useEffect(() => {
    if (!api || !hovered) return
    const region = regionOf(api)
    const move = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !region.contains(event.target)) setHovered(false)
    }
    document.addEventListener('pointermove', move)
    return () => document.removeEventListener('pointermove', move)
  }, [api, hovered])

  const running = !!api && !reducedMotion && !stopped && !hovered && !dragging && inView && !hidden

  useEffect(() => {
    if (!api || !running) return
    if (api.scrollSnapList().length < 2) return // nada que mover
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => move(api, step(api), 1), delay)
    }
    arm()
    api.on('select', arm)
    return () => {
      window.clearTimeout(timer)
      api.off('select', arm)
    }
  }, [api, running, delay, step])

  /** Un paso manual (flechas), del mismo tamaño que el automático. */
  const advance = useCallback(
    (direction: 1 | -1) => {
      if (api) move(api, step(api), direction)
    },
    [api, step]
  )
  const toggle = useCallback(() => setStopped((value) => !value), [])

  return { available: !reducedMotion, playing: !stopped, toggle, advance }
}
