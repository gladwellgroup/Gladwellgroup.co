import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { CofounderFields } from '@/components/portal/cofounder-fields'
import { AMERICAS_PHONE_CODES, inferPhoneCountryIso } from '@/lib/data/americas-phone-codes'

// El WhatsApp de cada co-fundador se guarda en E.164 («+573001234567») y se edita en dos campos: el país
// y el número nacional. Antes el país arrancaba SIEMPRE en Colombia: un +52 se veía como Colombia con el
// «52» pegado al número, y al tocarlo se guardaba un +57 con el 52 dentro (el número quedaba corrupto).

describe('inferPhoneCountryIso: el país de un número ya guardado', () => {
  test('lo reconoce por el código de marcación', () => {
    assert.equal(inferPhoneCountryIso('+573001234567'), 'CO')
    assert.equal(inferPhoneCountryIso('+525512345678'), 'MX')
    assert.equal(inferPhoneCountryIso('+541112345678'), 'AR')
    assert.equal(inferPhoneCountryIso('+5511987654321'), 'BR')
  })

  test('los códigos de tres cifras (+501, +506, +591) no se confunden con los de dos', () => {
    assert.equal(inferPhoneCountryIso('+50160012345'), 'BZ')
    assert.equal(inferPhoneCountryIso('+50688881234'), 'CR')
    assert.equal(inferPhoneCountryIso('+59170012345'), 'BO')
  })

  test('ningún código de la lista es prefijo de otro distinto: por eso basta el primero que coincide', () => {
    // Si un día entra uno como «+1809» (o «+50» junto a «+501»), el primero que coincida puede ser el equivocado
    // y `inferPhoneCountryIso` tendrá que escoger el más largo.
    const dials = [...new Set(AMERICAS_PHONE_CODES.map((entry) => entry.dialCode.replace(/\D/g, '')))]
    for (const a of dials) {
      for (const b of dials) {
        if (a !== b) assert.ok(!b.startsWith(a), `+${a} es prefijo de +${b}`)
      }
    }
  })

  test('el +1 lo comparten varios países y el número no dice cuál: devuelve EE. UU., el primero de la lista', () => {
    assert.equal(inferPhoneCountryIso('+14155550123'), 'US')
    assert.equal(inferPhoneCountryIso('+16045550123'), 'US', 'un número de Canadá se ve con la bandera de EE. UU.')
    assert.ok(AMERICAS_PHONE_CODES.filter((entry) => entry.dialCode === '+1').length > 1, 'la premisa: hay varios países con +1')
  })

  test('sin «+» no dice de dónde es: un número escrito sin código no se adivina', () => {
    for (const value of ['3001234567', '573001234567', '', '   ', null, undefined]) {
      assert.equal(inferPhoneCountryIso(value), undefined, String(value))
    }
  })

  test('un código que no es de América no se reconoce', () => {
    for (const value of ['+34600123456', '+447911123456', '+919876543210']) {
      assert.equal(inferPhoneCountryIso(value), undefined, value)
    }
  })

  test('cada país de la lista se reconoce a sí mismo (los del +1, como EE. UU.)', () => {
    for (const { iso, dialCode } of AMERICAS_PHONE_CODES) {
      assert.equal(inferPhoneCountryIso(`${dialCode}1234567890`), dialCode === '+1' ? 'US' : iso, iso)
    }
  })
})

describe('CofounderFields: el país sale del número guardado', () => {
  const render = (whatsapp: string | null) =>
    renderToString(
      React.createElement(CofounderFields, {
        cofounders: [{ nombre: 'Ana', whatsapp, correo: null, orden: 0 }],
        onChange() {},
      })
    )
  const country = (html: string) => /font-semibold">([A-Z]{2})<\/span><span[^>]*>(\+\d+)</.exec(html)?.slice(1)

  test('un +52 se ve como México y con el número nacional, no como Colombia con el 52 pegado', () => {
    const html = render('+525512345678')
    assert.deepEqual(country(html), ['MX', '+52'])
    assert.match(html, /value="5512345678"/)
  })

  test('un +57 sigue viéndose como Colombia, con el número nacional', () => {
    const html = render('+573001234567')
    assert.deepEqual(country(html), ['CO', '+57'])
    assert.match(html, /value="3001234567"/)
  })

  test('un número guardado sin código (de antes del selector) se ve tal cual y con Colombia por defecto', () => {
    const html = render('3001234567')
    assert.deepEqual(country(html), ['CO', '+57'])
    assert.match(html, /value="3001234567"/)
  })

  test('al cambiar de país se quita el código del país que se veía (el inferido) y al escribir se fija el que se ve', () => {
    const source = fs
      .readFileSync(path.join(process.cwd(), 'components/portal/cofounder-fields.tsx'), 'utf8')
      .replace(/\/\/.*$/gm, '')
    // Cambiar de país: el número nacional se saca con el país actual (inferido o elegido), no con el de por defecto.
    assert.match(source, /function updateWhatsappPais[\s\S]*?digitsFromStored\(cofounders\[index\]\.whatsapp, paisDe\(index\)\)/)
    // Escribir: se fija el país visible, para que al borrar el número el selector no salte a Colombia.
    assert.match(source, /function updateWhatsappNumero[\s\S]*?setPaisPorIndice\(/)
    assert.doesNotMatch(source, /paisPorIndice\[index\] \?\? DEFAULT_PHONE_COUNTRY/, 'volvió el país por defecto sin mirar el número')
  })

  test('sin número, Colombia y el campo vacío', () => {
    const html = render(null)
    assert.deepEqual(country(html), ['CO', '+57'])
    assert.match(html, /value=""/)
  })
})
