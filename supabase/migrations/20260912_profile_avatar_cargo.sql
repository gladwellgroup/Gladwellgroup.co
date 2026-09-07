-- Complementa "Mi perfil": foto de perfil (avatar_url) y cargo dentro de
-- la comunidad Gladwell (texto libre, solo lo asigna el super_admin desde
-- /super/usuarios).

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists cargo text;

-- Bucket de Storage para avatares — mismo patrón que therapy-media /
-- education-media (supabase/migrations/20260716_entregables_refactor.sql).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Cada quien sube/actualiza/borra únicamente dentro de su propia carpeta
-- (primer segmento del path = su uid) — a diferencia de therapy-media, acá
-- no hace falta el rol: cualquier persona autenticada gestiona su propio
-- avatar.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects'
      and schemaname = 'storage'
      and policyname = 'Users upload own avatar'
  ) then
    create policy "Users upload own avatar"
      on storage.objects for insert
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects'
      and schemaname = 'storage'
      and policyname = 'Users update own avatar'
  ) then
    create policy "Users update own avatar"
      on storage.objects for update
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects'
      and schemaname = 'storage'
      and policyname = 'Users delete own avatar'
  ) then
    create policy "Users delete own avatar"
      on storage.objects for delete
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects'
      and schemaname = 'storage'
      and policyname = 'Public read avatars'
  ) then
    create policy "Public read avatars"
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;
end $$;
