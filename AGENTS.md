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
  sections/             hero, presentation, pillars, video, gallery, team
  modals/               walking-list-modal, pillar-modal
  providers/            theme-provider, walking-list-provider
  shared/               Section, SectionCaption, SectionDivider, SectionHeader, VideoFacade
  ui/                   shadcn (button, carousel, sheet, dialog)

lib/
  site.ts               SITE_URL, SITE_NAME, SITE_LOCALE, SITE_DESCRIPTION
  data/
    pillars.ts          tipo Pillar + array PILLARS
    founders.ts         tipo Founder + array FOUNDERS
    concepts.ts         tipo Concept + array CONCEPTS
    navigation.ts       NAV_LINKS, FOOTER_NAV_LINKS, HERO_INDICATORS
  youtube.ts            miniatura y reproductor de un video de YouTube (valida el id)
  supabase/server.ts    getSupabaseServer() — lazy init
  supabase/fetch.ts     fetchWithTimeout: tope de tiempo de todo cliente de Supabase (ver «Datos, sesión y errores»)
  supabase/must.ts      must(): un fallo de consulta lanza, no se confunde con «sin datos»
  auth/                 sesión de páginas (session.ts) y de APIs (api.ts)
  api/                  withApiErrors y respuestas JSON de las rutas
  deliverables/         claim, send-batch, idempotency: procesos largos y envíos sin duplicar
  validations/          zod schemas

hooks/                  use-save-queue, use-flush-on-leave, use-deliverable-processing, use-is-client…
proxy.ts                protege las rutas del portal (en Next 16 es el antiguo middleware.ts)
vercel.json             región de las funciones: gru1 (São Paulo, la misma que Supabase)

public/
  brand/                fuente wordmark (favicon + OG)
  og/                   gladwell-og.png (Open Graph 1200×630)
  images/               assets activos (~9 MB tras optimización)
  *.png                 favicon y apple-icon
```

---

## Convenciones para el trabajo en equipo

### Añadir una nueva sección

1. Crear `components/sections/nombre-section.tsx`, como componente de servidor siempre que se pueda: lo que necesita
   estado en el navegador va en un hijo pequeño (como `VideoFacade`), no en toda la sección.
2. Abrir con `<section id="..." className="relative py-24 scroll-mt-24">` y `<SectionDivider />`, y encabezar con
   `<SectionHeader eyebrow="..." title="..." />` (los dos vienen de `@/components/shared`). Así lo hacen todas las secciones y
   `tests/landing-sections.test.ts` lee ese `id`; el `<Section>` compartido existe, pero ninguna sección lo usa.
3. Exportarlo e importarlo en `app/page.tsx`, en el lugar donde debe aparecer.
4. Añadir su número en `HERO_INDICATORS` (`lib/data/navigation.ts`), en el mismo orden que la página: la prueba anterior falla si
   no coinciden. Un enlace en la barra superior es aparte (`NAV_LINKS`).
5. Si hay datos de contenido (>5 ítems), extraerlos a `lib/data/nombre.ts`.
6. Un video de YouTube va con `VideoFacade` (`components/shared/video-facade.tsx`): hasta el clic solo carga la miniatura.
   Comprobar antes que esa miniatura exista: `maxresdefault` solo la tienen los videos subidos en HD (si no, `sddefault`).
   El texto bajo el video va en `SectionCaption` (16 px en el celular, 20 desde `md` y 24 desde `lg`): a 16 px en escritorio
   casi no se leía.

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
npm run lint                  # 0 errores y 0 avisos
npm test                      # pruebas (node:test + tsx) en tests/
npm run build                 # build verde y sin avisos
npm audit --omit=dev          # 0 vulnerabilidades de producción
```

Node 22 o superior (`engines` de `package.json`; el CI corre 22 y 24). `next-env.d.ts` lo reescribe Next en cada
build: no se commitea.

---

## Portal interno

La documentación de producto del portal (roles, permisos, flujos, Terapia Organizacional) vive en
[`docs/plataforma-historia-y-usuarios.md`](docs/plataforma-historia-y-usuarios.md).

La matriz de permisos está codificada en `lib/permissions/` (`roles.ts`, `matrix.ts` y `modules.ts`).
Mantener sincronizados esos archivos al agregar permisos, módulos o roles. La tabla de la sección 5 del documento
de producto debe decir lo mismo: `tests/permissions-doc.test.ts` falla si no coincide (y exige marcar «Reservado»
a los permisos que ningún código comprueba todavía).

### Datos, sesión y errores

Reglas que salieron del QA del 2026-10-22 (cada una cierra un fallo real; las pruebas de `tests/` las vigilan):

- **Una consulta que falla no es «sin datos».** En el servidor se envuelve con `must(await supabase…, 'contexto')`
  (`lib/supabase/must.ts`): si falló, lanza y la pantalla de error ofrece reintentar, en vez de mostrar una lista
  vacía, un 404 o un 403 falsos. «No existe» es `maybeSingle()` con `null`.
- **Todo cliente de Supabase, del servidor o del navegador, lleva `global: { fetch: fetchWithTimeout }`** (`lib/supabase/fetch.ts`):
  8 s las lecturas y Auth, 30 s las escrituras, Storage sin tope. Aborta con `AbortError` y no con `TimeoutError`:
  postgrest-js reintenta los GET que fallan por cualquier otra causa y una consulta colgada tardaba 39 s en fallar.
- **Sesión.** En páginas: `getSession`, `requireAuth`, `requirePermission` (`lib/auth/session.ts`). En rutas de API:
  `requireApiUser` y `requireApiPermission` (`lib/auth/api.ts`). Distinguen «no hay sesión» (login o 401) de «Auth o la
  base no contestaron» (pantalla de error o 503): una caída nunca cierra la sesión ni responde 401, 403 o 404. Las
  páginas verifican la firma del token en local (`getClaims()`; una sesión revocada se ve hasta que vence, 1 h como
  máximo); las rutas que escriben vuelven a validar con `getUser()`.
- **`proxy.ts`** protege las rutas listadas en `lib/data/portal-routes.ts` (`PORTAL_PREFIXES`, que una prueba compara
  con las carpetas de `app/(portal)/`). Borra el header entrante `x-gladwell-user-id` y lo fija con el id verificado:
  nunca leerlo en una ruta que el `matcher` no cubra.
- **Rutas de API:** `export const POST = withApiErrors(async (request) => …)` (`lib/api/with-errors.ts`): un fallo de
  consulta sale como 503 y cualquier otro como 500, siempre en JSON. Un conflicto de estado (ya enviado, archivado,
  otro proceso en curso) es **409**; 403 es solo «sin permiso». Para registrar un error, `logError(scope, error)`
  (`lib/log.ts`): escribe `{code, message}` y nunca el objeto entero (puede traer datos personales).
- **Pantallas de error, carga y 404:** `app/error.tsx`, `app/global-error.tsx` y `error`, `loading` y `not-found` de
  `app/(portal)/`, con los textos de `lib/data/error-copy.ts`. Un `error.tsx` no atrapa los fallos del layout de su
  propia carpeta: por eso hay uno en la raíz y otro en el portal.
- **Formularios largos:** autoguardado con `useSaveQueue` (un guardado en vuelo, se repite si hay algo nuevo) y
  `useFlushOnLeave`, que manda lo pendiente al salir o pasar a segundo plano con `keepalive` (en iPad solo es fiable
  `visibilitychange`). No se re-sincronizan los campos desde el servidor mientras hay cambios sin guardar. Las listas
  hijas se guardan insertando primero y borrando después (`lib/supabase/replace-rows.ts`), nunca al revés.
- **Procesos largos y envíos** (síntesis de un entregable, aprobar): reclamo atómico (`lib/deliverables/claim.ts`) y
  409 si ya hay uno vivo; el editor sondea `…/deliverables/status` en vez de repetir `router.refresh()`. Los correos
  llevan `Idempotency-Key` de Resend (`lib/deliverables/idempotency.ts`): un doble toque en «Aprobar» no duplica envíos.
- **Fechas:** «hoy» se calcula en Bogotá (`todayKey`, `lib/date.ts`) también en el servidor: las funciones de Vercel
  corren en UTC y `TZ` es una variable reservada que no se puede cambiar.
- **Enlaces y archivos que escribe una persona:** `safeHttpUrl` (`lib/url.ts`, solo http y https, nunca `javascript:`),
  archivos solo del Storage del proyecto (`lib/storage/hosts.ts`) y descargas con tope de tamaño leído del flujo
  (`lib/http/read-limited.ts`).
- **Cabeceras de seguridad** en `next.config.mjs` (`SECURITY_HEADERS`). Sin CSP completa: chocaría con Next, YouTube y
  Analytics.
- **Producción comparte la base con local.** Una migración aplicada ya está viva para el código desplegado: el orden es
  código primero y SQL después si la migración quita algo que el código viejo usa (`20260923` va después de desplegar).
  Nunca se edita una migración ya aplicada; cada una trae su bloque REVERTIR y consultas de verificación.
- **Procesos locales:** nunca `pkill -f` ni `killall` con nombres genéricos (`next-server`, `next start`): matan el
  `next dev` de quien trabaja. Se guarda el PID de lo que uno arranca y se cierra solo ese.

Las rutas del portal viven en `app/(portal)/`; la landing pública sigue en `app/(public)/`.

---

## Tablet y pantallas táctiles

El equipo usa el portal sobre todo en iPad. La parrilla y sus modales ya siguen estas reglas;
las demás vistas del portal deben adoptarlas al tocarlas:

- **El ancho no decide si algo es táctil.** 1024 px (`lg:`) separa menú móvil de escritorio, pero un
  iPad horizontal supera ese corte y sigue siendo un dedo. La ergonomía táctil se activa con
  `pointer-coarse:` y la densidad de escritorio con `pointer-fine:` (`lg:pointer-fine:` para "ancho y
  ratón"): objetivos de **44 px** (Apple HIG) y campos de **16 px** (con menos, Safari hace zoom al
  enfocar) solo al tacto. `.modal-field` y `BrandButton size="sm"` ya lo hacen. Un botón de icono o de texto
  suelto (X de eliminar, «Agregar…», chips) lleva `pointer-coarse:size-11` o `pointer-coarse:min-h-11`; los ya
  corregidos están inventariados en `tests/touch.test.ts` (al añadir uno, súmalo a esa lista).
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
- **Tablas (Banco y Frases de la Parrilla, `parrilla-table.tsx`):** una celda de texto libre lleva siempre un
  ancho tope + `line-clamp-2` (y `title` con el texto completo): un valor largo ensancha TODA la tabla (un
  referente de 120 caracteres sumaba 657 px). Las columnas secundarias se ocultan por el ancho de la TABLA
  (`@container` + `hidden` con `table-cell` desde un ancho mínimo, ver `parrilla-quotes.tsx`; no se escribe aquí la
  clase literal porque Tailwind también escanea este archivo y generaría CSS inválido) y no por el de la pantalla,
  para que la acción principal —la
  última columna— no quede fuera de vista en un iPad horizontal; si se añade una columna, hay que revisar ese
  umbral. Se verifica en WebKit con datos de peor caso, no con los de ejemplo.
- **Verificar con WebKit real** (el motor de Safari; Chrome no reproduce estos fallos), con perfil de
  iPad táctil en vertical y horizontal. Lo que ningún emulador cubre (teclado en pantalla, selector de
  fecha nativo de iOS) se valida en un iPad.

---

## Rate limiting

Ni `/api/walking-list` (formulario público) ni `/api/attendance/*` (registro de asistencia por QR, también público)
tienen rate limiting activo. Está pendiente de configurar en el Firewall de Vercel, por IP.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
