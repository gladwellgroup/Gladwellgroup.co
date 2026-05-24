"use client"

import { useWalkingList } from "@/components/providers/walking-list-provider"

export function TeamWalkingListCta() {
  const { openWalkingList } = useWalkingList()

  return (
    <div className="mt-16 flex flex-col items-center gap-4 text-center">
      <p className="max-w-md text-sm text-muted-foreground md:text-base">
        ¿Listo para formar parte de la comunidad?
      </p>
      <button
        type="button"
        onClick={openWalkingList}
        className="min-h-11 px-10 py-4 rounded-full gladwell-gradient text-white font-semibold text-lg tracking-wide hover:scale-105 hover:shadow-[0_0_40px_rgba(124,58,237,0.4)] transition-all duration-300"
      >
        Unirme a la Walking List
      </button>
    </div>
  )
}
