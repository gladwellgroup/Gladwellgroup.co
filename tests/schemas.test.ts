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
