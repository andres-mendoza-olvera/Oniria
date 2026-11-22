-- =========================================================
-- Migración 005: aceptación de la Política de Privacidad
-- =========================================================
-- Solo AGREGA cosas; no borra ni cambia datos existentes.
-- Se puede correr varias veces sin problema (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".

BEGIN;

-- Cuándo aceptó la política al registrarse (NULL = cuenta creada antes de pedirlo)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS politicas_aceptadas_en TIMESTAMPTZ;

COMMIT;
