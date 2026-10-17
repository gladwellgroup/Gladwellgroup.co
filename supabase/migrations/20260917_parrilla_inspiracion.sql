-- Parrilla de contenido: Inspiración (enlace de referencia) para piezas de video.
--
-- Columna nueva `inspiration_url`: un enlace a la referencia de la que parte el
-- video, para abrirla desde el modal de la publicación sin ir a buscarla al chat.
-- Solo aplica cuando el formato es video (el código la vacía en cualquier otro
-- formato, igual que talent), pero la base no lo impone: es una regla de
-- visibilidad de la pantalla, no una restricción de los datos.
--
-- El CHECK admite solo enlaces http(s) sin espacios y de hasta 2048 caracteres.
-- Es la misma regla que valida el servidor (lib/validations/parrilla.ts); aquí
-- queda como defensa en profundidad: el valor termina en un <a href>, y un
-- `javascript:` guardado a mano en Supabase se ejecutaría al hacer clic.
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo ANTES de
--   desplegar el código: el código nuevo selecciona inspiration_url en el
--   listado (sin la columna el calendario se ve vacío). Aplicarla antes es
--   inocuo para el código viejo, que ignora la columna. Re-ejecutable de punta
--   a punta. La columna se agrega sin default, así que es instantáneo y no
--   reescribe la tabla; las piezas existentes quedan en NULL.
--
-- REVERTIR (solo si hiciera falta)
--   alter table public.parrilla_posts drop constraint if exists parrilla_posts_inspiration_url_check;
--   alter table public.parrilla_posts drop column if exists inspiration_url;
--   Los enlaces ya guardados se pierden con la columna.

begin;

alter table public.parrilla_posts
  add column if not exists inspiration_url text;

-- En una re-ejecución se suelta y se recrea: `add constraint` no admite
-- `if not exists`.
alter table public.parrilla_posts
  drop constraint if exists parrilla_posts_inspiration_url_check;

alter table public.parrilla_posts
  add constraint parrilla_posts_inspiration_url_check
  check (
    inspiration_url is null
    or (
      inspiration_url ~* '^https?://[^[:space:]]+$'
      and char_length(inspiration_url) <= 2048
    )
  );

comment on column public.parrilla_posts.inspiration_url is
  'Enlace de referencia (inspiración) de una pieza de video. Solo http(s), sin espacios, hasta 2048 caracteres.';

commit;

-- Verificación (ejecutar aparte, después del commit):
--   select column_name, is_nullable from information_schema.columns
--     where table_name = 'parrilla_posts' and column_name = 'inspiration_url';   -- YES
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.parrilla_posts'::regclass and conname = 'parrilla_posts_inspiration_url_check';
--   select count(*) from public.parrilla_posts where inspiration_url is not null;   -- 0 al aplicarla
