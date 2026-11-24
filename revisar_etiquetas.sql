-- Revisar a mano las etiquetas más frecuentes (Supabase -> SQL Editor).
-- Sirve para descubrir variantes que conviene unir en SINONIMOS (etiquetas.js):
-- por ejemplo "casa", "hogar" y "vivienda" contadas por separado.

-- Los 60 elementos más usados
SELECT e AS elemento, COUNT(*) AS veces
FROM (SELECT unnest(elementos) AS e FROM publicaciones WHERE estado = 'listo'
      UNION ALL SELECT unnest(elementos) FROM conversaciones WHERE id_publicacion IS NULL) x
GROUP BY e ORDER BY veces DESC, e LIMIT 60;

-- Las 60 acciones más usadas
SELECT a AS accion, COUNT(*) AS veces
FROM (SELECT unnest(acciones) AS a FROM publicaciones WHERE estado = 'listo'
      UNION ALL SELECT unnest(acciones) FROM conversaciones WHERE id_publicacion IS NULL) x
GROUP BY a ORDER BY veces DESC, a LIMIT 60;
