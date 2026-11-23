-- =========================================================
-- Migración 010: memoria de interpretaciones pasadas
-- =========================================================
-- Solo AGREGA cosas; no borra ni cambia datos existentes.
-- Se puede correr varias veces sin problema (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".
--
-- Al interpretar un sueño, la IA guarda un resumen corto ("Soñó con agua que
-- inundaba su casa; sintió miedo; mencionó que se va a mudar"). En los sueños
-- siguientes los lee y, si hay relación, la menciona junto a la interpretación
-- ("La semana pasada también soñaste con agua y mencionaste tu mudanza…").
--   - Solo la ve su dueño: se puede ver, borrar (uno o todos) y apagar en su perfil.
--   - Si se borra el sueño (su conversación), se borra también su recuerdo.

BEGIN;

-- ¿Oniria puede recordar mis sueños? (apagada = ni los lee ni guarda nuevos)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS memoria_activa BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS memorias (
    id_memoria      SERIAL PRIMARY KEY,
    id_usuario      INTEGER      NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_conversacion INTEGER      UNIQUE REFERENCES conversaciones(id_conversacion) ON DELETE CASCADE,
    resumen         VARCHAR(300) NOT NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS memorias_usuario ON memorias (id_usuario, creado_en DESC);

-- La conexión con sueños anteriores que dijo la IA (privada: se ve solo en el chat, nunca en el feed)
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS conexion_memoria TEXT;

COMMIT;
