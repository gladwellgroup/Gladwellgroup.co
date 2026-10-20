"use client"

import Image from "next/image"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"
import { SectionDivider, SectionHeader } from "@/components/shared"
import { CONCEPTS } from "@/lib/data/concepts"

export function GallerySection() {
  return (
    <section id="galeria" className="py-24 relative overflow-hidden scroll-mt-24">
      <SectionDivider />

      {/* Brillos de fondo: degradados, no `blur-3xl` (ver `.glow-violet` en globals.css). */}
      <div aria-hidden className="glow-violet pointer-events-none absolute top-1/4 left-0 h-96 w-96 scale-[1.7]" />
      <div aria-hidden className="glow-cyan pointer-events-none absolute bottom-1/4 right-0 h-96 w-96 scale-[1.7]" />

      <div className="container mx-auto px-6 relative z-10">
        <SectionHeader eyebrow="Desde nuestra fundación" title="Conceptos que nos definen" />

        <Carousel
          opts={{ align: "start", loop: true }}
          className="w-full max-w-6xl mx-auto"
        >
          <CarouselContent className="-ml-4">
            {CONCEPTS.map((concept, index) => (
              <CarouselItem key={index} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <div className="relative group">
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden glass gladwell-border-gradient">
                    {/* `sizes` = ancho real de la tarjeta (carrusel de max-w-6xl: 1, 2 o 3 por vista). */}
                    <Image
                      src={concept.src}
                      alt={concept.title}
                      fill
                      sizes="(min-width: 1280px) 373px, (min-width: 1024px) 315px, (min-width: 768px) 352px, (min-width: 640px) 592px, calc(100vw - 48px)"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <div className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-center backdrop-blur-md lg:text-left">
                        <h3 className="mb-1 text-lg font-bold text-white">{concept.title}</h3>
                        <p className="text-sm leading-relaxed text-white/70">{concept.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4 bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 text-white" />
          <CarouselNext className="right-4 bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 text-white" />
        </Carousel>
      </div>
    </section>
  )
}
