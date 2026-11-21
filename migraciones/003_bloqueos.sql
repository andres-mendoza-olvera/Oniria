-- =========================================================
-- Migración 003: bloquear personas
-- =========================================================
-- Solo AGREGA cosas; no borra ni cambia datos existentes.
-- Se puede correr varias veces sin problema (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".
--
-- Si A bloquea a B:
--   - se borra su amistad o solicitud pendiente (si había)
--   - ninguno ve los sueños ni los comentarios del otro
--   - ninguno puede mandarle solicitud al otro
--   - B no encuentra a A en el buscador ni puede abrir su perfil
-- Desbloquear = borrar la fila.

BEGIN;

CREATE TABLE IF NOT EXISTS bloqueos (
    id_bloqueador INTEGER     NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_bloqueado  INTEGER     NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_bloqueador, id_bloqueado),
    CHECK (id_bloqueador <> id_bloqueado)
);

-- Para revisar rápido "¿alguien me bloqueó?"
CREATE INDEX IF NOT EXISTS bloqueos_bloqueado ON bloqueos (id_bloqueado);

COMMIT;
