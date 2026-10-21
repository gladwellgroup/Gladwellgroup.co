import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  QUOTE_AUTHOR_MAX,
  QUOTE_AUTHOR_MIN,
  QUOTE_CONTEXT_MAX,
  QUOTE_SOURCE_MAX,
  QUOTE_TEXT_MAX,
  QUOTE_TEXT_MIN,
} from '@/lib/parrilla/quotes'
import { EDITABLE_KEYS, isHttpUrl } from '@/lib/parrilla/rules'
import {
  parrillaPostPatchSchema,
  parrillaPostSchema,
  parrillaPostShape,
  parrillaQuotePatchSchema,
  parrillaQuoteSchema,
  parrillaQuoteShape,
  parrillaRescheduleSchema,
} from '@/lib/validations/parrilla'

const UID = '11111111-1111-4111-8111-111111111111'

const minimo = {
  title: 'Pieza de prueba',
  platforms: ['instagram'],
  production_date: '2026-10-16',
  publish_date: '2026-10-16',
}

/** Primer mensaje de error, o null si el parseo fue exitoso. */
function firstError(result: { success: boolean; error?: { errors: { message: string }[] } }) {
  return result.success ? null : (result.error?.errors[0]?.message ?? '(sin mensaje)')
}

test('EDITABLE_KEYS coincide con las columnas del schema', () => {
  // Si falla: una columna se agregó (o quitó) en un lado y no en el otro, y el
  // formulario no la incluiría en lo que se guarda.
  assert.deepEqual([...EDITABLE_KEYS].sort(), Object.keys(parrillaPostShape).sort())
})

describe('crear (POST)', () => {
  test('acepta el mínimo y completa las listas con []', () => {
    const result = parrillaPostSchema.safeParse(minimo)
    assert.equal(result.success, true)
    if (result.success) {
      assert.deepEqual(result.data.filmmaker_ids, [])
      assert.deepEqual(result.data.editor_ids, [])
    }
  })

  test('texto vacío o en blanco se guarda como null; el resto se recorta', () => {
    const result = parrillaPostSchema.safeParse({
      ...minimo,
      copy_text: '   ',
      caption: '',
      talent: ' Ana ',
      cover_image_url: '',
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.copy_text, null)
      assert.equal(result.data.caption, null)
      assert.equal(result.data.talent, 'Ana')
      assert.equal(result.data.cover_image_url, null)
    }
  })

  test('Inspiración acepta enlaces http(s), recortados', () => {
    for (const link of [
      'https://www.instagram.com/reel/abc123/',
      'http://example.com/video',
      'HTTPS://YOUTU.BE/abc123?t=42&si=xyz',
      'https://www.tiktok.com/@cuenta/video/7123456789012345678',
    ]) {
      const result = parrillaPostSchema.safeParse({ ...minimo, inspiration_url: ` ${link} ` })
      assert.equal(result.success, true, link)
      if (result.success) assert.equal(result.data.inspiration_url, link)
    }
  })

  test('Inspiración vacía, en blanco u omitida se guarda como null', () => {
    for (const inspiration_url of ['', '   ', null]) {
      const result = parrillaPostSchema.safeParse({ ...minimo, inspiration_url })
      assert.equal(result.success, true, String(inspiration_url))
      if (result.success) assert.equal(result.data.inspiration_url, null)
    }
    assert.equal(parrillaPostSchema.safeParse(minimo).success, true)
  })

  test('Inspiración rechaza lo que no es un enlace http(s) — en especial javascript:', () => {
    const malos = [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://example.com/archivo',
      'file:///etc/passwd',
      'instagram.com/reel/abc123', // sin esquema
      'www.instagram.com/reel/abc123',
      'https://',
      'https:// con espacios',
      'https://example.com/a b',
      'solo texto',
    ]
    for (const inspiration_url of malos) {
      const result = parrillaPostSchema.safeParse({ ...minimo, inspiration_url })
      assert.equal(firstError(result), 'El enlace de inspiración no es válido', inspiration_url)
    }
  })

  test('Inspiración: el schema no acepta nada que la regla compartida (isHttpUrl) rechace', () => {
    // `isHttpUrl` es lo que decide si la interfaz dibuja un `<a href>`: si el schema dejara pasar
    // algo que ella rechaza, el enlace se guardaría y nunca se vería como enlace.
    const casos = [
      'https://example.com',
      'http://example.com/a?b=c#d',
      'HTTPS://EXAMPLE.COM/Reel',
      'javascript:alert(1)',
      'https://example.com/a b',
      'https://',
      'ftp://example.com',
      'example.com',
      'https://[',
    ]
    for (const inspiration_url of casos) {
      const ok = parrillaPostSchema.safeParse({ ...minimo, inspiration_url }).success
      if (ok) assert.equal(isHttpUrl(inspiration_url), true, inspiration_url)
    }
    for (const bueno of ['https://example.com', 'http://example.com/a?b=c#d', 'HTTPS://EXAMPLE.COM/Reel']) {
      assert.equal(parrillaPostSchema.safeParse({ ...minimo, inspiration_url: bueno }).success, true, bueno)
    }
  })

  test('Inspiración tiene un tope de 2048 caracteres (el mismo del CHECK de SQL)', () => {
    const base = 'https://example.com/'
    const justo = base + 'a'.repeat(2048 - base.length)
    assert.equal(justo.length, 2048)
    assert.equal(parrillaPostSchema.safeParse({ ...minimo, inspiration_url: justo }).success, true)
    assert.equal(
      firstError(parrillaPostSchema.safeParse({ ...minimo, inspiration_url: `${justo}a` })),
      'El enlace de inspiración no es válido'
    )
  })

  test('secciones ocultas: acepta [] y las cuatro claves; el POST completa []', () => {
    const sin = parrillaPostSchema.safeParse(minimo)
    assert.equal(sin.success, true)
    if (sin.success) assert.deepEqual(sin.data.hidden_sections, [])

    const todas = parrillaPostSchema.safeParse({
      ...minimo,
      hidden_sections: ['inspiracion', 'guion', 'copy', 'portada'],
    })
    assert.equal(todas.success, true)
    if (todas.success) assert.deepEqual(todas.data.hidden_sections, ['inspiracion', 'guion', 'copy', 'portada'])
  })

  test('secciones ocultas: una clave desconocida se rechaza, en español', () => {
    for (const hidden_sections of [['foto'], ['guion', 'titulo'], ['Guion'], [''], ['copy_text']]) {
      const result = parrillaPostSchema.safeParse({ ...minimo, hidden_sections })
      assert.equal(
        firstError(result),
        'Sección no válida. Recarga la página e inténtalo de nuevo.',
        JSON.stringify(hidden_sections)
      )
    }
    assert.equal(parrillaPostSchema.safeParse({ ...minimo, hidden_sections: 'guion' }).success, false)
    assert.equal(parrillaPostSchema.safeParse({ ...minimo, hidden_sections: null }).success, false)
  })

  test('acepta format y category null (Sin definir / Sin categoría)', () => {
    const result = parrillaPostSchema.safeParse({ ...minimo, format: null, category: null })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.format, null)
      assert.equal(result.data.category, null)
    }
  })

  test('acepta las 6 categorías vigentes', () => {
    for (const category of ['crecer', 'conectar', 'construir', 'aprender', 'roots', 'comunidad']) {
      assert.equal(parrillaPostSchema.safeParse({ ...minimo, category }).success, true, category)
    }
  })

  test('rechaza una categoría retirada, con mensaje en español', () => {
    for (const category of ['valor', 'prospeccion', 'viral']) {
      const result = parrillaPostSchema.safeParse({ ...minimo, category })
      assert.equal(
        firstError(result),
        'Categoría no válida. Recarga la página e inténtalo de nuevo.',
        category
      )
    }
  })

  test('los demás enums también responden en español', () => {
    assert.match(firstError(parrillaPostSchema.safeParse({ ...minimo, format: 'gif' }))!, /^Formato no válido/)
    assert.match(firstError(parrillaPostSchema.safeParse({ ...minimo, status: 'x' }))!, /^Estado no válido/)
    assert.match(
      firstError(parrillaPostSchema.safeParse({ ...minimo, platforms: ['tiktok'] }))!,
      /^Plataforma no válida/
    )
  })

  test('rechaza fechas imposibles', () => {
    for (const bad of ['2026-02-29', '2026-13-45', '2026-04-31']) {
      const result = parrillaPostSchema.safeParse({ ...minimo, production_date: bad })
      assert.equal(firstError(result), 'Fecha inválida', bad)
    }
  })

  test('sin fecha de publicación solo vale una pieza archivada', () => {
    const sinFecha = { title: minimo.title, platforms: minimo.platforms, production_date: minimo.production_date }

    for (const publish_date of [undefined, null, '']) {
      const result = parrillaPostSchema.safeParse({ ...sinFecha, publish_date })
      // '' no es una fecha: la rechaza el formato antes que la regla de la fecha faltante.
      assert.notEqual(firstError(result), null, String(publish_date))
    }
    assert.equal(
      firstError(parrillaPostSchema.safeParse({ ...sinFecha, publish_date: null })),
      'Falta la fecha de publicación'
    )

    const archivada = parrillaPostSchema.safeParse({ ...sinFecha, status: 'archivado', publish_date: null })
    assert.equal(archivada.success, true)
  })

  test('acepta los estados del flujo y ya no acepta cancelado', () => {
    for (const status of ['idea', 'agendado', 'en_produccion', 'programado', 'publicado', 'archivado']) {
      assert.equal(parrillaPostSchema.safeParse({ ...minimo, status }).success, true, status)
    }
    assert.match(
      firstError(parrillaPostSchema.safeParse({ ...minimo, status: 'cancelado' }))!,
      /^Estado no válido/
    )
  })

  test('rechaza publicar antes de producir y señala el campo de publicación', () => {
    const result = parrillaPostSchema.safeParse({
      ...minimo,
      production_date: '2026-10-20',
      publish_date: '2026-10-16',
    })
    assert.equal(result.success, false)
    if (!result.success) {
      const issue = result.error.errors[0]
      assert.equal(issue.message, 'La publicación no puede ser anterior a la producción')
      assert.deepEqual(issue.path, ['publish_date'])
    }
  })

  test('mensajes de título, plataformas e identificadores', () => {
    assert.equal(
      firstError(parrillaPostSchema.safeParse({ ...minimo, title: 'ab' })),
      'El título debe tener al menos 3 caracteres'
    )
    assert.equal(
      firstError(parrillaPostSchema.safeParse({ ...minimo, platforms: [] })),
      'Selecciona al menos una plataforma'
    )
    assert.equal(
      firstError(parrillaPostSchema.safeParse({ ...minimo, editor_ids: ['no-uuid'] })),
      'Identificador no válido'
    )
  })

  test('acepta ids válidos en las listas de equipo', () => {
    assert.equal(
      parrillaPostSchema.safeParse({ ...minimo, editor_ids: [UID], filmmaker_ids: [UID] }).success,
      true
    )
  })
})

describe('editar (PATCH)', () => {
  test('un parche vacío no inventa campos (los .default() no se aplican)', () => {
    const result = parrillaPostPatchSchema.safeParse({})
    assert.equal(result.success, true)
    if (result.success) assert.deepEqual(result.data, {})
  })

  test('valida lo que viene: título corto', () => {
    assert.equal(
      firstError(parrillaPostPatchSchema.safeParse({ title: 'ab' })),
      'El título debe tener al menos 3 caracteres'
    )
  })

  test('una sola fecha no dispara la regla de orden (la compara el servidor con la guardada)', () => {
    assert.equal(parrillaPostPatchSchema.safeParse({ production_date: '2026-12-30' }).success, true)
    assert.equal(parrillaPostPatchSchema.safeParse({ publish_date: '2020-01-01' }).success, true)
  })

  test('dos fechas en orden inverso sí se rechazan', () => {
    const result = parrillaPostPatchSchema.safeParse({
      production_date: '2026-10-20',
      publish_date: '2026-10-16',
    })
    assert.equal(firstError(result), 'La publicación no puede ser anterior a la producción')
  })

  test('null limpia y omitir no toca', () => {
    const limpia = parrillaPostPatchSchema.safeParse({ category: null, format: null, copy_text: '   ' })
    assert.equal(limpia.success, true)
    if (limpia.success) {
      assert.equal(limpia.data.category, null)
      assert.equal(limpia.data.format, null)
      assert.equal(limpia.data.copy_text, null)
    }

    const omite = parrillaPostPatchSchema.safeParse({ title: 'Nuevo título' })
    assert.equal(omite.success, true)
    if (omite.success) {
      assert.equal('category' in omite.data, false)
      assert.equal('caption' in omite.data, false)
    }
  })

  test('secciones ocultas en un parche: [] las muestra todas, omitir no las toca', () => {
    const muestra = parrillaPostPatchSchema.safeParse({ hidden_sections: [] })
    assert.equal(muestra.success, true)
    if (muestra.success) assert.deepEqual(muestra.data.hidden_sections, [])

    const oculta = parrillaPostPatchSchema.safeParse({ hidden_sections: ['portada'] })
    assert.equal(oculta.success, true)
    if (oculta.success) assert.deepEqual(oculta.data.hidden_sections, ['portada'])

    const omite = parrillaPostPatchSchema.safeParse({ title: 'Nuevo título' })
    assert.equal(omite.success, true)
    if (omite.success) assert.equal('hidden_sections' in omite.data, false, 'el parche no inventa []')

    assert.equal(parrillaPostPatchSchema.safeParse({ hidden_sections: ['otra'] }).success, false)
  })

  test('Inspiración en un parche: null la limpia, omitir no la toca, javascript: se rechaza', () => {
    const limpia = parrillaPostPatchSchema.safeParse({ inspiration_url: null })
    assert.equal(limpia.success, true)
    if (limpia.success) assert.equal(limpia.data.inspiration_url, null)

    const omite = parrillaPostPatchSchema.safeParse({ title: 'Nuevo título' })
    assert.equal(omite.success, true)
    if (omite.success) assert.equal('inspiration_url' in omite.data, false)

    assert.equal(
      firstError(parrillaPostPatchSchema.safeParse({ inspiration_url: 'javascript:alert(1)' })),
      'El enlace de inspiración no es válido'
    )
  })

  test('el token de concurrencia llega tal cual, con microsegundos y +00:00', () => {
    const token = '2026-10-16T12:34:56.123456+00:00'
    const result = parrillaPostPatchSchema.safeParse({ title: 'Nuevo', expected_updated_at: token })
    assert.equal(result.success, true)
    if (result.success) assert.equal(result.data.expected_updated_at, token)
  })

  test('un token vacío se rechaza', () => {
    assert.equal(parrillaPostPatchSchema.safeParse({ expected_updated_at: '' }).success, false)
  })
})

describe('reprogramar (arrastre)', () => {
  test('acepta un campo de fecha y una fecha real', () => {
    assert.equal(parrillaRescheduleSchema.safeParse({ field: 'publish_date', date: '2026-10-30' }).success, true)
  })

  test('rechaza otro campo o una fecha imposible', () => {
    assert.equal(parrillaRescheduleSchema.safeParse({ field: 'title', date: '2026-10-30' }).success, false)
    assert.equal(parrillaRescheduleSchema.safeParse({ field: 'publish_date', date: '2026-02-30' }).success, false)
  })
})

// ───────────── Frases de referentes (pestaña «Frases») ─────────────

const frase = {
  quote_text: 'La felicidad de tu vida depende de la calidad de tus pensamientos.',
  author: 'Marco Aurelio',
}

describe('frases: crear (POST)', () => {
  test('acepta el mínimo: los opcionales quedan sin valor', () => {
    const result = parrillaQuoteSchema.safeParse(frase)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.author_context ?? null, null)
      assert.equal(result.data.source ?? null, null)
      assert.equal(result.data.category ?? null, null)
    }
  })

  test('recorta, y el texto en blanco de los opcionales se guarda como null', () => {
    const result = parrillaQuoteSchema.safeParse({
      quote_text: '  Una frase  ',
      author: ' Séneca ',
      author_context: '   ',
      source: '',
      category: null,
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.deepEqual(result.data, {
        quote_text: 'Una frase',
        author: 'Séneca',
        author_context: null,
        source: null,
        category: null,
      })
    }
  })

  test('conserva el contenido de los opcionales, recortado', () => {
    const result = parrillaQuoteSchema.safeParse({
      ...frase,
      author_context: ' Emperador y filósofo estoico ',
      source: ' Meditaciones, libro V ',
      category: 'crecer',
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.author_context, 'Emperador y filósofo estoico')
      assert.equal(result.data.source, 'Meditaciones, libro V')
      assert.equal(result.data.category, 'crecer')
    }
  })

  test('los topes son los del CHECK de SQL: justo en el límite pasa, uno más se rechaza con su mensaje', () => {
    const justo = {
      quote_text: 'x'.repeat(QUOTE_TEXT_MAX),
      author: 'a'.repeat(QUOTE_AUTHOR_MAX),
      author_context: 'c'.repeat(QUOTE_CONTEXT_MAX),
      source: 's'.repeat(QUOTE_SOURCE_MAX),
    }
    assert.equal(parrillaQuoteSchema.safeParse(justo).success, true)

    assert.equal(
      firstError(parrillaQuoteSchema.safeParse({ ...justo, quote_text: `${justo.quote_text}x` })),
      `La frase no puede pasar de ${QUOTE_TEXT_MAX} caracteres`
    )
    assert.equal(
      firstError(parrillaQuoteSchema.safeParse({ ...justo, author: `${justo.author}a` })),
      `El referente no puede pasar de ${QUOTE_AUTHOR_MAX} caracteres`
    )
    assert.equal(
      firstError(parrillaQuoteSchema.safeParse({ ...justo, author_context: `${justo.author_context}c` })),
      `«Quién fue» no puede pasar de ${QUOTE_CONTEXT_MAX} caracteres`
    )
    assert.equal(
      firstError(parrillaQuoteSchema.safeParse({ ...justo, source: `${justo.source}s` })),
      `La fuente no puede pasar de ${QUOTE_SOURCE_MAX} caracteres`
    )
  })

  test('los mínimos: 3 caracteres la frase y 2 el referente', () => {
    assert.equal(parrillaQuoteSchema.safeParse({ quote_text: 'abc', author: 'Yo' }).success, true)
    assert.equal(
      firstError(parrillaQuoteSchema.safeParse({ ...frase, quote_text: 'ab' })),
      `La frase debe tener al menos ${QUOTE_TEXT_MIN} caracteres`
    )
    assert.equal(
      firstError(parrillaQuoteSchema.safeParse({ ...frase, author: 'Y' })),
      `El referente debe tener al menos ${QUOTE_AUTHOR_MIN} caracteres`
    )
  })

  test('una frase o un referente de solo espacios no pasa: el recorte lo deja vacío', () => {
    assert.equal(firstError(parrillaQuoteSchema.safeParse({ ...frase, quote_text: '      ' })) !== null, true)
    assert.equal(firstError(parrillaQuoteSchema.safeParse({ ...frase, author: '     ' })) !== null, true)
  })

  test('la frase y el referente son obligatorios, con su mensaje', () => {
    assert.equal(firstError(parrillaQuoteSchema.safeParse({ author: 'Séneca' })), 'Escribe la frase')
    assert.equal(firstError(parrillaQuoteSchema.safeParse({ quote_text: 'Una frase' })), 'Escribe el referente')
    assert.equal(firstError(parrillaQuoteSchema.safeParse({ quote_text: 5, author: 'Séneca' })), 'La frase no es válida')
  })

  test('categoría: null y omitida valen; una desconocida o retirada se rechaza', () => {
    for (const category of [null, undefined, 'crecer', 'conectar', 'construir', 'aprender', 'roots', 'comunidad']) {
      assert.equal(parrillaQuoteSchema.safeParse({ ...frase, category }).success, true, String(category))
    }
    for (const category of ['valor', 'prospeccion', 'Crecer', '']) {
      assert.equal(
        firstError(parrillaQuoteSchema.safeParse({ ...frase, category })),
        'Categoría no válida. Recarga la página e inténtalo de nuevo.',
        category
      )
    }
  })

  test('un cuerpo que no es un objeto se rechaza en español, no con el «Expected object» de zod', () => {
    for (const body of ['hola', 5, null, [], undefined]) {
      assert.equal(firstError(parrillaQuoteSchema.safeParse(body)), 'Datos inválidos', JSON.stringify(body))
      assert.equal(firstError(parrillaQuotePatchSchema.safeParse(body)), 'Datos inválidos', JSON.stringify(body))
    }
  })

  test('descarta lo que no es suyo: id, created_by, updated_at y used_count nunca llegan a la base', () => {
    const result = parrillaQuoteSchema.safeParse({
      ...frase,
      id: 'otro',
      created_by: '99999999-9999-4999-8999-999999999999',
      updated_at: '2000-01-01',
      used_count: 9,
    })
    assert.equal(result.success, true)
    if (result.success) {
      const allowed = Object.keys(parrillaQuoteShape)
      assert.deepEqual(
        Object.keys(result.data).filter((key) => !allowed.includes(key)),
        []
      )
    }
  })
})

describe('frases: editar (PATCH)', () => {
  test('un parche vacío no es una edición', () => {
    for (const body of [{}, { author: undefined }]) {
      assert.equal(firstError(parrillaQuotePatchSchema.safeParse(body)), 'No hay nada que guardar')
    }
  })

  test('un solo campo basta, recortado: lo que no llega no se toca', () => {
    const result = parrillaQuotePatchSchema.safeParse({ author: ' Séneca ' })
    assert.equal(result.success, true)
    if (result.success) assert.deepEqual(result.data, { author: 'Séneca' })
  })

  test('null (o el texto en blanco) limpia los opcionales', () => {
    const result = parrillaQuotePatchSchema.safeParse({ source: null, author_context: '  ', category: null })
    assert.equal(result.success, true)
    if (result.success) assert.deepEqual(result.data, { source: null, author_context: null, category: null })
  })

  test('los mismos límites y mensajes que al crear; omitir un campo no lo vuelve «vacío»', () => {
    assert.equal(
      firstError(parrillaQuotePatchSchema.safeParse({ quote_text: '   ' })),
      `La frase debe tener al menos ${QUOTE_TEXT_MIN} caracteres`
    )
    assert.equal(
      firstError(parrillaQuotePatchSchema.safeParse({ source: 's'.repeat(QUOTE_SOURCE_MAX + 1) })),
      `La fuente no puede pasar de ${QUOTE_SOURCE_MAX} caracteres`
    )
    assert.equal(
      firstError(parrillaQuotePatchSchema.safeParse({ category: 'valor' })),
      'Categoría no válida. Recarga la página e inténtalo de nuevo.'
    )
  })

  test('descarta lo que no es editable', () => {
    const result = parrillaQuotePatchSchema.safeParse({ author: 'Séneca', id: 'x', created_by: 'y', used_count: 3 })
    assert.equal(result.success, true)
    if (result.success) assert.deepEqual(result.data, { author: 'Séneca' })
  })
})

describe('quote_id: la frase de la que nace una pieza', () => {
  const QUOTE_ID = '20000000-0000-4000-8000-000000000002'

  test('crear acepta un uuid, null y omitido', () => {
    for (const quote_id of [QUOTE_ID, null, undefined]) {
      const result = parrillaPostSchema.safeParse({ ...minimo, quote_id })
      assert.equal(result.success, true, String(quote_id))
    }
    const withId = parrillaPostSchema.safeParse({ ...minimo, quote_id: QUOTE_ID })
    assert.equal(withId.success && withId.data.quote_id, QUOTE_ID)
  })

  test('rechaza lo que no es un uuid', () => {
    for (const quote_id of ['no-es-uuid', '', 5]) {
      assert.equal(
        firstError(parrillaPostSchema.safeParse({ ...minimo, quote_id })),
        'Identificador no válido',
        String(quote_id)
      )
    }
  })

  test('solo existe al crear: el PATCH de piezas lo descarta, nadie lo edita después', () => {
    const result = parrillaPostPatchSchema.safeParse({ title: 'Nuevo', quote_id: QUOTE_ID })
    assert.equal(result.success, true)
    if (result.success) assert.ok(!('quote_id' in result.data), 'el vínculo no debe poder cambiarse por PATCH')
  })

  test('no es un campo editable: ni está en el schema compartido ni en EDITABLE_KEYS', () => {
    assert.ok(!('quote_id' in parrillaPostShape))
    assert.ok(!(EDITABLE_KEYS as readonly string[]).includes('quote_id'))
  })
})

describe('frases: largo como la base (puntos de código) y comillas envolventes', () => {
  const emoji = '😀' // 1 punto de código para Postgres, 2 unidades para JS

  test('un referente de un solo emoji mide 1 y se rechaza, como lo haría el CHECK de SQL', () => {
    assert.equal(
      firstError(parrillaQuoteSchema.safeParse({ ...frase, author: emoji })),
      `El referente debe tener al menos ${QUOTE_AUTHOR_MIN} caracteres`
    )
    assert.equal(parrillaQuoteSchema.safeParse({ ...frase, author: emoji.repeat(2) }).success, true)
  })

  test('una frase de 2 emojis mide 2 y se rechaza; de 3 pasa', () => {
    assert.equal(
      firstError(parrillaQuoteSchema.safeParse({ ...frase, quote_text: emoji.repeat(2) })),
      `La frase debe tener al menos ${QUOTE_TEXT_MIN} caracteres`
    )
    assert.equal(parrillaQuoteSchema.safeParse({ ...frase, quote_text: emoji.repeat(3) }).success, true)
  })

  test('los topes también cuentan puntos de código: justo en el límite pasa y uno más se rechaza', () => {
    const ok = (data: object) => parrillaQuoteSchema.safeParse({ ...frase, ...data }).success
    assert.equal(ok({ quote_text: emoji.repeat(QUOTE_TEXT_MAX) }), true, '500 emojis son 500, no 1000')
    assert.equal(ok({ quote_text: emoji.repeat(QUOTE_TEXT_MAX + 1) }), false)
    assert.equal(ok({ author: emoji.repeat(QUOTE_AUTHOR_MAX) }), true)
    assert.equal(ok({ author: emoji.repeat(QUOTE_AUTHOR_MAX + 1) }), false)
    assert.equal(ok({ author_context: emoji.repeat(QUOTE_CONTEXT_MAX) }), true)
    assert.equal(ok({ author_context: emoji.repeat(QUOTE_CONTEXT_MAX + 1) }), false)
    assert.equal(ok({ source: emoji.repeat(QUOTE_SOURCE_MAX) }), true)
    assert.equal(ok({ source: emoji.repeat(QUOTE_SOURCE_MAX + 1) }), false)
  })

  test('las comillas que envuelven la frase se quitan ANTES de medirla', () => {
    const ok = parrillaQuoteSchema.safeParse({ ...frase, quote_text: '“Quien no arriesga no gana”' })
    assert.equal(ok.success && ok.data.quote_text, 'Quien no arriesga no gana')
    // «“ab”» mide 2 una vez sin comillas: no llega al mínimo de 3.
    assert.equal(
      firstError(parrillaQuoteSchema.safeParse({ ...frase, quote_text: '“ab”' })),
      `La frase debe tener al menos ${QUOTE_TEXT_MIN} caracteres`
    )
    // Dos citas no son una frase entre comillas: se respetan.
    const dos = parrillaQuoteSchema.safeParse({ ...frase, quote_text: '"A" y "B"' })
    assert.equal(dos.success && dos.data.quote_text, '"A" y "B"')
  })

  test('en el PATCH también', () => {
    const patch = parrillaQuotePatchSchema.safeParse({ quote_text: '«Quien no arriesga no gana»' })
    assert.equal(patch.success && patch.data.quote_text, 'Quien no arriesga no gana')
  })
})
