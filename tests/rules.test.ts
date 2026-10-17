import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { PARRILLA_CATEGORIES } from '@/lib/parrilla/posts'
import {
  EDITABLE_KEYS,
  datesInOrder,
  diffPost,
  isAssignedTo,
  isRealDateOnly,
  isUuid,
  mergeLatest,
  normalizeFields,
  sectionHasContent,
  showsFilmmaker,
  showsInspiration,
  showsTalent,
  type EditableFields,
} from '@/lib/parrilla/rules'

const UID_A = '11111111-1111-4111-8111-111111111111'
const UID_B = '22222222-2222-4222-8222-222222222222'
const UID_C = '33333333-3333-4333-8333-333333333333'

function fields(overrides: Partial<EditableFields> = {}): EditableFields {
  return {
    title: 'Pieza de prueba',
    copy_text: null,
    caption: null,
    platforms: ['instagram'],
    production_date: '2026-10-16',
    publish_date: '2026-10-20',
    status: 'idea',
    format: 'video',
    cover_image_url: null,
    talent: null,
    inspiration_url: null,
    hidden_sections: [],
    filmmaker_ids: [],
    editor_ids: [],
    category: 'crecer',
    ...overrides,
  }
}

describe('qué campos aplican', () => {
  test('Responsable en cámara solo en video', () => {
    assert.equal(showsTalent('video'), true)
    assert.equal(showsTalent('imagen'), false)
    assert.equal(showsTalent('carrusel'), false)
    assert.equal(showsTalent(null), false)
  })

  test('Inspiración solo en video', () => {
    assert.equal(showsInspiration('video'), true)
    assert.equal(showsInspiration('imagen'), false)
    assert.equal(showsInspiration('carrusel'), false)
    assert.equal(showsInspiration(null), false)
  })

  test('Filmmaker: video siempre, con cualquier categoría o sin ella', () => {
    for (const category of PARRILLA_CATEGORIES) assert.equal(showsFilmmaker('video', category), true)
    assert.equal(showsFilmmaker('video', null), true)
  })

  test('Filmmaker: imagen y carrusel solo con roots o comunidad', () => {
    for (const format of ['imagen', 'carrusel'] as const) {
      for (const category of PARRILLA_CATEGORIES) {
        const esperado = category === 'roots' || category === 'comunidad'
        assert.equal(showsFilmmaker(format, category), esperado, `${format} + ${category}`)
      }
      assert.equal(showsFilmmaker(format, null), false)
    }
  })

  test('Filmmaker: sin formato definido nunca aplica', () => {
    for (const category of PARRILLA_CATEGORIES) assert.equal(showsFilmmaker(null, category), false)
    assert.equal(showsFilmmaker(null, null), false)
  })
})

describe('sectionHasContent (la marca «con contenido» de una sección oculta)', () => {
  test('cada sección mira su propia columna', () => {
    assert.equal(sectionHasContent(fields({ inspiration_url: 'https://x.com/a' }), 'inspiracion'), true)
    assert.equal(sectionHasContent(fields({ copy_text: 'Hook…' }), 'guion'), true)
    assert.equal(sectionHasContent(fields({ caption: '#gladwell' }), 'copy'), true)
    assert.equal(sectionHasContent(fields({ cover_image_url: 'https://x.com/p.jpg' }), 'portada'), true)
  })

  test('el contenido de una sección no cuenta para las otras', () => {
    const solo = fields({ copy_text: 'Solo guion' })
    assert.equal(sectionHasContent(solo, 'guion'), true)
    for (const otra of ['inspiracion', 'copy', 'portada'] as const) {
      assert.equal(sectionHasContent(solo, otra), false, otra)
    }
  })

  test('null, vacío y solo espacios son lo mismo: sin contenido', () => {
    for (const value of [null, '', '   ', '\n\t']) {
      const vacia = fields({ inspiration_url: value, copy_text: value, caption: value, cover_image_url: value })
      for (const section of ['inspiracion', 'guion', 'copy', 'portada'] as const) {
        assert.equal(sectionHasContent(vacia, section), false, `${JSON.stringify(value)} → ${section}`)
      }
    }
  })
})

describe('normalizeFields', () => {
  test('limpia Responsable en cámara cuando el formato no es video', () => {
    assert.equal(normalizeFields(fields({ format: 'imagen', talent: 'Ana' })).talent, null)
    assert.equal(normalizeFields(fields({ format: null, talent: 'Ana' })).talent, null)
  })

  test('conserva (recortado) el Responsable en cámara en video', () => {
    assert.equal(normalizeFields(fields({ format: 'video', talent: '  Ana  ' })).talent, 'Ana')
  })

  test('limpia la Inspiración cuando el formato no es video', () => {
    const link = 'https://www.instagram.com/reel/abc123/'
    assert.equal(normalizeFields(fields({ format: 'imagen', inspiration_url: link })).inspiration_url, null)
    assert.equal(normalizeFields(fields({ format: 'carrusel', inspiration_url: link })).inspiration_url, null)
    assert.equal(normalizeFields(fields({ format: null, inspiration_url: link })).inspiration_url, null)
  })

  test('conserva (recortada) la Inspiración en video; en blanco pasa a null', () => {
    const link = 'https://www.instagram.com/reel/abc123/'
    assert.equal(normalizeFields(fields({ format: 'video', inspiration_url: `  ${link}  ` })).inspiration_url, link)
    assert.equal(normalizeFields(fields({ format: 'video', inspiration_url: '   ' })).inspiration_url, null)
    assert.equal(normalizeFields(fields({ format: 'video', inspiration_url: '' })).inspiration_url, null)
  })

  test('limpia Filmmaker cuando la combinación lo oculta', () => {
    const oculto = fields({ format: 'imagen', category: 'crecer', filmmaker_ids: [UID_A] })
    assert.deepEqual(normalizeFields(oculto).filmmaker_ids, [])
  })

  test('conserva Filmmaker cuando aplica', () => {
    const visible = fields({ format: 'imagen', category: 'roots', filmmaker_ids: [UID_A] })
    assert.deepEqual(normalizeFields(visible).filmmaker_ids, [UID_A])
    assert.deepEqual(normalizeFields(fields({ filmmaker_ids: [UID_A] })).filmmaker_ids, [UID_A])
  })

  test('un solo valor para "vacío": texto en blanco pasa a null', () => {
    const out = normalizeFields(fields({ copy_text: '   ', caption: '', cover_image_url: '' }))
    assert.equal(out.copy_text, null)
    assert.equal(out.caption, null)
    assert.equal(out.cover_image_url, null)
  })

  test('recorta el título y el texto con contenido', () => {
    const out = normalizeFields(fields({ title: '  Hola  ', caption: '  #gladwell  ' }))
    assert.equal(out.title, 'Hola')
    assert.equal(out.caption, '#gladwell')
  })

  test('archivar borra la fecha de publicación; en cualquier otro estado se conserva', () => {
    assert.equal(
      normalizeFields(fields({ status: 'archivado', publish_date: '2026-10-20' })).publish_date,
      null
    )
    assert.equal(
      normalizeFields(fields({ status: 'programado', publish_date: '2026-10-20' })).publish_date,
      '2026-10-20'
    )
  })

  test('no modifica el objeto original', () => {
    const original = fields({ format: 'imagen', talent: 'Ana', filmmaker_ids: [UID_A] })
    normalizeFields(original)
    assert.equal(original.talent, 'Ana')
    assert.deepEqual(original.filmmaker_ids, [UID_A])
  })
})

describe('isAssignedTo', () => {
  const base = { format: 'video' as const, category: 'crecer' as const }

  test('el Editor siempre cuenta', () => {
    assert.equal(isAssignedTo({ ...base, format: 'imagen', filmmaker_ids: [], editor_ids: [UID_A] }, UID_A), true)
  })

  test('el Filmmaker cuenta cuando el campo aplica', () => {
    assert.equal(isAssignedTo({ ...base, filmmaker_ids: [UID_A], editor_ids: [] }, UID_A), true)
    assert.equal(
      isAssignedTo({ format: 'imagen', category: 'roots', filmmaker_ids: [UID_A], editor_ids: [] }, UID_A),
      true
    )
  })

  test('un Filmmaker asignado cuando el campo está oculto no cuenta (dato viejo)', () => {
    const post = { format: 'imagen' as const, category: 'crecer' as const, filmmaker_ids: [UID_A], editor_ids: [] }
    assert.equal(isAssignedTo(post, UID_A), false)
  })

  test('quien no está asignado no cuenta', () => {
    assert.equal(isAssignedTo({ ...base, filmmaker_ids: [UID_A], editor_ids: [UID_B] }, UID_C), false)
  })
})

describe('fechas', () => {
  test('acepta fechas de calendario reales', () => {
    for (const ok of ['2026-10-16', '2026-12-31', '2028-02-29', '2000-02-29', '2026-01-01']) {
      assert.equal(isRealDateOnly(ok), true, ok)
    }
  })

  test('rechaza fechas imposibles o mal formadas', () => {
    const malas = [
      '2026-02-29', // 2026 no es bisiesto
      '1900-02-29', // siglo no divisible entre 400
      '2026-13-01',
      '2026-00-10',
      '2026-10-00',
      '2026-04-31',
      '0000-01-01',
      '2026-1-1',
      '2026-10-16T00:00',
      'hola',
      '',
    ]
    for (const mala of malas) assert.equal(isRealDateOnly(mala), false, mala)
  })

  test('el orden: mismo día y después valen, antes no', () => {
    assert.equal(datesInOrder('2026-10-16', '2026-10-16'), true)
    assert.equal(datesInOrder('2026-10-16', '2026-10-17'), true)
    assert.equal(datesInOrder('2026-10-16', '2026-10-15'), false)
    assert.equal(datesInOrder('2026-12-31', '2027-01-01'), true)
  })

  test('sin fecha de publicación (pieza archivada) no hay orden que romper', () => {
    assert.equal(datesInOrder('2026-10-16', null), true)
  })
})

describe('isUuid', () => {
  test('distingue uuid de otros textos', () => {
    assert.equal(isUuid(UID_A), true)
    assert.equal(isUuid('no-es-un-uuid'), false)
    assert.equal(isUuid(''), false)
    assert.equal(isUuid(`${UID_A}'; drop table x; --`), false)
  })
})

describe('diffPost', () => {
  test('sin cambios no hay parche', () => {
    assert.deepEqual(diffPost(fields(), fields()), {})
  })

  test('solo trae lo que cambió', () => {
    assert.deepEqual(diffPost(fields(), fields({ title: 'Otro título' })), { title: 'Otro título' })
  })

  test('el orden de una lista no es un cambio', () => {
    const base = fields({ platforms: ['instagram', 'linkedin'], editor_ids: [UID_A, UID_B] })
    const mine = fields({ platforms: ['linkedin', 'instagram'], editor_ids: [UID_B, UID_A] })
    assert.deepEqual(diffPost(base, mine), {})
  })

  test('ocultar o mostrar una sección es un cambio; el orden de las ocultas no', () => {
    assert.deepEqual(diffPost(fields(), fields({ hidden_sections: ['guion'] })), { hidden_sections: ['guion'] })
    assert.deepEqual(diffPost(fields({ hidden_sections: ['guion'] }), fields()), { hidden_sections: [] })
    assert.deepEqual(
      diffPost(fields({ hidden_sections: ['guion', 'portada'] }), fields({ hidden_sections: ['portada', 'guion'] })),
      {}
    )
  })

  test('agregar a una lista sí es un cambio', () => {
    const mine = fields({ platforms: ['instagram', 'youtube'] })
    assert.deepEqual(diffPost(fields(), mine), { platforms: ['instagram', 'youtube'] })
  })

  test('texto vacío, en blanco y null son lo mismo', () => {
    assert.deepEqual(diffPost(fields({ caption: null }), fields({ caption: '   ' })), {})
    assert.deepEqual(diffPost(fields({ copy_text: '' }), fields({ copy_text: null })), {})
  })

  test('vaciar un campo que tenía texto sí es un cambio', () => {
    assert.deepEqual(diffPost(fields({ caption: 'Hola' }), fields({ caption: null })), { caption: null })
  })

  test('varios cambios a la vez, incluidos los de formato y categoría', () => {
    const patch = diffPost(fields(), fields({ status: 'agendado', format: null, category: 'roots' }))
    assert.deepEqual(patch, { status: 'agendado', format: null, category: 'roots' })
  })
})

describe('mergeLatest', () => {
  test('campos distintos: se conservan los dos cambios y no hay conflicto', () => {
    const base = fields()
    const mine = fields({ title: 'Mi título' })
    const latest = fields({ status: 'agendado' })
    const { merged, conflicts } = mergeLatest(base, mine, latest)
    assert.equal(merged.title, 'Mi título')
    assert.equal(merged.status, 'agendado')
    assert.deepEqual(conflicts, [])
  })

  test('mismo campo cambiado distinto: conflicto y gana el valor de la persona', () => {
    const { merged, conflicts } = mergeLatest(
      fields({ title: 'A' }),
      fields({ title: 'B' }),
      fields({ title: 'C' })
    )
    assert.deepEqual(conflicts, ['title'])
    assert.equal(merged.title, 'B')
  })

  test('mismo campo cambiado al mismo valor: no hay conflicto', () => {
    const { conflicts } = mergeLatest(fields({ title: 'A' }), fields({ title: 'B' }), fields({ title: 'B' }))
    assert.deepEqual(conflicts, [])
  })

  test('lo que la persona no tocó adopta siempre lo último', () => {
    const latest = fields({ title: 'Nuevo', caption: 'Copy nuevo', status: 'publicado' })
    const { merged, conflicts } = mergeLatest(fields(), fields(), latest)
    assert.deepEqual(merged, latest)
    assert.deepEqual(conflicts, [])
  })

  test('dos personas que ocultan secciones distintas: conflicto, gana la de quien guarda', () => {
    const base = fields()
    const mine = fields({ hidden_sections: ['guion'] })
    const latest = fields({ hidden_sections: ['portada'] })
    const { merged, conflicts } = mergeLatest(base, mine, latest)
    assert.deepEqual(conflicts, ['hidden_sections'])
    assert.deepEqual(merged.hidden_sections, ['guion'])
  })

  test('si otra persona ocultó una sección y yo toqué otro campo, adopto lo suyo', () => {
    const base = fields()
    const mine = fields({ title: 'Mi título' })
    const latest = fields({ hidden_sections: ['copy'] })
    const { merged, conflicts } = mergeLatest(base, mine, latest)
    assert.deepEqual(conflicts, [])
    assert.deepEqual(merged.hidden_sections, ['copy'])
    assert.equal(merged.title, 'Mi título')
  })

  test('las listas se comparan como conjuntos', () => {
    const base = fields({ editor_ids: [UID_A] })
    const mine = fields({ editor_ids: [UID_A, UID_B] })
    const latest = fields({ editor_ids: [UID_A, UID_C] })
    const { merged, conflicts } = mergeLatest(base, mine, latest)
    assert.deepEqual(conflicts, ['editor_ids'])
    assert.deepEqual(merged.editor_ids, [UID_A, UID_B])
  })

  test('lo último que equivale a lo de antes (texto en blanco) no es un cambio ajeno', () => {
    const base = fields({ caption: null })
    const mine = fields({ caption: 'Mi copy' })
    const latest = fields({ caption: '  ' })
    const { merged, conflicts } = mergeLatest(base, mine, latest)
    assert.deepEqual(conflicts, [])
    assert.equal(merged.caption, 'Mi copy')
  })

  test('no modifica ninguno de los tres objetos de entrada', () => {
    const base = fields()
    const mine = fields({ title: 'Mi título' })
    const latest = fields({ status: 'agendado' })
    mergeLatest(base, mine, latest)
    assert.equal(latest.title, 'Pieza de prueba')
    assert.equal(mine.status, 'idea')
  })
})

test('EDITABLE_KEYS no tiene claves repetidas', () => {
  assert.equal(new Set(EDITABLE_KEYS).size, EDITABLE_KEYS.length)
})
