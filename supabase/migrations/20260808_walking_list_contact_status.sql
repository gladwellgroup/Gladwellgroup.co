-- Seguimiento de contacto de la Walking List, independiente de `status`
-- (que sigue siendo "a quién se delegó"). Este campo responde una pregunta
-- distinta: "qué tan avanzado va el contacto con este lead". Termina en
-- 'grupo_whatsapp' — de ahí en adelante el seguimiento ya se trackea vía
-- asistencia a sesiones, no en este módulo.
begin;

alter table public.walking_list_leads
  add column if not exists contact_status text not null default 'sin_contactar'
    check (contact_status in ('sin_contactar', 'contactado', 'grupo_whatsapp'));

create index if not exists walking_list_leads_contact_status_idx
  on public.walking_list_leads (contact_status);

commit;

-- Verificación (ejecutar aparte, después del commit):
--
--   select column_name, column_default
--   from information_schema.columns
--   where table_name = 'walking_list_leads' and column_name = 'contact_status';
