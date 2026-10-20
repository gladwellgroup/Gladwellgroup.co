import { DECOR_ORBS, ORB_RGB, type DecorOrb, type OrbTheme } from "@/lib/data/decor-orbs"
import { orbGradient } from "@/lib/landing/orb-gradient"

// Fondo decorativo de las secciones de contenido. Componente de servidor: el tema lo resuelven las
// variantes `light:` de Tailwind (el oscuro es el estado base, como `defaultTheme="dark"`), sin
// `useTheme`, sin estado `mounted` y sin JS en el cliente. Antes, 10 capas arrancaban en `opacity-0` y
// hacían un fundido de 500 ms justo después de hidratar —el momento en que se empieza a hacer scroll—,
// y cada círculo llevaba `transition-all` y una sombra de 50–150 px de desenfoque (hasta 800 px de
// círculo), que es lo que más costaba pintar en Chrome/Android.
//
// Ahora cada círculo es UNA caja vacía con posición y tamaño, y un solo degradado radial
// (`.decor-orb::before` en globals.css) pinta relleno, aro, brillo interior y halo; lo genera
// lib/landing/orb-gradient.ts con el mismo perfil que la sombra y viaja, uno por tema, en variables CSS.
// Con el relleno y el aro en el propio elemento, el relleno translúcido de los tres círculos mayores seguía
// costando lo mismo que las sombras (ver orb-gradient.ts). Los círculos viven en lib/data/decor-orbs.ts.

/** Variables CSS de un círculo: el degradado de cada tema y cuánto sobresale la capa del halo. */
function orbVars(orb: DecorOrb): React.CSSProperties {
  const rgb = ORB_RGB[orb.tone]
  const reach = Math.max(orb.dark.blur, orb.light.blur)
  const layer = (theme: OrbTheme) => orbGradient({ rgb, radius: orb.radius, reach, ...theme })
  return {
    "--orb-dark": layer(orb.dark),
    "--orb-light": layer(orb.light),
    "--orb-reach": `${reach}px`,
  } as React.CSSProperties
}

export function ContentBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-[#0a0a14] light:bg-[#f5f7fa]" />

      {DECOR_ORBS.map((orb) => (
        <div
          key={orb.place}
          aria-hidden
          style={orbVars(orb)}
          className={`decor-orb pointer-events-none absolute ${orb.place}`}
        />
      ))}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a14]/30 to-[#0a0a14]/80 light:via-transparent light:to-[#f5f7fa]/60"
      />

      <div className="relative z-10">{children}</div>
    </div>
  )
}
