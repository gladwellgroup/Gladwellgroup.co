-- Parrilla de contenido: integridad del guardado.
--
-- 1) TOKEN DE CONCURRENCIA. `updated_at` pasa a moverlo un trigger en cada
--    UPDATE, en vez de que cada ruta se acuerde de setearlo a mano. Con eso el
--    servidor detecta que alguien más guardó mientras otra persona editaba
--    (compare-and-set sobre updated_at) y no se pierden cambios en silencio; y
--    el token es confiable aunque la escritura no pase por la API.
--
-- 2) UN SOLO VALOR PARA "VACÍO". Los textos que quedaron como '' pasan a NULL
--    (Guion, Copy, Responsable en cámara); el código nuevo ya los guarda así.
--    No toca asignaciones ocultas (talent/filmmaker_ids de piezas donde ese
--    campo ya no aplica): se corrigen al guardar la pieza, y el dashboard las
--    ignora mientras tanto.
--
-- 3) LÍMITES DEL BUCKET `parrilla-media`. Solo imágenes (jpeg, png, webp, gif) y
--    hasta 10 MB, aplicados por Storage en el servidor: antes solo los
--    comprobaba el navegador, que se puede saltar. Storage valida el
--    Content-Type que declara el cliente, no el contenido del archivo: es una
--    política, no una defensa dura.
--
-- Requiere 20260913 (columna caption).
--
-- CÓMO APLICARLA
--   Pega el archivo completo en el SQL Editor de Supabase y ejecútalo ANTES de
--   desplegar el código. Re-ejecutable de punta a punta.
--
-- REVERTIR (solo si hiciera falta)
--   drop trigger if exists parrilla_posts_touch_updated_at on public.parrilla_posts;
--   drop function if exists public.touch_updated_at();
--   update storage.buckets set file_size_limit = null, allowed_mime_types = null
--     where id = 'parrilla-media';
--   Los '' ya convertidos a NULL no se deshacen; el código trata ambos igual.

begin;

-- Primero la limpieza y después el trigger: al revés, cada fila limpiada
-- movería updated_at e invalidaría el token de los modales que estén abiertos.
update public.parrilla_posts set copy_text = null where copy_text = '';
update public.parrilla_posts set caption = null where caption = '';
update public.parrilla_posts set talent = null where talent = '';

-- Genérica a propósito (no menciona parrilla): cualquier tabla con updated_at
-- puede reutilizarla. search_path vacío, como pide el linter de Supabase.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists parrilla_posts_touch_updated_at on public.parrilla_posts;
create trigger parrilla_posts_touch_updated_at
  before update on public.parrilla_posts
  for each row execute function public.touch_updated_at();

-- El `insert … on conflict do nothing` de 20260906 nunca actualiza un bucket
-- que ya existe, por eso los límites van en un update aparte.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'parrilla-media';

commit;

-- Verificación (ejecutar aparte, después del commit):
--   select tgname from pg_trigger
--     where tgrelid = 'public.parrilla_posts'::regclass and not tgisinternal;
--   select file_size_limit, allowed_mime_types from storage.buckets where id = 'parrilla-media';
--   select count(*) from public.parrilla_posts
--     where copy_text = '' or caption = '' or talent = '';   -- debe dar 0
--
-- Portadas subidas y nunca guardadas (el modal se cerró después de subir): no
-- se borran solas. Revisión manual, y solo las de más de un día para no tocar
-- la de alguien que esté editando ahora:
--   select o.name, o.created_at from storage.objects o
--     where o.bucket_id = 'parrilla-media'
--       and o.created_at < now() - interval '1 day'
--       and not exists (
--         select 1 from public.parrilla_posts p where p.cover_image_url like '%' || o.name
--       )
--     order by o.created_at;
