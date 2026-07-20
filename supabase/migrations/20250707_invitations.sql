-- Tabla de invitaciones al portal
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  email text not null,
  role public.app_role not null default 'community_member',
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;

create policy "Super admin manages invitations"
  on public.invitations for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );

create index if not exists invitations_token_idx on public.invitations (token);
create index if not exists invitations_email_idx on public.invitations (email);
