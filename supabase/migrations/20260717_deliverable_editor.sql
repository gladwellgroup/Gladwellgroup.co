-- =============================================================
-- Entregable editor: campos estructurados + UNIQUE(session_id)
-- =============================================================

-- 1. Deduplicar entregables (quedarse el más reciente por session_id)
DELETE FROM public.therapy_deliverables d
WHERE d.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY session_id
        ORDER BY generated_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM public.therapy_deliverables
  ) ranked
  WHERE ranked.rn > 1
);

-- 2. Columnas estructuradas + processing_status
ALTER TABLE public.therapy_deliverables
  ADD COLUMN IF NOT EXISTS problema_recordatorio text,
  ADD COLUMN IF NOT EXISTS resumen_audio text,
  ADD COLUMN IF NOT EXISTS recomendaciones_incomodas text,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'listo';

-- 3. Normalizar processing_status en filas existentes
UPDATE public.therapy_deliverables
SET processing_status = 'listo'
WHERE processing_status IS NULL
   OR processing_status NOT IN ('generando', 'listo', 'error');

-- 4. UNIQUE(session_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'therapy_deliverables_session_id_key'
  ) THEN
    ALTER TABLE public.therapy_deliverables
      ADD CONSTRAINT therapy_deliverables_session_id_key UNIQUE (session_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS therapy_deliverables_processing_idx
  ON public.therapy_deliverables (processing_status);
