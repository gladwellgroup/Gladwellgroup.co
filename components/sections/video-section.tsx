"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { SectionDivider, SectionHeader } from "@/components/shared"

const VIDEO_ID = "eckoiS-sRNQ"

export function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <section id="comunidad" className="relative py-24 scroll-mt-24">
      <SectionDivider />

      <div className="container mx-auto px-6">
        <SectionHeader eyebrow="Nuestra Comunidad" title="Conoce Gladwell" />

        <div className="relative max-w-5xl mx-auto aspect-video rounded-2xl overflow-hidden group glass-gradient gladwell-border-gradient">
          {!isPlaying ? (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://img.youtube.com/vi/${VIDEO_ID}/maxresdefault.jpg')`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:from-black/70 transition-colors" />

              <button
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 flex items-center justify-center"
                aria-label="Reproducir video de la comunidad Gladwell"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full glass-strong flex items-center justify-center group-hover:scale-110 transition-transform gladwell-border-gradient">
                  <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" aria-hidden="true" />
                </div>
              </button>
            </>
          ) : (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
              title="Video de la comunidad Gladwell"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        <div className="text-center max-w-2xl mx-auto mt-8">
          <div className="glass-subtle rounded-xl px-8 py-6">
            <p className="text-muted-foreground text-lg leading-relaxed">
              Una comunidad de líderes y estrategas que transforman organizaciones a través del
              pensamiento estratégico y la acción decidida.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
