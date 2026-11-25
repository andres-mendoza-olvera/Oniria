const { JSDOM } = require('jsdom'); const fs = require('fs');
const R = require('path').join(__dirname, '..', '..') + '/';
const ids = 'acciones adjuntos aviso-publicada bienvenida btn-cerrar-vista btn-confirmar-publicar btn-descartar btn-enviar btn-microfono btn-nuevo btn-publicar btn-seguir error-chat estado-bot form-chat input-imagenes lista-pendientes mensajes pendientes texto vista-previa vista-previa-contenido'.split(' ');
const html = '<body>' + ids.map((i) => i === 'mensajes' ? '<ul id="mensajes"></ul>' : i === 'input-imagenes' ? '<label><input id="input-imagenes"></label>' : i === 'texto' ? '<textarea id="texto"></textarea>' : i === 'form-chat' ? '<form id="form-chat"></form>' : `<div id="${i}"></div>`).join('') + '</body>';
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/sueno' });
const w = dom.window; w.matchMedia = () => ({ matches: false }); w.fetch = async () => { throw new Error('sin red'); };
const src = fs.readFileSync(R + 'Comun.js', 'utf-8') + '\n' + fs.readFileSync(R + 'Sueno-script.js', 'utf-8') +
  '\nwindow.__t = { mensajeIA, pintarConversacion, estado, textarea };';
w.eval(src + '\nwindow.__t.revisar = revisarEstadoIA; window.__t.ui = actualizarInterfaz;');
const { mensajeIA, pintarConversacion, estado, revisar, ui } = w.__t;
let fallos = 0; const ok = (c, m) => { console.log((c ? '  OK     ' : '  FALLO  ') + m); if (!c) fallos++; };
const q = (el, s) => el.querySelector(s);
const m1 = { rol: 'ia', tipo: 'interpretacion', titulo: 'T', texto: 'Análisis\n\nPrimera lectura', motor: 'oniria' };
const li = mensajeIA(m1);
ok(q(li, '.interpretacion-etiqueta').textContent.includes('Primera lectura'), 'beta: etiqueta "Primera lectura"');
ok(!!q(li, '.insignia-beta') && !!q(li, '.btn-ver-interpretacion'), 'beta: insignia y botón "Ver la interpretación completa"');
ok(q(li, '.sin-imagen').textContent === 'No pude crear la imagen esta vez.', 'beta: sin la frase "aquí está la interpretación"');
const g = mensajeIA({ rol: 'ia', tipo: 'interpretacion', titulo: 'T', texto: 'x', motor: 'gemini' });
ok(q(g, '.interpretacion-etiqueta').textContent.includes('Interpretación psicológica') && !q(g, '.btn-ver-interpretacion') && !q(g, '.insignia-beta'), 'gemini: sin cambios (Interpretación psicológica, sin botón)');
// pulsar el botón => pone "omitir" y envía
let enviado = null; w.fetch = async (url, op) => { if (op && op.body && op.body.get) enviado = op.body.get('texto'); throw new Error('sin red'); };
estado.borrador = { id: 1 };
const lista = w.document.getElementById('mensajes'); lista.append(li);
q(li, '.btn-ver-interpretacion').click();
setTimeout(() => {
  ok(enviado === 'omitir', 'el botón envía "omitir" (se pidió: ' + enviado + ')');
  ok(!q(lista, '.btn-ver-interpretacion'), 'al enviar, el botón desaparece');
  // recarga: si ya hay respuesta posterior, el botón no aparece; si la primera lectura es la última, sí
  pintarConversacion([m1, { rol: 'usuario', texto: 'hola' }, { rol: 'ia', texto: 'interp', motor: 'oniria' }]);
  ok(!q(lista, '.btn-ver-interpretacion'), 'recarga con interpretación ya dada: sin botón');
  pintarConversacion([{ rol: 'usuario', texto: 'sueño' }, m1]);
  ok(!!q(lista, '.btn-ver-interpretacion'), 'recarga con la primera lectura al final: con botón');
  (async () => {

  estado.borrador = { id: 9, publicada: true }; ui();
  const D = w.document;
  ok(D.getElementById('form-chat').hidden === false, 'sueño publicado: la caja para escribir sigue visible');
  ok(D.getElementById('acciones').hidden === true, 'sueño publicado: sin botones Eliminar/Publicar');
  ok(D.getElementById('aviso-publicada').hidden === false, 'sueño publicado: se muestra el aviso de privacidad');
  estado.borrador = { id: 9, publicada: false }; ui();
  ok(D.getElementById('acciones').hidden === false && D.getElementById('aviso-publicada').hidden === true, 'borrador: botones visibles, sin aviso');

  const lc = mensajeIA({ rol: 'ia', crisis: true, texto: 'Mensaje de apoyo.\n\n• Emergencias: 911\n• Línea de la Vida: 800 911 2000\n• Locatel: 55 5658 1111' });
  const ps = [...lc.querySelectorAll('p')];
  ok(ps.length === 2 && ps[1].classList.contains('con-saltos') && ps[1].textContent.split('\n').length === 3, 'lista de teléfonos: un párrafo con 3 líneas que conservan sus saltos');
  ok(!ps[0].classList.contains('con-saltos'), 'el párrafo normal no cambia');
  // aviso de Gemini saturado
  let est = 'saturado';
  w.fetch = async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('estado-ia') ? { gemini: est } : {}) });
  await revisar(); const a1 = w.document.getElementById('aviso-servicio');
  ok(!!a1 && /Gemini/.test(a1.textContent) && /ni de Oniria/.test(a1.textContent), 'Gemini saturado: aparece el aviso en la página');
  await revisar(); ok(w.document.querySelectorAll('#aviso-servicio').length === 1, 'no se duplica el aviso');
  est = 'ok'; await revisar(); ok(!w.document.getElementById('aviso-servicio'), 'cuando Gemini se recupera, el aviso desaparece');
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo bien'); process.exit(fallos ? 1 : 0); })();
}, 300);
