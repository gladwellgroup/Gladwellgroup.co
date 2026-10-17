import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COVER_DEFAULT_RATIO,
  COVER_MAX_RATIO,
  COVER_MIN_RATIO,
  coverRatio,
} from '@/lib/parrilla/cover'

const cerca = (actual: number | null, esperado: number) => {
  assert.ok(actual !== null, 'debería haber proporción')
  assert.ok(Math.abs(actual - esperado) < 1e-9, `${actual} ≠ ${esperado}`)
}

describe('coverRatio: la portada toma la proporción de la foto', () => {
  test('reel o story vertical (9:16)', () => {
    cerca(coverRatio(1080, 1920), 9 / 16)
  })

  test('feed de Instagram: vertical 4:5 y cuadrado 1:1', () => {
    cerca(coverRatio(1080, 1350), 4 / 5)
    cerca(coverRatio(1080, 1080), 1)
  })

  test('post de LinkedIn: horizontal 1,91:1 y cuadrado', () => {
    cerca(coverRatio(1200, 627), 1200 / 627)
    cerca(coverRatio(1200, 1200), 1)
  })

  test('video horizontal (16:9) y fotos de celular (4:3 y 3:4)', () => {
    cerca(coverRatio(1920, 1080), 16 / 9)
    cerca(coverRatio(1600, 1200), 4 / 3)
    cerca(coverRatio(1200, 1600), 3 / 4)
  })

  test('las proporciones reales de cada red caben dentro del rango admitido', () => {
    for (const [w, h] of [
      [1080, 1920], // reel / story
      [1080, 1350], // feed vertical
      [1080, 1080], // feed cuadrado
      [1200, 627], //  LinkedIn
      [1920, 1080], // video horizontal
    ]) {
      const ratio = coverRatio(w, h)!
      assert.ok(ratio >= COVER_MIN_RATIO && ratio <= COVER_MAX_RATIO, `${w}×${h} → ${ratio}`)
      cerca(ratio, w / h) // sin recorte: no se toca
    }
  })

  test('una tira extrema se acota: ni más angosta que 1:2 ni más ancha que 2,4:1', () => {
    assert.equal(coverRatio(100, 1000), COVER_MIN_RATIO)
    assert.equal(coverRatio(3000, 500), COVER_MAX_RATIO)
  })

  test('el tamaño no importa, solo la forma', () => {
    cerca(coverRatio(540, 960), coverRatio(1080, 1920)!)
    cerca(coverRatio(3, 2), 1.5)
  })

  test('sin dimensiones utilizables no hay proporción (se usa la de respaldo)', () => {
    for (const [w, h] of [
      [0, 0],
      [0, 100],
      [100, 0],
      [-100, 100],
      [100, -100],
      [NaN, 100],
      [100, NaN],
      [Infinity, 100],
      [100, Infinity],
    ]) {
      assert.equal(coverRatio(w, h), null, `${w}×${h}`)
    }
  })

  test('la proporción de respaldo es 16:9 y está dentro del rango', () => {
    cerca(COVER_DEFAULT_RATIO, 16 / 9)
    assert.ok(COVER_DEFAULT_RATIO >= COVER_MIN_RATIO && COVER_DEFAULT_RATIO <= COVER_MAX_RATIO)
  })
})
