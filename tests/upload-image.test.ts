import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  IMAGE_ACCEPT,
  IMAGE_MIME_EXT,
  fitWithin,
  randomId,
  validateImage,
} from '@/lib/storage/upload-image'

const MB = 1024 * 1024

describe('validateImage', () => {
  test('acepta los 4 tipos permitidos', () => {
    for (const type of Object.keys(IMAGE_MIME_EXT)) {
      assert.equal(validateImage({ type, size: 1 * MB }, 10 * MB), null, type)
    }
  })

  test('ignora mayúsculas y parámetros del tipo', () => {
    assert.equal(validateImage({ type: 'IMAGE/JPEG', size: 1 }, 10 * MB), null)
    assert.equal(validateImage({ type: 'image/png; charset=binary', size: 1 }, 10 * MB), null)
  })

  test('rechaza lo que no es una imagen permitida', () => {
    for (const type of ['application/pdf', 'text/html', 'image/svg+xml', 'image/heic', 'video/mp4', '']) {
      assert.match(validateImage({ type, size: 1 }, 10 * MB) ?? '', /Solo se admiten imágenes/, type)
    }
  })

  test('no se deja engañar por nombres de propiedades de objeto', () => {
    for (const type of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      assert.notEqual(validateImage({ type, size: 1 }, 10 * MB), null, type)
    }
  })

  test('rechaza lo que excede el límite y dice cuál es', () => {
    assert.equal(
      validateImage({ type: 'image/jpeg', size: 10 * MB + 1 }, 10 * MB),
      'El archivo excede el límite de 10 MB'
    )
    assert.equal(validateImage({ type: 'image/jpeg', size: 10 * MB }, 10 * MB), null)
  })

  test('el tipo se revisa antes que el tamaño', () => {
    assert.match(validateImage({ type: 'application/pdf', size: 99 * MB }, 10 * MB) ?? '', /Solo se admiten/)
  })
})

describe('fitWithin', () => {
  test('lo que ya cabe no se toca ni se agranda', () => {
    assert.deepEqual(fitWithin(800, 600, 1600), { w: 800, h: 600 })
    assert.deepEqual(fitWithin(1600, 1600, 1600), { w: 1600, h: 1600 })
  })

  test('reduce un horizontal al lado largo máximo, sin deformar', () => {
    assert.deepEqual(fitWithin(4000, 3000, 1600), { w: 1600, h: 1200 })
  })

  test('reduce un vertical (foto de celular) al lado largo máximo', () => {
    assert.deepEqual(fitWithin(3000, 4000, 1600), { w: 1200, h: 1600 })
  })

  test('un panorama extremo nunca baja de 1 px', () => {
    assert.deepEqual(fitWithin(10000, 10, 1600), { w: 1600, h: 2 })
    assert.deepEqual(fitWithin(100000, 1, 1600), { w: 1600, h: 1 })
  })

  test('redondea a enteros', () => {
    const { w, h } = fitWithin(3333, 2222, 1600)
    assert.equal(Number.isInteger(w) && Number.isInteger(h), true)
    assert.equal(w, 1600)
  })
})

describe('randomId', () => {
  test('da un identificador distinto cada vez, sin guiones raros ni espacios', () => {
    const ids = new Set(Array.from({ length: 50 }, () => randomId()))
    assert.equal(ids.size, 50)
    for (const id of ids) assert.match(id, /^[0-9a-f-]{32,36}$/)
  })

  test('sin crypto.randomUUID (contexto no seguro) cae a getRandomValues', () => {
    // Sombrea el método con una propiedad propia, como en un navegador por http.
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const id = randomId()
      assert.match(id, /^[0-9a-f]{32}$/)
      assert.notEqual(id, randomId())
    } finally {
      delete (crypto as unknown as Record<string, unknown>).randomUUID
    }
  })
})

test('IMAGE_ACCEPT lista exactamente los tipos permitidos', () => {
  assert.deepEqual(IMAGE_ACCEPT.split(',').sort(), Object.keys(IMAGE_MIME_EXT).sort())
})
