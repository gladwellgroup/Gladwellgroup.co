import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { DECOR_ORBS, ORB_RGB } from '@/lib/data/decor-orbs'
import { ORB_BORDER_PX, orbGradient } from '@/lib/landing/orb-gradient'

// Los círculos decorativos de la landing se pintan con UN degradado radial —relleno, aro, brillo interior y
// halo— en vez de un div con `bg-*`, `border-2` y un `box-shadow` de 50–150 px de desenfoque (ver
// lib/landing/orb-gradient.ts). Lo que importa de ese degradado se puede comprobar sin navegador: paradas
// ordenadas, el relleno y el aro con su opacidad, la mitad de la opacidad del halo justo en el borde y todo a
// cero al final. Que SE VEA igual que las clases de antes se midió aparte (píxel a píxel contra producción,
// en los dos temas, con las fotos ocultas).

interface Stop {
  rgb: string
  alpha: number
  position: number
}

function parse(gradient: string): Stop[] {
  assert.match(gradient, /^radial-gradient\(circle closest-side, /)
  return [...gradient.matchAll(/rgba\((\d+),(\d+),(\d+),([\d.]+)\) ([\d.]+)%/g)].map((m) => ({
    rgb: `${m[1]},${m[2]},${m[3]}`,
    alpha: Number(m[4]),
    position: Number(m[5]),
  }))
}

const near = (actual: number, expected: number, tolerance = 0.0006) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} no es ${expected}`)

describe('orbGradient', () => {
  const base = { rgb: [124, 58, 237] as const, radius: 250, reach: 120, fill: 0.15, line: 0.4, blur: 120, glow: 0.4 }
  const full = 250 + 120
  const edgePct = ((250 - ORB_BORDER_PX) / full) * 100
  const outerPct = (250 / full) * 100

  test('empieza con el relleno en el centro', () => {
    const [first] = parse(orbGradient(base))
    assert.equal(first.position, 0)
    near(first.alpha, 0.15)
  })

  test('el relleno es plano hasta el borde de relleno: nada se interpola hacia el aro', () => {
    // Un degradado solo mantiene un color si lo repite en dos paradas: sin la del borde, el relleno se
    // iría tiñendo hacia el aro desde el centro (medido: hasta 21 % de píxeles distintos de producción).
    const ring = 0.15 + 0.4 - 0.15 * 0.4
    for (const inset of [undefined, { blur: 80, alpha: 0.15 }]) {
      const stops = parse(orbGradient({ ...base, inset }))
      const ringAt = stops.findIndex((s) => Math.abs(s.alpha - ring) < 0.0006 && Math.abs(s.position - edgePct) < 0.01)
      assert.ok(ringAt > 0, 'no encontré el aro')
      const interior = stops.slice(0, ringAt) // todo lo que va antes del aro
      // sin brillo interior TODO el interior es relleno puro; con él, lo es hasta donde empieza el brillo
      const flatUntil = inset ? ((250 - ORB_BORDER_PX - 80) / full) * 100 : 100
      for (const stop of interior.filter((s) => s.position <= flatUntil + 0.01)) near(stop.alpha, 0.15)
      // y la parada justo anterior al aro está en el borde de relleno: sin inset es el relleno puro; con
      // inset, el relleno más la mitad de la opacidad del brillo
      const before = interior.at(-1)!
      near(before.position, edgePct, 0.01)
      near(before.alpha, inset ? 0.15 + 0.075 - 0.15 * 0.075 : 0.15)
    }
  })

  test('el aro de 2 px lleva el aro sobre el relleno: borde + relleno − borde·relleno', () => {
    const stops = parse(orbGradient(base))
    const ring = stops.filter((s) => s.position >= edgePct - 0.01 && s.position <= outerPct + 0.01 && s.alpha > 0.3)
    assert.equal(ring.length, 2, 'el aro son dos paradas: borde de relleno y borde exterior')
    for (const stop of ring) near(stop.alpha, 0.15 + 0.4 - 0.15 * 0.4)
    near(ring[0].position, edgePct, 0.01)
    near(ring[1].position, outerPct, 0.01)
  })

  test('el aro puede ser de otro color (el del círculo grande, en oscuro, es blanco)', () => {
    const stops = parse(orbGradient({ ...base, lineRgb: [255, 255, 255] }))
    const ring = stops.filter((s) => Math.abs(s.position - outerPct) < 0.01)
    assert.equal(ring[0].rgb, '255,255,255', 'el aro es blanco')
    assert.equal(ring.at(-1)!.rgb, '124,58,237', 'el halo sigue siendo del color del círculo')
  })

  test('el halo empieza en el borde con la MITAD de su opacidad y cae como una gaussiana hasta 0', () => {
    const stops = parse(orbGradient(base))
    const halo = stops.filter((s) => s.position >= outerPct - 0.01).slice(1) // sin la parada del aro
    assert.deepEqual(
      halo.map((s) => s.alpha),
      [0.2, 0.124, 0.064, 0.0268, 0]
    )
    near(halo[0].position, outerPct, 0.01)
    near(halo.at(-1)!.position, 100, 0.01) // desenfoque = alcance: llega justo al 100 %
  })

  test('si un tema tiene menos desenfoque que el alcance de la capa, el resto es transparente hasta el 100 %', () => {
    const stops = parse(orbGradient({ ...base, blur: 80, glow: 0.25 }))
    assert.equal(stops.at(-1)!.position, 100)
    assert.equal(stops.at(-1)!.alpha, 0)
    assert.equal(stops.at(-2)!.alpha, 0)
    near(stops.at(-2)!.position, ((250 + 80) / full) * 100, 0.01)
  })

  test('el brillo interior se suma al relleno: el relleno a su profundidad y la mitad de su opacidad en el borde', () => {
    const stops = parse(orbGradient({ ...base, inset: { blur: 80, alpha: 0.15 } }))
    const deep = stops.find((s) => Math.abs(s.position - ((250 - ORB_BORDER_PX - 80) / full) * 100) < 0.01)
    near(deep!.alpha, 0.15) // a 80 px del borde solo queda el relleno
    const atEdge = stops.find((s) => Math.abs(s.position - edgePct) < 0.01 && s.alpha < 0.3)
    near(atEdge!.alpha, 0.15 + 0.075 - 0.15 * 0.075) // relleno + 0,5 · 0,15 de brillo
  })

  test('las paradas van en orden y todas dentro de 0–100 %', () => {
    for (const inset of [undefined, { blur: 80, alpha: 0.15 }]) {
      const stops = parse(orbGradient({ ...base, inset }))
      for (let i = 1; i < stops.length; i += 1) assert.ok(stops[i].position >= stops[i - 1].position, `parada ${i} fuera de orden`)
      assert.ok(stops.every((s) => s.position >= 0 && s.position <= 100))
      assert.ok(stops.every((s) => s.alpha >= 0 && s.alpha <= 1))
      assert.equal(stops[0].position, 0)
    }
  })

  test('usa el color pedido', () => {
    assert.match(orbGradient({ ...base, rgb: ORB_RGB.cyan }), /rgba\(6,182,212,/)
  })
})

describe('los 8 círculos de la landing', () => {
  test('son 8 y el radio coincide con el ancho de su clase w-[…px]', () => {
    assert.equal(DECOR_ORBS.length, 8)
    for (const orb of DECOR_ORBS) {
      const width = /\bw-\[(\d+)px\]/.exec(orb.place)
      assert.ok(width, orb.place)
      assert.equal(orb.radius * 2, Number(width[1]), `el radio de «${orb.place}» no es la mitad de su ancho`)
      assert.match(orb.place, new RegExp(`\\bh-\\[${width[1]}px\\]`), 'alto distinto del ancho: ya no es un círculo')
    }
  })

  test('cada tema genera un degradado válido que termina en 0 y cabe en la capa', () => {
    for (const orb of DECOR_ORBS) {
      const reach = Math.max(orb.dark.blur, orb.light.blur)
      for (const theme of [orb.dark, orb.light]) {
        assert.ok(theme.fill > 0 && theme.fill < 1 && theme.line > 0 && theme.line < 1 && theme.glow > 0 && theme.glow < 1, orb.place)
        const stops = parse(orbGradient({ rgb: ORB_RGB[orb.tone], radius: orb.radius, reach, ...theme }))
        assert.equal(stops.at(-1)!.alpha, 0, `${orb.place}: el degradado no termina en 0`)
        assert.ok(stops.every((s) => s.position <= 100), orb.place)
        for (let i = 1; i < stops.length; i += 1) assert.ok(stops[i].position >= stops[i - 1].position, `${orb.place}: paradas fuera de orden`)
      }
    }
  })

  test('el brillo interior cabe dentro del círculo (el de 200 px tiene 98 px hasta el borde de relleno)', () => {
    for (const orb of DECOR_ORBS) {
      const inset = orb.dark.inset
      if (inset) assert.ok(inset.blur < orb.radius - ORB_BORDER_PX, orb.place)
    }
  })
})
