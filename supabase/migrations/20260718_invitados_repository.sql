-- =============================================================
-- Repositorio de Invitados (empresas) para Terapia Organizacional
-- =============================================================

-- 1. Empresa/invitado
create table if not exists public.invitados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  red_social text,
  pagina_web text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invitados enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'invitados' and policyname = 'Admins manage invitados'
  ) then
    create policy "Admins manage invitados"
      on public.invitados for all
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('super_admin', 'community_admin')
        )
      );
  end if;
end $$;

create index if not exists invitados_nombre_idx on public.invitados (nombre);

-- 2. Maestro de contactos/cofundadores reutilizable por invitado
create table if not exists public.invitado_contactos (
  id uuid primary key default gen_random_uuid(),
  invitado_id uuid not null references public.invitados(id) on delete cascade,
  nombre text not null,
  whatsapp text,
  correo text,
  created_at timestamptz not null default now()
);

alter table public.invitado_contactos enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'invitado_contactos' and policyname = 'Admins manage invitado contactos'
  ) then
    create policy "Admins manage invitado contactos"
      on public.invitado_contactos for all
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('super_admin', 'community_admin')
        )
      );
  end if;
end $$;

create index if not exists invitado_contactos_invitado_idx on public.invitado_contactos (invitado_id);

-- 3. Vínculo sesión -> invitado
alter table public.therapy_sessions
  add column if not exists invitado_id uuid references public.invitados(id);

-- 4. Backfill: un invitado por cada sesión existente, copiando los datos de
-- empresa que hoy viven en therapy_session_inputs (no se pierden).
insert into public.invitados (id, nombre, descripcion, red_social, pagina_web, created_by, created_at)
select gen_random_uuid(), s.title, i.empresa_descripcion, i.red_social, i.pagina_web, s.created_by, s.created_at
from public.therapy_sessions s
left join public.therapy_session_inputs i on i.session_id = s.id
where s.invitado_id is null;

update public.therapy_sessions s
set invitado_id = inv.id
from public.invitados inv
where s.invitado_id is null
  and inv.nombre = s.title
  and inv.created_by = s.created_by
  and inv.created_at = s.created_at;

alter table public.therapy_sessions alter column invitado_id set not null;

create index if not exists therapy_sessions_invitado_idx on public.therapy_sessions (invitado_id);

-- 5. Los campos de empresa migran al invitado; ya no se preguntan por sesión.
alter table public.therapy_session_inputs
  drop column if exists empresa_descripcion,
  drop column if exists red_social,
  drop column if exists pagina_web;
