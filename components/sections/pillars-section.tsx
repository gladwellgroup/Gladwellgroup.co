"use client"

import { useState } from "react"
import Image from "next/image"
import { PillarModal } from "@/components/modals/pillar-modal"
import { useWalkingList } from "@/components/providers/walking-list-provider"
import { SectionDivider, SectionHeader } from "@/components/shared"
import { PILLARS, type Pillar } from "@/lib/data/pillars"

export function PillarsSection() {
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null)
  const [isPillarModalOpen, setIsPillarModalOpen] = useState(false)
  const { openWalkingList } = useWalkingList()

  const openPillarModal = (pillar: Pillar) => {
    setSelectedPillar(pillar)
    setIsPillarModalOpen(true)
  }

  const closePillarModal = () => {
    setIsPillarModalOpen(false)
    setTimeout(() => setSelectedPillar(null), 300)
  }

  const handleOpenWalkingList = () => {
    closePillarModal()
    setTimeout(openWalkingList, 350)
  }

  return (
    <section id="pilares" className="py-24 relative scroll-mt-24">
      <SectionDivider />
      <div className="container mx-auto px-6 relative z-10">
        <SectionHeader
          eyebrow="Nuestros Pilares"
          title="Tres caminos, una visión"
          className="mb-20"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="relative">
            <div
              id={pillar.id}
              className="scroll-mt-[var(--scroll-offset)] pointer-events-none relative -top-[var(--scroll-offset)] h-0"
              aria-hidden="true"
            />
            <article
              onClick={() => openPillarModal(pillar)}
              className="group relative glass rounded-2xl overflow-hidden gladwell-border-gradient hover:glass-glow transition-all duration-500 cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPillarModal(pillar)}
              aria-label={`Ver más sobre ${pillar.title}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={pillar.image}
                  alt={pillar.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                <span className="absolute top-4 right-4 text-5xl font-bold gladwell-gradient-text opacity-60">
                  {pillar.number}
                </span>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium">
                    Ver más
                  </span>
                </div>
              </div>

              <div className="p-6 text-center lg:text-left">
                <span className="text-sm gladwell-gradient-text uppercase tracking-wider font-medium">
                  {pillar.subtitle}
                </span>
                <h3 className="text-2xl font-bold text-foreground mt-2 mb-4">
                  {pillar.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            </article>
            </div>
          ))}
        </div>
      </div>

      <PillarModal
        isOpen={isPillarModalOpen}
        onClose={closePillarModal}
        pillar={selectedPillar}
        onOpenWalkingList={handleOpenWalkingList}
      />
    </section>
  )
}
