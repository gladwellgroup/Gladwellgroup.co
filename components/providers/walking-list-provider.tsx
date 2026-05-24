"use client"

import { createContext, useContext, useState } from "react"
import { WalkingListModal } from "@/components/modals/walking-list-modal"

interface WalkingListContextValue {
  openWalkingList: () => void
}

const WalkingListContext = createContext<WalkingListContextValue | null>(null)

export function useWalkingList() {
  const ctx = useContext(WalkingListContext)
  if (!ctx) throw new Error("useWalkingList must be used inside WalkingListProvider")
  return ctx
}

export function WalkingListProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <WalkingListContext.Provider value={{ openWalkingList: () => setIsOpen(true) }}>
      {children}
      <WalkingListModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </WalkingListContext.Provider>
  )
}
