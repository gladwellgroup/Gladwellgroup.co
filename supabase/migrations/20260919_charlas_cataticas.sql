-- Charlas Catárticas: espacios abiertos para la comunidad, sin guion ni entregable.
-- Lo único que importa es tenerlas mapeadas (calendario) y registrar quién asistió
-- (QR), así que una charla es solo nombre, fecha, foto y su lista de asistentes.
--
-- Qué agrega
--   1. `charlas`: nombre (3–120 caracteres), fecha y foto.
--   2. `charla_attendees`: quién registró su asistencia, un correo por charla.
--   3. `session_attendance_links.charla_id`: el link/QR de asistencia ya existe para
--      Terapia y Education (20260807); la charla es el tercer programa que lo usa, y
--      el CHECK «exactamente un programa» se rehace con tres términos.
--   4. Bucket público `charlas-media` para la foto, con el mismo patrón de políticas
--      que `education-media` (20260805).
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo. Es atómica
--   (BEGIN/COMMIT) y re-ejecutable de punta a punta.
--
--   Producción y el entorno local comparten esta base, así que lo que se aplica aquí
--   ya está vivo para el código desplegado. Esta migración es inocua para él: solo
--   agrega tablas nuevas, una columna opcional y un CHECK más laxo (el viejo exigía
--   uno de dos; el nuevo, uno de tres), y el código viejo nunca escribe una fila que
--   el nuevo rechace. Se puede correr antes del despliegue sin ventana de riesgo; el
--   código nuevo, en cambio, necesita que esté aplicada.
--
-- NOTA SOBRE RLS
--   El servidor usa la service role key, que ignora RLS por completo; la autorización
--   real vive en lib/charlas/access.ts (módulo `charlas`) y en el token vigente de
--   app/api/attendance/[token]/route.ts. Estas policies son defensa en profundidad y
--   cubren las subidas a Storage, que sí salen del navegador con la anon key.
--
-- REVERTIR (solo si hiciera falta; borra las charlas, sus asistentes y la foto)
--   begin;
--   delete from public.session_attendance_links where charla_id is not null;
--   alter table public.session_attendance_links drop constraint if exists session_attendance_links_one_program;
--   drop index if exists public.session_attendance_links_charla_idx;
--   alter table public.session_attendance_links drop column if exists charla_id;
--   alter table public.session_attendance_links add constraint session_attendance_links_one_program check (
--     (therapy_session_id is not null)::int + (education_session_id is not null)::int = 1
--   );
--   drop table if exists public.charla_attendees;
--   drop table if exists public.charlas;
--   commit;
--   (las políticas del bucket y el bucket se quitan aparte desde Storage)

begin;

-- 1. Charlas. Sin estado ni «responsable»: no hay entregable que mover entre
--    estados, y quien tiene el módulo gestiona todas. Si la charla ya pasó o aún
--    no, se deduce de la fecha, igual que `programada` en el pipeline.
create table if not exists public.charlas (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint charlas_title_check check (char_length(btrim(title)) between 3 and 120),
  session_date date not null default current_date,
  photo_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists charlas_session_date_idx
  on public.charlas (session_date desc);

alter table public.charlas enable row level security;

-- is_entregables_admin() ya existe (20260805_gladwell_education.sql): super_admin
-- y community_admin, el mismo predicado de las demás tablas de sesiones.
drop policy if exists "Admins manage charlas" on public.charlas;
create policy "Admins manage charlas"
  on public.charlas for all
  using (public.is_entregables_admin());

-- 2. Asistentes. Todos llegan por QR, así que no hay columna `source` ni estado de
--    envío (no se manda ningún correo: no hay entregable).
create table if not exists public.charla_attendees (
  id uuid primary key default gen_random_uuid(),
  charla_id uuid not null references public.charlas(id) on delete cascade,
  nombre text not null,
  correo text not null,
  created_at timestamptz not null default now()
);

-- Un correo por charla: volver a enviar el formulario es idempotente (el servidor
-- trata 23505 como éxito), igual que en las sesiones de Terapia y Education.
create unique index if not exists charla_attendees_charla_correo_idx
  on public.charla_attendees (charla_id, lower(correo));

create index if not exists charla_attendees_charla_idx
  on public.charla_attendees (charla_id);

alter table public.charla_attendees enable row level security;

drop policy if exists "Admins manage charla attendees" on public.charla_attendees;
create policy "Admins manage charla attendees"
  on public.charla_attendees for all
  using (public.is_entregables_admin());

-- 3. El link de asistencia pasa a servir a tres programas. Una fila por charla
--    (índice único parcial, como los otros dos); «regenerar» sigue siendo un UPDATE
--    de esa fila. El CHECK se suelta y se recrea: `add constraint` no admite
--    `if not exists`, y las filas que ya existen (Terapia o Education) lo cumplen.
alter table public.session_attendance_links
  add column if not exists charla_id uuid references public.charlas(id) on delete cascade;

create unique index if not exists session_attendance_links_charla_idx
  on public.session_attendance_links (charla_id)
  where charla_id is not null;

alter table public.session_attendance_links
  drop constraint if exists session_attendance_links_one_program;

alter table public.session_attendance_links
  add constraint session_attendance_links_one_program check (
    (therapy_session_id is not null)::int
      + (education_session_id is not null)::int
      + (charla_id is not null)::int = 1
  );

-- 4. Bucket de Storage para la foto de la charla. Las policies de storage.objects
--    van con guarda `if not exists` en vez de `drop policy`: esa tabla es de
--    supabase_storage_admin y no conviene depender de permisos de borrado sobre ella.
insert into storage.buckets (id, name, public)
values ('charlas-media', 'charlas-media', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins upload charlas media'
  ) then
    create policy "Admins upload charlas media"
      on storage.objects for insert
      with check (
        bucket_id = 'charlas-media' and public.is_entregables_admin()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Public read charlas media'
  ) then
    create policy "Public read charlas media"
      on storage.objects for select
      using (bucket_id = 'charlas-media');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins delete charlas media'
  ) then
    create policy "Admins delete charlas media"
      on storage.objects for delete
      using (
        bucket_id = 'charlas-media' and public.is_entregables_admin()
      );
  end if;
end $$;

commit;

-- Verificación (ejecutar aparte, después del commit):
--
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('charlas', 'charla_attendees');
--   -- esperado: las dos
--
--   select column_name from information_schema.columns
--   where table_name = 'session_attendance_links' and column_name = 'charla_id';
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.session_attendance_links'::regclass
--     and conname = 'session_attendance_links_one_program';
--   -- esperado: la suma de los tres `is not null` igual a 1
--
--   select id from storage.buckets where id = 'charlas-media';
--
--   select tablename, policyname from pg_policies
--   where policyname ilike '%charla%' order by tablename;
--   -- esperado: 1 en public.charlas, 1 en public.charla_attendees y 3 en storage.objects
--
--   select count(*) from public.session_attendance_links;
--   -- las filas de Terapia y Education siguen ahí
