-- Parrilla de contenido: borrar una frase ya no mueve el updated_at de las piezas.
--
-- QUÉ PASABA
--   20260914 hizo INCONDICIONAL el trigger de updated_at, a propósito: updated_at es
--   el token de concurrencia del modal (`expected_updated_at`, compare-and-set) y así
--   cambia con cualquier escritura, aunque no pase por la API. Desde 20260920, borrar
--   una frase ejecuta el ON DELETE SET NULL de `parrilla_posts.quote_id`, que es un
--   UPDATE más de cada pieza derivada de ella, y el trigger lo contaba como una edición:
--     · el Banco de contenido ordena por updated_at (la última edición), así que cada
--       idea archivada que nació de esa frase saltaba al primer lugar;
--     · un modal abierto sobre una de esas piezas recibía un 409 al guardar (la fusión
--       reintenta sola y no se ve), y un guardado SIN token —arrastrar una fecha en el
--       calendario— que cayera entre la lectura y la escritura de applyPostUpdate
--       respondía «Esta publicación cambió mientras la editabas.».
--
-- QUÉ HACE
--   Recrea el MISMO trigger (mismo nombre, misma función) con una condición WHEN:
--   updated_at se mueve en todo UPDATE salvo el que hace la FK al borrar una frase, que
--   solo pone quote_id en NULL.
--
-- QUÉ SE CONSERVA
--   El token sigue cambiando con toda edición que alguien pueda ver o estar editando.
--   quote_id no es editable (el PATCH lo descarta; tests/schemas.test.ts lo comprueba) ni
--   viaja al cliente (ninguna lista de lectura de publicaciones lo pide), así que quitar
--   el vínculo no cambia nada que se muestre o se fusione. Siguen moviéndolo, como antes:
--   cualquier otro cambio (también si el vínculo se quita en el mismo UPDATE), quitar el
--   vínculo a mano con un UPDATE, vincular una pieza o cambiarla de frase, y un UPDATE
--   que no cambia nada.
--
-- DECISIONES
--   · La condición va en el trigger y no en touch_updated_at(): la función es genérica
--     (parrilla_quotes la usa también) y no se toca.
--   · Solo queda exento lo que hace la FK. Postgres ejecuta sus acciones (ON DELETE SET
--     NULL) dentro de triggers propios, así que `pg_trigger_depth() > 0` las distingue de
--     un UPDATE escrito a mano o enviado por la API, que llegan con profundidad 0. Además,
--     la fila tiene que haber cambiado SOLO en quote_id (de un valor a NULL).
--   · Compara la fila entera con to_jsonb() y no con una lista de columnas: una columna
--     que se agregue después cuenta sola; con una lista escrita a mano, la que se olvide
--     dejaría de mover updated_at sin que nadie lo note.
--   · `is not distinct from` en lugar de `=`: nunca da NULL, así que la condición siempre
--     es verdadera o falsa y ninguna duda puede desactivar el trigger.
--   · No cambia nada de lo que ve PostgREST: no hace falta recargar su caché de esquema.
--   · tests/trigger-updated-at.test.ts vigila que la definición vigente del trigger (la
--     última entre todas las migraciones) conserve la condición.
--
-- LÍMITES
--   · Un trigger (o una función que un trigger llama) que SOLO quite el vínculo también
--     queda exento, porque para Postgres es lo mismo que la FK. Hoy no existe ninguno.
--   · Otra FK de parrilla_posts cuya acción actualice la fila (ON DELETE SET NULL, ON
--     UPDATE CASCADE…) que se agregue más adelante necesitaría su propia excepción: hoy
--     created_by no tiene acción.
--   · El trigger depende de la columna quote_id: Postgres no deja borrarla ni cambiarle el
--     tipo mientras exista (renombrarla sí), y el REVERTIR de 20260920 falla hasta revertir
--     ESTA migración. (El de 20260914 ya fallaba desde 20260920: parrilla_quotes usa la
--     función.)
--
-- Requiere 20260914 (touch_updated_at) y 20260920 (parrilla_posts.quote_id).
--
-- CÓMO APLICARLA
--   1. Antes (solo lectura): las consultas 2 y 4 de «Verificación», al pie. Deben salir
--      solo los dos triggers esperados, ninguna regla, ninguna transacción larga y ninguna
--      función o vista a mano que toque parrilla_posts.
--   2. Pega el archivo completo en el SQL Editor de Supabase y ejecútalo. Es atómica
--      (begin/commit) y re-ejecutable de punta a punta.
--   3. Después, las consultas 1 y 3 de «Verificación».
--
--   Producción y el entorno local comparten esta base: lo que se aplica aquí ya está
--   vivo para el código desplegado. Esta migración es inocua para él, así que se puede
--   correr ANTES o DESPUÉS de desplegar: no cambia tablas, columnas ni respuestas de la
--   API, y el código desplegado nunca escribe quote_id, de modo que para él el trigger se
--   comporta igual que el de 20260914. Conviene aplicarla antes de desplegar «Frases»,
--   que es lo que permite borrar frases desde la app.
--
--   NO vuelvas a ejecutar 20260914_parrilla_integridad.sql después de esta: se anuncia
--   re-ejecutable, pero recrea el trigger SIN condición y deshace esta migración en
--   silencio. Si alguna vez lo haces, vuelve a ejecutar esta.
--
--   Bloqueo: DROP TRIGGER pide ACCESS EXCLUSIVE sobre parrilla_posts y CREATE TRIGGER,
--   SHARE ROW EXCLUSIVE, los dos hasta el commit. Son milisegundos (no se lee ni se
--   reescribe ninguna fila). El `set local lock_timeout` evita lo único malo que puede
--   pasar: que otra transacción larga tenga la tabla tomada y todas las consultas de la
--   parrilla hagan cola detrás de esta. Si vence (error 55P03) no se aplicó nada: ejecuta
--   `rollback;` solo (el Editor puede dejar la transacción abierta y abortada) y vuelve a
--   pegarla en un momento tranquilo. La guarda de requisitos va antes del begin justo
--   para que su error, el más probable, no deje nada abierto.
--
-- REVERTIR (solo si hiciera falta; vuelve al trigger incondicional de 20260914. La
-- función NO se borra: la usa también parrilla_quotes_touch_updated_at)
--   begin;
--   set local lock_timeout = '5s';
--   drop trigger if exists parrilla_posts_touch_updated_at on public.parrilla_posts;
--   create trigger parrilla_posts_touch_updated_at
--     before update on public.parrilla_posts
--     for each row execute function public.touch_updated_at();
--   commit;

-- Mensaje claro si falta alguna migración previa (si no, Postgres solo diría
-- «column "quote_id" does not exist»). Va ANTES del begin: si falla, no deja una
-- transacción abortada abierta en el Editor.
do $$
begin
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception 'Falta aplicar 20260914_parrilla_integridad.sql: no existe public.touch_updated_at()';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'parrilla_posts' and column_name = 'quote_id'
  ) then
    raise exception 'Falta aplicar 20260920_parrilla_frases.sql: no existe parrilla_posts.quote_id';
  end if;
end $$;

begin;

-- Falla rápido en vez de hacer cola detrás de una transacción larga (ver «Bloqueo»).
set local lock_timeout = '5s';

-- Mueve updated_at SALVO en el UPDATE que hace la FK al borrar una frase. Se lee: «no
-- mover si esto ocurre dentro de un trigger (la acción de la FK), antes había vínculo,
-- ahora no lo hay y el resto de la fila —sin contar quote_id ni updated_at— quedó igual».
drop trigger if exists parrilla_posts_touch_updated_at on public.parrilla_posts;
create trigger parrilla_posts_touch_updated_at
  before update on public.parrilla_posts
  for each row
  when (
    not (
      pg_trigger_depth() > 0
      and old.quote_id is not null
      and new.quote_id is null
      and (to_jsonb(new) - 'quote_id' - 'updated_at')
        is not distinct from (to_jsonb(old) - 'quote_id' - 'updated_at')
    )
  )
  execute function public.touch_updated_at();

comment on trigger parrilla_posts_touch_updated_at on public.parrilla_posts is
  'Mueve updated_at en cada UPDATE, salvo el que hace la FK al borrar una frase (ON DELETE SET NULL de quote_id). Ver 20260921_parrilla_updated_at_ignora_desvinculo_frase.sql.';

commit;

-- Verificación (ejecutar aparte, después del commit):
--   1. La definición vigente lleva la condición (debe contener WHEN, pg_trigger_depth y
--      to_jsonb):
--        select pg_get_triggerdef(oid) from pg_trigger
--          where tgrelid = 'public.parrilla_posts'::regclass and not tgisinternal;
--   2. Todo trigger de las dos tablas y todo lo que usa la función genérica. Sirve también
--      ANTES de aplicarla: deben salir solo estos dos, con tgenabled = 'O'; si hay otro,
--      revísalo antes de seguir:
--        select c.oid::regclass as tabla, t.tgname, t.tgenabled
--          from pg_trigger t join pg_class c on c.oid = t.tgrelid
--          where not t.tgisinternal
--            and (t.tgfoid = 'public.touch_updated_at()'::regprocedure
--                 or c.oid in ('public.parrilla_posts'::regclass, 'public.parrilla_quotes'::regclass))
--          order by 1, 2;   -- parrilla_posts_touch_updated_at y parrilla_quotes_touch_updated_at
--      Reglas de reescritura sobre las dos tablas (deben ser 0 filas):
--        select tablename, rulename from pg_rules
--          where schemaname = 'public' and tablename in ('parrilla_posts', 'parrilla_quotes');
--   3. Prueba de humo, opcional y sin rastro: lanza un error a propósito, que lo deshace
--      todo, y el resultado viaja en el mensaje. Pégala SOLA (sin begin ni commit). ANTES de
--      aplicar la migración debe decir FALLÓ con «borrar la frase conserva updated_at=f»
--      (es el defecto); DESPUÉS, OK con las cuatro en t:
--        do $$
--        declare
--          v_user uuid;
--          v_q1 uuid;
--          v_q2 uuid;
--          v_p1 uuid;
--          v_p2 uuid;
--          v_viejo constant timestamptz := '2000-01-01 00:00:00+00';
--          v_borrar_conserva boolean;
--          v_desvinculada boolean;
--          v_editar_mueve boolean;
--          v_quitar_a_mano_mueve boolean;
--        begin
--          select id into v_user from public.profiles limit 1;
--          if v_user is null then
--            raise exception 'No hay ningún perfil para firmar las filas de prueba';
--          end if;
--
--          insert into public.parrilla_quotes (quote_text, author, created_by)
--            values ('Prueba de humo 20260921 A', 'Prueba', v_user) returning id into v_q1;
--          insert into public.parrilla_quotes (quote_text, author, created_by)
--            values ('Prueba de humo 20260921 B', 'Prueba', v_user) returning id into v_q2;
--          -- updated_at viejo y explícito: now() es constante dentro de una transacción, y sin
--          -- esto «se movió» y «no se movió» no se distinguirían.
--          insert into public.parrilla_posts (title, publish_date, created_by, quote_id, updated_at)
--            values ('Prueba de humo A', current_date, v_user, v_q1, v_viejo) returning id into v_p1;
--          insert into public.parrilla_posts (title, publish_date, created_by, quote_id, updated_at)
--            values ('Prueba de humo B', current_date, v_user, v_q2, v_viejo) returning id into v_p2;
--
--          -- 1. Borrar la frase (ON DELETE SET NULL): desvincula la pieza y NO mueve updated_at.
--          delete from public.parrilla_quotes where id = v_q1;
--          select updated_at = v_viejo, quote_id is null
--            into v_borrar_conserva, v_desvinculada
--            from public.parrilla_posts where id = v_p1;
--
--          -- 2. Una edición normal SÍ lo mueve.
--          update public.parrilla_posts set title = 'Prueba de humo A (editada)' where id = v_p1;
--          select updated_at <> v_viejo into v_editar_mueve
--            from public.parrilla_posts where id = v_p1;
--
--          -- 3. Quitar el vínculo a mano (un UPDATE directo, no la FK) SÍ lo mueve.
--          update public.parrilla_posts set quote_id = null where id = v_p2;
--          select updated_at <> v_viejo into v_quitar_a_mano_mueve
--            from public.parrilla_posts where id = v_p2;
--
--          -- El error final deshace TODO lo anterior y lleva el resultado hasta el Editor.
--          raise exception 'PRUEBA DE HUMO % (todo revertido): borrar la frase conserva updated_at=%, la desvincula=%, editar lo mueve=%, quitar el vínculo a mano lo mueve=%',
--            case when v_borrar_conserva and v_desvinculada and v_editar_mueve and v_quitar_a_mano_mueve
--              then 'OK' else 'FALLÓ' end,
--            v_borrar_conserva, v_desvinculada, v_editar_mueve, v_quitar_a_mano_mueve;
--        end $$;
--   4. Solo ANTES de aplicarla: ¿hay una transacción larga que pueda retener la tabla (debe
--      salir vacío, o con duraciones de milisegundos) y alguna función o vista a mano que
--      lea o escriba parrilla_posts (debe salir vacío)?
--        select pid, state, now() - xact_start as duracion, left(query, 80) as consulta
--          from pg_stat_activity
--          where datname = current_database() and pid <> pg_backend_pid() and xact_start is not null
--          order by xact_start;
--        select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--          where n.nspname not in ('pg_catalog', 'information_schema') and p.prosrc ilike '%parrilla_posts%'
--        union all
--        select schemaname, viewname from pg_views where definition ilike '%parrilla_posts%';
