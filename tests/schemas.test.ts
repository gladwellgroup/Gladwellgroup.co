import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { EDITABLE_KEYS } from '@/lib/parrilla/rules'
import {
  parrillaPostPatchSchema,
  parrillaPostSchema,
  parrillaPostShape,
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
