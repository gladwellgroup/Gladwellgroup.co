-- Seguridad: nadie puede cambiarse el rol ni otorgarse módulos desde el navegador.
--
-- QUÉ PASABA (hallado en la revisión de QA del 2026-10-22, comprobado en PGlite con roles reales)
--   1. `profiles` tiene la policy «Users update own profile» (20250707_profiles_roles.sql):
--      `using (auth.uid() = id) with check (auth.uid() = id)`, sin límite de columnas, y ninguna
--      migración revoca el privilegio de UPDATE a `authenticated` (Supabase se lo da por defecto a las
--      tablas de `public`). Con su propia sesión, cualquier integrante podía abrir la consola del
--      navegador y ejecutar
--          supabase.from('profiles').update({ role: 'super_admin' }).eq('id', <su id>)
--      Toda la plataforma confía en `profiles.role` (lib/auth/session.ts, lib/auth/api.ts): quedaba como
--      super administrador (usuarios, CRM, módulos, borrado de cuentas...).
--   2. `set_profile_module_grants` es SECURITY DEFINER y estaba ejecutable por PUBLIC. Su guarda
--      (20260908) es «si hay un llamador identificado (auth.uid() no nulo), debe ser super_admin»: con
--      solo la llave anónima, sin el JWT de la persona, auth.uid() es NULO y la guarda pasa. Cualquiera
--      que conozca un id de perfil (el suyo, por ejemplo) se auto-otorgaba CRM, Parrilla o Entregables.
--
-- QUÉ HACE
--   · Quita INSERT, UPDATE y DELETE sobre `profiles` a `anon` y `authenticated`. Se conserva el SELECT
--     (con la RLS de siempre: cada quien lee su fila). Todas las escrituras a `profiles` las hace el
--     servidor con la llave de servicio (api/profile, api/admin/usuarios) o un trigger SECURITY DEFINER
--     (handle_new_user); ninguna pasa por estos privilegios, y ningún cliente del navegador escribe ahí.
--   · Deja `set_profile_module_grants` ejecutable solo por `service_role`, que es quien la llama
--     (app/api/admin/usuarios/route.ts y [id]/route.ts). La guarda interna se conserva como
--     defensa en profundidad.
--
-- QUÉ SE CONSERVA
--   Ninguna lectura cambia: el SELECT de `profiles` y de `profile_module_grants` sigue igual, así que
--   getSession (la consulta del perfil con la sesión de la persona) funciona como antes. La llave de
--   servicio tiene BYPASSRLS y sus propios privilegios: no se ve afectada. Es retrocompatible con el
--   código que hoy corre en producción (la base se comparte con local): se puede aplicar antes o
--   después de desplegar.
--
-- DECISIONES
--   · Se revoca el privilegio y no se «arregla» la policy con `with check` de columnas: es más simple
--     de razonar (sin privilegio no hay nada que filtrar) y cubre también DELETE e INSERT, que la
--     policy ya negaba pero que ningún cliente necesita.
--   · `revoke ... from public, anon, authenticated` en la función: Supabase concede EXECUTE por
--     defecto a `anon` y `authenticated` además del PUBLIC implícito, y la migración 20260905 lo
--     concedió explícitamente a `authenticated`; hay que quitar los tres.
--   · `set local lock_timeout`: REVOKE toma un bloqueo breve sobre la tabla viva; si hubiera una
--     transacción larga, vence a los 5 s sin aplicar nada (error 55P03; ejecuta `rollback;` y reintenta).
--   · tests/security-sql.test.ts vigila que estos REVOKE sigan en las migraciones y que ninguna
--     posterior vuelva a conceder el privilegio.
--
-- Requiere 20250707_profiles_roles.sql y 20260905_profile_module_grants.sql.
--
-- CÓMO APLICARLA
--   1. Antes (solo lectura): la consulta 1 de «Verificación», al pie; debe mostrar `true` en las
--      columnas auth_update y anon_rpc (el hueco).
--   2. Pega TODO este archivo en el SQL Editor y ejecútalo. Es idempotente: puedes correrlo dos veces.
--   3. Después: la consulta 1 debe salir `false` en todo salvo service_rpc (`true`). Comprueba también
--      que /super/usuarios sigue creando y editando cuentas y que «Mi perfil» sigue guardando.
--
-- REVERTIR (vuelve a abrir los dos huecos; solo si algo del servidor dejara de funcionar):
--   begin;
--   grant insert, update, delete on public.profiles to anon, authenticated;
--   grant execute on function public.set_profile_module_grants(uuid, text[], uuid) to public, anon, authenticated;
--   commit;

begin;

set local lock_timeout = '5s';

revoke insert, update, delete on public.profiles from anon, authenticated;

revoke execute on function public.set_profile_module_grants(uuid, text[], uuid)
  from public, anon, authenticated;
grant execute on function public.set_profile_module_grants(uuid, text[], uuid)
  to service_role;

commit;

-- Verificación (solo lectura):
--   1. Privilegios. Antes: auth_update y anon_rpc en true. Después: todo false salvo service_rpc.
--        select
--          has_table_privilege('authenticated', 'public.profiles', 'update')  as auth_update,
--          has_table_privilege('authenticated', 'public.profiles', 'insert')  as auth_insert,
--          has_table_privilege('authenticated', 'public.profiles', 'delete')  as auth_delete,
--          has_table_privilege('anon',          'public.profiles', 'update')  as anon_update,
--          has_function_privilege('anon',          'public.set_profile_module_grants(uuid, text[], uuid)', 'execute') as anon_rpc,
--          has_function_privilege('authenticated', 'public.set_profile_module_grants(uuid, text[], uuid)', 'execute') as auth_rpc,
--          has_function_privilege('service_role',  'public.set_profile_module_grants(uuid, text[], uuid)', 'execute') as service_rpc;
--   2. Lo que sigue leyendo `authenticated` (debe ser true): el SELECT de su propia fila.
--        select has_table_privilege('authenticated', 'public.profiles', 'select') as auth_select;
