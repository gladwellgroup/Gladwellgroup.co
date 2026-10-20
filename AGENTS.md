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
  brand/                fuente wordmark (favicon + OG)
  og/                   gladwell-og.png (Open Graph 1200×630)
  images/               assets activos (~9 MB tras optimización)
  *.png                 favicon y apple-icon
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

### Imágenes y efectos pesados (la landing se mide: ver `tests/landing-perf.test.ts`)

- **Toda `<Image fill>` declara `sizes`** con el ancho real por breakpoint. Sin él, `next/image` asume
  `100vw` y pide la foto a 1 920–3 840 px para una tarjeta de ~390: más bytes y, sobre todo, tirones al
  decodificarla durante el scroll. Usar `calc(100vw - 48px)` y no `100vw` para el caso móvil (si no,
  Next descarta las variantes chicas).
- **Nada de `blur-2xl`/`blur-3xl` sobre áreas grandes**: Safari rehace ese desenfoque cada vez que el
  bloque entra en pantalla (fotogramas de 100–130 ms). Para un brillo de fondo usar `.glow-violet` /
  `.glow-cyan` (degradado radial) en `app/globals.css`.
- **Al reemplazar una foto de `public/images/`, usar un nombre nuevo**: el CDN y el navegador pueden
  conservar la anterior bajo la misma URL.
- **El fondo del hero pide UNA foto por tema y pantalla** (`components/sections/hero-background.tsx`:
  `getImageProps` + `<picture>`, fotos importadas). No volver a un `background-image` en línea (descarga las
  fotos oscura y clara a la vez) ni a `priority`/`preload` (precargarían los dos breakpoints).
- **Los círculos decorativos del fondo son degradados** (`lib/data/decor-orbs.ts` →
  `lib/landing/orb-gradient.ts`), no `box-shadow` ni relleno en el elemento: en Chrome/Android el relleno
  translúcido de círculos de 500–800 px costaba tanto como la sombra. Para añadir uno, una entrada en esa tabla.
- Al medir el scroll, hacerlo en WebKit (el motor de Safari) y en Chromium con perfil móvil: lo que
  solo falla en Safari no se ve en Chrome.

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
npm test            # pruebas (node:test + tsx) en tests/
npm run build       # build verde
```

---

## Portal interno

La documentación de producto del portal (roles, permisos, flujos, Terapia Organizacional) vive en
[`docs/plataforma-historia-y-usuarios.md`](docs/plataforma-historia-y-usuarios.md).

La matriz de permisos está codificada en `lib/permissions/` (`roles.ts` + `matrix.ts`).
Mantener sincronizados ambos archivos al agregar permisos o roles.

Las rutas del portal viven en `app/(portal)/`; la landing pública sigue en `app/(public)/`.

---

## Tablet y pantallas táctiles

El equipo usa el portal sobre todo en iPad. La parrilla y sus modales ya siguen estas reglas;
las demás vistas del portal deben adoptarlas al tocarlas:

- **El ancho no decide si algo es táctil.** 1024 px (`lg:`) separa menú móvil de escritorio, pero un
  iPad horizontal supera ese corte y sigue siendo un dedo. La ergonomía táctil se activa con
  `pointer-coarse:` y la densidad de escritorio con `pointer-fine:` (`lg:pointer-fine:` para "ancho y
  ratón"): objetivos de **44 px** (Apple HIG) y campos de **16 px** (con menos, Safari hace zoom al
  enfocar) solo al tacto. `.modal-field` y `BrandButton size="sm"` ya lo hacen.
- **`hover:` no existe al tacto** (Tailwind lo envuelve en `@media (hover: hover)`). Lo que solo se
  descubre pasando el ratón (el "+" de cada día) necesita una alternativa visible, y el feedback al
  pulsar va en `active:`. Arrastrar con el dedo no es fiable: ofrecer otra vía (selector de fecha).
- **Modales, hojas y confirmaciones: `Dialog` de Radix, nunca un `fixed inset-0` propio.** Safari ata
  cualquier `fixed` a un ancestro con `transform`, `translate` o `backdrop-filter` (`.glass`,
  `.portal-header`, el propio `DialogContent`): la capa se dibuja del tamaño del ancestro y, con scroll,
  fuera de pantalla. `ConfirmDialog` ya está sobre `Dialog`.
- **`dvh`, no `vh`**, en alturas máximas: `vh` ignora las barras del navegador del iPad. En modales
  largos, cabecera y pie fijos y scroll solo en el cuerpo (ver `parrilla-post-dialog.tsx`).
- **`<select>` nativo:** WebKit ignora su `padding` y `min-height`; el alto táctil se fija con `height`.
- **Verificar con WebKit real** (el motor de Safari; Chrome no reproduce estos fallos), con perfil de
  iPad táctil en vertical y horizontal. Lo que ningún emulador cubre (teclado en pantalla, selector de
  fecha nativo de iOS) se valida en un iPad.

---

## Rate limiting

El endpoint `/api/walking-list` no tiene rate limiting activo. Está documentado como
tarea post-lanzamiento (Vercel Firewall).
