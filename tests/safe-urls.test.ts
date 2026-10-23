import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { normalizeHttpUrl } from '@/lib/url'
import { isProjectStorageUrl } from '@/lib/storage/hosts'
import { BodyTooLargeError, readLimited } from '@/lib/http/read-limited'
import { educationInputsSchema, educationToolSchema } from '@/lib/validations/education'
import { audioMetaSchema, therapyInputsSchema } from '@/lib/validations/therapy'
import { buildEducationHtml, type EducationContent } from '@/lib/education/deliverable-template'

// El campo «enlace» de una herramienta de Education llegaba tal cual a un `<a href>` del correo y de la vista previa: un
// `javascript:` se ejecutaba al hacer clic. Y las URL de audio y de fotos se aceptaban de cualquier host mientras el
// servidor las DESCARGA (SSRF) sin mirar el tamaño hasta haberlo bajado todo.

const ROOT = process.cwd()
const code = (file: string) =>
  fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('normalizeHttpUrl', () => {
  test('acepta enlaces http(s) y los devuelve normalizados', () => {
    assert.equal(normalizeHttpUrl('https://notion.so/guia'), 'https://notion.so/guia')
    assert.equal(normalizeHttpUrl('  http://example.com  '), 'http://example.com/')
    assert.equal(normalizeHttpUrl('HTTPS://Example.com/A'), 'https://example.com/A')
  })

  test('sin esquema asume https (como la barra de direcciones; antes salía un enlace relativo roto)', () => {
    assert.equal(normalizeHttpUrl('gladwell.co/herramienta'), 'https://gladwell.co/herramienta')
    assert.equal(normalizeHttpUrl('www.notion.so'), 'https://www.notion.so/')
  })

  test('rechaza todo esquema que no sea http(s), también disfrazado', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      '\u0001javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com/x',
      'mailto:a@b.co',
      'tel:+573001234567',
    ]) {
      assert.equal(normalizeHttpUrl(bad), null, JSON.stringify(bad))
    }
  })

  test('una entidad HTML disfrazando el esquema no puede convertirse en `javascript:`: sale como un enlace https (y se escapa al dibujarlo)', () => {
    const result = normalizeHttpUrl('jav&#x61;script:alert(1)')
    assert.ok(result === null || result.startsWith('https://'), String(result))
  })

  test('vacío, espacios o null → null', () => {
    for (const empty of ['', '   ', null, undefined]) assert.equal(normalizeHttpUrl(empty), null)
  })
})

describe('isProjectStorageUrl', () => {
  const PROJECT = 'https://proj.supabase.co'
  const ok = `${PROJECT}/storage/v1/object/public/therapy-media/audio/a.webm`

  test('un archivo público del Storage del proyecto vale', () => {
    assert.equal(isProjectStorageUrl(ok, PROJECT), true)
    assert.equal(isProjectStorageUrl(`${ok}?t=1`, PROJECT), true)
  })

  test('otro host, otro esquema o puerto, o un parecido engañoso: no', () => {
    for (const bad of [
      'https://evil.com/storage/v1/object/public/x',
      'http://proj.supabase.co/storage/v1/object/public/x',
      'https://proj.supabase.co:8443/storage/v1/object/public/x',
      'https://proj.supabase.co.evil.com/storage/v1/object/public/x',
      'https://proj.supabase.co@evil.com/storage/v1/object/public/x',
      'https://evil.com/?https://proj.supabase.co/storage/v1/object/public/x',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:3000/api/secret',
    ]) {
      assert.equal(isProjectStorageUrl(bad, PROJECT), false, bad)
    }
  })

  test('del mismo proyecto pero fuera de la ruta pública de Storage: no (la API REST, las firmadas, el dashboard)', () => {
    for (const bad of [`${PROJECT}/rest/v1/profiles`, `${PROJECT}/storage/v1/object/sign/x`, `${PROJECT}/auth/v1/user`, `${PROJECT}/`]) {
      assert.equal(isProjectStorageUrl(bad, PROJECT), false, bad)
    }
  })

  test('sin URL del proyecto configurada no se acepta ninguna; una URL inválida tampoco', () => {
    assert.equal(isProjectStorageUrl(ok, ''), false)
    assert.equal(isProjectStorageUrl('no es una url', PROJECT), false)
    assert.equal(isProjectStorageUrl(null, PROJECT), false)
    assert.equal(isProjectStorageUrl('', PROJECT), false)
  })
})

describe('esquemas: enlaces y archivos', () => {
  const PROJECT = 'https://proj.supabase.co'
  const storage = `${PROJECT}/storage/v1/object/public/education-media/foto.jpg`
  const SESSION = '33333333-3333-3333-3333-333333333333'
  let before: string | undefined
  beforeEach(() => {
    before = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROJECT
  })
  afterEach(() => {
    if (before === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = before
  })

  test('herramienta: un enlace http(s) o un dominio pelado pasan; `javascript:` y similares no', () => {
    for (const url of ['https://notion.so', 'notion.so/guia', '', undefined]) {
      assert.equal(educationToolSchema.safeParse({ nombre: 'Notion', url }).success, true, String(url))
    }
    for (const url of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'java\tscript:alert(1)']) {
      const result = educationToolSchema.safeParse({ nombre: 'Notion', url })
      assert.equal(result.success, false, url)
      if (!result.success) assert.match(result.error.errors[0].message, /http\(s\)/)
    }
  })

  test('Education: foto y audio solo del Storage del proyecto (vacío sigue valiendo)', () => {
    for (const field of ['ponente_foto_url', 'foto_sesion_url', 'audio_url']) {
      assert.equal(educationInputsSchema.safeParse({ session_id: SESSION, [field]: storage }).success, true, field)
      assert.equal(educationInputsSchema.safeParse({ session_id: SESSION, [field]: '' }).success, true, `${field} vacío`)
      assert.equal(educationInputsSchema.safeParse({ session_id: SESSION, [field]: 'https://evil.com/a.jpg' }).success, false, `${field} externo`)
      assert.equal(educationInputsSchema.safeParse({ session_id: SESSION, [field]: 'http://169.254.169.254/latest' }).success, false, `${field} interno`)
    }
  })

  test('Terapia: la foto de la sesión y el audio también', () => {
    assert.equal(therapyInputsSchema.safeParse({ session_id: SESSION, foto_sesion_url: storage }).success, true)
    assert.equal(therapyInputsSchema.safeParse({ session_id: SESSION, foto_sesion_url: 'https://evil.com/a.jpg' }).success, false)
    assert.equal(audioMetaSchema.safeParse({ session_id: SESSION, audio_url: storage }).success, true)
    assert.equal(audioMetaSchema.safeParse({ session_id: SESSION, audio_url: 'https://evil.com/a.webm' }).success, false)
  })
})

describe('la plantilla del correo', () => {
  const content = (url: string): EducationContent => ({
    sessionTitle: 'Sesión',
    conclusionesClave: 'Una conclusión',
    capsulas: '',
    tools: [{ nombre: 'Herramienta', url }],
  })

  test('un `javascript:` ya no llega a ningún href', () => {
    const html = buildEducationHtml(content('javascript:alert(document.cookie)'))
    assert.doesNotMatch(html, /href="javascript:/i)
    assert.doesNotMatch(html, /javascript:/i)
    assert.match(html, /Herramienta/, 'la herramienta sigue apareciendo, sin enlace')
  })

  test('un enlace normal es un enlace, y uno sin esquema se completa con https', () => {
    assert.match(buildEducationHtml(content('https://notion.so/guia')), /<a href="https:\/\/notion\.so\/guia"/)
    assert.match(buildEducationHtml(content('notion.so/guia')), /<a href="https:\/\/notion\.so\/guia"/)
  })
})

describe('readLimited', () => {
  const streamOf = (chunks: Uint8Array[], onCancel?: () => void) =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk)
          controller.close()
        },
        cancel: onCancel,
      })
    )
  const bytes = (n: number) => new Uint8Array(n).fill(7)

  test('devuelve el cuerpo completo si cabe en el límite', async () => {
    const buffer = await readLimited(streamOf([bytes(10), bytes(20)]), 30)
    assert.equal(buffer.byteLength, 30)
    assert.deepEqual([...new Uint8Array(buffer).slice(0, 3)], [7, 7, 7])
  })

  test('corta en cuanto se supera, sin esperar a bajarlo todo, y cancela la descarga', async () => {
    let cancelled = false
    const big = new Response(
      new ReadableStream({
        pull(controller) {
          controller.enqueue(bytes(1024))
        },
        cancel() {
          cancelled = true
        },
      })
    )
    await assert.rejects(readLimited(big, 4096), BodyTooLargeError)
    assert.equal(cancelled, true, 'el flujo infinito se canceló: no se siguió descargando')
  })

  test('un cuerpo vacío son cero bytes', async () => {
    assert.equal((await readLimited(new Response(null), 10)).byteLength, 0)
  })
})

describe('los puntos del servidor que descargan archivos', () => {
  test('la transcripción exige el Storage del proyecto y acota los bytes leyendo el flujo', () => {
    const source = code('lib/therapy/synthesize.ts')
    assert.match(source, /if \(!isProjectStorageUrl\(audioUrl\)\) \{\s*throw new Error/)
    assert.match(source, /readLimited\(audioRes, WHISPER_MAX_BYTES\)/)
    assert.doesNotMatch(source, /audioRes\.arrayBuffer\(\)/)
  })

  test('la foto del PDF solo se mide si es del Storage del proyecto, y con tope de tamaño', () => {
    const source = code('lib/deliverables/pdf-blocks.tsx')
    assert.match(source, /if \(!isProjectStorageUrl\(url\)\) return 220/)
    assert.match(source, /readLimited\(res, PHOTO_MAX_BYTES\)/)
  })

  test('la plantilla y el PDF solo dibujan enlaces http(s)', () => {
    assert.match(code('lib/education/deliverable-template.ts'), /const href = normalizeHttpUrl\(tool\.url\)/)
    assert.match(code('lib/education/deliverable-pdf.tsx'), /normalizeHttpUrl\(tool\.url\)/)
    assert.doesNotMatch(code('lib/education/deliverable-pdf.tsx'), /<Link src=\{tool\.url/)
  })
})
