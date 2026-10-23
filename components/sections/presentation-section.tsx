import { SectionCaption, SectionDivider, SectionHeader } from "@/components/shared"
import { VideoFacade } from "@/components/shared/video-facade"

// «Gladwell | Pitch Deck». Su miniatura HD (`maxresdefault`) no existe —responde 404—: se usa `sddefault`.
const VIDEO_ID = "bkl3q80ErNQ"

/** Componente de servidor: el único trozo con estado en el navegador es la fachada del video. */
export function PresentationSection() {
  return (
    <section id="presentacion" className="relative py-24 scroll-mt-24">
      <SectionDivider />

      <div className="container mx-auto px-6">
        <SectionHeader eyebrow="Presentación" title="¿Para quién es Gladwell?" />

        <VideoFacade
          videoId={VIDEO_ID}
          title="Video de presentación de Gladwell: ¿Para quién es Gladwell?"
          playLabel="Reproducir el video de presentación de Gladwell"
          poster="sddefault"
        />

        <SectionCaption>
          Unimos emprendedores, academia y universitarios con el objetivo de cerrar las brechas en
          Latinoamérica.
        </SectionCaption>
      </div>
    </section>
  )
}
