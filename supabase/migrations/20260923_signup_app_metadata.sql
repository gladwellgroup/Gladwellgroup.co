-- Seguridad: la invitación solo se salta con un dato que escribe el servidor.
--
-- QUÉ PASABA (hallado en la revisión de QA del 2026-10-22)
--   check_invitation_before_signup y handle_new_user (20260905_profile_module_grants.sql) dejan pasar
--   un alta SIN invitación cuando `raw_user_meta_data->>'admin_created'` es verdadero. Ese metadato lo
--   escribe el propio cliente al registrarse: con la llave anónima, que es pública,
--       supabase.auth.signInWithOtp({ email, options: { data: { admin_created: true } } })
--   crea una cuenta de auth sin invitación (queda sin perfil, pero con sesión: puede escribir en el
--   bucket `avatars` y llamar a lo que `authenticated` pueda). El registro es «100 % por invitación»
--   (docs/plataforma-historia-y-usuarios.md §2.2): el bypass de /super/usuarios tiene que depender de
--   algo que un cliente no pueda fijar.
--
-- QUÉ HACE
--   Las dos funciones leen `raw_app_meta_data->>'admin_created'` (app_metadata solo lo escribe el
--   servidor con la llave de servicio, p. ej. auth.admin.createUser) en lugar de raw_user_meta_data.
--   El resto de cada función queda idéntico a 20260905. `raw_user_meta_data` sigue sirviendo para el
--   nombre (full_name / name).
--
-- ORDEN (la base se comparte con producción: aplicarla ANTES de tiempo rompe el alta de cuentas)
--   1. Despliega el código que crea la cuenta con `app_metadata: { admin_created: true }`
--      (app/api/admin/usuarios/route.ts, commit de la Tanda 0 del QA). Ese código manda el dato en
--      app_metadata Y en user_metadata, así que funciona con el trigger de hoy y con el de esta migración.
--   2. Comprueba que /super/usuarios crea una cuenta nueva (con el trigger viejo todavía).
--   3. Recién entonces aplica ESTE archivo. Después quita `admin_created` de `user_metadata` en
--      esa ruta (ya no sirve para nada).
--   Volver al código anterior DESPUÉS de aplicarla rompería el alta de cuentas desde /super/usuarios
--   (el trigger rechazaría la cuenta por falta de invitación): corregir hacia adelante.
--
-- DECISIONES
--   · `create or replace` de las dos funciones; los triggers (check_invitation_before_signup,
--     on_auth_user_created) siguen apuntando a ellas por nombre y no se tocan.
--   · `coalesce(..., false)`: un app_metadata sin la clave es «no», como antes con user_metadata.
--   · tests/security-sql.test.ts vigila que la definición vigente de ambas funciones (la última entre
--     todas las migraciones) no lea `raw_user_meta_data` para decidir el bypass.
--
-- CÓMO APLICARLA
--   Después de los pasos 1 y 2 de arriba: pega TODO este archivo en el SQL Editor y ejecútalo
--   (idempotente). Verifica con la consulta de «Verificación» y creando una cuenta de prueba desde
--   /super/usuarios.
--
-- REVERTIR (vuelve a leer user_metadata: reabre el hueco, pero el alta desde /super/usuarios seguiría
-- funcionando con el código nuevo, que manda ambos): ejecuta las dos funciones de
-- 20260905_profile_module_grants.sql (las que tienen `raw_user_meta_data->>'admin_created'`).

begin;

create or replace function public.check_invitation_before_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((new.raw_app_meta_data->>'admin_created')::boolean, false) then
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
  if coalesce((new.raw_app_meta_data->>'admin_created')::boolean, false) then
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

-- Verificación (solo lectura): las dos funciones deben mencionar raw_app_meta_data y NO decidir con
-- raw_user_meta_data->>'admin_created'.
--   select proname,
--          prosrc like '%raw_app_meta_data->>''admin_created''%'  as lee_app_metadata,
--          prosrc like '%raw_user_meta_data->>''admin_created''%' as lee_user_metadata
--     from pg_proc
--     where proname in ('check_invitation_before_signup', 'handle_new_user');
