-- Revierte contact_delegate_id (20260909_session_contact_delegate.sql): el
-- usuario decidió que el único mecanismo de delegación por sesión sea el
-- coadministrador (co_admin_ids, acceso total), que ya cubre ver contacto
-- como parte de su acceso completo — la delegación de "solo ver contacto"
-- quedaba como una capa intermedia innecesaria. Nunca llegó a usarse en
-- producción (todas las filas tenían el valor en null).

alter table public.therapy_sessions
  drop column if exists contact_delegate_id;

alter table public.education_sessions
  drop column if exists contact_delegate_id;
