-- Walking List: columnas WhatsApp (nullable — leads existentes sin cambio)
-- Ejecutar en Supabase SQL Editor ANTES de desplegar código que inserta estas columnas.

alter table public.walking_list_leads
  add column if not exists whatsapp_pais text,
  add column if not exists whatsapp_indicativo text,
  add column if not exists whatsapp_numero text,
  add column if not exists whatsapp_e164 text;

alter table public.walking_list_leads
  drop constraint if exists walking_list_whatsapp_numero_check;

alter table public.walking_list_leads
  add constraint walking_list_whatsapp_numero_check
  check (
    whatsapp_numero is null
    or (char_length(trim(whatsapp_numero)) between 7 and 15
        and whatsapp_numero ~ '^[0-9]+$')
  );

create index if not exists walking_list_leads_whatsapp_e164_idx
  on public.walking_list_leads (whatsapp_e164)
  where whatsapp_e164 is not null;
