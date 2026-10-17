-- Parrilla de contenido: nuevo flujo de estados + Archivado (Banco de contenido).
--
-- ESTADOS. Orden del flujo del equipo:
--   idea → agendado → en_produccion → programado → publicado → archivado
-- · agendado: la idea pasó a la etapa de creación.
-- · programado: el video ya está editado y listo para salir el día de
--   "Fecha de publicación" (estado nuevo).
-- · archivado: la idea no se ejecuta, pero no se pierde — se guarda en el
--   Banco de contenido. Reemplaza a 'cancelado': las piezas canceladas pasan a
--   archivado.
-- Las piezas que hoy están en 'agendado' NO se remapean: siguen como agendado
-- (ahora "pasó a creación"). Si alguna en realidad estaba lista para salir, se
-- mueve a mano — ver "Reclasificar" al final.
--
-- FECHA DE PUBLICACIÓN. Una pieza archivada no tiene fecha de publicación:
-- publish_date pasa a admitir NULL y se borra en todas las archivadas. El CHECK
-- garantiza que solo las archivadas la dejan vacía.
--
-- Se recrea el enum (en vez de ALTER TYPE … ADD VALUE) porque Postgres no deja
-- quitar 'cancelado' de un enum, y así el orden del tipo es el del flujo.
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo ANTES de
--   desplegar el código: el código nuevo guarda 'programado' y 'archivado'
--   (que el enum viejo rechaza) y fechas de publicación vacías.
--   NO es re-ejecutable: la segunda vez el enum ya no tiene 'cancelado' y el
--   rename falla — es lo esperado, no hay nada más que hacer.
--
-- REVERTIR (solo si hiciera falta, y antes de que haya archivadas nuevas)
--   Hay que volver a crear el enum viejo y reasignar a mano las archivadas a
--   'cancelado' con su fecha de publicación; la fecha borrada no se recupera.

begin;

alter type public.parrilla_status rename to parrilla_status_old;

create type public.parrilla_status as enum (
  'idea', 'agendado', 'en_produccion', 'programado', 'publicado', 'archivado'
);

-- El default tiene que salir antes del cambio de tipo: Postgres no sabe
-- convertir 'idea'::parrilla_status_old al tipo nuevo por su cuenta.
alter table public.parrilla_posts alter column status drop default;

alter table public.parrilla_posts
  alter column status type public.parrilla_status
  using (
    case status::text when 'cancelado' then 'archivado' else status::text end
  )::public.parrilla_status;

alter table public.parrilla_posts alter column status set default 'idea';

drop type public.parrilla_status_old;

-- Orden obligatorio: quitar el NOT NULL para poder vaciar la fecha de las
-- archivadas, y solo después crear el CHECK — si no, ya existiría una fila
-- (la archivada con fecha) que lo viola.
alter table public.parrilla_posts alter column publish_date drop not null;

update public.parrilla_posts set publish_date = null where status = 'archivado';

alter table public.parrilla_posts
  add constraint parrilla_posts_publish_date_check
  check (status = 'archivado' or publish_date is not null);

commit;

-- Verificación (ejecutar aparte, después del commit):
--   select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
--     where t.typname = 'parrilla_status' order by e.enumsortorder;
--   select is_nullable from information_schema.columns
--     where table_name = 'parrilla_posts' and column_name = 'publish_date';   -- YES
--   select status, count(*), count(publish_date) as con_fecha
--     from public.parrilla_posts group by 1 order by 1;   -- archivado: con_fecha = 0
--
-- Reclasificar (opcional): piezas que estaban "agendadas para salir" y ahora
-- deberían ser Programado.
--   update public.parrilla_posts set status = 'programado' where id = '<uuid>';
