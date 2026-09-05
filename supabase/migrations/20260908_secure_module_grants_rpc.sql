-- Corrige un hueco real en set_profile_module_grants (creada en
-- 20260905_profile_module_grants.sql): al ser SECURITY DEFINER y estar
-- otorgada a `authenticated` sin ningún chequeo interno de quién llama,
-- cualquier usuario logueado (community_admin o community_member) podía
-- invocarla directo desde el navegador vía
-- `supabase.rpc('set_profile_module_grants', {...})` y auto-otorgarse
-- cualquier módulo (CRM, Parrilla, Entregables) — la policy de RLS de
-- profile_module_grants nunca se evalúa dentro de una función SECURITY
-- DEFINER, y esto saltaba también el requireApiPermission('users:create_admin')
-- de la API route.
--
-- El chequeo es "si hay un llamador identificado (auth.uid() no nulo), debe
-- ser super_admin" — deliberadamente NO "siempre exigir un llamador",
-- porque la ruta legítima (app/api/admin/usuarios/route.ts y
-- app/api/admin/usuarios/[id]/route.ts) invoca esta función con la service
-- role key, donde auth.uid() es null por no haber un usuario asociado a ese
-- JWT. Bloquear cuando es null rompería esa ruta; el hueco real es
-- específicamente cuando SÍ hay un usuario autenticado pero no es
-- super_admin.

begin;

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
  if auth.uid() is not null and not public.is_super_admin() then
    raise exception 'Solo un super administrador puede otorgar módulos';
  end if;

  delete from public.profile_module_grants
  where profile_id = _profile_id
    and module_key <> all(coalesce(_module_keys, array[]::text[]));

  insert into public.profile_module_grants (profile_id, module_key, granted_by)
  select _profile_id, key, _granted_by
  from unnest(coalesce(_module_keys, array[]::text[])) as key
  on conflict (profile_id, module_key) do nothing;
end;
$$;

commit;

-- Verificación (con el JWT propio de un community_admin vía anon key, debe
-- fallar con la excepción de arriba):
--   select set_profile_module_grants('<su-propio-id>', array['parrilla'], '<su-propio-id>');
