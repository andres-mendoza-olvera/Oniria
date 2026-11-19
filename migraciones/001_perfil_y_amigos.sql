-- =========================================================
-- Migración 001: perfil de usuario y sistema de amigos
-- =========================================================
-- Solo AGREGA cosas; no borra ni cambia datos existentes.
-- Se puede correr varias veces sin problema (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".

BEGIN;

-- ---------- Perfil ----------
-- Link (en Supabase Storage) de la foto de perfil; NULL = avatar automático
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil TEXT;
-- Descripción corta que se ve en el perfil
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS biografia VARCHAR(200);

-- ---------- Amigos ----------
-- Una fila por pareja de personas:
--   estado 'pendiente' = id_solicitante mandó la solicitud y falta que id_destinatario responda
--   estado 'aceptada'  = ya son amigos
-- Rechazar, cancelar o dejar de ser amigos = borrar la fila.
CREATE TABLE IF NOT EXISTS amistades (
    id_solicitante  INTEGER     NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_destinatario INTEGER     NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    estado          VARCHAR(10) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada')),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    respondido_en   TIMESTAMPTZ,
    PRIMARY KEY (id_solicitante, id_destinatario),
    CHECK (id_solicitante <> id_destinatario) -- nadie puede ser amigo de sí mismo
);

-- Evita filas duplicadas en sentido contrario (A->B y B->A a la vez)
CREATE UNIQUE INDEX IF NOT EXISTS amistades_pareja_unica
    ON amistades (LEAST(id_solicitante, id_destinatario), GREATEST(id_solicitante, id_destinatario));

-- Para encontrar rápido las solicitudes que me llegaron
CREATE INDEX IF NOT EXISTS amistades_destinatario ON amistades (id_destinatario, estado);

COMMIT;
