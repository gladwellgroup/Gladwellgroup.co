-- Se retira "Aprendizajes generales" de Gladwell Education: quedaba
-- redundante con "Conclusiones clave" (generadas por IA) y con "Cápsulas de
-- emprendimiento". Columnas nullable, sin backfill; drop directo de bajo
-- riesgo.
--
-- `if exists` porque debe correr limpio tanto en una base que ya aplicó
-- 20260805_gladwell_education.sql (donde la columna existe) como en una
-- instalación fresca que corra ambos archivos en secuencia.

begin;

alter table public.education_session_inputs
  drop column if exists aprendizajes;

alter table public.education_deliverables
  drop column if exists aprendizajes;

commit;
