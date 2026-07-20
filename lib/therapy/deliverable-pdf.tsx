import { readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { DeliverableContent } from '@/lib/therapy/deliverable-template'

const PURPLE = '#7C3AED'
const CYAN = '#06B6D4'
const INK = '#18181B'
const MUTED = '#71717A'
const HAIRLINE = '#E4E4E7'
const TINT = '#F8F6FF'

// Documento de una sola pieza (no está pensado para imprimirse en A4): el
// alto de la página se calcula a partir del contenido real, en vez de usar
// un tamaño de papel fijo que corta el contenido en varias hojas.
const PAGE_WIDTH = 595
const PAGE_PADDING_X = 44
const PAGE_PADDING_TOP = 44
const PAGE_PADDING_BOTTOM = 36
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_PADDING_X * 2

let logoDataUri: string | null = null
function getLogoDataUri(): string | null {
  if (logoDataUri) return logoDataUri
  try {
    const file = readFileSync(
      path.join(process.cwd(), 'public/brand/gladwell-logo-wordmark-tight.png')
    )
    logoDataUri = `data:image/png;base64,${file.toString('base64')}`
    return logoDataUri
  } catch {
    return null
  }
}

// Heurística de ancho promedio de carácter para Helvetica en texto corrido
// en español (mezcla de mayúsculas/minúsculas y tildes). No es exacta como
// la métrica real de la fuente, pero acerca bien el número de líneas para
// calcular el alto de la página de una sola pieza.
const AVG_CHAR_WIDTH_RATIO = 0.5

function estimateLines(text: string, fontSize: number, width: number): number {
  const charsPerLine = Math.max(1, Math.floor(width / (fontSize * AVG_CHAR_WIDTH_RATIO)))
  return Math.max(1, Math.ceil(text.length / charsPerLine))
}

function estimateParagraphsHeight(text: string, fontSize: number, lineHeight: number): number {
  const trimmed = text.trim()
  if (!trimmed) return fontSize * lineHeight + 6
  const blocks = trimmed.split(/\n{2,}/)
  let height = 0
  for (const block of blocks) {
    height += estimateLines(block, fontSize, CONTENT_WIDTH) * fontSize * lineHeight + 6
  }
  return height
}

const BULLET_INDENT = 14

function toBulletLines(text: string): string[] {
  return text
    .trim()
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean)
}

function estimateBulletsHeight(text: string, fontSize: number, lineHeight: number): number {
  const items = toBulletLines(text)
  if (items.length === 0) return fontSize * lineHeight + 6
  let height = 0
  for (const item of items) {
    height +=
      estimateLines(item, fontSize, CONTENT_WIDTH - BULLET_INDENT) *
        fontSize *
        lineHeight +
      6
  }
  return height
}

const MAX_PHOTO_HEIGHT = 340

async function getPhotoDisplayHeight(url: string): Promise<number> {
  try {
    const res = await fetch(url)
    if (!res.ok) return 220
    const buffer = Buffer.from(await res.arrayBuffer())
    const { width, height } = await sharp(buffer).metadata()
    if (!width || !height) return 220
    return Math.min(MAX_PHOTO_HEIGHT, CONTENT_WIDTH * (height / width))
  } catch {
    return 220
  }
}

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

  // Saludo
  if (content.invitadoNombre?.trim()) {
    const greetingText = `Estimado equipo de ${content.invitadoNombre.trim()},`
    height += estimateLines(greetingText, 11, CONTENT_WIDTH) * 11 * 1.3 + 16
  }

  // Barra de acento
  height += 3 + 28

  // Secciones de texto: encabezado (punto + título) + párrafos + margen de sección
  const sectionHeadingHeight = 12.5 * 1.2 + 8
  height += sectionHeadingHeight + estimateParagraphsHeight(content.problemaRecordatorio, 10.5, 1.55) + 22
  height += sectionHeadingHeight + estimateBulletsHeight(content.resumenAudio, 10.5, 1.55) + 22
  if (content.audioUrl) {
    height += 6 + 9.5 * 1.2 + 6 + 10 // pill (padding vertical x2 + texto + marginTop)
  }
  height += sectionHeadingHeight + estimateParagraphsHeight(content.recomendacionesIncomodas, 10.5, 1.55) + 22

  // Foto del grupo
  if (content.fotoSesionUrl) {
    const photoHeight = await getPhotoDisplayHeight(content.fotoSesionUrl)
    height += sectionHeadingHeight + 8 + 2 + photoHeight + 22
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

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PADDING_TOP,
    paddingBottom: PAGE_PADDING_BOTTOM,
    paddingHorizontal: PAGE_PADDING_X,
    fontSize: 10.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.55,
    color: INK,
  },
  logo: {
    height: 26,
    width: 132,
    objectFit: 'contain',
    marginBottom: 20,
    alignSelf: 'center',
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PURPLE,
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 19,
    lineHeight: 1.3,
    marginBottom: 10,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    textAlign: 'center',
  },
  date: {
    fontSize: 10,
    color: MUTED,
    marginBottom: 16,
    textAlign: 'center',
  },
  greeting: {
    fontSize: 11,
    color: INK,
    marginBottom: 16,
  },
  accentBar: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 2,
    marginBottom: 28,
    overflow: 'hidden',
  },
  accentBarPurple: {
    flex: 1,
    backgroundColor: PURPLE,
  },
  accentBarCyan: {
    flex: 1,
    backgroundColor: CYAN,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PURPLE,
    marginRight: 7,
  },
  heading: {
    fontSize: 12.5,
    fontFamily: 'Helvetica-Bold',
    color: INK,
  },
  body: {
    marginBottom: 6,
    color: '#3F3F46',
  },
  emptyBody: {
    marginBottom: 6,
    color: MUTED,
    fontFamily: 'Helvetica-Oblique',
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bulletMarker: {
    width: BULLET_INDENT,
    color: PURPLE,
    fontFamily: 'Helvetica-Bold',
  },
  bulletText: {
    flex: 1,
    color: '#3F3F46',
  },
  audioPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: TINT,
  },
  audioPillText: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: PURPLE,
  },
  photoFrame: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  image: {
    width: '100%',
    maxHeight: MAX_PHOTO_HEIGHT,
    objectFit: 'cover',
  },
  quoteBlock: {
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  quoteText: {
    fontSize: 11.5,
    fontFamily: 'Helvetica-Oblique',
    color: INK,
    textAlign: 'center',
    marginBottom: 6,
  },
  quoteAuthor: {
    fontSize: 9.5,
    color: MUTED,
    textAlign: 'center',
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  footerText: {
    fontSize: 8,
    color: MUTED,
  },
})

function Paragraphs({ text }: { text: string }) {
  const trimmed = text.trim()
  if (!trimmed) {
    return <Text style={styles.emptyBody}>Sin contenido</Text>
  }
  const blocks = trimmed.split(/\n{2,}/)
  return (
    <>
      {blocks.map((block, i) => (
        <Text key={i} style={styles.body}>
          {block}
        </Text>
      ))}
    </>
  )
}

function BulletList({ text }: { text: string }) {
  const items = toBulletLines(text)
  if (items.length === 0) {
    return <Text style={styles.emptyBody}>Sin contenido</Text>
  }
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletMarker}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  )
}

function SectionHeading({ children }: { children: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionDot} />
      <Text style={styles.heading}>{children}</Text>
    </View>
  )
}

function DeliverableDocument({
  content,
  pageHeight,
}: {
  content: DeliverableContent
  pageHeight: number
}) {
  const logo = getLogoDataUri()

  return (
    <Document title={`Entregable — ${content.sessionTitle}`} author="Gladwell">
      <Page size={[PAGE_WIDTH, pageHeight]} style={styles.page}>
        {logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
          <Image src={logo} style={styles.logo} />
        ) : null}

        <Text style={styles.eyebrow}>RESUMEN DE LA SESIÓN</Text>
        <Text style={styles.title}>{content.sessionTitle}</Text>
        {content.sessionDate ? (
          <Text style={styles.date}>{content.sessionDate}</Text>
        ) : null}
        {content.invitadoNombre?.trim() ? (
          <Text style={styles.greeting}>
            Estimado equipo de {content.invitadoNombre.trim()},
          </Text>
        ) : null}

        <View style={styles.accentBar}>
          <View style={styles.accentBarPurple} />
          <View style={styles.accentBarCyan} />
        </View>

        <View style={styles.section}>
          <SectionHeading>Recordar el problema</SectionHeading>
          <Paragraphs text={content.problemaRecordatorio} />
        </View>

        <View style={styles.section}>
          <SectionHeading>Resumen del audio</SectionHeading>
          <BulletList text={content.resumenAudio} />
          {content.audioUrl ? (
            <Link src={content.audioUrl} style={{ textDecoration: 'none' }}>
              <View style={styles.audioPill}>
                <Text style={styles.audioPillText}>Escuchar audio de la sesión</Text>
              </View>
            </Link>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeading>Recomendaciones incómodas</SectionHeading>
          <Paragraphs text={content.recomendacionesIncomodas} />
        </View>

        {content.fotoSesionUrl ? (
          <View style={styles.section}>
            <SectionHeading>Foto del grupo</SectionHeading>
            <View style={styles.photoFrame}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image */}
              <Image src={content.fotoSesionUrl} style={styles.image} />
            </View>
          </View>
        ) : null}

        {content.fraseTexto?.trim() ? (
          <View style={styles.quoteBlock}>
            <Text style={styles.quoteText}>“{content.fraseTexto.trim()}”</Text>
            {content.fraseAutor?.trim() ? (
              <Text style={styles.quoteAuthor}>— {content.fraseAutor.trim()}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Gladwell — Terapia Organizacional</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function buildDeliverablePdfBuffer(
  content: DeliverableContent
): Promise<Buffer> {
  const pageHeight = await estimatePageHeight(content)
  const buffer = await renderToBuffer(
    <DeliverableDocument content={content} pageHeight={pageHeight} />
  )
  return Buffer.from(buffer)
}
