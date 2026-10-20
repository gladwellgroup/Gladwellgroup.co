import { getImageProps, type StaticImageData } from "next/image"
import desktopDark from "@/public/images/hero-bg-desktop.jpg"
import desktopLight from "@/public/images/hero-bg-desktop-light.jpg"
import mobileDark from "@/public/images/hero-bg-mobile.jpg"
import mobileLight from "@/public/images/hero-bg-mobile-light.jpg"

// Fondo del hero. Antes eran 8 capas con `background-image` en línea: las dos fotos de cada breakpoint
// (oscura y clara) se descargaban a la vez aunque solo se viera una —1,5 MB en escritorio, 1,7 MB en
// móvil—, sin redimensionar ni WebP. Ahora:
//  · una <picture> por tema, con <source media> para escritorio: el navegador pide UNA sola foto;
//  · la del tema por defecto (oscuro) es eager y con fetchPriority="high" —sin `priority` ni `preload`,
//    que precargarían los dos breakpoints—; la clara es lazy y está oculta, así que no se pide hasta
//    que alguien activa el tema claro;
//  · fotos importadas: la URL lleva hash y /_next/image sale con caché inmutable;
//  · `light:` (globals.css) hace del oscuro el estado base, igual que `defaultTheme="dark"`.
// Se pierde el fundido entre las dos fotos al cambiar de tema: hacerlo exige tener ambas montadas, que
// es justo lo que obligaba a descargarlas. El degradado sí conserva su transición de color.

/** Mismo corte que `md:` de Tailwind (48rem). */
const MD = "(min-width: 768px)"

function layer(mobile: StaticImageData, desktop: StaticImageData, eager: boolean) {
  const {
    props: { srcSet },
  } = getImageProps({ alt: "", sizes: "100vw", src: desktop })
  const { props } = getImageProps({
    alt: "",
    sizes: "100vw",
    src: mobile,
    loading: eager ? "eager" : "lazy",
    fetchPriority: eager ? "high" : "auto",
  })
  return { srcSet, props }
}

export function HeroBackground() {
  const dark = layer(mobileDark, desktopDark, true)
  const light = layer(mobileLight, desktopLight, false)

  return (
    <>
      {/* Decorativas: `alt=""` las deja fuera del árbol de accesibilidad (<picture> no admite aria-hidden). */}
      <picture className="absolute inset-0 light:hidden">
        <source media={MD} srcSet={dark.srcSet} sizes="100vw" />
        <img {...dark.props} alt="" className="h-full w-full object-cover object-center" />
      </picture>

      {/* lazy + display:none ⇒ no se pide hasta que alguien activa el tema claro */}
      <picture className="absolute inset-0 hidden light:block">
        <source media={MD} srcSet={light.srcSet} sizes="100vw" />
        <img {...light.props} alt="" className="h-full w-full object-cover object-center" />
      </picture>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/90 transition-colors duration-500 ease-in-out light:from-white/15 light:via-black/25 light:to-black/55"
      />
    </>
  )
}
