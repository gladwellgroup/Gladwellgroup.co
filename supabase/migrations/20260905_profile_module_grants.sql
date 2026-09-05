-- Autorización de módulos por persona (no por rol) + alta directa de
-- cuentas sin pasar por el flujo de invitación por token.
--
-- Tabla aparte y no una columna en profiles: el mecanismo no le pregunta a
-- nadie "¿eres community_admin?" para funcionar, solo necesita un
-- profile_id válido — así queda listo para reutilizarse con futuros tipos
-- de usuario (p.ej. invitados de la comunidad) sin una migración nueva. De
-- paso evita el problema que sí tendría una columna en profiles: una policy
-- de UPDATE sin restricción de columna dejaría a cualquiera auto-otorgarse
-- módulos con su propio JWT. Al ser tabla aparte, su escritura es "solo
-- super_admin", sin ningún permiso de columna que endurecer.

begin;

create table if not exists public.profile_module_grants (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  module_key  text not null,
  granted_by  uuid references public.profiles(id),
  granted_at  timestamptz not null default now(),
  primary key (profile_id, module_key)
);

alter table public.profile_module_grants enable row level security;

drop policy if exists "Users read own module grants" on public.profile_module_grants;
create policy "Users read own module grants"
  on public.profile_module_grants for select
  using (auth.uid() = profile_id);

drop policy if exists "Super admin manages module grants" on public.profile_module_grants;
create policy "Super admin manages module grants"
  on public.profile_module_grants for all
  using (public.is_super_admin());

create index if not exists profile_module_grants_module_idx
  on public.profile_module_grants (module_key);

-- Reemplazo atómico del set completo de módulos de un perfil — así "editar
-- módulos" desde /super/usuarios es una sola llamada (borra lo que ya no
-- está marcado, inserta lo nuevo) en vez de dos round-trips desde la API.
create or replace function public.set_profile_module_grants(
  _profile_id uuid,
  _module_keys text[],
  _granted_by uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  delete from public.profile_module_grants
  where profile_id = _profile_id
    and module_key <> all(coalesce(_module_keys, array[]::text[]));

  insert into public.profile_module_grants (profile_id, module_key, granted_by)
  select _profile_id, key, _granted_by
  from unnest(coalesce(_module_keys, array[]::text[])) as key
  on conflict (profile_id, module_key) do nothing;
end;
$$;

grant execute on function public.set_profile_module_grants(uuid, text[], uuid) to authenticated;

-- Backfill: todo community_admin existente recibe los módulos que ya tiene
-- hoy vía ROLE_PERMISSIONS (antes de este cambio), así nadie pierde acceso
-- el día del despliegue.
insert into public.profile_module_grants (profile_id, module_key)
select id, key
from public.profiles, unnest(array['crm', 'entregables_terapia', 'entregables_educacion']) as key
where role = 'community_admin'
on conflict (profile_id, module_key) do nothing;

-- Alta directa de cuentas (community_admin o community_member) desde
-- /super/usuarios, sin invitación previa: check_invitation_before_signup y
-- handle_new_user (20260707_profiles_signup_trigger.sql) dispararían igual
-- para auth.admin.createUser() como para signUp() del navegador, así que
-- necesitan un bypass explícito marcado en el metadata del usuario. La API
-- route que crea la cuenta inserta la fila de profiles ella misma —
-- handle_new_user no hace nada para estas cuentas.
create or replace function public.check_invitation_before_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((new.raw_user_meta_data->>'admin_created')::boolean, false) then
    return new;
  end if;

  if not exists (
    select 1 from public.invitations
    where lower(email) = lower(new.email)
      and accepted_at is null
      and expires_at > now()
  ) then
    raise exception 'No tienes una invitación válida para acceder a Gladwell. Contacta a un administrador.';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
begin
  if coalesce((new.raw_user_meta_data->>'admin_created')::boolean, false) then
    return new;
  end if;

  select * into v_invitation
  from public.invitations
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  -- El trigger BEFORE ya garantizó que existe una invitación válida.
  insert into public.profiles (id, nombre, correo, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.email
    ),
    new.email,
    v_invitation.role
  )
  on conflict (id) do nothing;

  update public.invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return new;
end;
$$;

commit;

-- Verificación:
--   select table_name from information_schema.tables where table_name = 'profile_module_grants';
--   select p.correo, g.module_key from public.profiles p join public.profile_module_grants g on g.profile_id = p.id where p.role = 'community_admin';
--   select policyname from pg_policies where tablename = 'profile_module_grants';
--   select proname from pg_proc where proname in ('set_profile_module_grants', 'check_invitation_before_signup', 'handle_new_user');
