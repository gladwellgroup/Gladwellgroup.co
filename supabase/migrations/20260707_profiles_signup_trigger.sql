-- Solo permite registrarse si el correo tiene una invitación vigente y sin usar.
-- Si no la tiene, aborta la creación del usuario (signup 100% por invitación,
-- según docs/plataforma-historia-y-usuarios.md sección 2.2).
--
-- Van dos triggers separados a propósito: un BEFORE INSERT solo puede
-- rechazar la operación, no puede insertar en `profiles` porque en ese
-- momento la fila de auth.users todavía no existe (el FK profiles.id ->
-- auth.users(id) fallaría). La creación del perfil necesita un AFTER INSERT,
-- cuando la fila ya está confirmada.

-- 1. Validación (bloquea el signup si no hay invitación vigente)
create or replace function public.check_invitation_before_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists check_invitation_before_signup on auth.users;

create trigger check_invitation_before_signup
  before insert on auth.users
  for each row execute function public.check_invitation_before_signup();

-- 2. Creación del perfil + consumo de la invitación (la fila ya existe en auth.users)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
begin
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

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
