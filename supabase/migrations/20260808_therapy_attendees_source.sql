-- Terapia Organizacional también necesita saber si cada asistente llegó por
-- QR (en vivo) o por CSV (importado después) — mismo campo que ya tiene
-- education_attendees, agregado ahora que Terapia tiene los mismos dos
-- métodos de captura (ver 20260807_attendance_links.sql y la importación
-- CSV agregada después).

begin;

alter table public.therapy_session_attendees
  add column if not exists source text not null default 'csv'
    check (source in ('csv', 'qr'));

commit;

-- Verificación (ejecutar aparte, después del commit):
--
--   select column_name from information_schema.columns
--   where table_name = 'therapy_session_attendees' and column_name = 'source';
