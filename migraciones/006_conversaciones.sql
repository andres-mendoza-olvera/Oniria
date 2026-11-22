-- =========================================================
-- Migración 006: conversaciones de los sueños guardadas
-- =========================================================
-- Solo AGREGA cosas; no borra ni cambia datos existentes.
-- Se puede correr varias veces sin problema (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".
--
-- Cada plática con la IA sobre un sueño queda guardada para retomarla cuando sea.
--   id_publicacion NULL  = borrador (se puede seguir platicando, publicar o eliminar)
--   id_publicacion lleno = ya se publicó; si se borra la publicación, se borra también
--                          la conversación (comparten las mismas imágenes).

BEGIN;

CREATE TABLE IF NOT EXISTS conversaciones (
    id_conversacion SERIAL PRIMARY KEY,
    id_usuario      INTEGER     NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    titulo          VARCHAR(150),
    relato          TEXT        NOT NULL,             -- lo que se publicaría como relato
    interpretacion  TEXT        NOT NULL,             -- la interpretación más reciente
    imagen_ia       TEXT,                             -- URL (Storage) de la imagen creada por la IA
    prompt_ia       TEXT,
    imagenes        JSONB       NOT NULL DEFAULT '[]', -- imágenes del usuario: [{ "url", "tipo" }]
    mensajes        JSONB       NOT NULL DEFAULT '[]', -- lo que se ve en el chat
    historial       JSONB       NOT NULL DEFAULT '[]', -- lo que se le manda a Gemini (imágenes como referencia)
    id_publicacion  INTEGER     UNIQUE REFERENCES publicaciones(id_publicacion) ON DELETE CASCADE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Para la lista "Conversaciones" del perfil (las más recientes primero)
CREATE INDEX IF NOT EXISTS conversaciones_usuario ON conversaciones (id_usuario, actualizado_en DESC);

COMMIT;
