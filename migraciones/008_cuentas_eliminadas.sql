-- =========================================================
-- 008 · Cuentas eliminadas
-- =========================================================
-- Cuando alguien elimina su cuenta, la fila NO se borra (si se borrara, sus
-- sueños y comentarios se irían con ella por el ON DELETE CASCADE).
-- En su lugar se marca eliminado_en y se borran sus datos personales
-- (nombre, apodo, correo, teléfono, foto, contraseña). Sus sueños y
-- comentarios se quedan, firmados como "Cuenta eliminada".
-- Las cuentas baneadas también se muestran como "Cuenta eliminada".

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ;
