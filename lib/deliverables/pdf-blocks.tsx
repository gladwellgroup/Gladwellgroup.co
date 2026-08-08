import { readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'

/** Piezas compartidas por los PDF de los dos programas de entregables:
 *  paleta, geometría de página, estimación de alto y los bloques de contenido.
 *  Cada programa arma su propio documento con estas piezas. */

export const PURPLE = '#7C3AED'
export const CYAN = '#06B6D4'
export const INK = '#18181B'
export const MUTED = '#71717A'
export const HAIRLINE = '#E4E4E7'
export const TINT = '#F8F6FF'
export const BODY = '#3F3F46'

// Documento de una sola pieza (no está pensado para imprimirse en A4): el
// alto de la página se calcula a partir del contenido real, en vez de usar
// un tamaño de papel fijo que corta el contenido en varias hojas.
export const PAGE_WIDTH = 595
export const PAGE_PADDING_X = 44
export const PAGE_PADDING_TOP = 44
export const PAGE_PADDING_BOTTOM = 36
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_PADDING_X * 2

export const BULLET_INDENT = 14
export const MAX_PHOTO_HEIGHT = 340

let logoDataUri: string | null = null
export function getLogoDataUri(): string | null {
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

export function estimateLines(
  text: string,
  fontSize: number,
  width: number
): number {
  const charsPerLine = Math.max(
    1,
    Math.floor(width / (fontSize * AVG_CHAR_WIDTH_RATIO))
  )
  return Math.max(1, Math.ceil(text.length / charsPerLine))
}

export function estimateParagraphsHeight(
  text: string,
  fontSize: number,
  lineHeight: number
): number {
  const trimmed = text.trim()
  if (!trimmed) return fontSize * lineHeight + 6
  let height = 0
  for (const block of trimmed.split(/\n{2,}/)) {
    height +=
      estimateLines(block, fontSize, CONTENT_WIDTH) * fontSize * lineHeight + 6
  }
  return height
}

export function toBulletLines(text: string): string[] {
  return text
    .trim()
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean)
}

export function estimateBulletsHeight(
  text: string,
  fontSize: number,
  lineHeight: number
): number {
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

export async function getPhotoDisplayHeight(url: string): Promise<number> {
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

/** Alto del encabezado de sección (punto + título). */
export const SECTION_HEADING_HEIGHT = 12.5 * 1.2 + 8

export const sharedStyles = StyleSheet.create({
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
  /** Cuando debajo va la línea de contexto, el saludo se pega a ella: son un
   *  solo bloque, no dos párrafos sueltos. */
  greetingTight: {
    fontSize: 11,
    color: INK,
    marginBottom: 4,
  },
  intro: {
    fontSize: 10.5,
    lineHeight: 1.5,
    color: BODY,
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
    color: BODY,
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
    color: BODY,
  },
  pill: {
    flexDirection: 'row',
    // Centrado y no pegado a la izquierda: es una llamada a la acción, gana
    // fuerza como bloque propio bajo las viñetas.
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: TINT,
  },
  pillText: {
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

export function Paragraphs({ text }: { text: string }) {
  const trimmed = text.trim()
  if (!trimmed) {
    return <Text style={sharedStyles.emptyBody}>Sin contenido</Text>
  }
  return (
    <>
      {trimmed.split(/\n{2,}/).map((block, i) => (
        <Text key={i} style={sharedStyles.body}>
          {block}
        </Text>
      ))}
    </>
  )
}

export function BulletList({ text }: { text: string }) {
  const items = toBulletLines(text)
  if (items.length === 0) {
    return <Text style={sharedStyles.emptyBody}>Sin contenido</Text>
  }
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={sharedStyles.bulletRow}>
          <Text style={sharedStyles.bulletMarker}>•</Text>
          <Text style={sharedStyles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  )
}

export function SectionHeading({ children }: { children: string }) {
  return (
    <View style={sharedStyles.sectionHeader}>
      <View style={sharedStyles.sectionDot} />
      <Text style={sharedStyles.heading}>{children}</Text>
    </View>
  )
}

/** Encabezado + cuerpo como una sola unidad. `wrap={false}`: si no cabe el
 *  bloque completo en lo que resta de la página, react-pdf lo mueve entero a
 *  la siguiente en vez de partirlo — nunca deja una línea suelta atrás. */
export function Section({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <View style={sharedStyles.section} wrap={false}>
      <SectionHeading>{heading}</SectionHeading>
      {children}
    </View>
  )
}

export function DocumentHeader({
  eyebrow,
  title,
  dateLine,
  greeting,
  intro,
}: {
  eyebrow: string
  title: string
  dateLine?: string | null
  greeting?: string | null
  /** Línea de contexto bajo el saludo: qué fue esta sesión para quien lee. */
  intro?: string | null
}) {
  const logo = getLogoDataUri()

  return (
    <>
      {logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
        <Image src={logo} style={sharedStyles.logo} />
      ) : null}
      <Text style={sharedStyles.eyebrow}>{eyebrow}</Text>
      <Text style={sharedStyles.title}>{title}</Text>
      {dateLine ? <Text style={sharedStyles.date}>{dateLine}</Text> : null}
      {greeting ? (
        <Text
          style={intro ? sharedStyles.greetingTight : sharedStyles.greeting}
        >
          {greeting}
        </Text>
      ) : null}
      {intro ? <Text style={sharedStyles.intro}>{intro}</Text> : null}
      <View style={sharedStyles.accentBar}>
        <View style={sharedStyles.accentBarPurple} />
        <View style={sharedStyles.accentBarCyan} />
      </View>
    </>
  )
}

export function PhotoSection({
  heading,
  url,
}: {
  heading: string
  url?: string | null
}) {
  if (!url) return null
  return (
    <Section heading={heading}>
      <View style={sharedStyles.photoFrame}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image */}
        <Image src={url} style={sharedStyles.image} />
      </View>
    </Section>
  )
}

export function QuoteSection({
  texto,
  autor,
}: {
  texto?: string | null
  autor?: string | null
}) {
  if (!texto?.trim()) return null
  return (
    <View style={sharedStyles.quoteBlock} wrap={false}>
      <Text style={sharedStyles.quoteText}>“{texto.trim()}”</Text>
      {autor?.trim() ? (
        <Text style={sharedStyles.quoteAuthor}>— {autor.trim()}</Text>
      ) : null}
    </View>
  )
}

export function Footer({ children }: { children: string }) {
  return (
    <View style={sharedStyles.footer} wrap={false}>
      <Text style={sharedStyles.footerText}>{children}</Text>
    </View>
  )
}
