import type { Rgb } from "@/lib/landing/orb-gradient"

// Círculos decorativos del fondo de la landing (components/layout/content-background.tsx).
//
// Cada círculo se pinta con UN degradado radial por tema (lib/landing/orb-gradient.ts, `.decor-orb::before`
// en globals.css): relleno, aro de 2 px, brillo interior y halo. Antes eran un div con `bg-*`, `border-2` y
// un `box-shadow` de 50–150 px de desenfoque; los valores de abajo son los de aquellas clases, p. ej.
// `bg-[#7C3AED]/15 border-[#7C3AED]/40 shadow-[0_0_120px_rgba(124,58,237,0.4),inset_0_0_80px_rgba(124,58,237,0.15)]`
// es fill 0.15, line 0.4, blur 120, glow 0.4, inset { blur 80, alpha 0.15 }.

/** Parámetros de un círculo en un tema. */
export interface OrbTheme {
  /** Opacidad del relleno y del aro de 2 px. */
  fill: number
  line: number
  /** Color del aro si no es el del círculo. */
  lineRgb?: Rgb
  /** Halo: desenfoque (px) y opacidad. */
  blur: number
  glow: number
  /** Brillo interior (la sombra `inset`): profundidad (px) y opacidad. */
  inset?: { blur: number; alpha: number }
}

export interface DecorOrb {
  /** Posición y tamaño. El círculo mide `radius * 2` px. */
  place: string
  tone: "violet" | "cyan"
  radius: number
  dark: OrbTheme
  light: OrbTheme
}

export const ORB_RGB = {
  violet: [124, 58, 237],
  cyan: [6, 182, 212],
} as const satisfies Record<string, Rgb>

const WHITE: Rgb = [255, 255, 255]

export const DECOR_ORBS: readonly DecorOrb[] = [
  {
    place: "-top-32 -right-32 w-[500px] h-[500px]",
    tone: "violet",
    radius: 250,
    dark: { fill: 0.15, line: 0.4, blur: 120, glow: 0.4, inset: { blur: 80, alpha: 0.15 } },
    light: { fill: 0.08, line: 0.25, blur: 80, glow: 0.25 },
  },
  {
    place: "top-[30%] -left-48 w-[400px] h-[400px]",
    tone: "cyan",
    radius: 200,
    dark: { fill: 0.12, line: 0.35, blur: 100, glow: 0.35, inset: { blur: 60, alpha: 0.12 } },
    light: { fill: 0.06, line: 0.2, blur: 60, glow: 0.18 },
  },
  {
    place: "-bottom-64 left-1/4 w-[600px] h-[600px]",
    tone: "violet",
    radius: 300,
    dark: { fill: 0.12, line: 0.3, blur: 140, glow: 0.3, inset: { blur: 100, alpha: 0.08 } },
    light: { fill: 0.05, line: 0.18, blur: 90, glow: 0.15 },
  },
  {
    place: "top-[60%] right-[10%] w-[200px] h-[200px]",
    tone: "cyan",
    radius: 100,
    dark: { fill: 0.1, line: 0.3, blur: 60, glow: 0.3 },
    light: { fill: 0.05, line: 0.18, blur: 50, glow: 0.15 },
  },
  {
    // El relleno original era un degradado diagonal violeta → cian al 8 % (4 % en claro) y el aro, blanco al
    // 10 % en oscuro: se aproxima con relleno violeta (la diferencia con producción es imperceptible).
    place: "top-[50%] -translate-y-1/2 -right-96 w-[800px] h-[800px]",
    tone: "violet",
    radius: 400,
    dark: { fill: 0.08, line: 0.1, lineRgb: WHITE, blur: 150, glow: 0.2 },
    light: { fill: 0.04, line: 0.12, blur: 100, glow: 0.12 },
  },
  {
    place: "top-[15%] left-[15%] w-[150px] h-[150px]",
    tone: "violet",
    radius: 75,
    dark: { fill: 0.08, line: 0.25, blur: 50, glow: 0.25 },
    light: { fill: 0.04, line: 0.15, blur: 40, glow: 0.12 },
  },
  {
    place: "bottom-[20%] right-[5%] w-[300px] h-[300px]",
    tone: "cyan",
    radius: 150,
    dark: { fill: 0.1, line: 0.3, blur: 80, glow: 0.3 },
    light: { fill: 0.05, line: 0.18, blur: 60, glow: 0.15 },
  },
  {
    place: "top-[45%] left-[5%] w-[250px] h-[250px]",
    tone: "violet",
    radius: 125,
    dark: { fill: 0.08, line: 0.25, blur: 70, glow: 0.25 },
    light: { fill: 0.04, line: 0.15, blur: 50, glow: 0.12 },
  },
]
