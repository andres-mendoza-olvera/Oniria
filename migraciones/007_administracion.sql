-- =========================================================
-- Migración 007: administración, sanciones, reportes y estadísticas
-- =========================================================
-- Solo AGREGA cosas; no borra ni cambia datos existentes.
-- Se puede correr varias veces sin problema (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".

BEGIN;

-- ---------- Roles ----------
--   'usuario'   = cuenta normal
--   'moderador' = subadministrador: ve estadísticas, revisa reportes y SUSPENDE cuentas
--   'admin'     = todo lo anterior + banear y crear/quitar moderadores
-- Las cuentas de administración no tienen parte social (amigos, feed, sueños).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(10) NOT NULL DEFAULT 'usuario';
DO $$ BEGIN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_valido CHECK (rol IN ('usuario', 'moderador', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- Sanciones ----------
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido_hasta TIMESTAMPTZ; -- no puede entrar hasta esta fecha
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baneado_en       TIMESTAMPTZ; -- no puede volver a entrar
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS motivo_sancion   TEXT;

-- ---------- Clasificación de los sueños (para las estadísticas) ----------
-- La IA la decide al interpretar el sueño.
--   emocion:    feliz | triste | miedo | calma | confusion | otra
--   tipo_sueno: normal | pesadilla | lucido | recurrente
--   tema:       personas | peligro | volar_caer | naturaleza | fantasia | otro
ALTER TABLE publicaciones  ADD COLUMN IF NOT EXISTS emocion    VARCHAR(12);
ALTER TABLE publicaciones  ADD COLUMN IF NOT EXISTS tipo_sueno VARCHAR(12);
ALTER TABLE publicaciones  ADD COLUMN IF NOT EXISTS tema       VARCHAR(12);
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS emocion    VARCHAR(12);
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS tipo_sueno VARCHAR(12);
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS tema       VARCHAR(12);

-- ---------- Reportes ----------
CREATE TABLE IF NOT EXISTS reportes (
    id_reporte     SERIAL PRIMARY KEY,
    id_reportante  INTEGER     REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_reportado   INTEGER     NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_publicacion INTEGER     REFERENCES publicaciones(id_publicacion) ON DELETE SET NULL, -- si reportó un sueño
    motivo         VARCHAR(20) NOT NULL CHECK (motivo IN ('acoso', 'odio', 'sexual', 'violencia', 'spam', 'otro')),
    detalle        VARCHAR(500),
    estado         VARCHAR(12) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'resuelto', 'descartado')),
    accion         VARCHAR(12) CHECK (accion IN ('ninguna', 'suspension', 'baneo')),
    dias_suspension INTEGER,
    nota_admin     VARCHAR(500),
    id_revisor     INTEGER     REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelto_en    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS reportes_estado ON reportes (estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS reportes_reportado ON reportes (id_reportado);

COMMIT;
