// =========================================================
// Crea (o vuelve a crear) la cuenta del ADMINISTRADOR de Oniria.
// La contraseña NO se escribe en el código: se pasa en una variable de entorno.
//
// Uso (desde la carpeta del proyecto):
//   ADMIN_CONTRASENA='...' node herramientas/crear-admin.js correo@ejemplo.com apodo "Nombre" [--reemplazar]
//
// --reemplazar: si ya existe una cuenta NORMAL con ese correo, la borra (con sus sueños,
//               amigos y comentarios) y crea la del administrador en su lugar.
// =========================================================
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const [correoArg, apodo, nombre = 'Administrador'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const reemplazar = process.argv.includes('--reemplazar');
const contrasena = process.env.ADMIN_CONTRASENA;
const correo = String(correoArg || '').trim().toLowerCase();

if (!correo || !apodo || !contrasena) {
    console.error('Uso: ADMIN_CONTRASENA=\'...\' node herramientas/crear-admin.js correo apodo "Nombre" [--reemplazar]');
    process.exit(1);
}
if (contrasena.length < 8) {
    console.error('La contraseña del administrador debe tener al menos 8 caracteres.');
    process.exit(1);
}

(async () => {
    const db = new Client({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 5432, database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false }
    });
    await db.connect();
    try {
        await db.query('BEGIN');
        const existente = (await db.query('SELECT id_usuario, rol FROM usuarios WHERE LOWER(email) = $1', [correo])).rows[0];
        if (existente) {
            if (existente.rol === 'admin') {
                // Ya es admin: solo se actualiza la contraseña y el apodo
                await db.query('UPDATE usuarios SET contrasena = $1, apodo = $2 WHERE id_usuario = $3',
                    [await bcrypt.hash(contrasena, 10), apodo, existente.id_usuario]);
                await db.query('COMMIT');
                console.log(`Ya era administrador (id ${existente.id_usuario}); se actualizó su contraseña.`);
                return;
            }
            if (!reemplazar) throw new Error(`Ya existe una cuenta con ese correo (id ${existente.id_usuario}). Usa --reemplazar para borrarla y crear el admin.`);
            await db.query("DELETE FROM sesiones WHERE sess->>'idUsuario' = $1", [String(existente.id_usuario)]);
            await db.query('DELETE FROM usuarios WHERE id_usuario = $1', [existente.id_usuario]);
            console.log(`Se borró la cuenta anterior (id ${existente.id_usuario}).`);
        }
        const id = (await db.query(
            `INSERT INTO usuarios (nombre, apodo, email, contrasena, tema, verificado, rol, politicas_aceptadas_en)
             VALUES ($1, $2, $3, $4, 'Claro', TRUE, 'admin', NOW()) RETURNING id_usuario`,
            [nombre, apodo, correo, await bcrypt.hash(contrasena, 10)]
        )).rows[0].id_usuario;
        await db.query('COMMIT');
        console.log(`Administrador creado (id ${id}): ${apodo} <${correo}>`);
    } catch (err) {
        await db.query('ROLLBACK').catch(() => {});
        console.error('ERROR:', err.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
})();
