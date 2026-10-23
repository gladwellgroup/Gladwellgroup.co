"use client"

import { useEffect, useRef, useState } from "react"
import { Play } from "lucide-react"
import { youtubeEmbed, youtubePoster, type YoutubePoster } from "@/lib/youtube"

interface VideoFacadeProps {
  videoId: string
  /** Título del iframe, para los lectores de pantalla. */
  title: string
  /** Lo que anuncia el botón de reproducir. */
  playLabel: string
  /** La miniatura de YouTube que EXISTE para este video (ver `YoutubePoster`). */
  poster: YoutubePoster
}

/** Un video de YouTube que no carga nada de YouTube hasta que alguien lo reproduce: solo la miniatura, una imagen que
 *  además espera a estar cerca de la pantalla. El reproductor (un iframe con ~1 MB de JavaScript de terceros) se monta
 *  con el clic. */
export function VideoFacade({ videoId, title, playLabel, poster }: VideoFacadeProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)

  // El botón desaparece al reproducir: sin esto, el foco del teclado se perdía en <body>.
  useEffect(() => {
    if (isPlaying) frame.current?.focus()
  }, [isPlaying])

  return (
    <div className="relative max-w-5xl mx-auto aspect-video rounded-2xl overflow-hidden group glass-gradient gladwell-border-gradient">
      {!isPlaying ? (
        <>
          {/* Decorativa (el botón ya dice qué video es). Una <img> y no un `background-image`: el fondo CSS se pide siempre,
              aunque la sección esté lejos del pliegue; `loading="lazy"` la pide al acercarse. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={youtubePoster(videoId, poster)}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:from-black/70 transition-colors" />

          <button
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 flex items-center justify-center"
            aria-label={playLabel}
          >
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full glass-strong flex items-center justify-center group-hover:scale-110 transition-transform gladwell-border-gradient">
              <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" aria-hidden="true" />
            </div>
          </button>
        </>
      ) : (
        <iframe
          ref={frame}
          className="absolute inset-0 w-full h-full"
          src={youtubeEmbed(videoId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      )}
    </div>
  )
}
