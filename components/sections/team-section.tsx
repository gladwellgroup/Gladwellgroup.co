import Image from "next/image"
import { SectionDivider, SectionHeader } from "@/components/shared"
import { TeamWalkingListCta } from "@/components/sections/team-walking-list-cta"
import { FOUNDERS, type Founder } from "@/lib/data/founders"

/** Iniciales para el círculo mientras alguien no tiene foto: la primera letra de las dos
 *  primeras palabras del nombre («Mariana Nova Martínez» → «MN»). */
function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()
}

interface TeamSectionProps {
  /** Quién sale en la sección; por defecto, el equipo base. Existe para poder probar con
   *  `renderToString` cada caso (con y sin foto, con y sin rol) sin depender de a quién le
   *  falte la foto hoy. */
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

        {/* Fila que envuelve y centra, con tarjetas de ancho fijo (20 rem): la que queda sola en
            la última fila (la 3.ª con dos por fila) se centra en vez de pegarse a la izquierda,
            como pasaría en una cuadrícula, y sumar a alguien más no pide tocar el diseño. */}
        <div className="flex flex-wrap justify-center gap-12 max-w-4xl xl:max-w-6xl mx-auto">
          {members.map((founder) => (
            <article key={founder.name} className="group text-center w-full md:w-80">
              <div className="relative w-48 h-48 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full gladwell-gradient opacity-20 blur-md group-hover:opacity-40 transition-opacity" />
                <div className="relative w-full h-full rounded-full overflow-hidden p-1 bg-gradient-to-br from-[#7C3AED] to-[#06B6D4]">
                  <div className="w-full h-full rounded-full overflow-hidden">
                    {founder.image ? (
                      /* `sizes`: el círculo mide 192 px (w-48) menos el aro de 4 px por lado. */
                      <Image
                        src={founder.image}
                        alt={founder.name}
                        fill
                        sizes="184px"
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
              <p className="text-muted-foreground max-w-xs mx-auto leading-relaxed">
                {founder.description}
              </p>
            </article>
          ))}
        </div>

        <TeamWalkingListCta />
      </div>
    </section>
  )
}
