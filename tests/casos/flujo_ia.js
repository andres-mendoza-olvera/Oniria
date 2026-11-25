const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const Module = require('module');
const pg = new PGlite();
const cliente = { query: (s, p) => pg.query(s, p), release() {} };
class PoolPG { async query(s, p) { return pg.query(s, p); } async connect() { return cliente; } on() {} }
const cargar = Module._load;
Module._load = function (req, ...r) { if (req === 'pg') return { Pool: PoolPG, Client: PoolPG }; return cargar.call(this, req, ...r); };

const fetchReal = global.fetch; const gemini = []; let respuestaOniria = null;
global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('generativelanguage')) {
        const cuerpo = JSON.parse(opts.body); const sis = cuerpo.systemInstruction.parts[0].text;
        const tipo = sis.includes('NO interpretes el sueño') ? 'meta' : sis.includes('Ya interpretaste') ? 'conversacion' : 'completo';
        gemini.push(tipo);
        const salida = {
            meta: { es_sueno: !/^hola/i.test(cuerpo.contents[0].parts[0].text), respuesta: '', titulo: 'Reunión y plato', prompt_imagen: 'a family gathering', emocion: 'miedo', tipo_sueno: 'normal', tema: 'personas',
                elementos: ['Reunión', 'plato', 'sol', 'Hogar', 'cosa', 'platos'], acciones: ['reír', 'romper', 'volar', 'salir'],
                recuerdo: 'Soñó con una reunión familiar y un plato roto; sintió vergüenza.', conexion: globalThis.CONEXION || '' },
            completo: { es_sueno: true, respuesta: '', titulo: 'T', interpretacion: 'I', prompt_imagen: 'x', emocion: 'feliz', tipo_sueno: 'normal', tema: 'otro', elementos: ['plato'], acciones: ['romper'] },
            conversacion: { respuesta: 'ok', detalles_nuevos: '', interpretacion_actualizada: '' }
        }[tipo];
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(salida) }] } }] }) };
    }
    if (u.startsWith('http://oniria.test')) {
        if (respuestaOniria === 'caida') throw new TypeError('fetch failed');
        return { ok: true, status: 200, json: async () => respuestaOniria };
    }
    return fetchReal(url, opts);
};
process.env.SESSION_SECRET = 'x'; process.env.PORT = '0'; process.env.GEMINI_API_KEY = 'g';
process.env.ONIRIA_ACTIVO = '1'; process.env.ONIRIA_URL = 'http://oniria.test'; process.env.ONIRIA_API_KEY = 'k';
const { app, primerTurno, siguienteTurno, topLista, estadisticasDe } = require('../../server.js');

let fallos = 0;
const ok = (c, m) => { console.log((c ? '  OK     ' : '  FALLO  ') + m); if (!c) fallos++; };
const q = async (s, p) => (await pg.query(s, p)).rows;
const ruta = (path, metodo = 'get') => (app.router || app._router).stack.find((l) => l.route?.path === path && l.route.methods[metodo]).route.stack;
const llamar = async (capas, req) => { let salida; const res = { status(c) { this.codigo = c; return this; }, json(o) { salida = { codigo: this.codigo || 200, cuerpo: o }; return this; } };
    await capas[capas.length - 1].handle(req, res, () => {}); return salida; };

(async () => {
    // --- esquema base (como estaba ANTES de las migraciones 009 y 010) ---
    await pg.exec(`
      CREATE TABLE usuarios (id_usuario SERIAL PRIMARY KEY, nombre TEXT, apodo TEXT, rol TEXT DEFAULT 'usuario', eliminado_en TIMESTAMPTZ, baneado_en TIMESTAMPTZ);
      CREATE TABLE publicaciones (id_publicacion SERIAL PRIMARY KEY, id_usuario INT, sueno_texto TEXT, titulo TEXT, interpretacion_ia TEXT, estado TEXT DEFAULT 'listo',
        emocion TEXT, tipo_sueno TEXT, tema TEXT, creado_en TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE conversaciones (id_conversacion SERIAL PRIMARY KEY, id_usuario INT, titulo TEXT, relato TEXT, interpretacion TEXT, imagen_ia TEXT, prompt_ia TEXT,
        imagenes JSONB DEFAULT '[]', mensajes JSONB DEFAULT '[]', historial JSONB DEFAULT '[]', emocion TEXT, tipo_sueno TEXT, tema TEXT,
        id_publicacion INT, creado_en TIMESTAMPTZ DEFAULT NOW(), actualizado_en TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE corazones (id_publicacion INT); CREATE TABLE comentarios (id_publicacion INT, id_usuario INT, creado_en TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE amistades (estado TEXT, id_solicitante INT, id_destinatario INT);
      INSERT INTO usuarios (nombre, apodo) VALUES ('Ana','ana'),('Beto','beto'),('Cata','cata'),('Dani','dani'),('Eli','eli');`);
    console.log('1) Migraciones 009 y 010 sobre un esquema previo');
    for (const f of ['migraciones/009_reacciones_y_recordatorio.sql', 'migraciones/010_memoria_de_suenos.sql', 'migraciones/011_motor_oniria.sql', 'migraciones/012_elementos_acciones.sql']) {
        try { await pg.exec(fs.readFileSync(f, 'utf-8')); ok(true, `${f} aplicada`); } catch (e) { ok(false, `${f}: ${e.message}`); }
    }
    try { await pg.exec(fs.readFileSync('migraciones/012_elementos_acciones.sql', 'utf-8')); ok(true, '012 se puede correr dos veces (IF NOT EXISTS)'); } catch (e) { ok(false, 'repetir 010: ' + e.message); }

    console.log('2) Primer turno: Gemini da elementos/acciones y se limpian contra el relato');
    const SUENO = 'Estaba en una reunión familiar y mi tía decía en voz alta algo que yo le había contado. Todos se reían y yo rompía un plato al salir.';
    respuestaOniria = { ok: true, alerta: 'ninguna', analisis: 'Gracias por compartirlo.', lectura_inicial: 'Podría reflejar tensión entre confianza y risa.', preguntas: ['¿Cómo te sentiste?'], publicable: true };
    let r = await primerTurno(1, SUENO, []);
    let fila = (await q('SELECT * FROM conversaciones'))[0];
    ok(JSON.stringify(fila.elementos) === JSON.stringify(['reunion', 'plato']), 'elementos limpios: ' + JSON.stringify(fila.elementos) + ' (sol y hogar eran inventados; cosa es vacía; platos = plato)');
    ok(JSON.stringify(fila.acciones) === JSON.stringify(['reir', 'romper', 'salir']), 'acciones limpias: ' + JSON.stringify(fila.acciones) + ' (volar era inventado)');

    console.log('2b) Memoria de sueños (de ustedes) sigue funcionando con el modelo beta');
    let mems = await q('SELECT * FROM memorias');
    ok(mems.length === 1 && mems[0].resumen.startsWith('Soñó con una reunión'), 'el recuerdo se guardó también en modo beta: ' + JSON.stringify(mems[0]?.resumen));
    ok(!fila.conexion_memoria, 'primer sueño: sin memoria previa no hay conexión');
    globalThis.CONEXION = 'La semana pasada también soñaste con una reunión; quizá algo sigue moviéndose.';
    const r2 = await primerTurno(1, SUENO + ' Otra vez.', []);
    const fila2 = (await q('SELECT * FROM conversaciones ORDER BY id_conversacion DESC LIMIT 1'))[0];
    ok(r2.mensaje.conexion && fila2.conexion_memoria === globalThis.CONEXION && fila2.motor === 'oniria', 'segundo sueño: conexión privada con el sueño anterior (' + (fila2.conexion_memoria || '').slice(0, 30) + '…)');
    ok(!r2.mensaje.texto.includes('semana pasada'), 'la conexión NO se mezcla con el texto publicable');
    await q('DELETE FROM conversaciones WHERE id_conversacion = $1', [fila2.id_conversacion]); await q('DELETE FROM memorias WHERE id_conversacion = $1', [fila2.id_conversacion]);
    globalThis.CONEXION = '';

    console.log('3) Oniria interpreta y afina elementos/acciones');
    respuestaOniria = { ok: true, alerta: 'ninguna', interpretacion: 'Una posibilidad es que…', etiquetas: {
        emotions: [{ tag: 'ansiedad', intensity: 'media', confidence: 'media', evidence: 'x' }], themes: ['familia'], elements: ['tia', 'plato', 'dragon'],
        actions: ['decir', 'reir', 'romper'], environment: [], characters: ['familiar'], characteristics: ['vivido'], central_image: null } };
    fila = (await q('SELECT * FROM conversaciones'))[0];
    r = await siguienteTurno({ ...fila, imagenes: fila.imagenes, mensajes: fila.mensajes, historial: fila.historial }, 'omitir', []);
    fila = (await q('SELECT * FROM conversaciones'))[0];
    ok(JSON.stringify(fila.elementos) === JSON.stringify(['tia', 'plato']), 'elementos de Oniria reemplazan a los de Gemini: ' + JSON.stringify(fila.elementos) + ' (dragon inventado)');
    ok(JSON.stringify(fila.acciones) === JSON.stringify(['decir', 'reir', 'romper']), 'acciones de Oniria: ' + JSON.stringify(fila.acciones));
    // Si Oniria no da elementos, se conservan los de Gemini
    await q("UPDATE conversaciones SET fase_oniria = 'preguntas', elementos = ARRAY['reunion','plato']");
    respuestaOniria.etiquetas.elements = []; respuestaOniria.etiquetas.actions = [];
    fila = (await q('SELECT * FROM conversaciones'))[0];
    await siguienteTurno(fila, 'omitir', []);
    fila = (await q('SELECT * FROM conversaciones'))[0];
    ok(JSON.stringify(fila.elementos) === JSON.stringify(['reunion', 'plato']), 'sin elementos de Oniria se conservan los de Gemini');

    console.log('4) Publicar copia elementos y acciones');
    await pg.exec(`CREATE TABLE medios_publicacion (id_publicacion INT, tipo TEXT, url TEXT, orden INT, prompt_ia TEXT);`);
    const pub = await llamar(ruta('/api/conversaciones/:id/publicar', 'post'), { params: { id: String(fila.id_conversacion) }, session: { idUsuario: 1, apodo: 'ana' }, body: {} });
    const p = (await q('SELECT * FROM publicaciones'))[0];
    ok(pub.codigo === 201 && p && JSON.stringify(p.elementos) === JSON.stringify(['reunion', 'plato']) && p.motor === 'oniria',
        `publicación creada (${pub.codigo}) con elementos ${JSON.stringify(p?.elementos)} y motor=${p?.motor}`);

    console.log('5) Estadísticas: top de listas, mínimo de personas y clima onírico');
    await pg.exec(`DELETE FROM publicaciones; DELETE FROM conversaciones;`);
    const sembrar = async (u, el, ac, em = 'miedo', dias = 1, estado = 'listo') =>
        q(`INSERT INTO publicaciones (id_usuario, estado, emocion, elementos, acciones, creado_en) VALUES ($1,$2,$3,$4,$5, NOW() - make_interval(days => $6))`, [u, estado, em, el, ac, dias]);
    await sembrar(1, ['agua', 'casa'], ['nadar']); await sembrar(2, ['agua', 'puente'], ['nadar', 'caer']); await sembrar(3, ['agua', 'casa'], ['caer', 'nadar']);
    await sembrar(4, ['casa'], ['volar'], 'feliz'); await sembrar(1, ['agua', 'secreto_de_ana'], ['nadar'], 'calma');
    await sembrar(5, ['agua'], ['nadar'], 'miedo', 30);                 // fuera de los 7 días
    await q("INSERT INTO conversaciones (id_usuario, elementos, acciones, emocion) VALUES (1, ARRAY['agua','borrador_privado'], ARRAY['nadar'], 'miedo')");
    let top = await topLista('elementos', null);
    ok(top[0].clave === 'agua' && top[0].total === 6 && top[0].personas === 4, 'global: agua x6 en 4 personas (5 publicados, 1 borrador): ' + JSON.stringify(top[0]));
    top = await topLista('elementos', null, { idUsuario: 1 });
    ok(top[0].clave === 'agua' && top[0].total === 3, 'personal (usuario 1): agua x3 (2 publicados + 1 borrador propio)');
    top = await topLista('elementos', 7, { minPersonas: 3, soloPublicados: true });
    const claves = top.map((t) => t.clave);
    ok(JSON.stringify(claves) === JSON.stringify(['agua', 'casa']), 'público (>=3 personas, 7 días, sin borradores): ' + JSON.stringify(top.map((t) => `${t.clave}:${t.total}/${t.personas}p`)));
    ok(!claves.includes('secreto_de_ana') && !claves.includes('borrador_privado') && !claves.includes('puente'), 'lo raro, lo privado y los borradores no salen en lo público');
    try { await topLista('relato; DROP TABLE usuarios', null); ok(false, 'columna no permitida debía fallar'); } catch { ok(true, 'columna no permitida se rechaza (sin inyección SQL)'); }

    const adelantar = (min) => { const real = Date.now; Date.now = () => real() + min * 60 * 1000; return () => { Date.now = real; }; };
    let clima = await llamar(ruta('/api/clima-onirico'), { session: { idUsuario: 1 } });
    const c = clima.cuerpo;
    ok(c.suficiente === true && c.total === 6, 'clima (de ustedes; cuenta también borradores): suficiente, total=' + c.total + ', emoción ' + JSON.stringify(c.emocion) + ', tema ' + JSON.stringify(c.tema));
    ok(JSON.stringify(c.simbolos) === JSON.stringify(['agua', 'casa']) && JSON.stringify(c.acciones) === JSON.stringify(['nadar']),
        'clima ahora incluye símbolos ' + JSON.stringify(c.simbolos) + ' y acciones ' + JSON.stringify(c.acciones) + ' (caer solo 2 personas: no sale)');
    await q('DELETE FROM publicaciones WHERE id_usuario IN (3,4,5)'); await q('DELETE FROM conversaciones');
    let volver = adelantar(11);
    clima = await llamar(ruta('/api/clima-onirico'), { session: { idUsuario: 1 } });
    volver();
    ok(clima.cuerpo.suficiente === false && !clima.cuerpo.simbolos, 'con pocos sueños el clima calla y no filtra símbolos: ' + JSON.stringify(clima.cuerpo));

    const est = await estadisticasDe(1, null);
    ok(Array.isArray(est.simbolos) && est.simbolos[0].clave === 'agua' && Array.isArray(est.acciones), 'estadisticasDe (mis estadísticas) incluye simbolos y acciones');

    console.log('6) Charla posterior con Gemini, crisis, "no es un sueño" y caída del modelo');
    await q('DELETE FROM memorias'); await q('DELETE FROM conversaciones');
    respuestaOniria = { ok: true, alerta: 'ninguna', analisis: 'Gracias.', lectura_inicial: 'Podría reflejar algo.', preguntas: ['¿Cómo te sentiste?'] };
    await primerTurno(1, SUENO, []);
    respuestaOniria = { ok: true, alerta: 'ninguna', interpretacion: 'Una posibilidad…', etiquetas: { emotions: [], themes: [], elements: [], actions: [], environment: [], characters: [], characteristics: [], central_image: null } };
    let f = (await q('SELECT * FROM conversaciones'))[0];
    await siguienteTurno(f, 'Me sentí mal.', []);
    f = (await q('SELECT * FROM conversaciones'))[0];
    gemini.length = 0;
    const charla = await siguienteTurno(f, '¿Y qué significa el agua en los sueños?', []);
    ok(charla.mensaje.texto === 'ok' && gemini.join() === 'conversacion', 'tercer mensaje: sigue con Gemini');
    gemini.length = 0; const antes = (await q('SELECT COUNT(*)::int n FROM conversaciones'))[0].n;
    let cr = await primerTurno(1, 'Soñé con mi casa pero en realidad ya no quiero seguir viviendo.', []);
    ok(cr.mensaje.crisis === true && cr.mensaje.texto.includes('800 911 2000') && gemini.length === 0 && (await q('SELECT COUNT(*)::int n FROM conversaciones'))[0].n === antes, 'crisis en el primer mensaje: sin IA y sin guardar');
    cr = await siguienteTurno(f, 'a veces pienso en hacerme daño', []);
    ok(cr.mensaje.crisis === true && gemini.length === 0, 'crisis en un mensaje posterior: sin IA');
    const nada = await primerTurno(1, 'hola, ¿qué tal?', []);
    ok(nada.conversacion === null, '"hola" no crea conversación');
    respuestaOniria = 'caida'; const cantes = (await q('SELECT COUNT(*)::int n FROM conversaciones'))[0].n;
    gemini.length = 0;
    const caido = await primerTurno(1, SUENO, []);
    const fc = (await q('SELECT * FROM conversaciones ORDER BY id_conversacion DESC LIMIT 1'))[0];
    ok(fc.motor === 'gemini' && fc.fase_oniria === null && (await q('SELECT COUNT(*)::int n FROM conversaciones'))[0].n === cantes + 1 && gemini.join() === 'meta,completo',
        'con el modelo caído la conversación sale con Gemini (' + gemini + ')');
    gemini.length = 0; await primerTurno(1, SUENO + ' Otra.', []);
    ok(gemini.join() === 'completo', 'en la pausa de 60 s ni lo intenta');
    console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo bien');
    process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
