const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs'); const Module = require('module');
const pg = new PGlite();
const cliente = { query: (s, p) => pg.query(s, p), release() {} };
class PoolPG { async query(s, p) { return pg.query(s, p); } async connect() { return cliente; } on() {} }
const cargar = Module._load;
Module._load = function (req, ...r) { if (req === 'pg') return { Pool: PoolPG, Client: PoolPG }; return cargar.call(this, req, ...r); };
const fetchReal = global.fetch; let respuestaOniria = null; let geminiCaido = false; const pedidos = [];
global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('generativelanguage')) {
        if (geminiCaido) return { ok: false, status: 503, json: async () => ({ error: { message: 'This model is currently experiencing high demand.' } }) };
        const cuerpo = JSON.parse(opts.body); const sis = cuerpo.systemInstruction.parts[0].text;
        const tipo = sis.includes('NO interpretes el sueño') ? 'meta' : sis.includes('Ya interpretaste') ? 'conversacion' : 'completo';
        pedidos.push({ tipo, ultimo: cuerpo.contents[cuerpo.contents.length - 1].parts[0].text });
        const salida = { meta: { es_sueno: true, respuesta: '', titulo: 'Sueño de prueba', prompt_imagen: 'x', emocion: 'miedo', tipo_sueno: 'normal', tema: 'personas', elementos: ['casa'], acciones: ['correr'], recuerdo: 'r', conexion: '' },
            conversacion: { respuesta: 'Interpretación de Gemini: una posibilidad es que...', detalles_nuevos: globalThis.DETALLE || '', interpretacion_actualizada: globalThis.INTERP_NUEVA || 'Interp. Gemini' },
            completo: { es_sueno: true, respuesta: '', titulo: 'T', interpretacion: 'I', prompt_imagen: 'x', emocion: 'miedo', tipo_sueno: 'normal', tema: 'otro', elementos: [], acciones: [] } }[tipo];
        salida.senal_cuidado = !!globalThis.SENAL;
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(salida) }] } }] }) };
    }
    if (u.startsWith('http://oniria.test')) return { ok: true, status: 200, json: async () => respuestaOniria };
    return fetchReal(url, opts);
};
process.env.SESSION_SECRET = 'x'; process.env.PORT = '0'; process.env.GEMINI_API_KEY = 'g';
process.env.ONIRIA_ACTIVO = '1'; process.env.ONIRIA_URL = 'http://oniria.test'; process.env.ONIRIA_API_KEY = 'k';
const { app, primerTurno, siguienteTurno } = require('../../server.js');
let fallos = 0; const ok = (c, m) => { console.log((c ? '  OK     ' : '  FALLO  ') + m); if (!c) fallos++; };
const q = async (s, p) => (await pg.query(s, p)).rows;
const ruta = (path, metodo = 'get') => (app.router || app._router).stack.find((l) => l.route?.path === path && l.route.methods[metodo]).route.stack;
const llamar = async (capas, req) => { let salida; const res = { status(c) { this.codigo = c; return this; }, json(o) { salida = { codigo: this.codigo || 200, cuerpo: o }; return this; } };
    await capas[capas.length - 1].handle(req, res, () => {}); return salida; };
(async () => {
    await pg.exec(`
      CREATE TABLE usuarios (id_usuario SERIAL PRIMARY KEY, nombre TEXT, apodo TEXT, rol TEXT DEFAULT 'usuario', eliminado_en TIMESTAMPTZ, baneado_en TIMESTAMPTZ);
      CREATE TABLE publicaciones (id_publicacion SERIAL PRIMARY KEY, id_usuario INT, sueno_texto TEXT, titulo TEXT, interpretacion_ia TEXT, estado TEXT DEFAULT 'listo', emocion TEXT, tipo_sueno TEXT, tema TEXT, creado_en TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE conversaciones (id_conversacion SERIAL PRIMARY KEY, id_usuario INT, titulo TEXT, relato TEXT, interpretacion TEXT, imagen_ia TEXT, prompt_ia TEXT,
        imagenes JSONB DEFAULT '[]', mensajes JSONB DEFAULT '[]', historial JSONB DEFAULT '[]', emocion TEXT, tipo_sueno TEXT, tema TEXT, id_publicacion INT, creado_en TIMESTAMPTZ DEFAULT NOW(), actualizado_en TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE medios_publicacion (id_publicacion INT, tipo TEXT, url TEXT, orden INT, prompt_ia TEXT); CREATE TABLE corazones (id_publicacion INT); CREATE TABLE comentarios (id_publicacion INT, id_usuario INT, creado_en TIMESTAMPTZ DEFAULT NOW()); CREATE TABLE amistades (estado TEXT, id_solicitante INT, id_destinatario INT);
      INSERT INTO usuarios (nombre, apodo) VALUES ('Ana','ana');`);
    for (const f of ['009_reacciones_y_recordatorio', '010_memoria_de_suenos', '011_motor_oniria', '012_elementos_acciones']) await pg.exec(fs.readFileSync(`migraciones/${f}.sql`, 'utf-8'));
    const SUENO = 'Estaba en mi casa, todo nublado, y comenzaron a llover bombas del cielo. Corrí a esconderme.';
    const nuevo = async () => { await pg.exec('DELETE FROM conversaciones; DELETE FROM memorias;');
        respuestaOniria = { ok: true, alerta: 'ninguna', analisis: 'Gracias.', lectura_inicial: 'Podría reflejar tensión.', preguntas: ['¿Cómo te sentiste?'], publicable: true };
        await primerTurno(1, SUENO, []); return (await q('SELECT * FROM conversaciones'))[0]; };

    console.log('A) Gemini saturado: mensaje claro y aviso en la página');
    const est0 = await llamar(ruta('/api/estado-ia'), { session: { idUsuario: 1 } });
    ok(est0.cuerpo.gemini === 'ok', 'antes de fallar: estado ok');
    geminiCaido = true;
    const r = await llamar(ruta('/api/sueno/mensaje', 'post'), { session: { idUsuario: 1 }, body: { texto: SUENO }, files: [] });
    ok(r.codigo === 503 && r.cuerpo.origen === 'gemini' && /Gemini/.test(r.cuerpo.error) && /no es un problema de tu sueño ni de Oniria/i.test(r.cuerpo.error), `la ruta responde ${r.codigo} con mensaje que nombra a Gemini: "${(r.cuerpo.error || '').slice(0, 70)}…"`);
    ok(!/Oniria no pudo responder/.test(r.cuerpo.error), 'ya no dice el genérico "Oniria no pudo responder"');
    const est1 = await llamar(ruta('/api/estado-ia'), { session: { idUsuario: 1 } });
    ok(est1.cuerpo.gemini === 'saturado', 'estado-ia: saturado');
    geminiCaido = false; await new Promise((r2) => setTimeout(r2, 5)); // un éxito posterior lo limpia
    await nuevo();
    const est2 = await llamar(ruta('/api/estado-ia'), { session: { idUsuario: 1 } });
    ok(est2.cuerpo.gemini === 'ok', 'tras una respuesta correcta de Gemini: estado ok otra vez');

    console.log('B) "Omitir" y el modelo se niega a interpretar -> Gemini interpreta');
    let fila = await nuevo(); pedidos.length = 0;
    respuestaOniria = { ok: true, alerta: 'ninguna', interpretacion: 'Gracias. Sin más contexto prefiero no darle un significado cerrado, sin más contexto no puedo asegurarlo.', etiquetas: { emotions: [], themes: [], elements: [], actions: [] } };
    let res = await siguienteTurno(fila, 'omitir', []);
    ok(res.mensaje.motor !== 'oniria' && /Interpretación de Gemini/.test(res.mensaje.texto), 'respuesta evasiva descartada; contesta Gemini: "' + res.mensaje.texto.slice(0, 40) + '…"');
    ok(pedidos.length === 1 && pedidos[0].tipo === 'conversacion' && /Prefiero no responder las preguntas/.test(pedidos[0].ultimo), 'Gemini recibió la instrucción de interpretar (no el literal "omitir")');
    fila = (await q('SELECT * FROM conversaciones'))[0];
    const usuarioMsg = [...fila.mensajes].reverse().find((m) => m.rol === 'usuario');
    console.log('   debug:', JSON.stringify(usuarioMsg), fila.fase_oniria); ok(usuarioMsg.texto === 'omitir' && fila.fase_oniria === 'interpretada', 'en el chat sigue viéndose "omitir" y la fase queda interpretada');

    console.log('C) "Omitir" y el modelo sí interpreta -> se queda con Oniria');
    fila = await nuevo(); pedidos.length = 0;
    respuestaOniria = { ok: true, alerta: 'ninguna', interpretacion: 'Una posibilidad es que el sueño refleje una sensación de amenaza cercana al hogar.', etiquetas: { emotions: [{ tag: 'miedo', intensity: 'alta', confidence: 'media', evidence: 'x' }], themes: ['persecucion'], elements: ['casa', 'bomba'], actions: ['correr'], environment: [], characters: [], characteristics: [] } };
    res = await siguienteTurno(fila, 'omitir', []);
    ok(res.mensaje.motor === 'oniria' && pedidos.length === 0, 'interpretación útil de Oniria se conserva, sin llamar a Gemini');

    console.log('D) Si la persona respondió, no se descarta aunque suene cauta');
    fila = await nuevo();
    respuestaOniria = { ok: true, alerta: 'ninguna', interpretacion: 'Sin más contexto no puedo asegurarlo, pero con lo que cuentas quizá sea miedo.', etiquetas: { emotions: [], themes: [], elements: [], actions: [] } };
    res = await siguienteTurno(fila, 'Me sentí con mucho miedo, perdí a familiares.', []);
    ok(res.mensaje.motor === 'oniria', 'con respuestas reales se acepta lo que diga el modelo');

    console.log('E) Oniria caída + "omitir" -> Gemini interpreta igual');
    fila = await nuevo(); pedidos.length = 0; respuestaOniria = { ok: false };
    res = await siguienteTurno(fila, 'omitir', []);
    ok(res.mensaje.motor !== 'oniria' && /Prefiero no responder/.test(pedidos[0]?.ultimo || ''), 'sin respuesta válida de Oniria, Gemini interpreta con la instrucción');

    console.log('F) Segundo nivel de seguridad: cuidado (ideación pasiva), tu caso real');
    const DORMIDO = 'Soñé que estaba en una estación de tren completamente vacía. No sabía cuánto tiempo llevaba ahí ni hacia dónde debía ir. Recuerdo que pensé que sería agradable simplemente dejar de estar allí. No porque tuviera miedo ni porque algo me persiguiera, sino porque estaba cansado de tener que continuar. Solo quería que el tiempo dejara de avanzar y que nadie notara mi ausencia.';
    await pg.exec('DELETE FROM conversaciones; DELETE FROM memorias;'); pedidos.length = 0; let llamadasOniria = 0;
    const fetchPrevio = global.fetch; global.fetch = async (u, o) => { if (String(u).startsWith('http://oniria.test')) llamadasOniria++; return fetchPrevio(u, o); };
    respuestaOniria = { ok: true, alerta: 'ninguna', analisis: 'x', lectura_inicial: 'y', preguntas: [], publicable: true };
    const rc = await primerTurno(1, DORMIDO, []);
    ok(rc.mensaje.crisis === true && rc.conversacion === null && /Línea de la Vida/.test(rc.mensaje.texto) && /cansancio/.test(rc.mensaje.texto), 'el sueño pasivo activa el mensaje de cuidado con teléfonos');
    ok(pedidos.length === 0 && llamadasOniria === 0, 'ninguna IA (ni Gemini ni Oniria) fue llamada');
    ok((await q('SELECT count(*)::int n FROM conversaciones'))[0].n === 0, 'no se guardó nada');
    const fila6 = await nuevo(); llamadasOniria = 0; pedidos.length = 0;
    const rs = await siguienteTurno(fila6, 'Es que ya estaba cansado de tener que continuar y quería que nadie notara mi ausencia.', []);
    ok(rs.mensaje.crisis === true && pedidos.length === 0 && llamadasOniria === 0, 'también en un mensaje posterior de la conversación');
    const rn = await primerTurno(1, 'Soñé que corría por un bosque, estaba cansado de seguir corriendo y llegué a una casa con luz.', []);
    ok(!rn.mensaje.crisis, 'un sueño normal NO activa el cuidado');

    console.log('G) Barrera de Gemini: "senal_cuidado" cuando ninguna frase coincide');
    const PARAFRASIS = 'Soñé con una habitación vacía con mi nombre en la puerta. Me quedé tranquilo imaginando que todo seguiría su curso sin que yo hiciera falta.';
    await pg.exec('DELETE FROM conversaciones; DELETE FROM memorias;');
    ok(!require('../../seguridad').evaluarCuidado(PARAFRASIS).cuidado && !require('../../seguridad').evaluarRiesgo(PARAFRASIS).riesgo, 'el texto de prueba NO lo atrapa ninguna frase (solo Gemini puede verlo)');
    globalThis.SENAL = true; respuestaOniria = { ok: true, alerta: 'ninguna', analisis: 'x', lectura_inicial: 'y', preguntas: [], publicable: true };
    const g1 = await primerTurno(1, PARAFRASIS, []);
    ok(g1.mensaje.crisis === true && g1.conversacion === null && /Línea de la Vida/.test(g1.mensaje.texto), 'primer turno (con Oniria beta): Gemini marca la señal -> mensaje de cuidado');
    ok((await q('SELECT count(*)::int n FROM conversaciones'))[0].n === 0, 'no se guardó el sueño ni la respuesta del modelo');
    globalThis.SENAL = false; const f7 = await nuevo(); const antes = f7.mensajes.length; globalThis.SENAL = true;
    const g2 = await siguienteTurno({ ...f7, motor: 'gemini', fase_oniria: null }, 'Me pregunto cómo sería todo sin estar yo.', []);
    const despues = (await q('SELECT mensajes FROM conversaciones'))[0].mensajes.length;
    ok(g2.mensaje.crisis === true && despues === antes, 'mensaje posterior: la respuesta de Gemini se descarta y no se guarda (' + antes + ' -> ' + despues + ' mensajes)');
    globalThis.SENAL = false;
    const g3 = await siguienteTurno({ ...f7, motor: 'gemini', fase_oniria: null }, 'Gracias, ¿y el reloj sin agujas qué significa?', []);
    ok(!g3.mensaje.crisis, 'sin señal, la conversación sigue normal');
    // frases nuevas del chat real
    const S2 = require('../../seguridad');
    ok(S2.evaluarCuidado('Me pregunto si realmente notarían mi ausencia o si sus vidas continuarían exactamente igual sin mí').cuidado, 'tu mensaje real ("notarían mi ausencia…") ahora activa el cuidado');

    console.log('H) Seguir platicando un sueño ya publicado (privado; lo publicado no cambia)');
    globalThis.SENAL = false; await pg.exec('DELETE FROM conversaciones; DELETE FROM memorias; DELETE FROM publicaciones;');
    let fh = await nuevo();
    const pub = await llamar(ruta('/api/conversaciones/:id/publicar', 'post'), { params: { id: String(fh.id_conversacion) }, session: { idUsuario: 1, apodo: 'ana' }, body: {} });
    const p0 = (await q('SELECT * FROM publicaciones'))[0];
    ok(pub.codigo === 201 && p0, 'sueño publicado (' + pub.codigo + ')');
    globalThis.DETALLE = 'Mi hermano Luis (dato privado) estaba ahí.'; globalThis.INTERP_NUEVA = 'Interpretación nueva con dato privado de la charla.';
    const cont = await llamar(ruta('/api/sueno/mensaje', 'post'), { session: { idUsuario: 1 }, body: { texto: 'Se me olvidó contarte que estaba mi hermano Luis.', conversacion: String(fh.id_conversacion) }, files: [] });
    ok(cont.codigo === 200 && !cont.cuerpo.error, 'ya NO responde 409: la conversación continúa (código ' + cont.codigo + ')');
    ok(cont.cuerpo.conversacion?.publicada === true, 'sigue marcada como publicada');
    const cH = (await q('SELECT * FROM conversaciones'))[0]; const pH = (await q('SELECT * FROM publicaciones'))[0];
    ok(cH.mensajes.length > fh.mensajes.length && /Luis/.test(cH.relato), 'la conversación privada sí guarda lo nuevo');
    ok(pH.sueno_texto === p0.sueno_texto && pH.interpretacion_ia === p0.interpretacion_ia && !/Luis|privado/.test(pH.sueno_texto + pH.interpretacion_ia), 'la publicación NO cambió: ni relato ni interpretación (sin filtrar el dato privado)');
    const noDueno = await llamar(ruta('/api/sueno/mensaje', 'post'), { session: { idUsuario: 2 }, body: { texto: 'hola', conversacion: String(fh.id_conversacion) }, files: [] });
    ok(noDueno.codigo === 404, 'otra persona no puede continuar tu conversación (404)');
    globalThis.DETALLE = ''; globalThis.INTERP_NUEVA = '';

    console.log('I) El tema de Gemini no se pisa con "otro" cuando Oniria no tiene un tema equivalente');
    globalThis.SENAL = false; await pg.exec('DELETE FROM conversaciones; DELETE FROM memorias; DELETE FROM publicaciones;');
    let fi = await nuevo(); await q("UPDATE conversaciones SET tema = 'peligro'"); fi = (await q('SELECT * FROM conversaciones'))[0];
    respuestaOniria = { ok: true, alerta: 'ninguna', interpretacion: 'Una posibilidad es que el sueño hable de incertidumbre.', etiquetas: { emotions: [{ tag: 'miedo', intensity: 'alta', confidence: 'alta', evidence: 'x' }], themes: ['incertidumbre', 'muerte'], elements: ['casa', 'bomba'], actions: ['llover', 'despertar', 'pensar'], environment: [], characters: [], characteristics: ['pesadilla'] } };
    await siguienteTurno(fi, 'Sentí mucho miedo.', []);
    fi = (await q('SELECT * FROM conversaciones'))[0];
    ok(fi.tema === 'peligro', 'el tema "peligro" de Gemini se conserva (queda: ' + fi.tema + ')');
    ok(fi.emocion === 'miedo' && fi.tipo_sueno === 'pesadilla', 'emoción y tipo sí se afinan con Oniria (' + fi.emocion + ' / ' + fi.tipo_sueno + ')');
    ok(JSON.stringify(fi.acciones) === JSON.stringify(['llover']), 'acciones sin verbos de relleno: ' + JSON.stringify(fi.acciones));
    console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo bien'); process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
