-- =========================================================
-- 011 · Motor de IA (Gemini u Oniria beta)
-- =========================================================
-- Solo AGREGA columnas; no borra ni cambia datos existentes.
-- Se puede correr varias veces (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".

BEGIN;

-- Qué modelo respondió: 'gemini' (el de siempre) u 'oniria' (modelo propio, beta).
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS motor VARCHAR(20) NOT NULL DEFAULT 'gemini';
ALTER TABLE publicaciones  ADD COLUMN IF NOT EXISTS motor VARCHAR(20) NOT NULL DEFAULT 'gemini';

-- Con el modelo propio la conversación tiene dos pasos:
--   'preguntas'    = Oniria hizo sus preguntas y espera las respuestas de la persona
--   'interpretada' = ya dio su interpretación (a partir de aquí sigue la charla normal)
-- NULL = conversación hecha con Gemini.
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS fase_oniria VARCHAR(12);

-- Etiquetas completas del modelo propio (emociones con evidencia, temas, entornos,
-- personajes, rasgos...). Las estadísticas siguen usando emocion/tipo_sueno/tema.
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS etiquetas_oniria JSONB;

COMMIT;
