/** Parser de la lista de asistentes registrados. El archivo son unas pocas KB
 *  con dos o tres columnas, así que no justifica una dependencia: lo que sí
 *  hay que cubrir es lo que rompe en la práctica (BOM de Excel, `;` como
 *  separador, comas dentro de comillas, CRLF). Compartido entre Terapia y
 *  Education: mismo formato de CSV, misma tabla de origen (nombre + correo). */

export interface AttendeeRow {
  nombre: string
  correo: string
  empresa?: string
}

export interface CsvRowError {
  line: number
  reason: string
}

export interface ParsedAttendees {
  rows: AttendeeRow[]
  errors: CsvRowError[]
}

const NOMBRE_HEADERS = ['nombre', 'name', 'nombre completo', 'participante', 'asistente']
const CORREO_HEADERS = ['correo', 'email', 'e-mail', 'mail', 'correo electronico', 'correo electrónico']
const EMPRESA_HEADERS = ['empresa', 'compania', 'compañia', 'compañía', 'organizacion', 'organización']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** Detecta el separador contando ocurrencias fuera de comillas en la cabecera. */
function detectDelimiter(headerLine: string): string {
  let inQuotes = false
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }

  for (const char of headerLine) {
    if (char === '"') inQuotes = !inQuotes
    else if (!inQuotes && char in counts) counts[char] += 1
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

/** Divide el texto completo en filas de campos, respetando comillas (que
 *  pueden contener el delimitador y hasta saltos de línea). */
function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let fields: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      fields.push(field)
      field = ''
    } else if (char === '\n') {
      fields.push(field)
      records.push(fields)
      fields = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || fields.length > 0) {
    fields.push(field)
    records.push(fields)
  }

  return records
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalizedCandidates = candidates.map(normalizeHeader)
  return headers.findIndex((header) =>
    normalizedCandidates.includes(normalizeHeader(header))
  )
}

export function parseAttendeesCsv(rawText: string): ParsedAttendees {
  const text = stripBom(rawText).trim()
  if (!text) {
    return { rows: [], errors: [{ line: 0, reason: 'El archivo está vacío' }] }
  }

  const firstLine = text.split('\n')[0]
  const records = splitRecords(text, detectDelimiter(firstLine))
  if (records.length === 0) {
    return { rows: [], errors: [{ line: 0, reason: 'El archivo está vacío' }] }
  }

  const headers = records[0].map((h) => h.trim())
  const nombreIdx = findColumn(headers, NOMBRE_HEADERS)
  const correoIdx = findColumn(headers, CORREO_HEADERS)
  const empresaIdx = findColumn(headers, EMPRESA_HEADERS)

  if (correoIdx === -1) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          reason:
            'No se encontró una columna de correo. Nombra la columna "correo" o "email".',
        },
      ],
    }
  }

  const rows: AttendeeRow[] = []
  const errors: CsvRowError[] = []
  const seen = new Set<string>()

  for (let i = 1; i < records.length; i += 1) {
    const line = i + 1
    const record = records[i]
    if (record.every((cell) => cell.trim() === '')) continue

    const correo = (record[correoIdx] ?? '').trim().toLowerCase()
    const nombre = nombreIdx === -1 ? '' : (record[nombreIdx] ?? '').trim()
    const empresa = empresaIdx === -1 ? undefined : (record[empresaIdx] ?? '').trim()

    if (!correo) {
      errors.push({ line, reason: 'Sin correo' })
      continue
    }
    if (!EMAIL_RE.test(correo)) {
      errors.push({ line, reason: `Correo inválido: ${correo}` })
      continue
    }
    if (seen.has(correo)) {
      errors.push({ line, reason: `Duplicado: ${correo}` })
      continue
    }

    seen.add(correo)
    rows.push({
      // Sin nombre el saludo del correo quedaría vacío; el usuario local del
      // correo es mejor fallback que un "Hola ," roto.
      nombre: nombre || correo.split('@')[0],
      correo,
      empresa: empresa || undefined,
    })
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: 0, reason: 'El archivo no tiene filas de asistentes' })
  }

  return { rows, errors }
}
