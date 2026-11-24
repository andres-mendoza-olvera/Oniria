-- Resumen de las opiniones de la gente (Supabase -> SQL Editor).
-- 1) Promedio y cantidad por motor (para comparar Gemini contra Oniria beta)
SELECT COALESCE(motor, 'sin dato') AS motor, COUNT(*) AS opiniones, ROUND(AVG(valoracion), 2) AS promedio
FROM opiniones WHERE valoracion IS NOT NULL GROUP BY 1 ORDER BY 1;

-- 2) Últimos comentarios (sin el nombre de la persona)
SELECT creado_en::date AS fecha, COALESCE(motor, '-') AS motor, valoracion, comentario
FROM opiniones WHERE comentario IS NOT NULL ORDER BY creado_en DESC LIMIT 50;
