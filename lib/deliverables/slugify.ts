import { randomInt } from 'crypto'

/** Minúsculas, sin tildes, espacios/símbolos a guiones — igual criterio que
 *  normalizeHeader en lib/deliverables/csv.ts, aplicado a texto libre en vez de
 *  encabezados de columna. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** 10 caracteres de un alfabeto de 36 (~52 bits), con crypto.randomInt (CSPRNG): es la parte que de verdad hace el
 *  token no adivinable, no el slug. Eran 6 (~31 bits): con el título adivinable, unas 2 mil millones de combinaciones se
 *  prueban rápido contra una página pública. Los enlaces ya emitidos (con 6) siguen valiendo: el token se compara tal
 *  cual, sin exigir una longitud. */
export function randomSuffix(length = 10): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)]
  }
  return out
}

/** Token legible del link de asistencia: slug del título + sufijo aleatorio,
 *  recalculado en cada generación/regeneración a partir del título vigente. */
export function buildAttendanceToken(title: string): string {
  const slug = slugify(title) || 'sesion'
  return `${slug}-${randomSuffix()}`
}
