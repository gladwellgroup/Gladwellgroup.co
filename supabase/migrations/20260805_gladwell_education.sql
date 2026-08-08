-- Gladwell Education: sesiones formativas con ponente, transcripción de
-- videollamada y entregable enviado por correo a los asistentes registrados.
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo. El
--   BEGIN/COMMIT lo hace atómico: si algo falla, la base queda exactamente
--   como estaba, sin estados a medias.
--
--   Es re-ejecutable de punta a punta (`if not exists` + `drop policy if
--   exists`), así que también puede correrse por secciones si se prefiere
--   inspeccionar entre pasos. Las secciones 1-5 van juntas —hay FKs hacia
--   education_sessions—; la 6 y la 7 son independientes. La 7 NO es opcional:
--   sin el bucket, toda subida de foto o audio falla desde el navegador.
--
-- NOTA SOBRE RLS
--   El servidor usa la service role key, que ignora RLS por completo; la
--   autorización real vive en lib/education/session-access.ts. Estas policies
--   son defensa en profundidad y cubren las subidas a Storage, que sí salen
--   del navegador con la anon key.

begin;

-- Enum propio (no se reutiliza therapy_status: son dos programas distintos y
-- renombrar un tipo en uso no aporta nada aquí).
do $$ begin
  create type public.education_status as enum ('borrador', 'generado', 'entregado');
exception when duplicate_object then null;
end $$;

-- Predicado único de acceso, en vez de repetir el mismo `exists (...)` en cada
-- policy. Security definer por la misma razón que public.is_super_admin(): el
-- select interno no vuelve a disparar RLS sobre profiles.
create or replace function public.is_entregables_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin', 'community_admin')
  );
$$;

-- 1. Sesiones
create table if not exists public.education_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  session_date date not null default current_date,
  -- Administrador de comunidad responsable, asignado por el super admin al crear.
  admin_id uuid not null references public.profiles(id) on delete restrict,
  status public.education_status not null default 'borrador',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.education_sessions enable row level security;

drop policy if exists "Admins manage education sessions" on public.education_sessions;
create policy "Admins manage education sessions"
  on public.education_sessions for all
  using (public.is_entregables_admin());

-- 2. Inputs de captura (1:1 — la app los lee con .single()).
--    Los datos del ponente viven aquí, no en education_sessions, para que el
--    autoguardado del formulario escriba en una sola tabla.
create table if not exists public.education_session_inputs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.education_sessions(id) on delete cascade,
  ponente_nombre text,
  ponente_rol text,
  ponente_foto_url text,
  objetivo text,
  notas_moderador text,
  frase_texto text,
  frase_autor text,
  aprendizajes text,
  capsulas_emprendimiento text,
  foto_sesion_url text,
  transcripcion_texto text,
  transcripcion_fuente text check (transcripcion_fuente in ('texto', 'audio')),
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.education_session_inputs enable row level security;

drop policy if exists "Admins manage education inputs" on public.education_session_inputs;
create policy "Admins manage education inputs"
  on public.education_session_inputs for all
  using (public.is_entregables_admin());

-- 3. Herramientas recomendadas en la sesión
create table if not exists public.education_tools (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.education_sessions(id) on delete cascade,
  nombre text not null,
  descripcion text,
  url text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.education_tools enable row level security;

drop policy if exists "Admins manage education tools" on public.education_tools;
create policy "Admins manage education tools"
  on public.education_tools for all
  using (public.is_entregables_admin());

-- 4. Asistentes registrados (importados por CSV)
create table if not exists public.education_attendees (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.education_sessions(id) on delete cascade,
  nombre text not null,
  correo text not null,
  empresa text,
  email_status text not null default 'pendiente'
    check (email_status in ('pendiente', 'enviado', 'error')),
  email_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.education_attendees enable row level security;

drop policy if exists "Admins manage education attendees" on public.education_attendees;
create policy "Admins manage education attendees"
  on public.education_attendees for all
  using (public.is_entregables_admin());

-- Un correo por sesión: reimportar el mismo CSV es idempotente.
create unique index if not exists education_attendees_session_correo_idx
  on public.education_attendees (session_id, lower(correo));

-- 5. Entregable generado
create table if not exists public.education_deliverables (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.education_sessions(id) on delete cascade,
  conclusiones_clave text,
  aprendizajes text,
  capsulas text,
  content_html text,
  pdf_url text,
  -- 'procesando' es el claim atómico que evita que dos pestañas abiertas
  -- disparen dos síntesis simultáneas sobre la misma sesión.
  processing_status text not null default 'generando'
    check (processing_status in ('generando', 'procesando', 'listo', 'error')),
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now()
);

alter table public.education_deliverables enable row level security;

drop policy if exists "Admins manage education deliverables" on public.education_deliverables;
create policy "Admins manage education deliverables"
  on public.education_deliverables for all
  using (public.is_entregables_admin());

-- 6. Índices
create index if not exists education_sessions_admin_idx on public.education_sessions (admin_id);
create index if not exists education_sessions_created_by_idx on public.education_sessions (created_by);
create index if not exists education_sessions_status_idx on public.education_sessions (status);
create index if not exists education_tools_session_idx on public.education_tools (session_id);
create index if not exists education_attendees_session_idx on public.education_attendees (session_id);

-- 7. Bucket de Storage para media de Education.
--    Las policies de storage.objects van con guarda `if not exists` en vez de
--    `drop policy`: esa tabla es de supabase_storage_admin y no conviene
--    depender de permisos de borrado sobre ella.
insert into storage.buckets (id, name, public)
values ('education-media', 'education-media', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins upload education media'
  ) then
    create policy "Admins upload education media"
      on storage.objects for insert
      with check (
        bucket_id = 'education-media' and public.is_entregables_admin()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Public read education media'
  ) then
    create policy "Public read education media"
      on storage.objects for select
      using (bucket_id = 'education-media');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins delete education media'
  ) then
    create policy "Admins delete education media"
      on storage.objects for delete
      using (
        bucket_id = 'education-media' and public.is_entregables_admin()
      );
  end if;
end $$;

commit;

-- Verificación (ejecutar aparte, después del commit):
--
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name like 'education%';
--   -- esperado: education_sessions, education_session_inputs,
--   --           education_tools, education_attendees, education_deliverables
--
--   select id from storage.buckets where id = 'education-media';
--
--   select tablename, policyname from pg_policies
--   where policyname ilike '%education%' order by tablename;
--   -- esperado: 5 policies en public.* + 3 en storage.objects
