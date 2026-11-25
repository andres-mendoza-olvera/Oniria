// Ejecuta cada caso de prueba como un proceso aparte (usan una base PostgreSQL en memoria y un DOM simulado,
// así que no tocan Supabase, Gemini ni el modelo Oniria). Uso: npm test
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const raiz = path.join(__dirname, '..');
const casos = [
    ['Detector de riesgo y de cuidado (seguridad.js)', 'seguridad.js'],
    ['Limpieza de elementos y acciones (etiquetas.js)', 'etiquetas.js'],
    ['Flujo de IA: Gemini, Oniria, memoria y estadísticas', 'tests/casos/flujo_ia.js'],
    ['Estado de la IA, seguridad en el chat y publicación', 'tests/casos/estado_y_seguridad.js'],
    ['Opiniones: validación, propiedad y límite diario', 'tests/casos/opiniones.js'],
    ['Administración: permisos, reportes, sanciones, publicaciones y equipo', 'tests/casos/admin.js'],
    ['Interfaz del panel de administración: equipo y confirmaciones', 'tests/casos/interfaz_admin.js'],
    ['Interfaz del chat: botones, avisos y teléfonos', 'tests/casos/interfaz_chat.js'],
    ['Interfaz de opiniones y aviso de imágenes', 'tests/casos/interfaz_opiniones.js'],
    ['Gráficas y etiquetas de estadísticas', 'tests/casos/graficas.js']
];

for (const [nombre, archivo] of casos) {
    test(nombre, { timeout: 120000 }, () => {
        const r = spawnSync(process.execPath, [archivo], {
            cwd: raiz, encoding: 'utf-8',
            env: { ...process.env, SESSION_SECRET: 'prueba', GEMINI_API_KEY: 'prueba', PORT: '0' }
        });
        assert.strictEqual(r.status, 0, `${archivo} falló:\n${(r.stdout || '').split('\n').filter((l) => /FALLO|ERROR/.test(l)).join('\n')}\n${r.stderr}`);
    });
}
