-- Parrilla de contenido: calendario de publicaciones de redes sociales de
-- Gladwell (Instagram, LinkedIn, YouTube). Sin flujo de aprobación —
-- cualquiera con el módulo "parrilla" otorgado (ver profile_module_grants,
-- migración 20260905_profile_module_grants.sql) tiene control total sobre
-- todas las publicaciones, no solo las propias.
--
-- Dos fechas por post: producción (cuándo se crea/edita la pieza) y
-- publicación (cuándo sale a redes) — el calendario tiene una vista para
-- cada una. "Editor" es quién queda a cargo de producir/editar (uno o
-- varios community_admin, para que nada "quede en el aire"); "Responsable
-- en cámara" es texto libre porque no siempre es alguien con cuenta en el
-- portal (ej. un socio del despacho).
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo.
--   Re-ejecutable de punta a punta (if not exists + drop policy if exists).
--
-- NOTA SOBRE RLS
--   El servidor usa la service role key, que ignora RLS; la autorización
--   real vive en requireApiPermission('parrilla:manage'). Estas policies son
--   defensa en profundidad, sobre todo para la subida a Storage desde el
--   navegador con la anon key.

begin;

-- 'idea' es el punto de partida (una pieza recién anotada, nada empezado);
-- 'en_produccion' cubre guion/diseño/edición como una sola etapa — el editor
-- asignado y las dos fechas ya dicen quién y cuándo, sin necesidad de
-- subdividirla más. Sin estado de aprobación: la parrilla no tiene ese flujo.
do $$ begin
  create type public.parrilla_status as enum ('idea', 'en_produccion', 'agendado', 'publicado', 'cancelado');
exception when duplicate_object then null;
end $$;

-- Deriva el acceso directo de profile_module_grants — no de una copia local
-- del estado, así que revocar el módulo desde /super/usuarios corta el
-- acceso real, no solo el ítem del menú.
create or replace function public.is_parrilla_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
    or exists (
      select 1 from public.profile_module_grants
      where profile_id = auth.uid() and module_key = 'parrilla'
    );
$$;

create table if not exists public.parrilla_posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  copy_text   text,
  platforms   text[] not null default '{}'
                check (platforms <@ array['instagram', 'linkedin', 'youtube']::text[]),
  production_date date not null default current_date,
  publish_date     date not null,
  status      public.parrilla_status not null default 'idea',
  -- Formato planeado (se decide antes de grabar/diseñar) — el video real
  -- vive en la red social una vez publicado, acá solo hace falta la foto de
  -- portada para identificar la pieza a simple vista en el calendario.
  format      text check (format in ('carrusel', 'imagen', 'video')),
  cover_image_url text,
  -- Quién sale en cámara — no siempre tiene cuenta en el portal, por eso es
  -- texto libre y no una referencia a profiles.
  talent      text,
  -- Dos etapas, dos responsables: quien sale a capturar lo crudo (foto/video
  -- del evento) y quien lo convierte en pieza terminada (portada, carrusel,
  -- edición) — no siempre es la misma persona.
  filmmaker_ids uuid[] not null default '{}',
  editor_ids  uuid[] not null default '{}',
  category    text check (category in ('valor', 'prospeccion', 'viral', 'comunidad')),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.parrilla_posts enable row level security;

drop policy if exists "Parrilla admins manage posts" on public.parrilla_posts;
create policy "Parrilla admins manage posts"
  on public.parrilla_posts for all
  using (public.is_parrilla_admin());

create index if not exists parrilla_posts_publish_date_idx on public.parrilla_posts (publish_date);
create index if not exists parrilla_posts_production_date_idx on public.parrilla_posts (production_date);
create index if not exists parrilla_posts_status_idx on public.parrilla_posts (status);
create index if not exists parrilla_posts_category_idx on public.parrilla_posts (category);

-- Bucket de Storage para la foto de portada.
insert into storage.buckets (id, name, public)
values ('parrilla-media', 'parrilla-media', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Parrilla admins upload media'
  ) then
    create policy "Parrilla admins upload media"
      on storage.objects for insert
      with check (bucket_id = 'parrilla-media' and public.is_parrilla_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Public read parrilla media'
  ) then
    create policy "Public read parrilla media"
      on storage.objects for select
      using (bucket_id = 'parrilla-media');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Parrilla admins delete media'
  ) then
    create policy "Parrilla admins delete media"
      on storage.objects for delete
      using (bucket_id = 'parrilla-media' and public.is_parrilla_admin());
  end if;
end $$;

commit;

-- Verificación (ejecutar aparte, después del commit):
--   select table_name from information_schema.tables where table_name = 'parrilla_posts';
--   select id from storage.buckets where id = 'parrilla-media';
--   select policyname from pg_policies where tablename = 'parrilla_posts';
