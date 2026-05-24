# AGENTS.md — Gladwell Landing

Guía de referencia rápida para desarrolladores humanos y agentes IA que trabajen en este repositorio.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Estilos | Tailwind CSS 4 |
| Componentes UI | shadcn/ui (mínimo: button, carousel, sheet, dialog) |
| Backend | Supabase (Postgres) |
| Deploy | Vercel |
| CI | GitHub Actions (`ci.yml`) |

---

## Estructura de carpetas

```
app/
  page.tsx              página principal
  layout.tsx            metadata, fuentes, ThemeProvider
  globals.css           tokens CSS, utilidades globales
  api/walking-list/     POST handler para leads
  sitemap.ts / robots.ts

components/
  layout/               navbar, footer, content-background
  sections/             hero, video, pillars, gallery, team
  modals/               walking-list-modal, pillar-modal
  providers/            theme-provider, walking-list-provider
  shared/               Section, SectionDivider, SectionHeader
  ui/                   shadcn (button, carousel, sheet, dialog)

lib/
  site.ts               SITE_URL, SITE_NAME, SITE_LOCALE, SITE_DESCRIPTION
  data/
    pillars.ts          tipo Pillar + array PILLARS
    founders.ts         tipo Founder + array FOUNDERS
    concepts.ts         tipo Concept + array CONCEPTS
    navigation.ts       NAV_LINKS, FOOTER_NAV_LINKS, HERO_INDICATORS
  supabase/server.ts    getSupabaseServer() — lazy init
  validations/          zod schemas

public/
  images/               assets activos (~9 MB tras optimización)
  *.png / *.svg         iconos OG y favicon
```

---

## Convenciones para el trabajo en equipo

### Añadir una nueva sección

1. Crear `components/sections/nombre-section.tsx`.
2. Envolver con `<Section id="..." withDivider>` desde `@/components/shared`.
3. Usar `<SectionHeader eyebrow="..." title="..." />` para el encabezado.
4. Exportar el componente e importarlo en `app/page.tsx`.
5. Si hay datos de contenido (>5 ítems), extraerlos a `lib/data/nombre.ts`.

### Añadir un nuevo pilar

Editar únicamente `lib/data/pillars.ts` — añadir un objeto al array `PILLARS`.  
No modificar `pillars-section.tsx` ni `pillar-modal.tsx`.

### Añadir links de navegación

Editar únicamente `lib/data/navigation.ts` — las tres superficies (navbar, footer, hero)
leen desde esta fuente. Añadir en `NAV_LINKS` y `FOOTER_NAV_LINKS` según corresponda.

### Añadir un componente shadcn

```bash
npx shadcn@latest add <componente>
```

Solo instalar lo que se usará activamente.

### Variables de entorno

Nunca commitear `.env*.local`. Las variables requeridas son:

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Documentadas en `.env.example`. Para CI/CD, configurarlas como secrets en GitHub y como
variables de entorno en el proyecto Vercel.

---

## Comandos QA (ejecutar antes de cada push)

```bash
npm run lint        # 0 errores
npm run build       # build verde
```

---

## Rate limiting

El endpoint `/api/walking-list` no tiene rate limiting activo. Está documentado como
tarea post-lanzamiento (Vercel Firewall).
