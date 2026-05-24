# Gladwell Landing

Landing page de [Gladwell](https://gladwellgroup-landing.vercel.app) — comunidad de estrategas con los pilares Experience, Consulting y Education.

Stack: **Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase · Vercel**

---

## Setup local

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-org/gladwell-landing.git
cd gladwell-landing
npm install
```

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores:

```bash
cp .env.example .env.local
```

| Variable | Dónde obtenerla |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role secret |

> La `SUPABASE_SERVICE_ROLE_KEY` **nunca** debe ir en variables `NEXT_PUBLIC_*` ni en Git.

### 3. Base de datos Supabase

Ejecuta el siguiente SQL en **Supabase → SQL Editor**:

```sql
create table if not exists public.walking_list_leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) >= 2),
  apellidos text not null check (char_length(trim(apellidos)) >= 2),
  correo text not null check (correo ~* '^[^@]+@[^@]+\.[^@]+$'),
  red_social text not null check (red_social in ('linkedin', 'instagram')),
  perfil text,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

create unique index if not exists walking_list_leads_correo_unique
  on public.walking_list_leads (lower(trim(correo)));

create index if not exists walking_list_leads_created_at_idx
  on public.walking_list_leads (created_at desc);

alter table public.walking_list_leads enable row level security;
```

### 4. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción local |
| `npm run lint` | ESLint (0 errores esperado) |

---

## Estructura del proyecto

```
app/
  page.tsx                       composición de secciones + WalkingListProvider
  layout.tsx                     metadata SEO, fuentes, ThemeProvider
  globals.css                    tokens CSS y utilidades globales
  api/walking-list/route.ts      POST → registra leads en Supabase
  sitemap.ts / robots.ts

components/
  layout/    navbar.tsx  footer.tsx  content-background.tsx
  sections/  hero  video  pillars  gallery  team
  modals/    walking-list-modal  pillar-modal  (shadcn Dialog)
  providers/ theme-provider  walking-list-provider
  shared/    Section  SectionDivider  SectionHeader
  ui/        button  carousel  sheet  dialog  (shadcn mínimo)

lib/
  site.ts                        SITE_URL, SITE_NAME, SITE_LOCALE, SITE_DESCRIPTION
  data/
    pillars.ts                   tipo Pillar + array PILLARS
    founders.ts                  tipo Founder + array FOUNDERS
    concepts.ts                  tipo Concept + array CONCEPTS
    navigation.ts                NAV_LINKS, FOOTER_NAV_LINKS, HERO_INDICATORS
  supabase/server.ts             getSupabaseServer() — lazy init
  validations/walking-list.ts    schema Zod del formulario

public/
  brand/gladwell-logo-wordmark.png   fuente de favicon y OG (wordmark oficial)
  og/gladwell-og.png                 imagen Open Graph 1200×630 (redes / WhatsApp)
  images/  (~9 MB — optimizadas con calidad 82)
  apple-icon.png  icon-dark-32x32.png  icon-light-32x32.png
app/icon.png                         favicon 512px (convención Next.js)
```

`SITE_URL` en `lib/site.ts` debe ser el dominio canónico de producción (`https://www.gladwellgroup.co`).

### Regenerar assets de marca

Tras sustituir el PNG en `public/brand/`:

```bash
npm run generate:favicons
npm run generate:og
```

### Vista previa al compartir en WhatsApp

WhatsApp cachea la miniatura del enlace. Tras un deploy:

1. Abre [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) y pega `https://www.gladwellgroup.co` → **Volver a recopilar**.
2. Prueba en WhatsApp una URL nueva, por ejemplo `https://www.gladwellgroup.co/?v=og1`.

---

## Deploy en Vercel

1. Conecta el repositorio en [vercel.com](https://vercel.com).
2. En **Settings → Environment Variables** añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Vercel detecta Next.js automáticamente. El deploy se activa en cada push a `main`.

### Secrets para GitHub Actions (CI)

En **GitHub → Settings → Secrets and variables → Actions** añade los mismos dos secrets.
El workflow `.github/workflows/ci.yml` los necesita para que el build no falle.

---

## Checklist pre-push

```bash
npm run lint     # 0 errores
npm run build    # build verde sin errores TypeScript
```

Checklist manual tras deploy en Vercel:

- [ ] Formulario Walking List → respuesta 201 / mensaje de éxito
- [ ] Correo duplicado → mensaje de error (409)
- [ ] Anclas de navegación funcionan (Experience, Consulting, Education, Comunidad, Galería, Equipo)
- [ ] Modales de pilares abren, carrusel interno funciona, botón "Unirme" abre Walking List
- [ ] Toggle de tema claro/oscuro funciona
- [ ] Menú mobile (Sheet) abre y cierra correctamente
- [ ] Imágenes de fundadores, pilares y conceptos cargan
- [ ] Video de YouTube carga al hacer clic en play

---

## Convenciones

Ver `AGENTS.md` y `.cursor/rules/gladwell-landing.mdc` para guías detalladas de organización,
datos de contenido y uso de componentes compartidos.
