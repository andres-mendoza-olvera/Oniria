// Interfaz del panel de administración (jsdom): botones del equipo y de borrar con ventana de confirmación.
// Protege un error real: el botón "Quitar" usaba e.currentTarget después de esperar la ventana (ya era null) y nunca mandaba la petición.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const R = require('path').join(__dirname, '..', '..') + '/';
let html = fs.readFileSync(R + 'Admin.html', 'utf-8').replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/admin#equipo' });
const w = dom.window; w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
const llamadas = []; let equipo = [{ id_usuario: 1, apodo: 'Admin', nombre: 'Admin', email: 'a@x', rol: 'admin', activo: true, yo: true }, { id_usuario: 2, apodo: 'Mod', nombre: 'Mod', email: 'm@x', rol: 'moderador', activo: true, yo: false }];
const resp = (o, status = 200) => ({ ok: status < 400, status, json: async () => o, text: async () => JSON.stringify(o) });
w.fetch = async (u, o = {}) => {
    llamadas.push({ u, metodo: o.method || 'GET' });
    if (u === '/api/yo') return resp({ id: 1, rol: 'admin', apodo: 'Admin' });
    if (u === '/api/admin/equipo' && !o.method) return resp(equipo);
    if (/\/api\/admin\/equipo\/\d+$/.test(u) && o.method === 'DELETE') { equipo = equipo.filter((m) => m.id_usuario !== Number(u.split('/').pop())); return resp({ ok: true }); }
    if (u.startsWith('/api/admin/reportes')) return resp([]);
    return resp({}); };
w.eval(fs.readFileSync(R + 'Comun.js', 'utf-8') + '\n' + fs.readFileSync(R + 'Graficas.js', 'utf-8') + '\n' + fs.readFileSync(R + 'Admin-script.js', 'utf-8'));
const D = w.document; const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0; const ok = (c, m) => { console.log((c ? '  OK     ' : '  FALLO  ') + m); if (!c) fallos++; };
(async () => {
    await pausa(300); w.location.hash = '#equipo'; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await pausa(300);
    const botones = [...D.querySelectorAll('#lista-equipo button')].filter((b) => /Quitar/.test(b.textContent));
    ok(botones.length === 1, 'el equipo muestra "Quitar" solo para el subadministrador (no para el administrador)');
    botones[0].click(); await pausa(100);
    const dlg = D.querySelector('dialog[open]'); ok(!!dlg && /Quitar a Mod/.test(dlg.textContent), 'al pulsar "Quitar" pide confirmación');
    dlg.querySelectorAll('button')[0].click(); await pausa(250);
    ok(!llamadas.some((l) => l.metodo === 'DELETE'), 'si se cancela, no se borra nada');
    [...D.querySelectorAll('#lista-equipo button')].find((b) => /Quitar/.test(b.textContent)).click(); await pausa(100);
    D.querySelector('dialog[open]').querySelectorAll('button')[1].click(); await pausa(400);
    ok(llamadas.some((l) => l.metodo === 'DELETE' && l.u === '/api/admin/equipo/2'), 'al confirmar manda DELETE /api/admin/equipo/2');
    ok(![...D.querySelectorAll('#lista-equipo button')].some((b) => /Quitar/.test(b.textContent)), 'la lista se actualiza sin el subadministrador quitado');
    console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK'); process.exit(fallos ? 1 : 0);
})();
