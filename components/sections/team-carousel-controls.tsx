"use client"

import { useCallback, useSyncExternalStore } from "react"
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react"
import { useCarousel, type CarouselApi } from "@/components/ui/carousel"
import { useCarouselAutoplay } from "@/hooks/use-carousel-autoplay"
import { cn } from "@/lib/utils"

/** Cuánto se queda cada vista antes de avanzar sola. */
const AUTOPLAY_MS = 5000

/** Posiciones que avanza cada paso: todas las tarjetas visibles menos una, para que siempre quede una a la
 *  vista como referencia. Hoy se ven tres desde 1024 px (y avanza dos), dos en un iPad vertical y una en un
 *  celular (y avanza una). Las visibles se miden del propio diseño (ancho del visor ÷ ancho de una tarjeta) y
 *  no de un ancho de pantalla copiado aquí: los `basis-*` de team-section.tsx cortan en `rem`, y con otra
 *  letra base en el navegador caen en otro ancho; con el corte copiado, el paso se saltaba tarjetas. */
function stepOf(api: NonNullable<CarouselApi>) {
  const slide = api.slideNodes()[0]
  const visible = slide ? Math.round(api.rootNode().clientWidth / slide.offsetWidth) : 1
  return Math.max(1, visible - 1)
}

/** Qué posición está primera y cuántas hay. Mientras embla no arranca (HTML del servidor y primer
 *  render) se usa `fallbackCount`, así los puntos no aparecen de golpe al hidratar. */
function useSnaps(api: CarouselApi, fallbackCount: number) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!api) return () => {}
      api.on("select", onChange).on("reInit", onChange)
      return () => {
        api.off("select", onChange).off("reInit", onChange)
      }
    },
    [api]
  )
  // Un texto y no un objeto: React compara el snapshot por valor y no redibuja si no cambió.
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (api ? `${api.selectedScrollSnap()}/${api.scrollSnapList().length}` : `0/${fallbackCount}`),
    () => `0/${fallbackCount}`
  )
  const [selected, count] = snapshot.split("/").map(Number)
  return { selected, count }
}

const ROUND_BUTTON =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/60 disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-11"

interface TeamCarouselControlsProps {
  /** Cuántas tarjetas hay: los puntos salen ya en el HTML del servidor, sin esperar a embla. */
  count: number
}

/** Bajo el carrusel de «Equipo base»: el selector (flechas y un punto por tarjeta; el activo marca la que va
 *  primera) y, en una fila propia debajo, centrada en todos los anchos, la pausa/reanudar del avance
 *  automático. Vive dentro de `<Carousel>`: lee su API del contexto. */
export function TeamCarouselControls({ count: slides }: TeamCarouselControlsProps) {
  const { api, canScrollPrev, canScrollNext } = useCarousel()
  const { available, playing, toggle, advance } = useCarouselAutoplay(api, { delay: AUTOPLAY_MS, step: stepOf })
  const { selected, count } = useSnaps(api, slides)

  return (
    <div data-slot="team-carousel-controls" className="mt-8 flex flex-col items-center gap-3">
      <div className="flex min-h-11 items-center justify-center gap-2">
        <button
          type="button"
          aria-label="Ver anterior"
          onClick={() => advance(-1)}
          disabled={!!api && !canScrollPrev}
          className={ROUND_BUTTON}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>

        <div className="flex items-center">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Ir a la vista ${index + 1} de ${count}`}
              aria-current={index === selected ? "true" : undefined}
              onClick={() => api?.scrollTo(index)}
              className="group flex h-8 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/60 pointer-coarse:h-11"
            >
              <span
                className={cn(
                  "block h-2 rounded-full transition-[width,background-color] duration-300",
                  index === selected
                    ? "w-5 gladwell-gradient"
                    : "w-2 bg-muted-foreground/40 group-hover:bg-muted-foreground/70"
                )}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="Ver siguiente"
          onClick={() => advance(1)}
          disabled={!!api && !canScrollNext}
          className={ROUND_BUTTON}
        >
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      {available && (
        /* `motion-reduce:hidden`: con menos movimiento no hay botón (`available` es falso), pero el servidor no
           conoce esa preferencia y lo envía; ocultarlo por CSS evita que la sección encoja cuando React lo
           quita al hidratar. */
        <button
          type="button"
          aria-label={playing ? "Pausar el avance automático" : "Reanudar el avance automático"}
          onClick={toggle}
          className={cn(ROUND_BUTTON, "motion-reduce:hidden")}
        >
          {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  )
}
