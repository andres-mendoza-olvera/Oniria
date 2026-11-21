-- =========================================================
-- Migración 004: canal preferido, notificaciones y correo único
-- =========================================================
-- Solo AGREGA cosas; no borra ni cambia datos existentes.
-- Se puede correr varias veces sin problema (usa IF NOT EXISTS).
-- Para aplicarla a mano: Supabase -> SQL Editor -> pegar y "Run".

BEGIN;

-- Por dónde le llegan los códigos de inicio de sesión y las notificaciones:
-- 'correo' (siempre disponible) o 'sms' (solo si tiene teléfono verificado)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS canal_preferido VARCHAR(10) NOT NULL DEFAULT 'correo';
DO $$ BEGIN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_canal_preferido_valido CHECK (canal_preferido IN ('correo', 'sms'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Qué notificaciones quiere recibir
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_solicitudes   BOOLEAN NOT NULL DEFAULT TRUE; -- solicitudes de amistad (y cuando las aceptan)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_publicaciones BOOLEAN NOT NULL DEFAULT TRUE; -- un amigo publicó un sueño

-- Un correo = una cuenta, sin importar mayúsculas ("Ana@x.com" y "ana@x.com" son el mismo).
-- El servidor ya guarda todos los correos en minúsculas; esto es la última barrera.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico_minusculas ON usuarios (LOWER(email));

COMMIT;
