-- Registro de asistencia por QR/link, compartido entre Terapia Organizacional
-- y Gladwell Education: un link legible y expirable por sesión que captura
-- nombre y correo de quien estuvo presente, en vez de depender solo de quién
-- se inscribió (CSV/Luma).
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo. Es
--   atómica (BEGIN/COMMIT) y re-ejecutable de punta a punta.
--
-- NOTA SOBRE RLS
--   El servidor usa la service role key, que ignora RLS por completo; la
--   autorización real vive en app/api/attendance-link/route.ts (reutiliza
--   resolveDeliverableAccess/resolveEducationAccess) y en
--   app/api/attendance/[token]/route.ts (coincidencia exacta de token +
--   expires_at vigente, igual que /invite/[token] hoy). Estas policies son
--   defensa en profundidad, igual que en el resto del módulo.

begin;

-- 1. Link de asistencia — una fila por sesión (índices únicos parciales más
--    abajo). "Regenerar" es un UPDATE sobre esta misma fila, no un insert
--    nuevo: eso es lo que invalida el token anterior al instante.
create table if not exists public.session_attendance_links (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  therapy_session_id uuid references public.therapy_sessions(id) on delete cascade,
  education_session_id uuid references public.education_sessions(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  regenerated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_attendance_links_one_program check (
    (therapy_session_id is not null)::int + (education_session_id is not null)::int = 1
  )
);

create unique index if not exists session_attendance_links_therapy_idx
  on public.session_attendance_links (therapy_session_id)
  where therapy_session_id is not null;

create unique index if not exists session_attendance_links_education_idx
  on public.session_attendance_links (education_session_id)
  where education_session_id is not null;

create index if not exists session_attendance_links_token_idx
  on public.session_attendance_links (token);

alter table public.session_attendance_links enable row level security;

-- is_entregables_admin() ya existe (20260805_gladwell_education.sql): cubre
-- super_admin y community_admin, el mismo permiso que ya abre las sesiones.
drop policy if exists "Admins manage attendance links" on public.session_attendance_links;
create policy "Admins manage attendance links"
  on public.session_attendance_links for all
  using (public.is_entregables_admin());

-- 2. Asistentes QR de Terapia — misma forma que education_attendees,
--    incluidas las columnas de envío: cada asistente QR recibe un correo
--    personalizado individual, separado del correo grupal a cofundadores.
create table if not exists public.therapy_session_attendees (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.therapy_sessions(id) on delete cascade,
  nombre text not null,
  correo text not null,
  email_status text not null default 'pendiente'
    check (email_status in ('pendiente', 'enviado', 'error')),
  email_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists therapy_session_attendees_session_correo_idx
  on public.therapy_session_attendees (session_id, lower(correo));

create index if not exists therapy_session_attendees_session_idx
  on public.therapy_session_attendees (session_id);

alter table public.therapy_session_attendees enable row level security;

drop policy if exists "Admins manage therapy attendees" on public.therapy_session_attendees;
create policy "Admins manage therapy attendees"
  on public.therapy_session_attendees for all
  using (public.is_entregables_admin());

-- 3. Education reutiliza education_attendees (misma tabla que ya llena el
--    importador de CSV) — solo se agrega de dónde vino cada fila.
alter table public.education_attendees
  add column if not exists source text not null default 'csv'
    check (source in ('csv', 'qr'));

commit;

-- Verificación (ejecutar aparte, después del commit):
--
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('session_attendance_links', 'therapy_session_attendees');
--
--   select column_name from information_schema.columns
--   where table_name = 'education_attendees' and column_name = 'source';
--
--   select tablename, policyname from pg_policies
--   where tablename in ('session_attendance_links', 'therapy_session_attendees');
--   -- esperado: 1 policy en cada una
