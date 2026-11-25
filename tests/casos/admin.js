// Pruebas del panel de administración: permisos de administrador y subadministrador (moderador),
// reportes, sanciones, publicaciones y equipo. Corre las rutas reales (con su filtro de rol) sobre PGlite.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs'); const Module = require('module');
const pg = new PGlite();
const cliente = { query: (s, p) => pg.query(s, p), release() {} };
class PoolPG { query(s, p, cb) { if (typeof p === 'function') { cb = p; p = undefined; } const pr = pg.query(s, p); if (cb) { pr.then((r) => cb(null, r), (e) => cb(e)); return; } return pr; } async connect() { return cliente; } on() {} end() {} }
const cargar = Module._load;
Module._load = function (req, ...r) { if (req === 'pg') return { Pool: PoolPG, Client: PoolPG }; return cargar.call(this, req, ...r); };
Object.assign(process.env, { SESSION_SECRET: 'x', PORT: '0', GEMINI_API_KEY: 'g', GMAIL_CLIENT_ID: 'x', GMAIL_CLIENT_SECRET: 'x', GMAIL_REFRESH_TOKEN: 'x', GMAIL_USER: 'oniria@prueba.test', BASE_URL: 'http://prueba.test' });
const correos = []; const fetchReal = global.fetch;
global.fetch = async (url, opts = {}) => {
    const u = String(url); const json = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
    if (u.includes('oauth2.googleapis.com')) return json({ access_token: 't', expires_in: 3600 });
    if (u.includes('gmail.googleapis.com')) { const crudo = Buffer.from(JSON.parse(opts.body).raw, 'base64url').toString(); // las partes del correo van en base64: se decodifican para poder leerlas
        correos.push(crudo + '\n' + [...crudo.matchAll(/base64\r\n\r\n([A-Za-z0-9+\/=]+)/g)].map((m) => Buffer.from(m[1], 'base64').toString()).join('\n')); return json({ id: 'x' }); }
    return fetchReal(url, opts);
};
const { app } = require('../../server.js');
let fallos = 0; const ok = (c, m) => { console.log((c ? '  OK     ' : '  FALLO  ') + m); if (!c) fallos++; };
const q = async (s, p) => (await pg.query(s, p)).rows;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const capas = (path, metodo) => (app.router || app._router).stack.find((l) => l.route?.path === path && l.route.methods[metodo]).route.stack;
// Ejecuta TODA la cadena de la ruta (filtro de rol incluido), como lo haría Express
const pedir = (metodo, path, { sesion, params = {}, query = {}, body = {} } = {}) => new Promise((resolver, rechazar) => {
    const pila = capas(path, metodo); let i = 0;
    const res = { codigo: 200, status(c) { this.codigo = c; return this; }, json(o) { resolver({ codigo: this.codigo, cuerpo: o }); return this; }, redirect(u) { resolver({ codigo: 302, destino: u }); }, sendFile(f) { resolver({ codigo: 200, archivo: f }); } };
    const req = { session: Object.assign(sesion ? { ...sesion } : {}, { regenerate(cb) { cb(); }, save(cb) { cb && cb(); } }), params, query, body, headers: {}, get() { return ''; } };
    const siguiente = (e) => { if (e) return rechazar(e); const capa = pila[i++]; if (!capa) return; Promise.resolve(capa.handle(req, res, siguiente)).catch(rechazar); };
    siguiente();
});
const ADMIN = { idUsuario: 1, rol: 'admin', apodo: 'Admin' }, MOD = { idUsuario: 2, rol: 'moderador', apodo: 'Mod' }, USR = { idUsuario: 3, rol: 'usuario', apodo: 'ana' };

(async () => {
    await pg.exec(fs.readFileSync(__dirname + '/esquema_base.sql', 'utf-8'));
    for (const f of fs.readdirSync('migraciones').filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) await pg.exec(fs.readFileSync('migraciones/' + f, 'utf-8'));
    await pg.exec(`INSERT INTO usuarios (nombre, apodo, email, contrasena, verificado, rol, politicas_aceptadas_en) VALUES
      ('Admin','Admin','admin@prueba.test','x',true,'admin',NOW()), ('Mod','Mod','mod@prueba.test','x',true,'moderador',NOW()),
      ('Ana','ana','ana@prueba.test','x',true,'usuario',NOW()), ('Beto','beto','beto@prueba.test','x',true,'usuario',NOW()),
      ('Caro','caro','caro@prueba.test','x',true,'usuario',NOW()), ('Dani 100%','dani','dani@prueba.test','x',false,'usuario',NOW()), ('Eli','eli','eli@prueba.test','x',true,'usuario',NOW());
      UPDATE usuarios SET eliminado_en = NOW() WHERE id_usuario = 7;
      INSERT INTO publicaciones (id_usuario, sueno_texto, titulo, estado, emocion, tipo_sueno, tema) VALUES
      (3,'Volaba sobre una ciudad','Vuelo','listo','feliz','normal','volar_caer'),(4,'Un bosque que susurraba','Bosque','listo','calma','normal','naturaleza'),(4,'Una escalera sin fin','Escalera','listo','miedo','pesadilla','peligro');
      INSERT INTO corazones (id_usuario, id_publicacion) VALUES (4,1); INSERT INTO comentarios (id_publicacion, id_usuario, contenido) VALUES (1,4,'bonito');
      INSERT INTO reportes (id_reportante, id_reportado, id_publicacion, motivo, detalle) VALUES (3,4,2,'acoso','insultos'),(5,4,3,'spam',NULL),(3,5,NULL,'odio','mensajes'),(4,3,1,'otro','x'),(3,4,NULL,'violencia','amenazas');
      INSERT INTO sesiones (sid, sess, expire) VALUES ('s4','{"idUsuario":4}', NOW() + INTERVAL '1 day'),('s5','{"idUsuario":5}', NOW() + INTERVAL '1 day'),('s3','{"idUsuario":3}', NOW() + INTERVAL '1 day');`);

    console.log('\n[Acceso a cada ruta]');
    const rutas = [['get', '/api/admin/estadisticas', 'moderador'], ['get', '/api/admin/reportes', 'moderador'], ['post', '/api/admin/reportes/:id/resolver', 'moderador'],
        ['get', '/api/admin/usuarios', 'moderador'], ['post', '/api/admin/usuarios/:id/sancion', 'moderador'], ['get', '/api/admin/publicaciones', 'moderador'],
        ['get', '/api/admin/usuarios/:id/estadisticas', 'moderador'], ['delete', '/api/admin/publicaciones/:id', 'admin'], ['get', '/api/admin/equipo', 'admin'],
        ['post', '/api/admin/equipo', 'admin'], ['delete', '/api/admin/equipo/:id', 'admin']];
    for (const [m, p, minimo] of rutas) {
        const sin = await pedir(m, p), usr = await pedir(m, p, { sesion: USR }), mod = await pedir(m, p, { sesion: MOD, params: { id: '9999' } });
        ok(sin.codigo === 401, `${m.toUpperCase()} ${p}: sin sesión → 401`);
        ok(usr.codigo === 403, `${m.toUpperCase()} ${p}: usuario normal → 403`);
        ok(minimo === 'admin' ? mod.codigo === 403 : mod.codigo !== 403, `${m.toUpperCase()} ${p}: subadministrador ${minimo === 'admin' ? 'bloqueado (403)' : 'permitido'}`);
    }
    let r = await pedir('get', '/admin', { sesion: ADMIN }); ok(r.archivo && /Admin\.html$/.test(r.archivo), 'página /admin: administrador entra');
    r = await pedir('get', '/admin', { sesion: MOD }); ok(r.archivo && /Admin\.html$/.test(r.archivo), 'página /admin: subadministrador entra');
    r = await pedir('get', '/admin', { sesion: USR }); ok(r.destino === '/feed', 'página /admin: usuario normal va a /feed');
    r = await pedir('get', '/feed', { sesion: MOD }); ok(r.destino === '/admin', 'el staff no entra al feed: lo manda a /admin');

    console.log('\n[Estadísticas generales]');
    for (const s of [ADMIN, MOD]) {
        r = await pedir('get', '/api/admin/estadisticas', { sesion: s, query: { dias: '30' } });
        ok(r.codigo === 200 && r.cuerpo.dias === 30 && r.cuerpo.numeros.publicados === 3 && r.cuerpo.numeros.reportes_pendientes === 5, `${s.rol}: totales (3 sueños, 5 reportes pendientes)`);
    }
    ok(r.cuerpo.cuentas.activas === 3 && r.cuerpo.cuentas.sin_verificar === 1 && r.cuerpo.cuentas.eliminadas === 1, 'conteo de cuentas: 3 activas, 1 sin verificar, 1 eliminada');
    ok(r.cuerpo.emocion.feliz === 1 && r.cuerpo.emocion.miedo === 1 && r.cuerpo.tipo_sueno.pesadilla === 1 && r.cuerpo.tema.naturaleza === 1, 'trae emociones, tipos y temas de los sueños');
    r = await pedir('get', '/api/admin/estadisticas', { sesion: ADMIN, query: { dias: 'abc' } }); ok(r.codigo === 200 && r.cuerpo.dias === null, 'periodo inválido → todo el tiempo');
    r = await pedir('get', '/api/admin/usuarios/:id/estadisticas', { sesion: MOD, params: { id: '4' } }); ok(r.codigo === 200 && r.cuerpo.persona.apodo === 'beto' && r.cuerpo.persona.reportes === 3, 'estadísticas de una persona (3 reportes)');
    r = await pedir('get', '/api/admin/usuarios/:id/estadisticas', { sesion: MOD, params: { id: '1' } }); ok(r.codigo === 404, 'estadísticas de una cuenta de administración → 404');
    r = await pedir('get', '/api/admin/usuarios/:id/estadisticas', { sesion: MOD, params: { id: 'x' } }); ok(r.codigo === 404, 'id inválido → 404');

    console.log('\n[Reportes]');
    r = await pedir('get', '/api/admin/reportes', { sesion: MOD }); ok(r.codigo === 200 && r.cuerpo.length === 5 && r.cuerpo[0].motivo_texto && r.cuerpo.every((x) => x.estado === 'pendiente'), 'lista 5 pendientes con el motivo en texto');
    ok(r.cuerpo.find((x) => x.reportado === 'beto').reportes_totales === 3, 'cuenta los reportes totales de la persona');
    const res = (id, body, s) => pedir('post', '/api/admin/reportes/:id/resolver', { sesion: s, params: { id: String(id) }, body });
    ok((await res(1, { accion: 'otra' }, MOD)).codigo === 400, 'acción inválida → 400');
    ok((await res(1, { accion: 'banear' }, MOD)).codigo === 403, 'subadministrador NO puede banear desde un reporte');
    ok((await res(999, { accion: 'descartar' }, MOD)).codigo === 404, 'reporte inexistente → 404');
    r = await res(4, { accion: 'descartar', nota: 'sin falta' }, MOD);
    let f = (await q('SELECT estado, accion, nota_admin, id_revisor FROM reportes WHERE id_reporte = 4'))[0];
    ok(r.codigo === 200 && f.estado === 'descartado' && f.accion === 'ninguna' && f.id_revisor === 2, 'subadministrador descarta un reporte (queda su nombre como revisor)');
    ok((await res(4, { accion: 'descartar' }, MOD)).codigo === 404, 'un reporte ya revisado no se vuelve a resolver');
    r = await res(1, { accion: 'suspender', dias: 9999, nota: 'insultos' }, MOD);
    f = (await q('SELECT suspendido_hasta, motivo_sancion FROM usuarios WHERE id_usuario = 4'))[0];
    const dias = Math.round((new Date(f.suspendido_hasta) - Date.now()) / 864e5);
    ok(r.codigo === 200 && dias === 365 && /Acoso/.test(f.motivo_sancion), 'suspender desde un reporte: tope de 365 días y motivo con la nota');
    ok((await q("SELECT COUNT(*)::int n FROM reportes WHERE id_reportado = 4 AND estado = 'resuelto'"))[0].n === 3, 'se cierran los 3 reportes pendientes contra esa persona');
    ok((await q("SELECT COUNT(*)::int n FROM sesiones WHERE sess->>'idUsuario' = '4'"))[0].n === 0, 'se cierran las sesiones de la persona suspendida');
    await pausa(300);
    ok(correos.some((c) => /beto@prueba\.test/.test(c)), 'se avisa por correo a la persona suspendida');
    r = await res(3, { accion: 'banear', nota: 'reincidente' }, ADMIN);
    ok(r.codigo === 200 && (await q('SELECT baneado_en FROM usuarios WHERE id_usuario = 5'))[0].baneado_en, 'administrador banea desde un reporte');
    ok((await q("SELECT COUNT(*)::int n FROM sesiones WHERE sess->>'idUsuario' = '5'"))[0].n === 0, 'se cierran las sesiones de la persona baneada');
    r = await pedir('get', '/api/admin/reportes', { sesion: ADMIN }); ok(r.cuerpo.length === 0, 'ya no quedan pendientes');
    r = await pedir('get', '/api/admin/reportes', { sesion: ADMIN, query: { estado: 'revisados' } });
    ok(r.cuerpo.length === 5 && r.cuerpo.some((x) => x.revisor === 'Mod') && r.cuerpo.some((x) => x.accion === 'baneo'), 'lista de revisados (5, con revisor y acción)');

    console.log('\n[Buscar y sancionar cuentas]');
    r = await pedir('get', '/api/admin/usuarios', { sesion: MOD }); ok(r.cuerpo.length === 4 && !r.cuerpo.some((u) => u.apodo === 'Admin' || u.apodo === 'eli'), 'lista solo usuarios normales y sin cuentas eliminadas');
    ok(!!(r.cuerpo[0].baneado_en || r.cuerpo[0].suspendido_hasta) && !!(r.cuerpo[1].baneado_en || r.cuerpo[1].suspendido_hasta) && !(r.cuerpo[2].baneado_en || r.cuerpo[2].suspendido_hasta), 'las cuentas sancionadas salen primero en la lista');
    r = await pedir('get', '/api/admin/usuarios', { sesion: MOD, query: { buscar: 'ANA' } }); ok(r.cuerpo.length === 1 && r.cuerpo[0].apodo === 'ana', 'busca por apodo sin importar mayúsculas');
    r = await pedir('get', '/api/admin/usuarios', { sesion: MOD, query: { buscar: 'caro@prueba' } }); ok(r.cuerpo.length === 1, 'busca por correo');
    r = await pedir('get', '/api/admin/usuarios', { sesion: MOD, query: { buscar: '100%' } }); ok(r.cuerpo.length === 1 && r.cuerpo[0].apodo === 'dani', 'el % se busca literal (no es comodín)');
    r = await pedir('get', '/api/admin/usuarios', { sesion: MOD, query: { buscar: '%' } }); ok(r.cuerpo.length === 1, 'un % solo no devuelve a todos');
    r = await pedir('get', '/api/admin/usuarios', { sesion: MOD, query: { filtro: 'suspendidas' } }); ok(r.cuerpo.length === 1 && r.cuerpo[0].apodo === 'beto', 'filtro: suspendidas');
    r = await pedir('get', '/api/admin/usuarios', { sesion: MOD, query: { filtro: 'baneadas' } }); ok(r.cuerpo.length === 1 && r.cuerpo[0].apodo === 'caro', 'filtro: baneadas');
    const san = (id, body, s) => pedir('post', '/api/admin/usuarios/:id/sancion', { sesion: s, params: { id: String(id) }, body });
    ok((await san(3, { accion: 'x' }, MOD)).codigo === 400, 'acción inválida → 400');
    ok((await san(3, { accion: 'suspender', dias: 3 }, MOD)).codigo === 400, 'suspender sin motivo → 400');
    ok((await san(3, { accion: 'suspender', dias: 3, motivo: 'ab' }, ADMIN)).codigo === 400, 'motivo de menos de 3 letras → 400');
    ok((await san(3, { accion: 'banear', motivo: 'grave' }, MOD)).codigo === 403, 'subadministrador NO puede banear');
    ok((await san(5, { accion: 'quitar' }, MOD)).codigo === 403, 'subadministrador NO puede quitar un baneo');
    ok((await san(2, { accion: 'suspender', dias: 2, motivo: 'prueba' }, ADMIN)).codigo === 400, 'no se puede sancionar a un subadministrador');
    ok((await san(1, { accion: 'banear', motivo: 'prueba' }, ADMIN)).codigo === 400, 'no se puede sancionar a un administrador');
    ok((await san(7, { accion: 'suspender', dias: 2, motivo: 'prueba' }, ADMIN)).codigo === 400, 'no se puede sancionar una cuenta eliminada por su dueño');
    ok((await san(999, { accion: 'suspender', dias: 2, motivo: 'prueba' }, ADMIN)).codigo === 404, 'cuenta inexistente → 404');
    r = await san(3, { accion: 'suspender', dias: 7, motivo: 'spam repetido' }, MOD);
    ok(r.codigo === 200 && r.cuerpo.suspendido_hasta && (await q("SELECT COUNT(*)::int n FROM sesiones WHERE sess->>'idUsuario' = '3'"))[0].n === 0, 'subadministrador suspende 7 días y se cierran sus sesiones');
    r = await san(3, { accion: 'quitar' }, MOD); f = (await q('SELECT suspendido_hasta, motivo_sancion FROM usuarios WHERE id_usuario = 3'))[0];
    ok(r.codigo === 200 && !f.suspendido_hasta && !f.motivo_sancion, 'subadministrador quita una suspensión');
    await pg.exec("INSERT INTO amistades (id_solicitante, id_destinatario, estado) VALUES (3,4,'aceptada'),(6,3,'pendiente')");
    r = await san(3, { accion: 'banear', motivo: 'acoso grave' }, ADMIN);
    ok(r.codigo === 200 && r.cuerpo.baneado && (await q('SELECT COUNT(*)::int n FROM amistades'))[0].n === 0, 'administrador banea y se borran sus amistades');
    r = await san(3, { accion: 'quitar' }, ADMIN); ok(r.codigo === 200 && !(await q('SELECT baneado_en FROM usuarios WHERE id_usuario = 3'))[0].baneado_en, 'administrador quita el baneo');
    r = await san(4, { accion: 'suspender', dias: 0, motivo: 'mínimo' }, ADMIN); f = (await q('SELECT suspendido_hasta FROM usuarios WHERE id_usuario = 4'))[0];
    ok(r.codigo === 200 && Math.round((new Date(f.suspendido_hasta) - Date.now()) / 864e5) === 1, 'suspender con 0 días → mínimo 1 día');

    console.log('\n[Publicaciones]');
    r = await pedir('get', '/api/admin/publicaciones', { sesion: MOD }); ok(r.codigo === 200 && r.cuerpo.publicaciones.length === 3 && r.cuerpo.hayMas === false, 'lista las 3 publicaciones');
    ok(r.cuerpo.publicaciones[0].id_publicacion === 3 && r.cuerpo.publicaciones.find((p) => p.id_publicacion === 1).total_corazones === 1, 'más nuevas primero y con corazones');
    ok(r.cuerpo.publicaciones.find((p) => p.id_publicacion === 3).total_reportes === 1, 'cuenta los reportes de cada publicación');
    r = await pedir('get', '/api/admin/publicaciones', { sesion: MOD, query: { buscar: 'bosque' } }); ok(r.cuerpo.publicaciones.length === 1, 'busca por texto');
    r = await pedir('get', '/api/admin/publicaciones', { sesion: MOD, query: { buscar: 'beto' } }); ok(r.cuerpo.publicaciones.length === 2, 'busca por apodo del autor');
    r = await pedir('get', '/api/admin/publicaciones', { sesion: MOD, query: { filtro: 'reportadas' } }); ok(r.cuerpo.publicaciones.length === 3, 'filtro: reportadas');
    r = await pedir('get', '/api/admin/publicaciones', { sesion: MOD, query: { antes: '3' } }); ok(r.cuerpo.publicaciones.length === 2 && r.cuerpo.publicaciones[0].id_publicacion === 2, 'paginación "antes de"');
    await pg.exec("UPDATE usuarios SET baneado_en = NOW() WHERE id_usuario = 4");
    r = await pedir('get', '/api/admin/publicaciones', { sesion: MOD, query: { filtro: 'eliminadas' } }); ok(r.cuerpo.publicaciones.length === 2 && r.cuerpo.publicaciones[0].autor === 'beto', 'filtro: de cuentas dadas de baja (la administración ve el apodo real)');
    await pg.exec("UPDATE usuarios SET baneado_en = NULL WHERE id_usuario = 4");
    const borrar = (id, s, body) => pedir('delete', '/api/admin/publicaciones/:id', { sesion: s, params: { id: String(id) }, body });
    ok((await borrar(2, MOD, {})).codigo === 403, 'subadministrador NO puede borrar publicaciones');
    ok((await borrar('x', ADMIN, {})).codigo === 404 && (await borrar(999, ADMIN, {})).codigo === 404, 'borrar id inválido o inexistente → 404');
    correos.length = 0; r = await borrar(2, ADMIN, { motivo: 'no respeta las normas' }); await pausa(300);
    ok(r.codigo === 200 && (await q('SELECT COUNT(*)::int n FROM publicaciones WHERE id_publicacion = 2'))[0].n === 0, 'administrador borra una publicación');
    ok((await q('SELECT COUNT(*)::int n FROM medios_publicacion WHERE id_publicacion = 2'))[0].n === 0, 'se borran también sus medios');
    ok(correos.some((c) => /beto@prueba\.test/.test(c)), 'se avisa al autor con el motivo');

    console.log('\n[Equipo (subadministradores)]');
    r = await pedir('get', '/api/admin/equipo', { sesion: ADMIN }); ok(r.cuerpo.length === 2 && r.cuerpo.find((u) => u.id_usuario === 1).yo === true, 'lista el equipo y marca "yo"');
    const crear = (body) => pedir('post', '/api/admin/equipo', { sesion: ADMIN, body });
    ok((await crear({ nombre: 'A', apodo: 'nuevo', correo: 'n@prueba.test' })).codigo === 400, 'nombre muy corto → 400');
    ok((await crear({ nombre: 'Nuevo Mod', apodo: 'n', correo: 'n@prueba.test' })).codigo === 400, 'apodo muy corto → 400');
    ok((await crear({ nombre: 'Nuevo Mod', apodo: 'nuevomod', correo: 'no-es-correo' })).codigo === 400, 'correo inválido → 400');
    ok((await crear({ nombre: 'Nuevo Mod', apodo: 'nuevomod', correo: 'MOD@prueba.test' })).codigo === 409, 'correo ya registrado (sin importar mayúsculas) → 409');
    correos.length = 0; r = await crear({ nombre: 'Nuevo Mod', apodo: 'nuevomod', correo: 'Nuevo@Prueba.test' }); await pausa(200);
    f = (await q("SELECT id_usuario, rol, verificado, token_recuperacion, token_recuperacion_expira FROM usuarios WHERE email = 'nuevo@prueba.test'"))[0];
    ok(r.codigo === 201 && f.rol === 'moderador' && f.verificado && f.token_recuperacion && new Date(f.token_recuperacion_expira) > Date.now() + 47 * 36e5, 'crea un subadministrador con enlace de 48 h');
    ok(correos.length === 1 && /\/restablecer\/[0-9a-f]{64}/.test(correos[0]), 'le llega el correo con el enlace para elegir contraseña');
    r = await pedir('get', '/api/admin/equipo', { sesion: ADMIN }); ok(r.cuerpo.length === 3 && r.cuerpo.find((u) => u.apodo === 'nuevomod').activo === false, 'aparece como pendiente (aún sin contraseña elegida)');
    await pg.exec(`INSERT INTO sesiones (sid, sess, expire) VALUES ('sn','{"idUsuario":${f.id_usuario}}', NOW() + INTERVAL '1 day')`);
    const quitar = (id, s = ADMIN) => pedir('delete', '/api/admin/equipo/:id', { sesion: s, params: { id: String(id) } });
    ok((await quitar(f.id_usuario, MOD)).codigo === 403, 'un subadministrador NO puede quitar a otro');
    ok((await quitar(1)).codigo === 404, 'no se puede quitar a un administrador');
    ok((await quitar(3)).codigo === 404, 'no se puede borrar a un usuario normal desde Equipo');
    r = await quitar(f.id_usuario);
    ok(r.codigo === 200 && (await q('SELECT COUNT(*)::int n FROM usuarios WHERE id_usuario = $1', [f.id_usuario]))[0].n === 0, 'administrador quita a un subadministrador');
    ok((await q("SELECT COUNT(*)::int n FROM sesiones WHERE sid = 'sn'"))[0].n === 0, 'se cierra la sesión del subadministrador quitado');

    console.log('\n[Las cuentas sancionadas no pueden entrar]');
    const bcrypt = require('bcrypt'); const hash = await bcrypt.hash('Prueba123!', 4);
    await pg.query("UPDATE usuarios SET contrasena = $1 WHERE id_usuario IN (3, 4, 5)", [hash]);
    const entrar = (correo, password = 'Prueba123!') => pedir('post', '/login', { body: { email: correo, password } });
    await san(3, { accion: 'suspender', dias: 2, motivo: 'prueba de acceso' }, ADMIN); r = await entrar('ana@prueba.test');
    ok(r.destino && /suspendida/.test(decodeURIComponent(r.destino)), 'una cuenta suspendida no entra y se le dice hasta cuándo');
    await san(5, { accion: 'banear', motivo: 'prueba de acceso' }, ADMIN); r = await entrar('caro@prueba.test');
    ok(r.destino && /dada de baja/.test(decodeURIComponent(r.destino)), 'una cuenta baneada no entra');
    r = await entrar('caro@prueba.test', 'otra-contraseña'); ok(r.destino && !/baja/.test(decodeURIComponent(r.destino)), 'con contraseña incorrecta no se revela que está baneada');
    await san(3, { accion: 'quitar' }, MOD); r = await entrar('ana@prueba.test'); ok(!(r.destino && /suspendida/.test(decodeURIComponent(r.destino))), 'al quitar la suspensión puede volver a entrar');

    console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK'); process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
