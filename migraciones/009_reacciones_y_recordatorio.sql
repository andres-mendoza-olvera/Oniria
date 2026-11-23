-- =========================================================
-- Migración 009: reacciones y recordatorio de cada mañana
-- =========================================================
-- Solo AGREGA cosas; no borra ni cambia datos existentes.
-- Se puede correr varias veces sin problema (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".

BEGIN;

-- ---------- Reacciones ----------
-- La tabla "corazones" ahora guarda cualquier reacción (una por persona y sueño).
-- Los corazones que ya existían se quedan como 'corazon'.
--   corazon ❤️ · risa 😂 · asombro 😮 · miedo 😱 · triste 😢 · yo_tambien 🔮 ("yo también lo he soñado")
ALTER TABLE corazones ADD COLUMN IF NOT EXISTS reaccion VARCHAR(12) NOT NULL DEFAULT 'corazon';
DO $$ BEGIN
    ALTER TABLE corazones ADD CONSTRAINT corazones_reaccion_valida
        CHECK (reaccion IN ('corazon', 'risa', 'asombro', 'miedo', 'triste', 'yo_tambien'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- Recordatorio de cada mañana ----------
-- "¿Qué soñaste anoche?" por su canal preferido (correo o SMS), alrededor de las 8:00 (hora de México)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_recordatorio BOOLEAN NOT NULL DEFAULT TRUE;
-- Último día (hora de México) en que se le mandó, para no repetirlo aunque el servidor se reinicie
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_recordatorio DATE;

COMMIT;
