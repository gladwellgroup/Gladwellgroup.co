-- Coadministradores de una sesión de Entregables, designados por el
-- super_admin DESPUÉS de creada (moderator_id/admin_id solo se eligen una
-- vez, al crear). A diferencia de contact_delegate_id (solo ver contacto),
-- estar en co_admin_ids da acceso total de edición — mismo array simple que
-- ya usa parrilla_posts.filmmaker_ids/editor_ids, sin tabla aparte porque no
-- hace falta guardar quién lo otorgó ni cuándo.

alter table public.therapy_sessions
  add column if not exists co_admin_ids uuid[] not null default '{}';

alter table public.education_sessions
  add column if not exists co_admin_ids uuid[] not null default '{}';
