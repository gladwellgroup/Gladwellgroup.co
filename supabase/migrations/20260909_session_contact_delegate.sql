-- Permite al super_admin delegar, sesión por sesión, la visibilidad de los
-- datos de contacto (WhatsApp/correo de fundadores, lista de asistentes) a
-- un community_admin puntual que no es el dueño de esa sesión. La
-- delegación NO otorga permisos de edición — eso lo sigue decidiendo el
-- módulo de Entregables + ser el creador/moderador, sin cambios.
--
-- Nullable y sin índice: siempre se consulta junto al resto de la fila de
-- la sesión por su id (ya es la clave primaria), nunca se busca por esta
-- columna de forma independiente.

alter table public.therapy_sessions
  add column if not exists contact_delegate_id uuid references public.profiles(id);

alter table public.education_sessions
  add column if not exists contact_delegate_id uuid references public.profiles(id);
