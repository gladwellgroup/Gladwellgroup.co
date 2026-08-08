import { Document, Page, Text, View, Link } from '@react-pdf/renderer'
import {
  audioPageUrl,
  therapyIntro,
  type DeliverableContent,
} from '@/lib/therapy/deliverable-template'
import {
  BulletList,
  CONTENT_WIDTH,
  DocumentHeader,
  Footer,
  PAGE_PADDING_BOTTOM,
  PAGE_PADDING_TOP,
  PAGE_WIDTH,
  Paragraphs,
  PhotoSection,
  QuoteSection,
  SECTION_HEADING_HEIGHT,
  Section,
  estimateBulletsHeight,
  estimateLines,
  estimateParagraphsHeight,
  getPhotoDisplayHeight,
  sharedStyles as styles,
} from '@/lib/deliverables/pdf-blocks'
import { renderFitToOnePage } from '@/lib/deliverables/pdf-render'

async function estimatePageHeight(content: DeliverableContent): Promise<number> {
  let height = PAGE_PADDING_TOP + PAGE_PADDING_BOTTOM

  // Logo + eyebrow
  height += 26 + 20 // logo + marginBottom
  height += 9 * 1.2 + 8 // eyebrow line + marginBottom

  // Título (puede envolver a varias líneas)
  height += estimateLines(content.sessionTitle, 19, CONTENT_WIDTH) * 19 * 1.3 + 10

  // Fecha
  if (content.sessionDate) {
    height += 10 * 1.2 + 16
  }

  // Saludo + línea de contexto
  const intro = therapyIntro(content)
  if (intro) {
    height += estimateLines(intro.greeting, 11, CONTENT_WIDTH) * 11 * 1.3 + 4
    height += estimateLines(intro.intro, 10.5, CONTENT_WIDTH) * 10.5 * 1.5 + 16
  }

  // Barra de acento
  height += 3 + 28

  // Secciones de texto: encabezado (punto + título) + párrafos + margen de sección
  height += SECTION_HEADING_HEIGHT + estimateParagraphsHeight(content.problemaRecordatorio, 10.5, 1.55) + 22
  height += SECTION_HEADING_HEIGHT + estimateBulletsHeight(content.resumenAudio, 10.5, 1.55) + 22
  if (content.audioUrl) {
    height += 6 + 9.5 * 1.2 + 6 + 10 // pill (padding vertical x2 + texto + marginTop)
  }
  height += SECTION_HEADING_HEIGHT + estimateParagraphsHeight(content.recomendacionesIncomodas, 10.5, 1.55) + 22

  // Foto del grupo
  if (content.fotoSesionUrl) {
    const photoHeight = await getPhotoDisplayHeight(content.fotoSesionUrl)
    height += SECTION_HEADING_HEIGHT + 8 + 2 + photoHeight + 22
  }

  // Frase inspiradora de cierre
  if (content.fraseTexto?.trim()) {
    height += 16 // paddingTop del divisor
    height +=
      estimateLines(content.fraseTexto.trim(), 11.5, CONTENT_WIDTH) *
        11.5 *
        1.3 +
      6
    if (content.fraseAutor?.trim()) {
      height += 9.5 * 1.2
    }
    height += 10
  }

  // Footer (borde + texto)
  height += 10 + 8 * 1.2

  // Margen de seguridad: la heurística de ancho de carácter es aproximada,
  // mejor sobrar un poco de espacio en blanco al final que cortar contenido.
  height += 48

  return Math.ceil(height)
}

function DeliverableDocument({
  content,
  pageHeight,
}: {
  content: DeliverableContent
  pageHeight: number
}) {
  return (
    <Document title={`Entregable — ${content.sessionTitle}`} author="Gladwell">
      <Page size={[PAGE_WIDTH, pageHeight]} style={styles.page}>
        <DocumentHeader
          eyebrow="RESUMEN DE LA SESIÓN"
          title={content.sessionTitle}
          dateLine={content.sessionDate}
          greeting={therapyIntro(content)?.greeting ?? null}
          intro={therapyIntro(content)?.intro ?? null}
        />

        <Section heading="Recordar el problema">
          <Paragraphs text={content.problemaRecordatorio} />
        </Section>

        <Section heading="Resumen del audio">
          <BulletList text={content.resumenAudio} />
          {audioPageUrl(content) ? (
            <Link
              src={audioPageUrl(content)!}
              style={{ textDecoration: 'none' }}
            >
              <View style={styles.pill}>
                <Text style={styles.pillText}>Escuchar audio de la sesión</Text>
              </View>
            </Link>
          ) : null}
        </Section>

        <Section heading="Recomendaciones incómodas">
          <Paragraphs text={content.recomendacionesIncomodas} />
        </Section>

        <PhotoSection heading="Foto del grupo" url={content.fotoSesionUrl} />

        <QuoteSection texto={content.fraseTexto} autor={content.fraseAutor} />

        <Footer>Gladwell — Terapia Organizacional</Footer>
      </Page>
    </Document>
  )
}

export async function buildDeliverablePdfBuffer(
  content: DeliverableContent
): Promise<Buffer> {
  const initialHeight = await estimatePageHeight(content)
  return renderFitToOnePage(
    (pageHeight) => (
      <DeliverableDocument content={content} pageHeight={pageHeight} />
    ),
    initialHeight
  )
}
