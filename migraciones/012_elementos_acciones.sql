-- =========================================================
-- 012 · Elementos y acciones de cada sueño
-- =========================================================
-- Requiere haber corrido antes la 011.
-- Solo AGREGA columnas e índices; no cambia datos existentes. Se puede correr varias veces.
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".
--
-- elementos: lo que aparece en el sueño (plato, puente, casa)     -> texto, singular, sin acentos
-- acciones:  lo que se hace en el sueño (romper, volar, salir)    -> verbos en infinitivo
-- Los sueños anteriores quedan con listas vacías (no se rellenan solos).

BEGIN;

ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS elementos TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS acciones  TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE publicaciones  ADD COLUMN IF NOT EXISTS elementos TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE publicaciones  ADD COLUMN IF NOT EXISTS acciones  TEXT[] NOT NULL DEFAULT '{}';

-- Para buscar "sueños con agua" sin recorrer toda la tabla
CREATE INDEX IF NOT EXISTS idx_publicaciones_elementos ON publicaciones USING GIN (elementos);
CREATE INDEX IF NOT EXISTS idx_publicaciones_acciones  ON publicaciones USING GIN (acciones);

COMMIT;
