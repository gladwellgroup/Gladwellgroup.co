-- walking_list_leads no tenía RLS habilitado tras la migración de delegación.
-- Sin esto, cualquier cliente con la anon key podía leer/escribir todos los leads.
alter table public.walking_list_leads enable row level security;

create policy "Super admin manages all leads"
  on public.walking_list_leads for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );

create policy "Community admin reads own delegated leads"
  on public.walking_list_leads for select
  using (assigned_to = auth.uid());
