'use client'

import { useMemo, useState } from 'react'
import { ParrillaBank } from '@/components/portal/parrilla-bank'
import { ParrillaCalendar } from '@/components/portal/parrilla-calendar'
import { ParrillaQuotes } from '@/components/portal/parrilla-quotes'
import { PLATFORM_ICONS } from '@/components/portal/parrilla-shared'
import {
  DATE_FIELD_LABELS,
  PARRILLA_CATEGORIES,
  PARRILLA_CATEGORY_LABELS,
  PLATFORM_LABELS,
  PLATFORMS,
  type ParrillaCategory,
  type ParrillaDateField,
  type ParrillaEditor,
  type ParrillaPostSummary,
  type Platform,
} from '@/lib/parrilla/posts'
import { distinctAuthors, type ParrillaQuote } from '@/lib/parrilla/quotes'

type CategoryFilterValue = ParrillaCategory | 'todas'

const DATE_FIELDS: ParrillaDateField[] = ['production_date', 'publish_date']

/** Control segmentado de la página: el mismo aspecto para elegir qué se ve
 *  (Calendario / Banco / Frases) y qué fecha organiza el calendario (Producción /
 *  Publicación).
 *
 *  Con tres pestañas ya no caben en un teléfono (≈ 343 px de ancho útil): bajo
 *  `sm` el relleno es menor y una opción puede traer `shortLabel` («Banco»). La
 *  etiqueta corta y la larga son dos `span` hermanos y `display: none` saca de
 *  `sm` para arriba / para abajo al que no se ve, así que el nombre accesible es
 *  siempre el texto visible (WCAG 2.5.3, «label in name») — por eso no se usa un
 *  `aria-label` que lo pise. Al tacto el relleno vuelve a crecer desde `sm`. */
function PillTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; shortLabel?: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-full border border-border bg-muted/30 p-1"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors pointer-coarse:min-h-11 sm:px-5 sm:pointer-coarse:px-6 ${
              active
                ? 'bg-[#7C3AED] text-white shadow-[0_0_20px_rgba(124,58,237,0.35)]'
                : 'text-muted-foreground hover:text-foreground active:text-foreground'
            }`}
          >
            {option.shortLabel ? (
              <>
                <span className="sm:hidden">{option.shortLabel}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </>
            ) : (
              option.label
            )}
            {option.count !== undefined && (
              <span className="tabular-nums opacity-70">{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const DATE_FIELD_OPTIONS = DATE_FIELDS.map((field) => ({
  value: field,
  label: DATE_FIELD_LABELS[field],
}))

/** El control más importante del calendario — decide qué fecha lo organiza
 *  TODO, no es un filtro más — por eso lleva su propia leyenda y más peso
 *  visual que los chips de plataforma/categoría de abajo.
 *  `self-center` no servía de nada acá: el padre (`space-y-4`) no es un
 *  contenedor flex, así que ese alineamiento nunca se aplicaba y el control
 *  quedaba pegado a la izquierda mientras todo lo demás sí se centraba. */
function ViewTabs({
  value,
  onChange,
}: {
  value: ParrillaDateField
  onChange: (value: ParrillaDateField) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Ver calendario por
      </span>
      <PillTabs options={DATE_FIELD_OPTIONS} value={value} onChange={onChange} />
    </div>
  )
}

/** Multi-select: un post con varias plataformas cuenta en cada chip que
 *  coincida, y "Todas" no es un valor propio — es simplemente no tener
 *  nada seleccionado. */
function PlatformFilter({
  posts,
  selected,
  onToggle,
  onClear,
}: {
  posts: ParrillaPostSummary[]
  selected: Platform[]
  onToggle: (platform: Platform) => void
  onClear: () => void
}) {
  const counts = new Map<Platform, number>()
  for (const p of posts) {
    for (const platform of p.platforms) {
      counts.set(platform, (counts.get(platform) ?? 0) + 1)
    }
  }

  return (
    // "Todas" + las 3 plataformas son siempre 4 chips — en grilla 2x2 en
    // móvil (en vez de flex-wrap, que los desbalancea 3+1) y en fila en
    // pantallas más anchas, donde sí caben los 4 sin desorden.
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
      <button
        type="button"
        onClick={onClear}
        aria-pressed={selected.length === 0}
        className={`flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-11 pointer-coarse:px-4 pointer-coarse:text-sm sm:w-auto ${
          selected.length === 0
            ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]'
            : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
        }`}
      >
        Todas
        <span className="tabular-nums opacity-70">{posts.length}</span>
      </button>
      {PLATFORMS.map((platform) => {
        const Icon = PLATFORM_ICONS[platform]
        const active = selected.includes(platform)
        return (
          <button
            key={platform}
            type="button"
            onClick={() => onToggle(platform)}
            aria-pressed={active}
            className={`flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-11 pointer-coarse:px-4 pointer-coarse:text-sm sm:w-auto ${
              active
                ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]'
                : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            <Icon className="size-3.5" />
            {PLATFORM_LABELS[platform]}
            <span className="tabular-nums opacity-70">{counts.get(platform) ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Single-select: a diferencia de plataformas, cada post tiene como mucho
 *  una categoría — no tiene sentido "coincide con varias" acá. Solo lee
 *  `category`, así que sirve igual para las publicaciones que para las frases.
 *
 *  La fila se oculta con menos de dos categorías (un solo chip no filtra nada)…
 *  salvo que haya un filtro ACTIVO: si la última pieza de esa categoría se borra o
 *  cambia de categoría, el filtro seguía puesto, la lista quedaba vacía y, sin la
 *  fila, no había ningún chip para quitarlo (solo cambiar de pestaña). Así la
 *  categoría activa se queda con su chip —con el conteo en 0— y «Todas» sigue ahí.
 *  Exportada para probarla sin dibujar el tablero. */
export function CategoryFilter({
  items,
  value,
  onChange,
}: {
  items: readonly { category: ParrillaCategory | null }[]
  value: CategoryFilterValue
  onChange: (value: CategoryFilterValue) => void
}) {
  const counts = new Map<ParrillaCategory, number>()
  for (const item of items) {
    if (item.category) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
  }

  const visibles = PARRILLA_CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0 || c === value)
  if (value === 'todas' && visibles.length < 2) return null

  const opciones: { key: CategoryFilterValue; label: string; count: number }[] = [
    { key: 'todas', label: 'Todas', count: items.length },
    ...visibles.map((c) => ({ key: c as CategoryFilterValue, label: PARRILLA_CATEGORY_LABELS[c], count: counts.get(c) ?? 0 })),
  ]

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {opciones.map((opcion) => {
        const activo = opcion.key === value
        return (
          <button
            key={opcion.key}
            type="button"
            onClick={() => onChange(opcion.key)}
            aria-pressed={activo}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-11 pointer-coarse:px-4 pointer-coarse:text-sm ${
              activo
                ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]'
                : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {opcion.label}
            <span className="tabular-nums opacity-70">{opcion.count}</span>
          </button>
        )
      })}
    </div>
  )
}

interface ParrillaBoardProps {
  posts: ParrillaPostSummary[]
  editors: ParrillaEditor[]
  /** La biblioteca de frases de referentes históricos (pestaña «Frases»). */
  quotes: ParrillaQuote[]
}

type BoardView = 'calendario' | 'banco' | 'frases'

/** Orquesta el calendario (con sus dos vistas, producción / publicación), el
 *  Banco de contenido, la biblioteca de frases y los filtros por plataforma y
 *  categoría, que aplican a la pestaña activa. ParrillaCalendar, ParrillaBank y
 *  ParrillaQuotes siguen siendo "tontos": solo dibujan lo que les pasen. Lo
 *  archivado vive en el Banco y no en el calendario: no tiene fecha de
 *  publicación. Las frases no tienen plataforma, así que en esa pestaña solo
 *  aplica el filtro de categoría. */
export function ParrillaBoard({ posts, editors, quotes }: ParrillaBoardProps) {
  const [view, setView] = useState<BoardView>('calendario')
  const [dateField, setDateField] = useState<ParrillaDateField>('publish_date')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>('todas')

  const { scheduled, archived } = useMemo(() => {
    const scheduled: ParrillaPostSummary[] = []
    const archived: ParrillaPostSummary[] = []
    for (const post of posts) (post.status === 'archivado' ? archived : scheduled).push(post)
    return { scheduled, archived }
  }, [posts])

  const scoped = view === 'banco' ? archived : scheduled

  const platformFiltered = useMemo(() => {
    if (selectedPlatforms.length === 0) return scoped
    return scoped.filter((p) => p.platforms.some((pl) => selectedPlatforms.includes(pl)))
  }, [scoped, selectedPlatforms])

  const filteredPosts = useMemo(() => {
    if (categoryFilter === 'todas') return platformFiltered
    return platformFiltered.filter((p) => p.category === categoryFilter)
  }, [platformFiltered, categoryFilter])

  const filteredQuotes = useMemo(() => {
    if (categoryFilter === 'todas') return quotes
    return quotes.filter((q) => q.category === categoryFilter)
  }, [quotes, categoryFilter])
  const authors = useMemo(() => distinctAuthors(quotes), [quotes])
  const anyQuoteUsed = useMemo(() => quotes.some((q) => q.used_count > 0), [quotes])

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  // Los filtros se limpian al cambiar de pestaña: una categoría sin piezas en
  // la otra pestaña dejaría la lista vacía y, con menos de dos categorías, sin
  // el chip para quitar el filtro.
  function changeView(next: BoardView) {
    setView(next)
    setSelectedPlatforms([])
    setCategoryFilter('todas')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <PillTabs
          ariaLabel="Parrilla"
          options={[
            { value: 'calendario', label: 'Calendario', count: scheduled.length },
            {
              value: 'banco',
              label: 'Banco de contenido',
              shortLabel: 'Banco',
              count: archived.length,
            },
            { value: 'frases', label: 'Frases', count: quotes.length },
          ]}
          value={view}
          onChange={changeView}
        />
      </div>
      {view === 'calendario' && <ViewTabs value={dateField} onChange={setDateField} />}
      {view !== 'frases' && (
        <PlatformFilter
          posts={scoped}
          selected={selectedPlatforms}
          onToggle={togglePlatform}
          onClear={() => setSelectedPlatforms([])}
        />
      )}
      <CategoryFilter
        items={view === 'frases' ? quotes : platformFiltered}
        value={categoryFilter}
        onChange={setCategoryFilter}
      />
      {view === 'calendario' ? (
        <ParrillaCalendar posts={filteredPosts} dateField={dateField} editors={editors} />
      ) : view === 'banco' ? (
        <ParrillaBank posts={filteredPosts} total={archived.length} editors={editors} />
      ) : (
        <ParrillaQuotes
          quotes={filteredQuotes}
          total={quotes.length}
          anyUsed={anyQuoteUsed}
          authors={authors}
          editors={editors}
        />
      )}
    </div>
  )
}
