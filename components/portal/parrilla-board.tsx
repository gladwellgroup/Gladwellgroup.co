'use client'

import { useMemo, useState } from 'react'
import { Instagram, Linkedin, Youtube } from 'lucide-react'
import { ParrillaCalendar } from '@/components/portal/parrilla-calendar'
import {
  DATE_FIELD_LABELS,
  PARRILLA_CATEGORIES,
  PARRILLA_CATEGORY_LABELS,
  PLATFORM_LABELS,
  PLATFORMS,
  type ParrillaCategory,
  type ParrillaDateField,
  type ParrillaEditor,
  type ParrillaPost,
  type Platform,
} from '@/lib/parrilla/posts'

type CategoryFilterValue = ParrillaCategory | 'todas'

const DATE_FIELDS: ParrillaDateField[] = ['production_date', 'publish_date']

const PLATFORM_ICONS: Record<Platform, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
}

/** El control más importante de la página — decide qué fecha organiza TODO
 *  el calendario, no es un filtro más — por eso lleva su propia leyenda y
 *  más peso visual que los chips de plataforma/categoría de abajo.
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
      <div className="inline-flex rounded-full border border-border bg-muted/30 p-1">
        {DATE_FIELDS.map((field) => {
          const active = field === value
          return (
            <button
              key={field}
              type="button"
              onClick={() => onChange(field)}
              aria-pressed={active}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-[#7C3AED] text-white shadow-[0_0_20px_rgba(124,58,237,0.35)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {DATE_FIELD_LABELS[field]}
            </button>
          )
        })}
      </div>
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
  posts: ParrillaPost[]
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
        className={`flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:w-auto ${
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
            className={`flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:w-auto ${
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
 *  una categoría — no tiene sentido "coincide con varias" acá. */
function CategoryFilter({
  posts,
  value,
  onChange,
}: {
  posts: ParrillaPost[]
  value: CategoryFilterValue
  onChange: (value: CategoryFilterValue) => void
}) {
  const counts = new Map<ParrillaCategory, number>()
  for (const p of posts) {
    if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1)
  }

  const visibles = PARRILLA_CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0)
  if (visibles.length < 2) return null

  const opciones: { key: CategoryFilterValue; label: string; count: number }[] = [
    { key: 'todas', label: 'Todas', count: posts.length },
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
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
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
  posts: ParrillaPost[]
  editors: ParrillaEditor[]
}

/** Orquesta las dos vistas del mismo calendario (producción / publicación) y
 *  los filtros por plataforma y categoría — ParrillaCalendar sigue siendo
 *  "tonta": solo sabe dibujar `posts` según la fecha (`dateField`) que le
 *  pasen. */
export function ParrillaBoard({ posts, editors }: ParrillaBoardProps) {
  const [dateField, setDateField] = useState<ParrillaDateField>('publish_date')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>('todas')

  const platformFiltered = useMemo(() => {
    if (selectedPlatforms.length === 0) return posts
    return posts.filter((p) => p.platforms.some((pl) => selectedPlatforms.includes(pl)))
  }, [posts, selectedPlatforms])

  const filteredPosts = useMemo(() => {
    if (categoryFilter === 'todas') return platformFiltered
    return platformFiltered.filter((p) => p.category === categoryFilter)
  }, [platformFiltered, categoryFilter])

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  return (
    <div className="space-y-4">
      <ViewTabs value={dateField} onChange={setDateField} />
      <PlatformFilter
        posts={posts}
        selected={selectedPlatforms}
        onToggle={togglePlatform}
        onClear={() => setSelectedPlatforms([])}
      />
      <CategoryFilter posts={platformFiltered} value={categoryFilter} onChange={setCategoryFilter} />
      <ParrillaCalendar posts={filteredPosts} dateField={dateField} editors={editors} />
    </div>
  )
}
