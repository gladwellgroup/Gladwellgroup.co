import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
} from '@react-pdf/renderer'
import {
  educationIntroText,
  type EducationContent,
  type EducationTool,
} from '@/lib/education/deliverable-template'
import { firstName } from '@/lib/deliverables/names'
import {
  BODY,
  BulletList,
  CONTENT_WIDTH,
  DocumentHeader,
  Footer,
  HAIRLINE,
  INK,
  MUTED,
  PAGE_PADDING_BOTTOM,
  PAGE_PADDING_TOP,
  PAGE_WIDTH,
  PURPLE,
  PhotoSection,
  QuoteSection,
  SECTION_HEADING_HEIGHT,
  Section,
  estimateBulletsHeight,
  estimateLines,
  getPhotoDisplayHeight,
  sharedStyles as styles,
} from '@/lib/deliverables/pdf-blocks'
import { renderFitToOnePage } from '@/lib/deliverables/pdf-render'

const educationStyles = StyleSheet.create({
  // Foto arriba, texto debajo, todo centrado — igual que el correo HTML: el
  // ponente se lee como una unidad, no como una fila foto+texto.
  ponenteBlock: {
    alignItems: 'center',
    marginBottom: 26,
  },
  ponenteFoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    objectFit: 'cover',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  ponenteEyebrow: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PURPLE,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  ponenteNombre: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    marginTop: 3,
    textAlign: 'center',
  },
  ponenteRol: {
    fontSize: 10,
    color: MUTED,
    marginTop: 1,
    textAlign: 'center',
  },
  toolRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  toolMarker: {
    width: 14,
    color: PURPLE,
    fontFamily: 'Helvetica-Bold',
  },
  toolBody: {
    flex: 1,
  },
  toolNombre: {
    fontFamily: 'Helvetica-Bold',
    color: INK,
  },
  toolNombreLink: {
    fontFamily: 'Helvetica-Bold',
    color: PURPLE,
    textDecoration: 'none',
  },
  toolDescripcion: {
    color: BODY,
  },
})

// Apilado (foto arriba, texto debajo) ocupa más alto que la fila anterior;
// el helper de reintento (renderFitToOnePage) corrige si esto se queda corto.
const PONENTE_BLOCK_HEIGHT = 165

function validTools(tools: EducationTool[]): EducationTool[] {
  return tools.filter((tool) => tool.nombre?.trim())
}

function toolLineText(tool: EducationTool): string {
  return tool.descripcion?.trim()
    ? `${tool.nombre.trim()} — ${tool.descripcion.trim()}`
    : tool.nombre.trim()
}

function estimateToolsHeight(tools: EducationTool[]): number {
  const items = validTools(tools)
  if (items.length === 0) return 10.5 * 1.55 + 6

  let height = 0
  for (const tool of items) {
    height +=
      estimateLines(toolLineText(tool), 10.5, CONTENT_WIDTH - 14) *
        10.5 *
        1.55 +
      8
  }
  return height
}

async function estimatePageHeight(content: EducationContent): Promise<number> {
  let height = PAGE_PADDING_TOP + PAGE_PADDING_BOTTOM

  height += 26 + 20 // logo + marginBottom
  height += 9 * 1.2 + 8 // eyebrow

  height += estimateLines(content.sessionTitle, 19, CONTENT_WIDTH) * 19 * 1.3 + 10

  if (content.sessionDate) height += 10 * 1.2 + 16

  if (content.attendeeNombre?.trim()) {
    height += 11 * 1.3 + 16
  }

  height += 3 + 28 // barra de acento

  if (content.ponenteNombre?.trim()) height += PONENTE_BLOCK_HEIGHT

  height += SECTION_HEADING_HEIGHT + estimateBulletsHeight(content.conclusionesClave, 10.5, 1.55) + 22
  height += SECTION_HEADING_HEIGHT + estimateToolsHeight(content.tools) + 22
  height += SECTION_HEADING_HEIGHT + estimateBulletsHeight(content.capsulas, 10.5, 1.55) + 22

  if (content.fotoSesionUrl) {
    const photoHeight = await getPhotoDisplayHeight(content.fotoSesionUrl)
    height += SECTION_HEADING_HEIGHT + 8 + 2 + photoHeight + 22
  }

  // Frase de cierre, que en Education va después de la foto de la sesión
  if (content.fraseTexto?.trim()) {
    height += 16
    height +=
      estimateLines(content.fraseTexto.trim(), 11.5, CONTENT_WIDTH) * 11.5 * 1.3 + 6
    if (content.fraseAutor?.trim()) height += 9.5 * 1.2
    height += 10
  }

  height += 10 + 8 * 1.2 // footer

  // Margen de seguridad: la estimación de ancho de carácter es aproximada.
  height += 48

  return Math.ceil(height)
}

function Ponente({ content }: { content: EducationContent }) {
  const nombre = content.ponenteNombre?.trim()
  if (!nombre) return null

  return (
    <View style={educationStyles.ponenteBlock} wrap={false}>
      {content.ponenteFotoUrl ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
        <Image src={content.ponenteFotoUrl} style={educationStyles.ponenteFoto} />
      ) : null}
      <Text style={educationStyles.ponenteEyebrow}>PONENTE</Text>
      <Text style={educationStyles.ponenteNombre}>{nombre}</Text>
      {content.ponenteRol?.trim() ? (
        <Text style={educationStyles.ponenteRol}>
          {content.ponenteRol.trim()}
        </Text>
      ) : null}
    </View>
  )
}

function ToolList({ tools }: { tools: EducationTool[] }) {
  const items = validTools(tools)
  if (items.length === 0) {
    return <Text style={styles.emptyBody}>Sin contenido</Text>
  }

  return (
    <>
      {items.map((tool, i) => (
        <View key={i} style={educationStyles.toolRow}>
          <Text style={educationStyles.toolMarker}>•</Text>
          <Text style={educationStyles.toolBody}>
            {tool.url?.trim() ? (
              <Link src={tool.url.trim()} style={educationStyles.toolNombreLink}>
                {tool.nombre.trim()}
              </Link>
            ) : (
              <Text style={educationStyles.toolNombre}>{tool.nombre.trim()}</Text>
            )}
            {tool.descripcion?.trim() ? (
              <Text style={educationStyles.toolDescripcion}>
                {' '}
                — {tool.descripcion.trim()}
              </Text>
            ) : null}
          </Text>
        </View>
      ))}
    </>
  )
}

function EducationDocument({
  content,
  pageHeight,
}: {
  content: EducationContent
  pageHeight: number
}) {
  return (
    <Document
      title={`Gladwell Education — ${content.sessionTitle}`}
      author="Gladwell"
    >
      <Page size={[PAGE_WIDTH, pageHeight]} style={styles.page}>
        <DocumentHeader
          eyebrow="ENTREGABLE DE LA SESIÓN"
          title={content.sessionTitle}
          dateLine={content.sessionDate}
          greeting={
            content.attendeeNombre?.trim()
              ? `Hola ${firstName(content.attendeeNombre)},`
              : null
          }
          intro={
            content.attendeeNombre?.trim()
              ? educationIntroText(content)
              : null
          }
        />

        <Ponente content={content} />

        <Section heading="Conclusiones clave">
          <BulletList text={content.conclusionesClave} />
        </Section>

        <Section heading="Herramientas recomendadas">
          <ToolList tools={content.tools} />
        </Section>

        <Section heading="Cápsulas de emprendimiento">
          <BulletList text={content.capsulas} />
        </Section>

        <PhotoSection heading="Foto de la sesión" url={content.fotoSesionUrl} />

        <QuoteSection texto={content.fraseTexto} autor={content.fraseAutor} />

        <Footer>Gladwell Education</Footer>
      </Page>
    </Document>
  )
}

export async function buildEducationPdfBuffer(
  content: EducationContent
): Promise<Buffer> {
  const initialHeight = await estimatePageHeight(content)
  return renderFitToOnePage(
    (pageHeight) => (
      <EducationDocument content={content} pageHeight={pageHeight} />
    ),
    initialHeight
  )
}
