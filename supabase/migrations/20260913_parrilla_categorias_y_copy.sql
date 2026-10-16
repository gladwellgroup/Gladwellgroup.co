-- Parrilla de contenido: categorías de Gladwell + copy del post.
--
-- CATEGORÍAS. Se agregan crecer, conectar, construir, aprender y roots;
-- comunidad se mantiene; valor, prospeccion y viral se retiran. No tienen
-- equivalente 1:1 con las nuevas, así que sus publicaciones quedan en "Sin
-- categoría" (NULL) para reclasificarlas a mano. Las de comunidad no se tocan.
--
-- COPY DEL POST. Columna nueva `caption`: el texto (caption, hashtags, CTA)
-- que acompaña la publicación en redes. Es distinta de copy_text que, pese al
-- nombre, guarda el Guion — así se llama en el modal desde que se creó la
-- parrilla. No se renombra copy_text: rompería el código desplegado durante la
-- ventana entre este SQL y el deploy.
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo ANTES de
--   desplegar el código: el código nuevo selecciona la columna caption (sin
--   ella el calendario se ve vacío) y el CHECK nuevo rechaza las categorías
--   retiradas. Re-ejecutable de punta a punta.

begin;

-- El CHECK de category se creó inline en 20260906 (nombre autogenerado): se
-- busca por columna en vez de asumir el nombre, para no dejar el viejo vivo —
-- rechazaría las categorías nuevas. Solo coincide con CHECK cuya ÚNICA columna
-- es category: uno que combine varias columnas no se toca. En una re-ejecución
-- suelta también el CHECK nuevo, que se recrea más abajo.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.parrilla_posts'::regclass
      and contype = 'c'
      and conkey = array[(
        select attnum from pg_attribute
        where attrelid = 'public.parrilla_posts'::regclass and attname = 'category'
      )]
  loop
    execute format('alter table public.parrilla_posts drop constraint %I', c.conname);
  end loop;
end $$;

-- Respaldo de las categorías retiradas: una vez en NULL ya no se sabe cuál era
-- cuál. Sirve para mapearlas después en una sola sentencia, o para revertir. Se
-- crea una sola vez (en una re-ejecución se conserva el original) y con RLS
-- activo y sin policies: nadie la lee por la API pública, solo desde el SQL
-- Editor o con la service role. Se borra cuando ya no haga falta:
--   drop table public.parrilla_posts_category_legacy;
create table if not exists public.parrilla_posts_category_legacy as
  select id as post_id, title, category, now() as saved_at
  from public.parrilla_posts
  where category in ('valor', 'prospeccion', 'viral');

alter table public.parrilla_posts_category_legacy enable row level security;

-- Orden obligatorio: limpiar las filas de las categorías retiradas ANTES de
-- crear el CHECK nuevo, o este falla por violarlo las filas viejas.
update public.parrilla_posts
set category = null
where category in ('valor', 'prospeccion', 'viral');

alter table public.parrilla_posts
  add constraint parrilla_posts_category_check
  check (category in ('crecer', 'conectar', 'construir', 'aprender', 'roots', 'comunidad'));

alter table public.parrilla_posts
  add column if not exists caption text;

-- Evita que alguien lea copy_text creyendo que es el copy publicable.
comment on column public.parrilla_posts.copy_text is
  'Guion de la pieza (nombre histórico). El copy que se publica en redes está en caption.';
comment on column public.parrilla_posts.caption is
  'Copy del post: texto (caption, hashtags, CTA) que acompaña la publicación en redes.';

commit;

-- Verificación (ejecutar aparte, después del commit):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.parrilla_posts'::regclass and contype = 'c';
--   select column_name from information_schema.columns
--     where table_name = 'parrilla_posts' and column_name = 'caption';
--   select category, count(*) from public.parrilla_posts group by 1 order by 1;
--   select category, count(*) from public.parrilla_posts_category_legacy group by 1 order by 1;
