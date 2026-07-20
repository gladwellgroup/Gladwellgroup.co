-- Estado de sesiones de Terapia Organizacional
do $$ begin
  create type public.therapy_status as enum ('borrador', 'generado', 'entregado');
exception when duplicate_object then null;
end $$;

-- Sesiones
create table if not exists public.therapy_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  session_date date not null default current_date,
  moderator_id uuid not null references public.profiles(id) on delete restrict,
  pillar text,
  status public.therapy_status not null default 'borrador',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.therapy_sessions enable row level security;

create policy "Admins manage therapy sessions"
  on public.therapy_sessions for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'community_admin')
    )
  );

-- Inputs de la sesión (1:1 — la app los lee con .single(), sin unique podría duplicarse)
create table if not exists public.therapy_session_inputs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.therapy_sessions(id) on delete cascade,
  empresa_descripcion text,
  reto_problema text,
  tipo_producto_servicio text,
  red_social text,
  feedback_cofundadores text,
  problema_real text,
  camino_sesion text,
  recomendaciones_generales text,
  recomendaciones_incomodas text,
  audios_urls text[] default '{}',
  fotos_urls text[] default '{}',
  foto_grupo_final text,
  created_at timestamptz not null default now()
);

alter table public.therapy_session_inputs enable row level security;

create policy "Admins manage therapy inputs"
  on public.therapy_session_inputs for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'community_admin')
    )
  );

-- Entregables generados
create table if not exists public.therapy_deliverables (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.therapy_sessions(id) on delete cascade,
  pdf_url text,
  content_html text,
  generated_by uuid not null references public.profiles(id),
  generated_at timestamptz not null default now()
);

alter table public.therapy_deliverables enable row level security;

create policy "Admins manage deliverables"
  on public.therapy_deliverables for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'community_admin')
    )
  );

-- Invitados a sesiones (para entrega de PDF)
create table if not exists public.therapy_session_guests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.therapy_sessions(id) on delete cascade,
  guest_name text not null,
  guest_email text,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.therapy_session_guests enable row level security;

create policy "Admins manage session guests"
  on public.therapy_session_guests for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'community_admin')
    )
  );

-- Índices
create index if not exists therapy_sessions_status_idx on public.therapy_sessions (status);
create index if not exists therapy_sessions_created_by_idx on public.therapy_sessions (created_by);
create index if not exists therapy_deliverables_session_idx on public.therapy_deliverables (session_id);
create index if not exists therapy_session_guests_session_idx on public.therapy_session_guests (session_id);
