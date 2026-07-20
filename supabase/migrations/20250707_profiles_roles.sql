-- Enum de roles para la plataforma
do $$ begin
  create type public.app_role as enum ('super_admin', 'community_admin', 'community_member');
exception when duplicate_object then null;
end $$;

-- Tabla de perfiles vinculada a auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'community_member',
  nombre text not null,
  correo text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;

-- Función security definer: evita la recursión infinita que causa consultar
-- `profiles` directamente dentro de una policy sobre la propia tabla `profiles`.
-- (el "select" interno corre con los privilegios del owner de la función,
-- por lo tanto no vuelve a disparar RLS sobre sí mismo).
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- FOR ALL (select/insert/update/delete) — consistente con el resto de tablas.
-- Sin esto, un super_admin no podría eliminar usuarios (sección 5 de la matriz de permisos)
-- si alguna vez se usa un cliente con sesión en vez de service_role.
create policy "Super admin manages all profiles"
  on public.profiles for all
  using (public.is_super_admin());

-- Índices
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_correo_idx on public.profiles (correo);
