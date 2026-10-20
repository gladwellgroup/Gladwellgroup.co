// Degradado radial que pinta de una vez un círculo decorativo —relleno, aro, brillo interior y halo—
// (components/layout/content-background.tsx).
//
// Antes cada círculo era un div con `bg-*`, `border-2` y un `box-shadow: 0 0 120px color` de hasta 150 px
// de desenfoque (hasta 800 px de círculo): con 8 círculos era la mayor parte del trabajo de pintado de la
// landing en Chrome/Android. Medido con perfil Android al recorrer la página (fotogramas con contenido sin
// pintar): 6 con las sombras, 6 con las sombras cambiadas por degradados pero con el relleno en el propio
// elemento, y 3 con TODO en un solo degradado —igual que sin círculos—: el relleno translúcido de los tres
// círculos mayores era lo que costaba. Un degradado radial se pinta sin desenfocar nada.
//
// El halo copia el perfil de una sombra gaussiana (σ = desenfoque / 2): vale la MITAD de su opacidad justo
// en el borde de la forma y cae como 1 − Φ(d / σ), es decir, a 0, 25, 50, 75 y 100 % del desenfoque:
const TAIL = [0.5, 0.31, 0.16, 0.067, 0] as const
// y el brillo interior (`inset`) es el mismo perfil hacia adentro, desde el borde de relleno:
const INSET_TAIL = [0, 0.067, 0.16, 0.31, 0.5] as const

/** Grosor del aro del círculo (antes `border-2`). */
export const ORB_BORDER_PX = 2

export type Rgb = readonly [number, number, number]

export interface OrbGradientInput {
  rgb: Rgb
  /** Radio hasta el borde exterior del círculo (px), aro incluido. */
  radius: number
  /** Cuánto sobresale del círculo la capa del degradado (px): el mayor desenfoque entre los temas. */
  reach: number
  /** Opacidad del relleno y del aro. El aro, si es de otro color (el del círculo grande en oscuro es
   *  blanco), lleva `lineRgb`. */
  fill: number
  line: number
  lineRgb?: Rgb
  /** Halo: desenfoque (px) y opacidad. */
  blur: number
  glow: number
  /** Brillo interior: profundidad (px) y opacidad. */
  inset?: { blur: number; alpha: number }
}

const num = (value: number) => String(Math.round(value * 10_000) / 10_000)
/** Opacidad de dos capas del mismo color una sobre otra. */
const over = (under: number, top: number) => under + top - under * top

/** `radial-gradient(...)` para una capa cuadrada de lado 2 · (radius + reach), centrada en el círculo y
 *  con `closest-side`: el 100 % es el radio `radius + reach`. De dentro hacia fuera: relleno (con el brillo
 *  interior encima, si lo hay), aro de 2 px y halo. */
export function orbGradient({ rgb, radius, reach, fill, line, lineRgb = rgb, blur, glow, inset }: OrbGradientInput): string {
  const full = radius + reach
  const at = (distance: number) => `${num((distance / full) * 100)}%`
  const color = (alpha: number, of: Rgb = rgb) => `rgba(${of.join(',')},${num(alpha)})`
  const edge = radius - ORB_BORDER_PX

  const stops = [`${color(fill)} 0%`]
  if (inset) {
    ;[1, 0.75, 0.5, 0.25, 0].forEach((depth, i) => {
      stops.push(`${color(over(fill, inset.alpha * INSET_TAIL[i]))} ${at(edge - inset.blur * depth)}`)
    })
  } else {
    // Sin esta parada el degradado iría interpolando del relleno al aro a lo largo de todo el radio.
    stops.push(`${color(fill)} ${at(edge)}`)
  }
  const ring = over(fill, line)
  stops.push(`${color(ring, lineRgb)} ${at(edge)}`, `${color(ring, lineRgb)} ${at(radius)}`)
  ;[0, 0.25, 0.5, 0.75, 1].forEach((fraction, i) => {
    stops.push(`${color(glow * TAIL[i])} ${at(radius + blur * fraction)}`)
  })
  if (reach > blur) stops.push(`${color(0)} 100%`)

  return `radial-gradient(circle closest-side, ${stops.join(', ')})`
}
