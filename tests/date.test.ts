import { afterEach, describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { bucketCharla } from '@/lib/charlas/status'
import { bucketSession, daysSinceSession } from '@/lib/deliverables/pipeline'
import { APP_TIME_ZONE, currentMonthStart, daysBetweenKeys, formatDay, todayKey } from '@/lib/date'

// «Hoy» de la plataforma es el de Bogotá (UTC-5, sin horario de verano), no el del servidor ni el del navegador. En
// Vercel el servidor corre en UTC: `TZ` es una variable reservada de sus funciones y el `process.env.TZ` de
// next.config.mjs no se ejecuta allí. Desde las 7 p. m. en Colombia el día UTC ya es el siguiente: una charla de
// «hoy» se marcaba «realizada» antes de empezar. Estas pruebas corren cada caso con la zona del proceso en UTC, en
// Bogotá y en otras (también con horario de verano) y exigen el mismo resultado en todas.

const ZONAS = ['UTC', 'America/Bogota', 'Europe/Madrid', 'Pacific/Auckland', 'America/New_York']
const TZ_ORIGINAL = process.env.TZ

/** Ejecuta `fn` con la zona del proceso cambiada (Node la relee al asignar `process.env.TZ`). */
function enZona<T>(zona: string, fn: () => T): T {
  process.env.TZ = zona
  try {
    return fn()
  } finally {
    if (TZ_ORIGINAL === undefined) delete process.env.TZ
    else process.env.TZ = TZ_ORIGINAL
  }
}

/** Fija el reloj en un instante (UTC) y lo suelta al terminar. */
function conReloj<T>(instante: string, fn: () => T): T {
  mock.timers.enable({ apis: ['Date'], now: new Date(instante) })
  try {
    return fn()
  } finally {
    mock.timers.reset()
  }
}

afterEach(() => mock.timers.reset())

describe('todayKey', () => {
  const CASOS: [string, string, string][] = [
    ['2026-10-22T01:30:00Z', '2026-10-21', '20:30 en Bogotá: en UTC ya es el 22'],
    ['2026-10-22T04:59:59Z', '2026-10-21', '23:59:59 en Bogotá'],
    ['2026-10-22T05:00:00Z', '2026-10-22', 'medianoche en Bogotá'],
    ['2026-10-22T17:00:00Z', '2026-10-22', 'mediodía'],
    ['2026-11-01T03:30:00Z', '2026-10-31', 'último día del mes por la noche'],
    ['2027-01-01T02:00:00Z', '2026-12-31', 'último día del año por la noche'],
    ['2028-03-01T03:00:00Z', '2028-02-29', 'año bisiesto'],
  ]

  test('es el día de Bogotá, sea cual sea la zona del proceso', () => {
    for (const zona of ZONAS) {
      for (const [instante, esperado, que] of CASOS) {
        assert.equal(enZona(zona, () => todayKey(new Date(instante))), esperado, `${zona} · ${que}`)
      }
    }
  })

  test('sin argumento usa el reloj', () => {
    for (const zona of ZONAS) {
      assert.equal(enZona(zona, () => conReloj('2026-10-22T01:30:00Z', () => todayKey())), '2026-10-21', zona)
    }
  })
})

describe('daysBetweenKeys', () => {
  test('cuenta días de calendario: meses, años bisiestos y cambios de hora no suman ni restan', () => {
    assert.equal(daysBetweenKeys('2026-10-21', '2026-10-21'), 0)
    assert.equal(daysBetweenKeys('2026-10-20', '2026-10-21'), 1)
    assert.equal(daysBetweenKeys('2026-02-28', '2026-03-01'), 1)
    assert.equal(daysBetweenKeys('2028-02-28', '2028-03-01'), 2)
    assert.equal(daysBetweenKeys('2026-12-31', '2027-01-01'), 1)
    assert.equal(daysBetweenKeys('2026-10-21', '2026-10-20'), -1)
    for (const zona of ZONAS) {
      // En Madrid el 29-mar-2026 se adelanta la hora; en Nueva York, el 8-mar-2026.
      assert.equal(enZona(zona, () => daysBetweenKeys('2026-03-07', '2026-03-09')), 2, zona)
      assert.equal(enZona(zona, () => daysBetweenKeys('2026-03-28', '2026-03-30')), 2, zona)
    }
  })
})

describe('«hoy» después de las 7 p. m. en Bogotá (01:30 UTC del día siguiente)', () => {
  const NOCHE = '2026-10-22T01:30:00Z' // 20:30 del 21 en Bogotá

  test('la charla de hoy sigue «programada» y la de ayer ya es «realizada»', () => {
    for (const zona of ZONAS) {
      conReloj(NOCHE, () => {
        assert.equal(enZona(zona, () => bucketCharla('2026-10-21')), 'programada', `${zona} · hoy`)
        assert.equal(enZona(zona, () => bucketCharla('2026-10-22')), 'programada', `${zona} · mañana`)
        assert.equal(enZona(zona, () => bucketCharla('2026-10-20')), 'realizada', `${zona} · ayer`)
      })
    }
  })

  test('una sesión de hoy NO es futura; la de mañana sí', () => {
    for (const zona of ZONAS) {
      conReloj(NOCHE, () => {
        assert.equal(enZona(zona, () => bucketSession({ status: 'borrador', session_date: '2026-10-21' })), 'borrador', `${zona} · hoy`)
        assert.equal(enZona(zona, () => bucketSession({ status: 'borrador', session_date: '2026-10-22' })), 'programada', `${zona} · mañana`)
      })
    }
  })

  test('los días desde la sesión no se adelantan un día', () => {
    for (const zona of ZONAS) {
      conReloj(NOCHE, () => {
        assert.equal(enZona(zona, () => daysSinceSession('2026-10-21')), 0, `${zona} · hoy`)
        assert.equal(enZona(zona, () => daysSinceSession('2026-10-20')), 1, `${zona} · ayer`)
        assert.equal(enZona(zona, () => daysSinceSession('2026-10-30')), 0, `${zona} · futura`)
        assert.equal(enZona(zona, () => daysSinceSession('2026-09-21')), 30, `${zona} · hace un mes`)
      })
    }
  })
})

describe('currentMonthStart', () => {
  test('el último día del mes por la noche sigue en ese mes (el servidor en UTC ya estaba en el siguiente)', () => {
    for (const zona of ZONAS) {
      // Con componentes locales y DENTRO de la zona: el calendario construye el mes con `new Date(año, mes, 1)`.
      const componentes = enZona(zona, () => {
        const inicio = currentMonthStart(new Date('2026-11-01T03:30:00Z'))
        return [inicio.getFullYear(), inicio.getMonth(), inicio.getDate()]
      })
      assert.deepEqual(componentes, [2026, 9, 1], zona)
    }
  })
})

describe('formatDay', () => {
  test('escribe el día de Bogotá de un instante con hora, igual en el servidor y en el navegador', () => {
    for (const zona of ZONAS) {
      // 02:00 UTC del 22 = 21:00 del 21 en Bogotá.
      assert.equal(enZona(zona, () => formatDay('2026-10-22T02:00:00Z')), '21/10/2026', zona)
      assert.equal(enZona(zona, () => formatDay('2026-10-22T05:00:00Z')), '22/10/2026', zona)
    }
  })

  test('la zona de la plataforma es Bogotá', () => {
    assert.equal(APP_TIME_ZONE, 'America/Bogota')
  })
})
