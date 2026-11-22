// =========================================================
// PANEL DE ADMINISTRACIÓN
// (Comun.js: crear, api, icono, crearAvatar, preguntar, avisar ·
//  Graficas.js: crearGrafica, exportarImagen, exportarCSV, descargarBlob)
//   #estadisticas · #reportes · #usuarios · #equipo (solo admin)
// =========================================================
const $ = (id) => document.getElementById(id);

const estado = {
    yo: null,           // { idUsuario, apodo, rol }
    esAdmin: false,
    seccion: null,
    estadisticas: null,
    filtroReportes: 'pendiente',
    filtroUsuarios: 'todas'
};

const fecha = (f) => new Date(f).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const vacio = (texto) => crear('p', { class: 'vacio-admin', text: texto });

// Estado de una cuenta como etiqueta (siempre con texto)
function etiquetaEstado(u) {
    if (u.baneado_en) return crear('span', { class: 'etiqueta baneada' }, icono('bloquear', 'icono-xs'), 'Baneada');
    if (u.suspendido_hasta && new Date(u.suspendido_hasta) > new Date()) {
        return crear('span', { class: 'etiqueta suspendida' }, icono('reloj', 'icono-xs'), `Suspendida hasta ${fecha(u.suspendido_hasta)}`);
    }
    return crear('span', { class: 'etiqueta activa' }, icono('check', 'icono-xs'), 'Activa');
}

// ---------------------------------------------------------
// Secciones (#hash)
// ---------------------------------------------------------
const SECCIONES = ['estadisticas', 'reportes', 'usuarios', 'equipo'];

function irA(nombre) {
    if (!SECCIONES.includes(nombre) || (nombre === 'equipo' && !estado.esAdmin)) nombre = 'estadisticas';
    estado.seccion = nombre;
    SECCIONES.forEach((s) => { $(`seccion-${s}`).hidden = s !== nombre; });
    document.querySelectorAll('[data-seccion]').forEach((a) => a.classList.toggle('activo', a.dataset.seccion === nombre));
    if (nombre === 'estadisticas') cargarEstadisticas();
    if (nombre === 'reportes') cargarReportes();
    if (nombre === 'usuarios') cargarUsuarios();
    if (nombre === 'equipo') cargarEquipo();
}
window.addEventListener('hashchange', () => irA(location.hash.slice(1)));

// ---------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------
const PERIODOS = { '': 'Desde siempre', 365: 'Último año', 90: 'Últimos 90 días', 30: 'Últimos 30 días', 7: 'Última semana' };
const GRAFICAS_ADMIN = [
    { tipo: 'emocion', campo: 'emocion' },
    { tipo: 'tipo_sueno', campo: 'tipo_sueno' },
    { tipo: 'tema', campo: 'tema' },
    { tipo: 'cuentas', campo: 'cuentas', unidad: ['cuenta', 'cuentas'] }
];

function numerosAdmin(d) {
    const n = d.numeros;
    return [
        [n.usuarios, 'usuarios'],
        [n.publicados, 'sueños publicados'],
        [n.conversaciones, 'conversaciones con la IA'],
        [n.comentarios, 'comentarios'],
        [n.corazones, 'corazones'],
        [n.reportes_pendientes, 'reportes pendientes']
    ];
}

function pintarEstadisticas() {
    const d = estado.estadisticas;
    $('numeros').replaceChildren(...numerosAdmin(d).map(([valor, etiqueta]) =>
        crear('div', { class: 'numero' }, crear('strong', { text: String(valor) }), crear('span', { text: etiqueta }))));
    $('graficas').replaceChildren(...GRAFICAS_ADMIN.map(({ tipo, campo, unidad }) =>
        crearGrafica(tipo, d[campo], { unidad, subtitulo: tipo === 'cuentas' ? 'Todas las cuentas de usuarios (sin importar el periodo)' : '' })));
    $('estado-estadisticas').hidden = true;
}

async function cargarEstadisticas() {
    $('estado-estadisticas').hidden = false;
    $('estado-estadisticas').textContent = 'Calculando…';
    try {
        const periodo = $('periodo').value;
        estado.estadisticas = await api(`/api/admin/estadisticas${periodo ? `?dias=${periodo}` : ''}`);
        pintarEstadisticas();
        pintarGloboReportes(estado.estadisticas.numeros.reportes_pendientes);
    } catch (err) {
        $('estado-estadisticas').textContent = err.message;
    }
}
$('periodo').addEventListener('change', cargarEstadisticas);

const sufijoArchivo = () => `${new Date().toISOString().slice(0, 10)}${$('periodo').value ? `-${$('periodo').value}dias` : ''}`;

$('btn-png').addEventListener('click', async (e) => {
    const d = estado.estadisticas;
    if (!d) return;
    e.currentTarget.disabled = true;
    try {
        const blob = await exportarImagen({
            titulo: 'Estadísticas de la comunidad',
            subtitulo: PERIODOS[$('periodo').value],
            numeros: numerosAdmin(d).slice(0, 3),
            graficas: GRAFICAS_ADMIN.map(({ tipo, campo, unidad }) => ({ tipo, conteos: d[campo], unidad }))
        });
        descargarBlob(blob, `oniria-estadisticas-${sufijoArchivo()}.png`);
    } catch (err) {
        avisar(err.message || 'No se pudo crear la imagen.');
    } finally {
        e.currentTarget.disabled = false;
    }
});

$('btn-csv').addEventListener('click', () => {
    const d = estado.estadisticas;
    if (!d) return;
    exportarCSV([
        { titulo: `Resumen (${PERIODOS[$('periodo').value]})`, conteos: numerosAdmin(d).map(([v, e]) => [e, v]) },
        ...GRAFICAS_ADMIN.map(({ tipo, campo }) => ({ tipo, conteos: d[campo] }))
    ], `oniria-estadisticas-${sufijoArchivo()}.csv`);
});

// Redibuja con los colores del tema al cambiar claro/oscuro
new MutationObserver(() => { if (estado.estadisticas && estado.seccion === 'estadisticas') pintarEstadisticas(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

// ---------------------------------------------------------
// Ventana para pedir días y motivo de una sanción
// ---------------------------------------------------------
// accion: 'suspender' | 'banear'. Devuelve { dias, motivo } o null si cancela.
function pedirSancion(accion, apodo, { conMotivo = true } = {}) {
    return new Promise((resolver) => {
        const banear = accion === 'banear';
        const dialogo = crear('dialog', { class: 'pregunta sancion peligro' });
        const dias = crear('select', { class: 'selector' },
            ...[[1, '1 día'], [3, '3 días'], [7, '1 semana'], [15, '15 días'], [30, '1 mes'], [90, '3 meses']]
                .map(([v, t]) => crear('option', { value: String(v), text: t })));
        dias.value = '7';
        const motivo = crear('textarea', { rows: '3', maxlength: '300', placeholder: 'Se le enviará a la persona por correo o SMS' });
        const error = crear('p', { class: 'error-admin', hidden: true });
        const aceptar = crear('button', { type: 'button', class: 'pregunta-btn principal peligro', text: banear ? 'Banear cuenta' : 'Suspender' });
        const cancelar = crear('button', { type: 'button', class: 'pregunta-btn', text: 'Cancelar' });
        let respuesta = null;

        dialogo.append(
            crear('div', { class: 'pregunta-icono' }, icono(banear ? 'bloquear' : 'reloj')),
            crear('h2', { class: 'pregunta-titulo', text: banear ? `¿Banear a ${apodo}?` : `Suspender a ${apodo}` }),
            crear('p', { class: 'pregunta-texto', text: banear
                ? 'No podrá volver a entrar, sus sueños dejarán de verse y se borrarán sus amistades. Se le avisará por su canal preferido.'
                : 'No podrá entrar mientras dure la suspensión y sus sueños no se verán. Se le avisará por su canal preferido.' }),
            banear ? null : crear('label', { class: 'campo-admin' }, crear('span', { text: 'Duración' }), dias),
            conMotivo ? crear('label', { class: 'campo-admin' }, crear('span', { text: 'Motivo' }), motivo) : null,
            error,
            crear('div', { class: 'pregunta-acciones' }, cancelar, aceptar)
        );
        cancelar.addEventListener('click', () => dialogo.close());
        dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
        aceptar.addEventListener('click', () => {
            if (conMotivo && motivo.value.trim().length < 3) {
                error.textContent = 'Escribe el motivo.';
                error.hidden = false;
                return;
            }
            respuesta = { dias: banear ? null : Number(dias.value), motivo: motivo.value.trim() };
            dialogo.close();
        });
        dialogo.addEventListener('close', () => { setTimeout(() => dialogo.remove(), 150); resolver(respuesta); });
        document.body.append(dialogo);
        dialogo.showModal();
        cancelar.focus();
    });
}

// ---------------------------------------------------------
// Reportes
// ---------------------------------------------------------
function pintarGloboReportes(total) {
    $('globo-reportes').textContent = total > 9 ? '9+' : String(total);
    $('globo-reportes').hidden = !total;
}

function tarjetaReporte(r) {
    const pendiente = r.estado === 'pendiente';
    const tarjeta = crear('article', { class: 'tarjeta-admin' },
        crear('div', { class: 'tarjeta-fila' },
            crearAvatar(r.reportado, false, r.reportado_foto),
            crear('div', { class: 'tarjeta-persona' },
                crear('strong', { text: r.reportado }),
                crear('small', { text: `Reportado por ${r.reportante || 'una cuenta eliminada'} · ${fecha(r.creado_en)}` })),
            crear('div', { class: 'etiquetas' },
                crear('span', { class: 'etiqueta motivo' }, icono('bandera', 'icono-xs'), r.motivo_texto),
                crear('span', { class: 'etiqueta' }, `${r.reportes_totales} reporte${r.reportes_totales === 1 ? '' : 's'} en total`),
                etiquetaEstado(r))),
        r.detalle ? crear('p', { class: 'reporte-detalle-texto', text: r.detalle }) : null,
        r.id_publicacion ? crear('div', { class: 'reporte-sueno' },
            crear('strong', { text: `Sueño reportado: ${r.publicacion_titulo || 'sin título'}` }),
            r.publicacion_texto || '') : null
    );

    if (!pendiente) {
        const que = r.accion === 'baneo' ? 'Se baneó la cuenta'
            : r.accion === 'suspension' ? `Se suspendió la cuenta ${r.dias_suspension} día${r.dias_suspension === 1 ? '' : 's'}`
            : 'Se descartó el reporte';
        tarjeta.append(crear('p', { class: 'resolucion', text: `${que} · ${r.revisor || 'administración'} · ${fecha(r.resuelto_en)}${r.nota_admin ? ` · Nota: ${r.nota_admin}` : ''}` }));
        return tarjeta;
    }

    const nota = crear('input', { type: 'text', class: 'nota-admin', maxlength: '500', placeholder: 'Nota (opcional; se agrega al motivo de la sanción)' });
    const resolver = async (accion, boton) => {
        let dias = null;
        if (accion === 'descartar') {
            if (!(await preguntar({ titulo: '¿Descartar este reporte?', texto: `No se hará nada contra ${r.reportado}. A quien reportó se le avisará que lo revisamos.`, aceptar: 'Descartar', icono: 'check' }))) return;
        } else {
            const datos = await pedirSancion(accion, r.reportado, { conMotivo: false });
            if (!datos) return;
            dias = datos.dias;
        }
        boton.disabled = true;
        try {
            await api(`/api/admin/reportes/${r.id_reporte}/resolver`, { method: 'POST', body: JSON.stringify({ accion, dias, nota: nota.value }) });
            cargarReportes();
        } catch (err) {
            boton.disabled = false;
            avisar(err.message);
        }
    };
    const botones = [
        crear('button', { type: 'button', class: 'btn-accion', onclick: (e) => resolver('descartar', e.currentTarget) }, icono('check', 'icono-sm'), 'Descartar'),
        crear('button', { type: 'button', class: 'btn-accion peligro', onclick: (e) => resolver('suspender', e.currentTarget) }, icono('reloj', 'icono-sm'), 'Suspender')
    ];
    if (estado.esAdmin) {
        botones.push(crear('button', { type: 'button', class: 'btn-accion peligro', onclick: (e) => resolver('banear', e.currentTarget) }, icono('bloquear', 'icono-sm'), 'Banear'));
    }
    tarjeta.append(crear('div', { class: 'acciones-admin' }, nota, ...botones));
    return tarjeta;
}

async function cargarReportes() {
    const lista = $('lista-reportes');
    try {
        const reportes = await api(`/api/admin/reportes?estado=${estado.filtroReportes}`);
        if (estado.filtroReportes === 'pendiente') pintarGloboReportes(reportes.length);
        lista.replaceChildren(...(reportes.length ? reportes.map(tarjetaReporte)
            : [vacio(estado.filtroReportes === 'pendiente' ? 'No hay reportes pendientes. 🎉' : 'Todavía no se ha revisado ningún reporte.')]));
    } catch (err) {
        lista.replaceChildren(vacio(err.message));
    }
}

document.querySelectorAll('[data-filtro-reportes]').forEach((chip) => chip.addEventListener('click', () => {
    estado.filtroReportes = chip.dataset.filtroReportes;
    document.querySelectorAll('[data-filtro-reportes]').forEach((c) => c.classList.toggle('activo', c === chip));
    cargarReportes();
}));

// ---------------------------------------------------------
// Usuarios
// ---------------------------------------------------------
function tarjetaUsuario(u) {
    const sancionado = Boolean(u.baneado_en) || (u.suspendido_hasta && new Date(u.suspendido_hasta) > new Date());
    const sancionar = async (accion, boton) => {
        let cuerpo = { accion };
        if (accion === 'quitar') {
            if (!(await preguntar({ titulo: `¿Reactivar a ${u.apodo}?`, texto: 'Podrá volver a entrar y sus sueños se verán otra vez. Se le avisará.', aceptar: 'Reactivar', icono: 'check' }))) return;
        } else {
            const datos = await pedirSancion(accion, u.apodo);
            if (!datos) return;
            cuerpo = { accion, ...datos };
        }
        boton.disabled = true;
        try {
            await api(`/api/admin/usuarios/${u.id_usuario}/sancion`, { method: 'POST', body: JSON.stringify(cuerpo) });
            cargarUsuarios();
        } catch (err) {
            boton.disabled = false;
            avisar(err.message);
        }
    };

    const botones = [];
    if (sancionado) {
        if (!u.baneado_en || estado.esAdmin) {
            botones.push(crear('button', { type: 'button', class: 'btn-accion', onclick: (e) => sancionar('quitar', e.currentTarget) }, icono('check', 'icono-sm'), u.baneado_en ? 'Quitar baneo' : 'Quitar suspensión'));
        }
    } else {
        botones.push(crear('button', { type: 'button', class: 'btn-accion peligro', onclick: (e) => sancionar('suspender', e.currentTarget) }, icono('reloj', 'icono-sm'), 'Suspender'));
    }
    if (estado.esAdmin && !u.baneado_en) {
        botones.push(crear('button', { type: 'button', class: 'btn-accion peligro', onclick: (e) => sancionar('banear', e.currentTarget) }, icono('bloquear', 'icono-sm'), 'Banear'));
    }

    return crear('article', { class: 'tarjeta-admin' },
        crear('div', { class: 'tarjeta-fila' },
            crearAvatar(u.apodo, false, u.foto_perfil),
            crear('div', { class: 'tarjeta-persona' },
                crear('strong', { text: u.apodo }),
                crear('small', { text: `${u.nombre} · ${u.email}${u.verificado ? '' : ' · sin verificar'}` })),
            crear('div', { class: 'etiquetas' },
                etiquetaEstado(u),
                crear('span', { class: 'etiqueta', text: `${u.suenos} sueño${u.suenos === 1 ? '' : 's'}` }),
                crear('span', { class: 'etiqueta', text: `${u.reportes} reporte${u.reportes === 1 ? '' : 's'}` }))),
        u.motivo_sancion && sancionado ? crear('p', { class: 'meta', text: `Motivo: ${u.motivo_sancion}` }) : null,
        botones.length ? crear('div', { class: 'acciones-admin' }, ...botones) : null
    );
}

let temporizadorUsuarios = null;
async function cargarUsuarios() {
    const lista = $('lista-usuarios');
    try {
        const buscar = $('buscar-usuarios').value.trim();
        const usuarios = await api(`/api/admin/usuarios?buscar=${encodeURIComponent(buscar)}&filtro=${estado.filtroUsuarios}`);
        lista.replaceChildren(...(usuarios.length ? usuarios.map(tarjetaUsuario) : [vacio('No hay cuentas que coincidan.')]));
    } catch (err) {
        lista.replaceChildren(vacio(err.message));
    }
}
$('buscar-usuarios').addEventListener('input', () => {
    clearTimeout(temporizadorUsuarios);
    temporizadorUsuarios = setTimeout(cargarUsuarios, 300);
});
document.querySelectorAll('[data-filtro-usuarios]').forEach((chip) => chip.addEventListener('click', () => {
    estado.filtroUsuarios = chip.dataset.filtroUsuarios;
    document.querySelectorAll('[data-filtro-usuarios]').forEach((c) => c.classList.toggle('activo', c === chip));
    cargarUsuarios();
}));

// ---------------------------------------------------------
// Equipo (solo admin)
// ---------------------------------------------------------
async function cargarEquipo() {
    const lista = $('lista-equipo');
    try {
        const equipo = await api('/api/admin/equipo');
        lista.replaceChildren(...equipo.map((m) => {
            const quitar = m.rol === 'moderador'
                ? crear('button', {
                    type: 'button', class: 'btn-accion peligro',
                    onclick: async (e) => {
                        if (!(await preguntar({ titulo: `¿Quitar a ${m.apodo} del equipo?`, texto: 'Se borrará su cuenta de subadministrador y se cerrará su sesión.', aceptar: 'Quitar', peligro: true, icono: 'basura' }))) return;
                        e.currentTarget.disabled = true;
                        try { await api(`/api/admin/equipo/${m.id_usuario}`, { method: 'DELETE' }); cargarEquipo(); } catch (err) { avisar(err.message); }
                    }
                }, icono('basura', 'icono-sm'), 'Quitar')
                : null;
            return crear('article', { class: 'tarjeta-admin' },
                crear('div', { class: 'tarjeta-fila' },
                    crearAvatar(m.apodo),
                    crear('div', { class: 'tarjeta-persona' },
                        crear('strong', { text: `${m.apodo}${m.yo ? ' (tú)' : ''}` }),
                        crear('small', { text: `${m.nombre} · ${m.email}` })),
                    crear('div', { class: 'etiquetas' },
                        crear('span', { class: 'etiqueta motivo', text: m.rol === 'admin' ? 'Administrador' : 'Subadministrador' }),
                        m.activo ? null : crear('span', { class: 'etiqueta suspendida', text: 'Invitación pendiente' })),
                    quitar));
        }));
    } catch (err) {
        lista.replaceChildren(vacio(err.message));
    }
}

$('form-equipo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = $('btn-equipo');
    $('error-equipo').hidden = true;
    boton.disabled = true;
    try {
        await api('/api/admin/equipo', {
            method: 'POST',
            body: JSON.stringify({ nombre: $('equipo-nombre').value, apodo: $('equipo-apodo').value, correo: $('equipo-correo').value })
        });
        e.target.reset();
        preguntar({ titulo: 'Invitación enviada', texto: 'Le llegó un correo para que elija su contraseña. Cuando lo haga, podrá entrar con su correo.', aceptar: 'Entendido', soloAceptar: true, icono: 'check' });
        cargarEquipo();
    } catch (err) {
        $('error-equipo').textContent = err.message;
        $('error-equipo').hidden = false;
    } finally {
        boton.disabled = false;
    }
});

// ---------------------------------------------------------
// Arranque
// ---------------------------------------------------------
(async () => {
    try {
        estado.yo = await api('/api/yo');
        estado.esAdmin = estado.yo.rol === 'admin';
        $('insignia-rol').textContent = estado.esAdmin ? 'Administrador' : 'Subadministrador';
        document.querySelectorAll('.js-solo-admin').forEach((el) => { el.hidden = !estado.esAdmin; });
        irA(location.hash.slice(1) || 'estadisticas');
        if (estado.seccion !== 'reportes') {
            api('/api/admin/reportes').then((r) => pintarGloboReportes(r.length)).catch(() => {});
        }
    } catch (err) {
        avisar(err.message);
    }
})();
