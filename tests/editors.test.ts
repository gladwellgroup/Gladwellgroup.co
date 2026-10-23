import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Los dos editores de entregable (Terapia y Education) tenían cada uno su copia del ciclo «generando → procesando → listo»:
// arranque, sondeo con router.refresh() cada 4 s, reintento. Ahora lo comparte un gancho y el sondeo pide solo el estado.

const ROOT = process.cwd()
const code = (file: string) =>
  fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const EDITORS = ['components/portal/deliverable-editor.tsx', 'components/portal/education-deliverable-editor.tsx']

describe('editores de entregable', () => {
  test('usan el gancho compartido y no conservan su propio sondeo ni el plazo de 6 min', () => {
    for (const file of EDITORS) {
      const source = code(file)
      assert.match(source, /useDeliverableProcessing\(\{/, file)
      assert.doesNotMatch(source, /setInterval/, `${file}: sigue con su propio sondeo`)
      assert.doesNotMatch(source, /RETRY_THRESHOLD_MS|processStartedRef|triggerProcess/, file)
    }
  })

  test('el ciclo le pide al servidor SOLO el estado, y solo con la pestaña visible', () => {
    const hook = code('hooks/use-deliverable-processing.ts')
    assert.match(hook, /fetch\(`\$\{statusUrl\}\?session_id=/)
    assert.match(hook, /document\.visibilityState !== 'visible'\) return/)
    assert.doesNotMatch(hook, /router\.refresh/, 'refrescar la página entera cada 4 s era lo caro')
    assert.match(hook, /const POLL_MS = 4000/)
  })

  test('un 409 de la síntesis (otra pestaña ya la lleva) no se muestra como error', () => {
    assert.match(code('hooks/use-deliverable-processing.ts'), /else if \(res\.status !== 409\) \{\s*onError\(/)
  })

  test('las rutas de estado existen y piden sesión y acceso', () => {
    for (const [file, access] of [
      ['app/api/therapy/deliverables/status/route.ts', 'resolveDeliverableAccess'],
      ['app/api/education/deliverables/status/route.ts', 'resolveEducationAccess'],
    ]) {
      const source = code(file)
      assert.match(source, /requireApiUser\(\)/, file)
      assert.match(source, new RegExp(`${access}\\(`), file)
      assert.match(source, /export const GET = withApiErrors\(/, file)
    }
  })

  test('no pisan lo que se está escribiendo: la sincronización con el servidor se salta si hay cambios sin guardar', () => {
    for (const file of EDITORS) {
      const source = code(file)
      assert.match(source, /if \(saveStatusRef\.current === 'dirty' \|\| saveStatusRef\.current === 'saving'\) return/, file)
      assert.match(source, /skipAutosaveRef\.current = true/, `${file}: lo traído del servidor no debe disparar un autoguardado`)
    }
  })

  test('aprobar tiene guarda de reentrada: un doble toque no manda el correo dos veces', () => {
    for (const file of EDITORS) {
      const source = code(file)
      assert.match(source, /if \(approvingRef\.current\) return\s*approvingRef\.current = true/, file)
      assert.match(source, /finally \{\s*approvingRef\.current = false/, file)
    }
  })

  test('descargar el PDF o aprobar esperan al guardado en marcha, no solo al pendiente', () => {
    for (const file of EDITORS) {
      assert.match(code(file), /\(saveStatus === 'dirty' \|\| saveStatus === 'saving'\)\) await saveNow\(\)/, file)
    }
  })
})

describe('formularios de la Parrilla', () => {
  test('tras un éxito el botón no se reactiva mientras el diálogo se cierra (un segundo toque duplicaba el alta)', () => {
    for (const file of ['components/portal/parrilla-post-form.tsx', 'components/portal/parrilla-quote-form.tsx']) {
      const source = code(file)
      assert.match(source, /function finish\(\) \{\s*closingRef\.current = true/, file)
      assert.match(source, /finally \{\s*if \(!closingRef\.current\) setSubmitting\(false\)/, file)
      assert.match(source, /finally \{\s*if \(!closingRef\.current\) setDeleting\(false\)/, file)
      assert.match(source, /if \(.*submitting \|\| closingRef\.current\) return/, file)
    }
  })
})
