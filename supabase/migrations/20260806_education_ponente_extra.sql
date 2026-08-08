-- Dos campos nuevos en la sección Ponente de Gladwell Education: red social
-- principal del ponente y una descripción de la sesión. Columnas nullable,
-- sin backfill: aditivo y de bajo riesgo.

begin;

alter table public.education_session_inputs
  add column if not exists ponente_red_social text,
  add column if not exists descripcion_sesion text;

commit;
