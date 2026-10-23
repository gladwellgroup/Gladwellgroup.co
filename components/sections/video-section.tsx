import { SectionCaption, SectionDivider, SectionHeader } from "@/components/shared"
import { VideoFacade } from "@/components/shared/video-facade"

const VIDEO_ID = "eckoiS-sRNQ"

export function VideoSection() {
  return (
    <section id="comunidad" className="relative py-24 scroll-mt-24">
      <SectionDivider />

      <div className="container mx-auto px-6">
        <SectionHeader eyebrow="Nuestra Comunidad" title="Inspirados en Malcolm Gladwell" />

        <VideoFacade
          videoId={VIDEO_ID}
          title="Video de la comunidad Gladwell"
          playLabel="Reproducir video de la comunidad Gladwell"
          poster="maxresdefault"
        />

        <SectionCaption>
          Se necesitan aproximadamente 10,000 horas de práctica deliberada de una actividad para
          alcanzar el nivel global.
        </SectionCaption>
      </div>
    </section>
  )
}
