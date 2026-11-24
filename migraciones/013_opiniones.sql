-- =========================================================
-- 013 · Opiniones sobre la experiencia con Oniria
-- =========================================================
-- Requiere haber corrido antes la 011 (usa la misma idea de "motor").
-- Solo CREA una tabla; no cambia datos existentes. Se puede correr varias veces.
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".
--
-- La persona puede dejar, mientras platica con Oniria, una valoración de 1 a 5 y/o un comentario.
-- Se guarda con qué motor respondió (Gemini u Oniria beta) para poder comparar. Si se borra la
-- conversación, la opinión se conserva (sin el enlace); si se borra la cuenta, se borra con ella.

BEGIN;

CREATE TABLE IF NOT EXISTS opiniones (
    id_opinion      SERIAL PRIMARY KEY,
    id_usuario      INTEGER     NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_conversacion INTEGER     REFERENCES conversaciones(id_conversacion) ON DELETE SET NULL,
    motor           VARCHAR(20),
    valoracion      SMALLINT    CHECK (valoracion BETWEEN 1 AND 5),
    comentario      VARCHAR(1000),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (valoracion IS NOT NULL OR comentario IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS opiniones_recientes ON opiniones (creado_en DESC);
CREATE INDEX IF NOT EXISTS opiniones_usuario ON opiniones (id_usuario, creado_en DESC);

COMMIT;
