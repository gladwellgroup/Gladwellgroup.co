import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { AttendanceQrSection } from '@/components/portal/attendance-qr-section'
import { CharlaAttendees } from '@/components/portal/charla-attendees'

// El servidor (Node) y el navegador (Safari) NO escriben igual una hora en español:
//   Node   → «3 de nov, 2:42 p. m.»   y   «3/11/2026, 2:42 p. m.»
//   Safari → «3 de nov., 2:42 p.m.»   y   «3/11/2026, 2:42 p.m.»
// Si el servidor la pinta, React descarta su HTML con el error de hidratación #418 y vuelve a
// dibujar la página entera en el cliente (se vio en WebKit al abrir una charla con el código
// ya generado). Por eso estos textos los escribe SOLO el navegador (`useIsClient`), y aquí se
// comprueba que el HTML del servidor no trae ninguna hora.

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }
const inRouter = (node: React.ReactNode) =>
  React.createElement(AppRouterContext.Provider, { value: router as never }, node)

/** Cualquier hora «h:mm» o marca «a. m.» / «p. m.» / «a.m.» / «p.m.». */
const HORA = /\d{1,2}:\d{2}|\b[ap]\.\s?m\./i

/** Solo el texto que ve la persona: los atributos (como el `datetime` ISO del <time>) son
 *  idénticos en el servidor y en el navegador y no cuentan. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ')

describe('lo que el servidor escribe y el navegador escribe distinto, lo escribe solo el navegador', () => {
  test('la lista de asistentes pinta nombre y correo en el servidor, pero no su hora de registro', () => {
    const html = renderToString(
      inRouter(
        React.createElement(CharlaAttendees, {
          attendees: [
            { id: 'a1', nombre: 'Ana Gómez', correo: 'ana@example.com', created_at: '2026-11-03T19:42:00+00:00' },
            { id: 'a2', nombre: 'Luis Pérez', correo: 'luis@example.com', created_at: '2026-11-03T19:50:00+00:00' },
          ],
        })
      )
    )
    assert.ok(html.includes('Ana Gómez') && html.includes('luis@example.com'))
    assert.equal(html.includes('dateTime="2026-11-03T19:42:00+00:00"'), true, 'el <time> sigue en el HTML, con su valor ISO')
    assert.doesNotMatch(textOf(html), HORA, 'el servidor escribió una hora: Safari la escribiría distinto y la hidratación fallaría')
  })

  test('el código de asistencia pinta «Vence el» en el servidor, pero no la fecha ni la hora', () => {
    const html = renderToString(
      inRouter(
        React.createElement(AttendanceQrSection, {
          sessionId: 's1',
          program: 'charla',
          link: { token: 'una-charla-abc123', expires_at: '2099-11-03T22:48:00+00:00' },
          onLinkChange() {},
        })
      )
    )
    assert.ok(html.includes('Vence el'), 'el texto fijo sí sale del servidor')
    assert.doesNotMatch(textOf(html), HORA)
    assert.doesNotMatch(textOf(html), /2099|\b\d{1,2}\/\d{1,2}\/\d{4}\b/, 'ni siquiera la fecha: depende del formato regional')
  })

  test('un enlace ya vencido tampoco cambia el HTML del servidor (se decide en el navegador)', () => {
    const html = renderToString(
      inRouter(
        React.createElement(AttendanceQrSection, {
          sessionId: 's1',
          program: 'charla',
          link: { token: 'vencido-abc123', expires_at: '2001-01-01T00:00:00+00:00' },
          onLinkChange() {},
        })
      )
    )
    assert.ok(html.includes('Vence el'), 'el servidor no decide si venció: depende del reloj del navegador')
    assert.equal(html.includes('Venció el'), false)
  })
})
