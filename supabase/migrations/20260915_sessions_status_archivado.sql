-- Agrega 'archivado' al estado de las sesiones de Terapia y Education: saca
-- una sesión del ciclo de vida (el dashboard deja de contarla y de marcarla
-- como estancada) sin borrarla — sigue visible en listados y calendario.
--
-- Solo se asigna desde Supabase; el portal no tiene ningún control para
-- archivar ni desarchivar, y las rutas que mueven el estado (generar y enviar
-- el entregable) ya no pisan una sesión archivada.
--
-- Sin begin/commit a propósito: un valor nuevo de enum no se puede usar en la
-- misma transacción que lo crea, y aquí no se usa — solo se agrega.
alter type public.therapy_status add value if not exists 'archivado';
alter type public.education_status add value if not exists 'archivado';

-- Para archivar (o devolver al ciclo de vida) una sesión, en el SQL editor:
--
--   update public.therapy_sessions   set status = 'archivado' where id = '<uuid>';
--   update public.education_sessions set status = 'archivado' where id = '<uuid>';
--
--   -- Desarchivar: volver a 'borrador' o 'generado' según el caso.
--   update public.therapy_sessions   set status = 'borrador'  where id = '<uuid>';
--
-- Verificación (ejecutar aparte, después):
--
--   select t.typname, e.enumlabel
--   from pg_enum e join pg_type t on t.oid = e.enumtypid
--   where t.typname in ('therapy_status', 'education_status')
--   order by t.typname, e.enumsortorder;
