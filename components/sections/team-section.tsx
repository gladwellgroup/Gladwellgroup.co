import Image from "next/image"
import { SectionDivider, SectionHeader } from "@/components/shared"
import { TeamWalkingListCta } from "@/components/sections/team-walking-list-cta"
import { FOUNDERS } from "@/lib/data/founders"

export function TeamSection() {
  return (
    <section id="equipo" className="py-24 relative bg-background scroll-mt-24">
      <SectionDivider />
      <div className="container mx-auto px-6 relative z-10">
        <SectionHeader
          eyebrow="Nuestro Equipo"
          title="Los arquitectos de Gladwell"
          className="mb-20"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {FOUNDERS.map((founder) => (
            <article key={founder.name} className="group text-center">
              <div className="relative w-48 h-48 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full gladwell-gradient opacity-20 blur-md group-hover:opacity-40 transition-opacity" />
                <div className="relative w-full h-full rounded-full overflow-hidden p-1 bg-gradient-to-br from-[#7C3AED] to-[#06B6D4]">
                  <div className="w-full h-full rounded-full overflow-hidden">
                    <Image
                      src={founder.image}
                      alt={founder.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-1">{founder.name}</h3>
              <span className="text-sm gladwell-gradient-text uppercase tracking-wider font-medium block mb-4">
                {founder.role}
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
