import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { captureOpener, returnFocus } from '@/hooks/use-restore-focus'

// Un diálogo CONTROLADO (lo abre un estado, no un `DialogTrigger`) no recibe el foco de vuelta
// de Radix: su `onCloseAutoFocus` solo enfoca el trigger y, sin trigger, el foco caía en
// <body>. Quien navega con teclado perdía su lugar al cerrar o guardar. El hook lo recuerda al
// abrir y lo devuelve al cerrar; aquí se prueba su lógica y que los tres diálogos lo usen.

const fakeElement = (connected = true) => {
  const calls: string[] = []
  return { isConnected: connected, focus: () => calls.push('focus'), calls }
}
const fakeEvent = () => {
  const calls: string[] = []
  return { preventDefault: () => calls.push('preventDefault'), calls }
}

describe('captureOpener', () => {
  test('devuelve quien tiene el foco', () => {
    const button = fakeElement()
    assert.equal(captureOpener(button, {}), button)
  })

  test('<body> no cuenta: es lo que hay cuando nadie tiene el foco (un toque en WebKit no enfoca los botones)', () => {
    const body = fakeElement()
    assert.equal(captureOpener(body, body), null)
  })

  test('lo que no se puede enfocar tampoco', () => {
    assert.equal(captureOpener(null, {}), null)
    assert.equal(captureOpener({}, {}), null)
    assert.equal(captureOpener({ isConnected: true }, {}), null)
  })
})

describe('returnFocus', () => {
  test('enfoca al que abrió el diálogo y evita el comportamiento por defecto de Radix', () => {
    const opener = fakeElement()
    const event = fakeEvent()
    assert.equal(returnFocus(opener, event), true)
    assert.deepEqual(opener.calls, ['focus'])
    assert.deepEqual(event.calls, ['preventDefault'])
  })

  test('si ya no está en la página (la fila se borró al confirmar) no hace nada y deja actuar a Radix', () => {
    const opener = fakeElement(false)
    const event = fakeEvent()
    assert.equal(returnFocus(opener, event), false)
    assert.deepEqual(opener.calls, [])
    assert.deepEqual(event.calls, [])
  })

  test('sin nadie a quien devolverlo no hace nada', () => {
    const event = fakeEvent()
    assert.equal(returnFocus(null, event), false)
    assert.deepEqual(event.calls, [])
  })
})

describe('los diálogos controlados devuelven el foco', () => {
  const dialogs = [
    'components/portal/confirm-dialog.tsx',
    'components/portal/parrilla-post-dialog.tsx',
    'components/portal/parrilla-quote-dialog.tsx',
  ]

  for (const file of dialogs) {
    test(`${file} recuerda quién lo abrió y se lo devuelve al cerrar`, () => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
      assert.match(source, /useRestoreFocus\(\)/, `${file} no usa useRestoreFocus`)
      assert.match(source, /onCloseAutoFocus=\{restore\}/, `${file} no devuelve el foco al cerrar`)
      assert.ok(
        /onOpenAutoFocus=\{remember\}/.test(source) || /remember\(\)/.test(source),
        `${file} no recuerda quién lo abrió`
      )
    })
  }
})
