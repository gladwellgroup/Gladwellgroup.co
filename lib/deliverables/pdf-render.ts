import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import type { ReactElement } from 'react'

const MAX_ATTEMPTS = 3
/** Cuánto crece el alto en cada reintento. Acumulativo: 2do intento +80,
 *  3ro +240. El desborde real observado (una sola línea de pie de página)
 *  se corrige de sobra con el primer salto. */
const HEIGHT_BUMP_PX = [80, 160]

/** Genera el PDF y, si el alto estimado se quedó corto y react-pdf lo separó
 *  en páginas, agranda el alto y regenera. Reemplaza la heurística de
 *  estimación de altura (aproximada, basada en ancho de carácter) por una
 *  verificación real sobre el PDF ya producido: no se adivina si cupo, se
 *  cuenta cuántas páginas salieron de verdad. */
export async function renderFitToOnePage(
  buildDocument: (pageHeight: number) => ReactElement<DocumentProps>,
  initialHeight: number
): Promise<Buffer> {
  let height = initialHeight
  let buffer = Buffer.from(await renderToBuffer(buildDocument(height)))

  for (let attempt = 0; attempt < MAX_ATTEMPTS - 1; attempt++) {
    const pages = await PDFDocument.load(buffer).then((doc) => doc.getPageCount())
    if (pages <= 1) return buffer

    height += HEIGHT_BUMP_PX[attempt] ?? 160
    buffer = Buffer.from(await renderToBuffer(buildDocument(height)))
  }

  return buffer
}
