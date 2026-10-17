// Geometría de la portada del modal: pura y sin I/O, para probarla sin navegador.
//
// La portada puede ser de un reel o story (9:16), del feed de Instagram (4:5 o
// 1:1), de un post de LinkedIn (1,91:1 o 1:1) o de un video horizontal (16:9):
// el contenedor toma la proporción de la foto en vez de recortarla a una fija.

/** Proporción (ancho / alto) mientras la foto carga, o si el navegador no la sabe. */
export const COVER_DEFAULT_RATIO = 16 / 9

/** Hasta dónde se adapta el contenedor: de un reel o story vertical (9:16 ≈ 0,56)
 *  a un panorama (≈ 2,4:1). Más allá, la foto se ve completa con barras a los
 *  lados en vez de volver el contenedor una tira inmanejable. */
export const COVER_MIN_RATIO = 1 / 2
export const COVER_MAX_RATIO = 12 / 5

/** Proporción con la que se dibuja la portada, a partir de las dimensiones reales
 *  de la foto; null si no son utilizables (0, negativas, NaN o infinitas — p. ej.
 *  un SVG sin tamaño). */
export function coverRatio(width: number, height: number): number | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return Math.min(COVER_MAX_RATIO, Math.max(COVER_MIN_RATIO, width / height))
}
