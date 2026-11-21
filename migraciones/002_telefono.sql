-- =========================================================
-- Migración 002: teléfono verificado (SMS o WhatsApp)
-- =========================================================
-- Solo AGREGA cosas; no borra ni cambia datos existentes.
-- Se puede correr varias veces sin problema (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".

BEGIN;

-- Número en formato internacional (E.164), p. ej. +5215512345678.
-- Solo se guarda cuando ya se verificó con el código; NULL = sin teléfono.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(16);
-- Cuándo se verificó y por qué canal llegó el código ('sms' o 'whatsapp')
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono_verificado_en TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono_canal VARCHAR(10);

-- Un mismo número no puede estar en dos cuentas
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_telefono_unico ON usuarios (telefono) WHERE telefono IS NOT NULL;

COMMIT;
