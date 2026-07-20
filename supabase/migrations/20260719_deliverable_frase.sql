-- Frase inspiradora de cierre del entregable (cita + autor), capturada en el
-- formulario de sesión y renderizada al final del PDF/correo en cursiva.
-- Columnas nullable, sin backfill: aditivo y de bajo riesgo.

alter table public.therapy_session_inputs
  add column if not exists frase_texto text,
  add column if not exists frase_autor text;
