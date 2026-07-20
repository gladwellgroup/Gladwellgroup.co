-- Estado y delegación para leads de Walking List
do $$ begin
  create type public.lead_status as enum (
    'nuevo', 'delegado', 'contactado', 'invitado', 'convertido'
  );
exception when duplicate_object then null;
end $$;

alter table public.walking_list_leads
  add column if not exists status public.lead_status not null default 'nuevo',
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists walking_list_leads_status_idx
  on public.walking_list_leads (status);

create index if not exists walking_list_leads_assigned_to_idx
  on public.walking_list_leads (assigned_to)
  where assigned_to is not null;
