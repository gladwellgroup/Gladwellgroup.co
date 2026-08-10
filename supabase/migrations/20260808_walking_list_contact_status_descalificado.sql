-- Agrega 'descalificado' a contact_status: un lead que no va a avanzar más
-- (no encaja, no responde, se cierra la puerta). No es un chip de filtro —
-- es una etiqueta gris para dejar de verlo como pendiente, sin borrarlo.
begin;

alter table public.walking_list_leads
  drop constraint if exists walking_list_leads_contact_status_check;

alter table public.walking_list_leads
  add constraint walking_list_leads_contact_status_check
  check (contact_status in ('sin_contactar', 'contactado', 'grupo_whatsapp', 'descalificado'));

commit;

-- Verificación (ejecutar aparte, después del commit):
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.walking_list_leads'::regclass
--     and conname = 'walking_list_leads_contact_status_check';
