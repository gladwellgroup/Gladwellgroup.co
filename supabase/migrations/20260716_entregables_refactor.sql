-- =============================================================
-- Migración: Refactor Entregables
-- Separa inputs humanos de outputs AI, crea tablas 1:N para
-- cofundadores y audios, y configura Storage para media.
-- =============================================================

-- 1. Agregar columna nueva a therapy_session_inputs
ALTER TABLE public.therapy_session_inputs
  ADD COLUMN IF NOT EXISTS foto_sesion_url text;

-- 2. Eliminar columnas que ahora son output AI o migran a tablas propias
ALTER TABLE public.therapy_session_inputs
  DROP COLUMN IF EXISTS tipo_producto_servicio,
  DROP COLUMN IF EXISTS feedback_cofundadores,
  DROP COLUMN IF EXISTS problema_real,
  DROP COLUMN IF EXISTS camino_sesion,
  DROP COLUMN IF EXISTS recomendaciones_generales,
  DROP COLUMN IF EXISTS fotos_urls,
  DROP COLUMN IF EXISTS foto_grupo_final;

-- 3. Tabla de cofundadores (1:N por sesión)
CREATE TABLE IF NOT EXISTS public.therapy_session_cofounders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  whatsapp text,
  correo text,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.therapy_session_cofounders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'therapy_session_cofounders'
      AND policyname = 'Admins manage session cofounders'
  ) THEN
    CREATE POLICY "Admins manage session cofounders"
      ON public.therapy_session_cofounders FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('super_admin', 'community_admin')
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS therapy_cofounders_session_idx
  ON public.therapy_session_cofounders (session_id);

-- 4. Tabla de audios (1:N por sesión)
CREATE TABLE IF NOT EXISTS public.therapy_session_audios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  autor_nombre text,
  duracion_segundos int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.therapy_session_audios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'therapy_session_audios'
      AND policyname = 'Admins manage session audios'
  ) THEN
    CREATE POLICY "Admins manage session audios"
      ON public.therapy_session_audios FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('super_admin', 'community_admin')
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS therapy_audios_session_idx
  ON public.therapy_session_audios (session_id);

-- 5. Bucket de Storage para media de terapia
INSERT INTO storage.buckets (id, name, public)
VALUES ('therapy-media', 'therapy-media', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Policies de Storage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Admins upload therapy media'
  ) THEN
    CREATE POLICY "Admins upload therapy media"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'therapy-media'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('super_admin', 'community_admin')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Public read therapy media'
  ) THEN
    CREATE POLICY "Public read therapy media"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'therapy-media');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Admins delete therapy media'
  ) THEN
    CREATE POLICY "Admins delete therapy media"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'therapy-media'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('super_admin', 'community_admin')
        )
      );
  END IF;
END $$;
