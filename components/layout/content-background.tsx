"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface ContentBackgroundProps {
  children: React.ReactNode
}

export function ContentBackground({ children }: ContentBackgroundProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = !mounted || resolvedTheme === "dark"
  const decorClass = mounted
    ? "opacity-100 transition-opacity duration-500"
    : "opacity-0 pointer-events-none"

  return (
    <div className="relative overflow-hidden">
      {/* Base background */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isDark ? "bg-[#0a0a14]" : "bg-[#f5f7fa]"
        } ${decorClass}`}
      />

      {/* Large circle top right */}
      <div
        className={`absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full transition-all duration-500 ${
          isDark
            ? "bg-[#7C3AED]/15 border-2 border-[#7C3AED]/40 shadow-[0_0_120px_rgba(124,58,237,0.4),inset_0_0_80px_rgba(124,58,237,0.15)]"
            : "bg-[#7C3AED]/8 border-2 border-[#7C3AED]/25 shadow-[0_0_80px_rgba(124,58,237,0.25)]"
        } ${decorClass}`}
      />

      {/* Medium circle left */}
      <div
        className={`absolute top-[30%] -left-48 w-[400px] h-[400px] rounded-full transition-all duration-500 ${
          isDark
            ? "bg-[#06B6D4]/12 border-2 border-[#06B6D4]/35 shadow-[0_0_100px_rgba(6,182,212,0.35),inset_0_0_60px_rgba(6,182,212,0.12)]"
            : "bg-[#06B6D4]/6 border-2 border-[#06B6D4]/20 shadow-[0_0_60px_rgba(6,182,212,0.18)]"
        } ${decorClass}`}
      />

      {/* Large circle bottom center */}
      <div
        className={`absolute -bottom-64 left-1/4 w-[600px] h-[600px] rounded-full transition-all duration-500 ${
          isDark
            ? "bg-[#7C3AED]/12 border-2 border-[#7C3AED]/30 shadow-[0_0_140px_rgba(124,58,237,0.3),inset_0_0_100px_rgba(124,58,237,0.08)]"
            : "bg-[#7C3AED]/5 border-2 border-[#7C3AED]/18 shadow-[0_0_90px_rgba(124,58,237,0.15)]"
        } ${decorClass}`}
      />

      {/* Small accent circle */}
      <div
        className={`absolute top-[60%] right-[10%] w-[200px] h-[200px] rounded-full transition-all duration-500 ${
          isDark
            ? "bg-[#06B6D4]/10 border-2 border-[#06B6D4]/30 shadow-[0_0_60px_rgba(6,182,212,0.3)]"
            : "bg-[#06B6D4]/5 border-2 border-[#06B6D4]/18 shadow-[0_0_50px_rgba(6,182,212,0.15)]"
        } ${decorClass}`}
      />

      {/* Extra large background circle */}
      <div
        className={`absolute top-[50%] -translate-y-1/2 -right-96 w-[800px] h-[800px] rounded-full transition-all duration-500 ${
          isDark
            ? "bg-gradient-to-br from-[#7C3AED]/8 to-[#06B6D4]/8 border-2 border-white/10 shadow-[0_0_150px_rgba(124,58,237,0.2)]"
            : "bg-gradient-to-br from-[#7C3AED]/4 to-[#06B6D4]/4 border-2 border-[#7C3AED]/12 shadow-[0_0_100px_rgba(124,58,237,0.12)]"
        } ${decorClass}`}
      />

      {/* Small floating circle top left */}
      <div
        className={`absolute top-[15%] left-[15%] w-[150px] h-[150px] rounded-full transition-all duration-500 ${
          isDark
            ? "bg-[#7C3AED]/8 border-2 border-[#7C3AED]/25 shadow-[0_0_50px_rgba(124,58,237,0.25)]"
            : "bg-[#7C3AED]/4 border-2 border-[#7C3AED]/15 shadow-[0_0_40px_rgba(124,58,237,0.12)]"
        } ${decorClass}`}
      />

      {/* Medium cyan circle bottom right */}
      <div
        className={`absolute bottom-[20%] right-[5%] w-[300px] h-[300px] rounded-full transition-all duration-500 ${
          isDark
            ? "bg-[#06B6D4]/10 border-2 border-[#06B6D4]/30 shadow-[0_0_80px_rgba(6,182,212,0.3)]"
            : "bg-[#06B6D4]/5 border-2 border-[#06B6D4]/18 shadow-[0_0_60px_rgba(6,182,212,0.15)]"
        } ${decorClass}`}
      />

      {/* Accent purple circle middle */}
      <div
        className={`absolute top-[45%] left-[5%] w-[250px] h-[250px] rounded-full transition-all duration-500 ${
          isDark
            ? "bg-[#7C3AED]/8 border-2 border-[#7C3AED]/25 shadow-[0_0_70px_rgba(124,58,237,0.25)]"
            : "bg-[#7C3AED]/4 border-2 border-[#7C3AED]/15 shadow-[0_0_50px_rgba(124,58,237,0.12)]"
        } ${decorClass}`}
      />

      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDark
            ? "bg-gradient-to-b from-transparent via-[#0a0a14]/30 to-[#0a0a14]/80"
            : "bg-gradient-to-b from-transparent via-transparent to-[#f5f7fa]/60"
        } ${decorClass}`}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
