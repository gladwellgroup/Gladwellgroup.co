-- Parrilla de contenido: Frases de referentes históricos.
--
-- Biblioteca de frases de referentes históricos que el equipo usa como materia
-- prima para crear contenido (Instagram, LinkedIn, YouTube). Vive en una pestaña
-- nueva de la parrilla, junto a Calendario y Banco de contenido.
--
-- QUÉ AGREGA
--   1. `parrilla_quotes`: la frase (3–500 caracteres), el referente que la dijo
--      (2–120), dos datos opcionales —quién fue (hasta 160) y la fuente (hasta
--      300)— y la categoría de la parrilla (opcional; la misma lista de seis que
--      usa parrilla_posts.category).
--   2. `parrilla_posts.quote_id`: vínculo OPCIONAL de una publicación con la
--      frase de la que nació. Solo lo escribe «Crear contenido» al crear la pieza
--      y permite mostrar «Usada» / «Sin usar» en la biblioteca. ON DELETE SET
--      NULL: borrar una frase nunca borra publicaciones.
--
-- DECISIONES
--   · Sin estado ni «responsable»: es una biblioteca, no un flujo. Quien tiene el
--     módulo `parrilla` ve y edita todas las frases, igual que con las piezas.
--   · `updated_at` lo mueve el trigger genérico de 20260914 (touch_updated_at).
--   · Los límites y la lista de categorías se repiten en el código
--     (lib/parrilla/quotes.ts y lib/parrilla/posts.ts); tests/drift.test.ts los
--     compara con este archivo.
--   · Sin índice sobre la tabla de frases (son cientos de filas). Sí uno parcial
--     sobre quote_id: cuenta los usos de cada frase y acelera el SET NULL al
--     borrarla.
--
-- Requiere 20260906 (is_parrilla_admin) y 20260914 (touch_updated_at).
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo ANTES de
--   desplegar el código. Es atómica (begin/commit) y re-ejecutable de punta a
--   punta.
--
--   Producción y el entorno local comparten esta base: lo que se aplica aquí ya
--   está vivo para el código desplegado. Es inocua para él: agrega una tabla
--   nueva y una columna opcional, sin default, que el código viejo nunca lee ni
--   escribe (el listado de publicaciones no la selecciona). Sin esta migración,
--   el código nuevo sigue mostrando el Calendario y el Banco; solo la pestaña
--   Frases queda vacía y «Nueva frase» avisa que falta aplicarla.
--
-- NOTA SOBRE RLS
--   El servidor usa la service role key, que ignora RLS por completo; la
--   autorización real vive en requireApiPermission('parrilla:manage') (ver
--   app/api/parrilla/frases). La policy es defensa en profundidad: sin sesión
--   (anon) o sin el módulo, no se ve ni se escribe nada.
--
-- REVERTIR (solo si hiciera falta; borra las frases y el vínculo de cada pieza
-- con su frase — las publicaciones en sí no se tocan)
--   begin;
--   drop index if exists public.parrilla_posts_quote_id_idx;
--   alter table public.parrilla_posts drop column if exists quote_id;
--   drop table if exists public.parrilla_quotes;
--   commit;

begin;

-- 1. Frases. Los CHECK miden el texto sin espacios en los extremos (btrim) y los
--    opcionales rechazan el texto en blanco: el servidor ya guarda NULL en su
--    lugar.
create table if not exists public.parrilla_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_text text not null
    constraint parrilla_quotes_quote_text_check
    check (char_length(btrim(quote_text)) between 3 and 500),
  author text not null
    constraint parrilla_quotes_author_check
    check (char_length(btrim(author)) between 2 and 120),
  author_context text
    constraint parrilla_quotes_author_context_check
    check (author_context is null or char_length(btrim(author_context)) between 1 and 160),
  source text
    constraint parrilla_quotes_source_check
    check (source is null or char_length(btrim(source)) between 1 and 300),
  category text
    constraint parrilla_quotes_category_check
    check (category in ('crecer', 'conectar', 'construir', 'aprender', 'roots', 'comunidad')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at lo mueve el trigger genérico (20260914), no cada ruta.
drop trigger if exists parrilla_quotes_touch_updated_at on public.parrilla_quotes;
create trigger parrilla_quotes_touch_updated_at
  before update on public.parrilla_quotes
  for each row execute function public.touch_updated_at();

alter table public.parrilla_quotes enable row level security;

drop policy if exists "Parrilla admins manage quotes" on public.parrilla_quotes;
create policy "Parrilla admins manage quotes"
  on public.parrilla_quotes for all
  using (public.is_parrilla_admin());

-- 2. Vínculo opcional de la pieza con su frase. Sin default: es instantáneo, no
--    reescribe la tabla y las piezas existentes quedan en NULL. `add column if
--    not exists` omite toda la cláusula (también la FK) si la columna ya
--    existe, así que se puede re-ejecutar.
alter table public.parrilla_posts
  add column if not exists quote_id uuid
    constraint parrilla_posts_quote_id_fkey
    references public.parrilla_quotes(id) on delete set null;

create index if not exists parrilla_posts_quote_id_idx
  on public.parrilla_posts (quote_id)
  where quote_id is not null;

comment on table public.parrilla_quotes is
  'Frases de referentes históricos que el equipo usa como materia prima para crear contenido (pestaña Frases de la parrilla).';
comment on column public.parrilla_quotes.source is
  'Obra, discurso o enlace de donde sale la frase (opcional). Muchas frases famosas se atribuyen mal: conviene citar la fuente.';
comment on column public.parrilla_posts.quote_id is
  'Frase de la que nació esta pieza (opcional). Solo se escribe al crearla desde «Crear contenido». ON DELETE SET NULL: borrar la frase no borra la pieza.';

-- PostgREST recarga su caché de esquema con cualquier DDL; esto lo asegura para
-- el embed `parrilla_posts(count)` de la lista de frases.
notify pgrst, 'reload schema';

commit;

-- Verificación (ejecutar aparte, después del commit):
--   select to_regclass('public.parrilla_quotes');                               -- parrilla_quotes
--   select column_name, is_nullable from information_schema.columns
--     where table_schema = 'public' and table_name = 'parrilla_quotes'
--     order by ordinal_position;
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.parrilla_quotes'::regclass and contype in ('c', 'f');
--   select tgname from pg_trigger
--     where tgrelid = 'public.parrilla_quotes'::regclass and not tgisinternal;  -- parrilla_quotes_touch_updated_at
--   select policyname from pg_policies where tablename = 'parrilla_quotes';     -- Parrilla admins manage quotes
--   select column_name, is_nullable from information_schema.columns
--     where table_name = 'parrilla_posts' and column_name = 'quote_id';         -- YES
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'parrilla_posts_quote_id_fkey';                           -- ... ON DELETE SET NULL
--   select count(*) filter (where quote_id is not null) as con_frase, count(*) as total
--     from public.parrilla_posts;                                               -- con_frase = 0 al aplicarla
