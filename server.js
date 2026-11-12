require('dotenv').config(); // Carga las variables del archivo .env

const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000; // Render asigna su propio puerto
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// La carpeta uploads no se sube a GitHub, así que la creamos si no existe
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

// =========================================================
// 1. MIDDLEWARES (Deben ir obligatoriamente antes de las rutas)
// =========================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// =========================================================
// 2. CONFIGURACIÓN DE LA BASE DE DATOS (PostgreSQL en Supabase)
// =========================================================
// Un "Pool" mantiene varias conexiones abiertas y las reutiliza.
const db = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false } // Supabase exige conexión cifrada
});

// Probamos la conexión al arrancar
db.query('SELECT NOW()')
    .then(() => console.log('Conectado a PostgreSQL (Supabase)'))
    .catch((err) => console.error('Error conectando a PostgreSQL:', err.message));

// NOTA para quien venga de MySQL:
//  - Los parámetros son $1, $2, $3... en lugar de ?
//  - Las filas vienen en resultado.rows (no en results)
//  - Las filas modificadas vienen en resultado.rowCount (no en affectedRows)

// =========================================================
// 3. CONFIGURACIÓN DE SERVICIOS (Correo y Archivos)
// =========================================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    },
    // Si el servidor de correo no responde, nos rendimos rápido
    // en lugar de dejar al usuario esperando varios minutos
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

// Todos los correos de la app salen por aquí.
// Si cambiamos de servicio de correo, solo hay que tocar esta función.
async function enviarCorreo({ to, subject, text, html }) {
    await transporter.sendMail({ from: process.env.GMAIL_USER, to, subject, text, html });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// =========================================================
// 4. RUTAS (Endpoints de navegación y procesos)
// =========================================================

// Genera una página de aviso con el mismo diseño que toda la app
// (caja blanca, título con degradado y botón para ir a iniciar sesión)
function paginaMensaje({ icono, titulo, texto, botonExtra }) {
    const extra = botonExtra
        ? `<a href="${botonExtra.href}" class="btn-secondary" style="text-decoration: none; display: block; margin-top: 12px; width: 100%;">${botonExtra.texto}</a>`
        : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo} - Oniria</title>
    <link rel="stylesheet" href="/LogIn.css">
    <link rel="stylesheet" href="/OlvideContrasena.css">
</head>
<body>
    <div class="login-container">
        <div class="login-box">
            <div class="recover-icon" aria-hidden="true">${icono}</div>
            <h1 class="app-name recover-title">${titulo}</h1>
            <p class="recover-instructions">${texto}</p>
            <a href="/" class="btn-primary" style="text-decoration: none; display: block;">Ir a Iniciar Sesión</a>
            ${extra}
        </div>
    </div>
</body>
</html>`;
}

const enlaceInvalido = paginaMensaje({
    icono: '⏳',
    titulo: 'Enlace inválido',
    texto: 'El enlace es inválido o ya caducó. Puedes pedir uno nuevo.',
    botonExtra: { href: '/olvide-contrasena', texto: 'Pedir otro enlace' }
});

// Vistas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'LogIn.html')));
app.get('/registro', (req, res) => res.sendFile(path.join(__dirname, 'Registro.html')));
app.get('/feed', (req, res) => res.sendFile(path.join(__dirname, 'Feedback.html')));
app.get('/olvide-contrasena', (req, res) => res.sendFile(path.join(__dirname, 'OlvideContrasena.html')));
app.get('/privacidad', (req, res) => res.sendFile(path.join(__dirname, 'Privacidad.html')));

// =========================================================
// RECUPERACIÓN DE CONTRASEÑA
// =========================================================

// 1) El usuario escribe su correo -> si existe, le mandamos un enlace
app.post('/olvide-contrasena', async (req, res) => {
    const { email } = req.body;
    const urlError = (msg) => '/olvide-contrasena?error=' + encodeURIComponent(msg);

    try {
        const resultado = await db.query('SELECT nombre FROM usuarios WHERE email = $1', [email]);

        // Si el correo NO está registrado, no mandamos nada, pero mostramos
        // el mismo mensaje para no revelar qué correos existen.
        if (resultado.rows.length === 0) return res.redirect('/olvide-contrasena?enviado=1');

        const usuario = resultado.rows[0];
        const token = crypto.randomBytes(32).toString('hex');

        // Guardamos el token con una caducidad de 1 hora
        await db.query(
            "UPDATE usuarios SET token_recuperacion = $1, token_recuperacion_expira = NOW() + INTERVAL '1 hour' WHERE email = $2",
            [token, email]
        );

        const enlace = `${BASE_URL}/restablecer/${token}`;
        try {
            await enviarCorreo({
                to: email,
                subject: 'Recupera tu contraseña de Oniria',
                text: `Hola ${usuario.nombre}, para crear una contraseña nueva entra aquí: ${enlace}\n\nEl enlace caduca en 1 hora. Si tú no lo pediste, ignora este correo.`,
                html: `<p>Hola <b>${usuario.nombre}</b>,</p>
                       <p>Recibimos una solicitud para cambiar tu contraseña.</p>
                       <p><a href="${enlace}">Crear una contraseña nueva</a></p>
                       <p>El enlace caduca en 1 hora. Si tú no lo pediste, ignora este correo.</p>`
            });
        } catch (errorCorreo) {
            console.error('Error enviando correo de recuperación:', errorCorreo.message);
            return res.redirect(urlError('No se pudo enviar el correo, intenta más tarde.'));
        }

        res.redirect('/olvide-contrasena?enviado=1');
    } catch (err) {
        console.error(err);
        res.redirect(urlError('Ocurrió un error, intenta de nuevo.'));
    }
});

// Página de éxito (va antes de /restablecer/:token para que no la confunda con un token)
app.get('/restablecer/exito', (req, res) => res.sendFile(path.join(__dirname, 'ContrasenaRestablecida.html')));

// 2) El usuario abre el enlace del correo -> revisamos que el token sea válido
app.get('/restablecer/:token', async (req, res) => {
    try {
        const resultado = await db.query(
            'SELECT email FROM usuarios WHERE token_recuperacion = $1 AND token_recuperacion_expira > NOW()',
            [req.params.token]
        );
        if (resultado.rows.length === 0) return res.send(enlaceInvalido);
        res.sendFile(path.join(__dirname, 'NuevaContrasena.html'));
    } catch (err) {
        console.error(err);
        res.send(enlaceInvalido);
    }
});

// 3) El usuario envía su contraseña nueva -> la guardamos cifrada
app.post('/restablecer/:token', async (req, res) => {
    const token = req.params.token;
    const { password, confirmar } = req.body;

    if (!password || password.length < 6) {
        return res.redirect(`/restablecer/${token}?error=` + encodeURIComponent('La contraseña debe tener al menos 6 caracteres.') + '&field=password');
    }
    if (password !== confirmar) {
        return res.redirect(`/restablecer/${token}?error=` + encodeURIComponent('Las contraseñas no coinciden.') + '&field=confirmar');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const resultado = await db.query(
            'UPDATE usuarios SET contrasena = $1, token_recuperacion = NULL, token_recuperacion_expira = NULL WHERE token_recuperacion = $2 AND token_recuperacion_expira > NOW()',
            [hashedPassword, token]
        );
        if (resultado.rowCount === 0) return res.send(enlaceInvalido);
        res.redirect('/restablecer/exito');
    } catch (err) {
        console.error(err);
        res.send(enlaceInvalido);
    }
});

// Procesar Registro
app.post('/registro', async (req, res) => {
    const { nombre, apodo, email, password } = req.body;

    // Misma regla que en recuperar contraseña (por si alguien se salta el HTML)
    if (!password || password.length < 6) {
        return res.redirect('/registro?error=' + encodeURIComponent('La contraseña debe tener al menos 6 caracteres.') + '&field=password');
    }

    // Cifrar y generar token
    const hashedPassword = await bcrypt.hash(password, 10);
    const tema = 'Claro'; // Asignamos el tema por defecto
    const token = crypto.randomBytes(20).toString('hex');

    try {
        // Si el correo es nuevo, se crea la cuenta.
        // Si ya existe pero NUNCA se verificó, se actualizan sus datos y se
        // genera un enlace nuevo (así nadie se queda atorado si no le llegó el correo).
        // Si ya existe y está verificado, no se toca y "RETURNING" no devuelve nada.
        // El enlace de verificación caduca en 24 horas.
        const resultado = await db.query(
            `INSERT INTO usuarios (nombre, apodo, email, contrasena, tema, token_verificacion, token_verificacion_expira)
             VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours')
             ON CONFLICT (email) DO UPDATE SET
                 nombre = EXCLUDED.nombre,
                 apodo = EXCLUDED.apodo,
                 contrasena = EXCLUDED.contrasena,
                 token_verificacion = EXCLUDED.token_verificacion,
                 token_verificacion_expira = EXCLUDED.token_verificacion_expira
             WHERE usuarios.verificado IS NOT TRUE
             RETURNING email`,
            [nombre, apodo, email, hashedPassword, tema, token]
        );

        if (resultado.rows.length === 0) {
            return res.send(paginaMensaje({
                icono: '⚠️',
                titulo: 'No se pudo registrar',
                texto: 'Ese correo ya está registrado. Inicia sesión o recupera tu contraseña.',
                botonExtra: { href: '/olvide-contrasena', texto: 'Olvidé mi contraseña' }
            }));
        }
    } catch (err) {
        console.error('Error registrando usuario:', err.message);
        return res.send(paginaMensaje({
            icono: '⚠️',
            titulo: 'No se pudo registrar',
            texto: 'Hubo un error al crear tu cuenta. Intenta de nuevo en un momento.',
            botonExtra: { href: '/registro', texto: 'Intentar de nuevo' }
        }));
    }

    try {
        await enviarCorreo({
            to: email,
            subject: 'Verifica tu cuenta de Oniria',
            text: `Hola ${nombre}, verifica tu cuenta haciendo clic aquí: ${BASE_URL}/verificar/${token}\n\nEl enlace caduca en 24 horas.`
        });
    } catch (errorCorreo) {
        console.error('Error enviando correo de verificación:', errorCorreo.message);
        // La cuenta quedó guardada sin verificar; si vuelve a registrarse
        // con el mismo correo se le genera un enlace nuevo.
        return res.send(paginaMensaje({
            icono: '⚠️',
            titulo: 'No pudimos enviarte el correo',
            texto: 'Tu cuenta se guardó, pero el correo de verificación no se pudo enviar. Intenta registrarte de nuevo en unos minutos con el mismo correo.',
            botonExtra: { href: '/registro', texto: 'Intentar de nuevo' }
        }));
    }

    res.send(paginaMensaje({
        icono: '✉️',
        titulo: '¡Registro exitoso!',
        texto: `Te enviamos un correo a <b>${email.replace(/</g, '&lt;')}</b>. Abre el enlace para verificar tu cuenta y después inicia sesión.`
    }));
});

// Procesar Verificación por URL del correo
app.get('/verificar/:token', async (req, res) => {
    try {
        const resultado = await db.query(
            'UPDATE usuarios SET verificado = TRUE, token_verificacion = NULL, token_verificacion_expira = NULL WHERE token_verificacion = $1 AND (token_verificacion_expira IS NULL OR token_verificacion_expira > NOW())',
            [req.params.token]
        );
        if (resultado.rowCount === 0) {
            return res.send(paginaMensaje({
                icono: '⏳',
                titulo: 'Enlace inválido',
                texto: 'Este enlace de verificación no es válido, ya fue usado o caducó. Si ya verificaste tu cuenta, solo inicia sesión.'
            }));
        }
        res.sendFile(path.join(__dirname, 'Verificado.html'));
    } catch (err) {
        console.error(err);
        res.status(500).send(paginaMensaje({ icono: '⚠️', titulo: 'Error', texto: 'Ocurrió un error, intenta de nuevo.' }));
    }
});

// Procesar Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const resultado = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (resultado.rows.length === 0) return res.redirect('/?error=' + encodeURIComponent('Usuario incorrecto.') + '&field=email');

        const usuario = resultado.rows[0];

        // Bloquear acceso si no está verificado
        if (!usuario.verificado) return res.redirect('/?error=' + encodeURIComponent('Debes verificar tu correo antes de entrar.') + '&field=email');

        // Comparar contraseñas
        const match = await bcrypt.compare(password, usuario.contrasena);
        if (match) {
            res.redirect('/feed');
        } else {
            res.redirect('/?error=' + encodeURIComponent('Contraseña incorrecta.') + '&field=password');
        }
    } catch (err) {
        console.error(err);
        res.redirect('/?error=' + encodeURIComponent('Ocurrió un error, intenta de nuevo.') + '&field=email');
    }
});

// Procesar subida de una nueva publicación
// OJO: la tabla "publicaciones" todavía hay que crearla en Supabase
app.post('/crear-publicacion', upload.single('imagen_post'), async (req, res) => {
    const contenido = req.body.contenido;
    let ruta_imagen = null;

    if (req.file) {
        ruta_imagen = '/uploads/' + req.file.filename;
    }

    try {
        await db.query(
            'INSERT INTO publicaciones (id_usuario, contenido, imagen_post_url) VALUES (1, $1, $2)',
            [contenido, ruta_imagen]
        );
        res.redirect('/feed');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error guardando en la base de datos');
    }
});

// =========================================================
// 5. INICIALIZAR EL SERVIDOR
// =========================================================
app.listen(PORT, () => {
    console.log(`Servidor corriendo en ${BASE_URL}`);
});
