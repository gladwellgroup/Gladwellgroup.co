"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { type Pillar } from "@/lib/data/pillars"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { SectionDivider } from "@/components/shared"

interface PillarModalProps {
  isOpen: boolean
  onClose: () => void
  pillar: Pillar | null
  onOpenWalkingList: () => void
}

export function PillarModal({ isOpen, onClose, pillar, onOpenWalkingList }: PillarModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const nextImage = useCallback(() => {
    if (!pillar || isAnimating) return
    setIsAnimating(true)
    setCurrentImageIndex((prev) => (prev + 1) % pillar.gallery.length)
    setTimeout(() => setIsAnimating(false), 300)
  }, [pillar, isAnimating])

  const prevImage = useCallback(() => {
    if (!pillar || isAnimating) return
    setIsAnimating(true)
    setCurrentImageIndex((prev) => (prev - 1 + pillar.gallery.length) % pillar.gallery.length)
    setTimeout(() => setIsAnimating(false), 300)
  }, [pillar, isAnimating])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevImage()
      if (e.key === "ArrowRight") nextImage()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, prevImage, nextImage])

  const handleJoinWalkingList = () => {
    onClose()
    setTimeout(onOpenWalkingList, 350)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setCurrentImageIndex(0)
        }
      }}
    >
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0d0d1a]/95 backdrop-blur-xl border border-white/10 shadow-[0_0_80px_rgba(124,58,237,0.2)] p-0">
        {pillar && (
          <>
            {/* Image Carousel */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl">
              {pillar.gallery.map((img, index) => (
                <div
                  key={img}
                  className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                    index === currentImageIndex ? "opacity-100 scale-100" : "opacity-0 scale-105"
                  }`}
                >
                  <Image
                    src={img}
                    alt={`${pillar.title} - Imagen ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d1a] via-transparent to-transparent" />
                </div>
              ))}

              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 transition-all text-white"
                aria-label="Imagen anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 transition-all text-white"
                aria-label="Siguiente imagen"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                {pillar.gallery.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentImageIndex ? "w-6 gladwell-gradient" : "w-2 bg-white/30 hover:bg-white/50"
                    }`}
                    aria-label={`Ir a imagen ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8">
              <div className="mb-6">
                <span className="text-sm gladwell-gradient-text uppercase tracking-wider font-medium">
                  {pillar.subtitle}
                </span>
                <DialogTitle className="text-3xl md:text-4xl font-bold text-white mt-2">
                  {pillar.title}
                </DialogTitle>
              </div>

              <DialogDescription className="sr-only">
                {pillar.subtitle} — {pillar.description}
              </DialogDescription>

              <p className="text-white/80 text-lg leading-relaxed mb-8">
                {pillar.fullDescription}
              </p>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Lo que incluye:</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pillar.highlights.map((highlight, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full gladwell-gradient mt-2 shrink-0" />
                      <span className="text-white/70">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <SectionDivider position="inline" className="mb-8" />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-white/60 text-sm text-center sm:text-left">
                  Forma parte de nuestra comunidad y accede a experiencias exclusivas.
                </p>
                <button
                  onClick={handleJoinWalkingList}
                  className="px-8 py-3 rounded-full gladwell-gradient text-white font-semibold tracking-wide hover:scale-105 hover:shadow-[0_0_40px_rgba(124,58,237,0.4)] transition-all duration-300 whitespace-nowrap"
                >
                  Unirme a la Walking List
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
