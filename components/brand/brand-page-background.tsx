'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface BrandPageBackgroundProps {
  children: React.ReactNode
  orbOpacity?: number
}

export function BrandPageBackground({
  children,
  orbOpacity = 1,
}: BrandPageBackgroundProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = !mounted || resolvedTheme === 'dark'
  const decorClass = mounted
    ? 'opacity-100 transition-opacity duration-500'
    : 'opacity-0 pointer-events-none'

  const orbStyle = { opacity: orbOpacity } as React.CSSProperties

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isDark ? 'bg-[#0a0a14]' : 'bg-[#f5f7fa]'
        } ${decorClass}`}
      />

      <div
        style={orbStyle}
        className={`absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full transition-all duration-500 ${
          isDark
            ? 'bg-[#7C3AED]/15 border-2 border-[#7C3AED]/40 shadow-[0_0_120px_rgba(124,58,237,0.4),inset_0_0_80px_rgba(124,58,237,0.15)]'
            : 'bg-[#7C3AED]/8 border-2 border-[#7C3AED]/25 shadow-[0_0_80px_rgba(124,58,237,0.25)]'
        } ${decorClass}`}
      />

      <div
        style={orbStyle}
        className={`absolute top-[30%] -left-48 w-[400px] h-[400px] rounded-full transition-all duration-500 ${
          isDark
            ? 'bg-[#06B6D4]/12 border-2 border-[#06B6D4]/35 shadow-[0_0_100px_rgba(6,182,212,0.35),inset_0_0_60px_rgba(6,182,212,0.12)]'
            : 'bg-[#06B6D4]/6 border-2 border-[#06B6D4]/20 shadow-[0_0_60px_rgba(6,182,212,0.18)]'
        } ${decorClass}`}
      />

      <div
        style={orbStyle}
        className={`absolute -bottom-64 left-1/4 w-[600px] h-[600px] rounded-full transition-all duration-500 ${
          isDark
            ? 'bg-[#7C3AED]/12 border-2 border-[#7C3AED]/30 shadow-[0_0_140px_rgba(124,58,237,0.3),inset_0_0_100px_rgba(124,58,237,0.08)]'
            : 'bg-[#7C3AED]/5 border-2 border-[#7C3AED]/18 shadow-[0_0_90px_rgba(124,58,237,0.15)]'
        } ${decorClass}`}
      />

      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDark
            ? 'bg-gradient-to-b from-transparent via-[#0a0a14]/30 to-[#0a0a14]/80'
            : 'bg-gradient-to-b from-transparent via-transparent to-[#f5f7fa]/60'
        } ${decorClass}`}
      />

      <div className="relative z-10">{children}</div>
    </div>
  )
}
