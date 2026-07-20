'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      className="relative flex items-center w-14 h-7 rounded-full p-0.5 transition-all duration-300 gladwell-border-gradient focus:outline-none"
      style={{
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.08)',
      }}
    >
      <span
        className="absolute inset-0.5 rounded-full transition-all duration-300"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.06)',
        }}
      />
      <span
        className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 shadow-md ${
          isDark
            ? 'translate-x-0 gladwell-gradient text-white'
            : 'translate-x-7 bg-white text-purple-600'
        }`}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  )
}
