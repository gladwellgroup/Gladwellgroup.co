/** El texto que acompaña a un video, bajo su tarjeta. Geist y gris, a 16 px en el celular y más grande desde `md`: a 16 px, bajo una
 *  tarjeta de 1 024 px de ancho, en escritorio casi no se leía. Las dos secciones con video lo comparten para que no se separen. */
export function SectionCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto mt-8 max-w-3xl text-center text-base leading-relaxed text-muted-foreground text-balance md:text-xl lg:text-2xl">
      {children}
    </p>
  )
}
