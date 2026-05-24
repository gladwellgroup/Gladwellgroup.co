"use client"

import { useWalkingList } from "@/components/providers/walking-list-provider"
import { HERO_INDICATORS } from "@/lib/data/navigation"

export function HeroSection() {
  const { openWalkingList } = useWalkingList()

  return (
    <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden scroll-mt-0">
      {/* Background Image - Desktop */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden md:block"
        style={{ backgroundImage: "url('/images/hero-bg-desktop.jpg')" }}
      />

      {/* Background Image - Mobile */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat md:hidden"
        style={{ backgroundImage: "url('/images/hero-bg-mobile.jpg')" }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/90" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center pt-24 md:pt-20">
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold mb-6 tracking-tight text-balance gladwell-gradient-text">
          GLADWELL
        </h1>

        <div className="inline-block rounded-full px-8 py-3 mb-8 bg-black/40 backdrop-blur-md border border-white/10">
          <p className="text-lg md:text-xl text-white tracking-wide">
            apasionados por la estrategia
          </p>
        </div>

        <p className="text-sm md:text-base text-white/70 uppercase tracking-[0.3em] mb-8">
          Descubre más
        </p>

        <div className="flex justify-center mb-16 md:mb-0">
          <button
            onClick={openWalkingList}
            className="px-10 py-4 rounded-full gladwell-gradient text-white font-semibold text-lg tracking-wide hover:scale-105 hover:shadow-[0_0_40px_rgba(124,58,237,0.4)] transition-all duration-300"
          >
            Unirme a la Walking List
          </button>
        </div>
      </div>

      {/* Navigation indicators (right side) */}
      <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-end gap-3">
        {HERO_INDICATORS.map(({ num, href }, i) => (
          <a
            key={num}
            href={href}
            className={`flex items-center gap-3 transition-all ${
              i === 0 ? "text-white" : "text-white/50 hover:text-white"
            }`}
          >
            <span className={`text-sm ${i === 0 ? "font-bold gladwell-gradient-text" : ""}`}>
              {num}
            </span>
            {i === 0 && <div className="w-8 h-px gladwell-gradient rounded-full" />}
          </a>
        ))}
      </div>
    </section>
  )
}
