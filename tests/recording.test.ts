import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { nowMs, recordedSeconds } from '@/lib/therapy/recording'

// Todas las grabaciones se guardaban con `duracion_segundos = 0`: el `onstop` del grabador se definía al EMPEZAR y veía el
// `elapsed` de ese momento. Además, navegar durante una grabación dejaba el micrófono abierto y el intervalo corriendo.

const ROOT = process.cwd()
const code = (file: string) =>
  fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('recordedSeconds', () => {
  test('segundos redondeados entre el inicio y ahora', () => {
    assert.equal(recordedSeconds(1_000, 1_000, 1800), 0)
    assert.equal(recordedSeconds(0, 94_400, 1800), 94)
    assert.equal(recordedSeconds(0, 94_600, 1800), 95)
    assert.equal(recordedSeconds(5_000, 65_000, 1800), 60)
  })

  test('nunca pasa del tope (30 min) ni baja de cero (un reloj que retrocede)', () => {
    assert.equal(recordedSeconds(0, 3_600_000, 1800), 1800)
    assert.equal(recordedSeconds(10_000, 4_000, 1800), 0)
  })

  test('se mide con el reloj, no contando ticks: un temporizador frenado en segundo plano no acorta la grabación', () => {
    // 3 ticks de un intervalo de 1 s habrían dicho «3 s»; el reloj dice lo que de verdad pasó.
    assert.equal(recordedSeconds(0, 120_000, 1800), 120)
  })

  test('nowMs es el reloj del sistema', () => {
    const before = Date.now()
    const value = nowMs()
    assert.ok(value >= before && value <= Date.now())
  })
})

describe('la grabadora', () => {
  const source = code('components/portal/audio-recorder.tsx')

  test('la duración que se guarda sale del reloj al parar, no del `elapsed` de cuando empezó', () => {
    assert.match(source, /uploadFile\(file, recordedSeconds\(state\.startedAt, nowMs\(\), MAX_DURATION\)\)/)
    assert.doesNotMatch(source, /uploadFile\(file, elapsed\)/)
  })

  test('el tope de 30 min se aplica dentro del intervalo', () => {
    assert.match(source, /if \(seconds >= MAX_DURATION\) stopRecording\(\)/)
    assert.doesNotMatch(source, /useEffect\(\(\) => \{\s*if \(recording && elapsed >= MAX_DURATION\)/)
  })

  test('al desmontar se descarta lo grabado, se para el intervalo y se suelta el micrófono', () => {
    assert.match(source, /state\.discard = true/)
    assert.match(source, /if \(state\.timer\) clearInterval\(state\.timer\)/)
    assert.match(source, /state\.stream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/)
    assert.match(source, /if \(state\.discard\) return/, 'lo descartado no se sube')
  })
})
