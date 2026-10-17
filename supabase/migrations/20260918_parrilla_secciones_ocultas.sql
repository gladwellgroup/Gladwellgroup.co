-- Parrilla de contenido: secciones ocultas del modal.
--
-- No todas las publicaciones llevan Inspiración, Guion, Copy del post o Foto de
-- portada: el modal tiene un ojo junto al título de cada una para ocultarla.
-- Cada pieza recuerda qué ocultó (para todo el equipo), en una columna nueva
-- `hidden_sections` con las claves de las secciones ocultas:
--   inspiracion → inspiration_url · guion → copy_text
--   copy → caption                · portada → cover_image_url
--
-- Ocultar solo esconde el campo en la pantalla: NO borra el contenido. Por eso
-- esta columna es independiente de las de contenido y de la regla de formato
-- (Inspiración solo se ve con video, y eso lo decide el código).
--
-- El CHECK admite solo esas cuatro claves (mismo patrón que `platforms`): una
-- prueba compara la lista con PARRILLA_SECTIONS en lib/parrilla/posts.ts.
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo ANTES de
--   desplegar el código: el código nuevo selecciona hidden_sections en el
--   listado (sin la columna el calendario se ve vacío). Aplicarla antes es
--   inocuo para el código viejo, que ignora la columna. Re-ejecutable de punta
--   a punta. El default es una constante, así que agregar la columna es
--   instantáneo y no reescribe la tabla; todas las piezas existentes quedan con
--   todo visible (`{}`).
--
-- REVERTIR (solo si hiciera falta)
--   alter table public.parrilla_posts drop constraint if exists parrilla_posts_hidden_sections_check;
--   alter table public.parrilla_posts drop column if exists hidden_sections;
--   Lo que cada pieza tenía oculto se pierde con la columna; el contenido no.

begin;

alter table public.parrilla_posts
  add column if not exists hidden_sections text[] not null default '{}';

-- En una re-ejecución se suelta y se recrea: `add constraint` no admite
-- `if not exists`.
alter table public.parrilla_posts
  drop constraint if exists parrilla_posts_hidden_sections_check;

alter table public.parrilla_posts
  add constraint parrilla_posts_hidden_sections_check
  check (hidden_sections <@ array['inspiracion', 'guion', 'copy', 'portada']::text[]);

comment on column public.parrilla_posts.hidden_sections is
  'Secciones del modal que el equipo ocultó en esta pieza (inspiracion, guion, copy, portada). Solo esconde el campo; el contenido se conserva.';

commit;

-- Verificación (ejecutar aparte, después del commit):
--   select column_name, is_nullable, column_default from information_schema.columns
--     where table_name = 'parrilla_posts' and column_name = 'hidden_sections';   -- NO, '{}'::text[]
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.parrilla_posts'::regclass and conname = 'parrilla_posts_hidden_sections_check';
--   select hidden_sections, count(*) from public.parrilla_posts group by 1;   -- {} en todas al aplicarla
