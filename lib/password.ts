// Sin caracteres ambiguos (0/O, 1/l/I): la contraseña se comparte a veces
// leyéndola en voz alta o copiándola a mano, y esos pares se confunden.
const LOWER = 'abcdefghjkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*-_+='

function secureRandomInt(max: number): number {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] % max
}

function pickFrom(pool: string): string {
  return pool[secureRandomInt(pool.length)]
}

/** Contraseña con al menos un carácter de cada tipo (minúscula, mayúscula,
 *  dígito, símbolo), mezclada con Fisher-Yates usando Web Crypto — no
 *  Math.random(), que no es apta para generar secretos. */
export function generatePassword(length = 14): string {
  const pools = [LOWER, UPPER, DIGITS, SYMBOLS]
  const all = pools.join('')
  const chars = pools.map(pickFrom)

  while (chars.length < length) {
    chars.push(pickFrom(all))
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}
