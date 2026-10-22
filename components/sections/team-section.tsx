import Image from "next/image"
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import { SectionDivider, SectionHeader } from "@/components/shared"
import { TeamCarouselControls } from "@/components/sections/team-carousel-controls"
import { TeamWalkingListCta } from "@/components/sections/team-walking-list-cta"
import { FOUNDERS, type Founder } from "@/lib/data/founders"

/** Iniciales para el círculo mientras alguien no tiene foto: la primera letra de las dos
 *  primeras palabras del nombre («Mariana Nova Martínez» → «MN»). */
function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()
}

interface TeamSectionProps {
  /** Quién sale en la sección; por defecto, el equipo base. Existe para poder probar con
   *  `renderToString` cada caso (con y sin foto, con y sin rol, con y sin descripción) sin
   *  depender de a quién le falte algo hoy. */
  members?: Founder[]
}

export function TeamSection({ members = FOUNDERS }: TeamSectionProps) {
  return (
    <section id="equipo" className="py-24 relative bg-background scroll-mt-24">
      <SectionDivider />
      <div className="container mx-auto px-6 relative z-10">
        <SectionHeader
          eyebrow="Equipo base"
          title="Los arquitectos de Gladwell"
          className="mb-20"
        />

        {/* Carrusel que avanza solo (ver team-carousel-controls.tsx): tres a la vez desde 1024 px, dos
            en un iPad vertical (`tablet:`, ver globals.css) y una en un celular, también girado.
            `max-w-[66rem]` = tres tarjetas de 20 rem y dos huecos de 3 rem, el ancho de siempre en
            escritorio. `pt-4`: que el visor del carrusel no recorte el brillo de arriba de cada círculo. */}
        <Carousel
          aria-label="Equipo base"
          opts={{ align: "start", loop: true }}
          className="mx-auto max-w-[66rem]"
        >
          <CarouselContent className="-ml-8 pt-4 xl:-ml-12">
            {members.map((founder, index) => (
              <CarouselItem
                key={founder.name}
                aria-label={`${index + 1} de ${members.length}`}
                className="pl-8 tablet:basis-1/2 lg:basis-1/3 xl:pl-12"
              >
                <article className="group text-center">
                  <div className="relative w-48 h-48 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full gladwell-gradient opacity-20 blur-md group-hover:opacity-40 transition-opacity" />
                    <div className="relative w-full h-full rounded-full overflow-hidden p-1 bg-gradient-to-br from-[#7C3AED] to-[#06B6D4]">
                      <div className="w-full h-full rounded-full overflow-hidden">
                        {founder.image ? (
                          /* `sizes`: el círculo mide 192 px (w-48) menos el aro de 4 px por lado.
                             `loading="eager"` + prioridad baja: en un celular (una tarjeta por vista) las
                             fotos de las tarjetas que aún no aparecen se pedían recién al entrar, y con
                             red lenta saltaban a mitad del deslizamiento. Son miniaturas de 9–18 KB. */
                          <Image
                            src={founder.image}
                            alt={founder.name}
                            fill
                            sizes="184px"
                            loading="eager"
                            fetchPriority="low"
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          /* Espacio reservado de la foto. Decorativo: el nombre ya va en el h3 de abajo. */
                          <div
                            aria-hidden="true"
                            className="flex h-full w-full items-center justify-center bg-muted"
                          >
                            <span className="gladwell-gradient-text text-5xl font-bold tracking-wider">
                              {initialsOf(founder.name)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-1">{founder.name}</h3>
                  <span className="text-sm gladwell-gradient-text uppercase tracking-wider font-medium block mb-4">
                    {/* Cada mitad no se parte: si el cargo no cabe, baja entero a la 2.ª línea. */}
                    {founder.role && (
                      <>
                        <span className="whitespace-nowrap">{founder.role} ·</span>{" "}
                      </>
                    )}
                    <span className="whitespace-nowrap">{founder.title}</span>
                  </span>
                  {founder.description && (
                    <p className="text-muted-foreground max-w-xs mx-auto leading-relaxed">
                      {founder.description}
                    </p>
                  )}
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <TeamCarouselControls count={members.length} />
        </Carousel>

        <TeamWalkingListCta />
      </div>
    </section>
  )
}
