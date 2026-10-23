import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { LEADS_PAGE_SIZE, LEAD_COLUMNS, LEAD_FIELDS_COMPLETE, LEAD_SELECT, POSTGREST_MAX_ROWS } from '@/lib/crm/leads'

// Velocidad del portal (Tanda 4): las funciones corren en la región de la base de datos, el CRM no manda al navegador
// lo que no pinta ni pinta cientos de tarjetas de golpe, y el riel del menú no se abre con el dedo en un iPad.

const ROOT = process.cwd()
const code = (file: string) =>
  fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('vercel.json', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))

  test('las funciones corren en São Paulo (gru1), la región de la base de datos', () => {
    // Supabase está en sa-east-1. Con las funciones en iad1 (el valor por defecto) cada viaje a la base costaba ~130 ms
    // y cada página encadena 2–4. El plan Hobby admite UNA región.
    assert.deepEqual(config.regions, ['gru1'])
  })

  test('no cambia nada más del despliegue', () => {
    assert.deepEqual(Object.keys(config), ['regions'])
  })
})

describe('CRM', () => {
  test('pide solo las columnas que pinta, sin repetir ninguna', () => {
    assert.equal(LEAD_SELECT, LEAD_COLUMNS.join(', '))
    assert.equal(new Set(LEAD_COLUMNS).size, LEAD_COLUMNS.length)
    for (const needed of ['id', 'nombre', 'correo', 'contact_status', 'assigned_to', 'created_at', 'whatsapp_e164']) {
      assert.ok((LEAD_COLUMNS as readonly string[]).includes(needed), needed)
    }
    assert.equal(LEAD_FIELDS_COMPLETE, true)
  })

  test('las dos páginas del CRM ya no piden `select(*)` de los leads y avisan si se llega al tope de la API', () => {
    for (const file of ['app/(portal)/super/crm/page.tsx', 'app/(portal)/admin/leads/page.tsx']) {
      const source = code(file)
      assert.doesNotMatch(source, /select\('\*'\)/, file)
      assert.match(source, /select\(LEAD_SELECT\)/, file)
      assert.match(source, /truncated=\{\(leads\?\.length \?\? 0\) >= POSTGREST_MAX_ROWS\}/, file)
    }
  })

  test('el CRM del super pide leads y administradores EN PARALELO (antes una consulta esperaba a la otra)', () => {
    const source = code('app/(portal)/super/crm/page.tsx')
    assert.match(source, /const \[leadsResult, adminsResult\] = await Promise\.all\(\[/)
    assert.equal((source.match(/await supabase/g) ?? []).length, 0, 'no debe quedar ninguna consulta suelta esperada en serie')
  })

  test('la tabla y las tarjetas pintan de 50 en 50 con «Cargar más», y el filtro vuelve a la primera tanda', () => {
    assert.equal(LEADS_PAGE_SIZE, 50)
    assert.equal(POSTGREST_MAX_ROWS, 1000)
    const source = code('components/portal/crm-leads-table.tsx')
    assert.match(source, /const mostrados = visibles\.slice\(0, visibleCount\)/)
    assert.equal((source.match(/mostrados\.map\(/g) ?? []).length, 2, 'las dos maquetaciones pintan solo `mostrados`')
    assert.doesNotMatch(source, /visibles\.map\(/)
    assert.match(source, /onClick=\{\(\) => setVisibleCount\(\(count\) => count \+ LEADS_PAGE_SIZE\)\}/)
    assert.match(source, /setFiltro\(next\)\s*setVisibleCount\(LEADS_PAGE_SIZE\)/)
  })

  test('los conteos de los chips siguen contando TODOS los leads, no solo los mostrados', () => {
    assert.match(code('components/portal/crm-leads-table.tsx'), /<ContactStatusFilter\s+leads=\{leads\}/)
  })
})

describe('riel del menú del portal', () => {
  const source = code('components/portal/portal-sidebar.tsx')

  test('se expande solo con el RATÓN: en iPad horizontal el toque no lo abre', () => {
    assert.match(source, /onPointerEnter=\{handlePointerEnter\}/)
    assert.match(source, /onPointerLeave=\{handlePointerLeave\}/)
    assert.equal((source.match(/event\.pointerType !== 'mouse'/g) ?? []).length, 2)
    assert.doesNotMatch(source, /onMouseEnter|onMouseLeave/, '`mouseenter` también lo dispara el toque (Safari lo emula)')
  })
})
