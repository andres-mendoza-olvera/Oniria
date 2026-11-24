// =========================================================
// PANEL DE ADMINISTRACIÓN
// (Comun.js: crear, api, icono, crearAvatar, preguntar, avisar ·
//  Graficas.js: crearGrafica, exportarImagen, exportarCSV, descargarBlob)
//   #estadisticas · #reportes · #publicaciones · #usuarios · #equipo (solo admin)
// =========================================================
const $ = (id) => document.getElementById(id);

const estado = {
    yo: null,           // { idUsuario, apodo, rol }
    esAdmin: false,
    seccion: null,
    estadisticas: null,
    filtroReportes: 'pendiente',
    filtroUsuarios: 'todas',
    filtroPublicaciones: 'todas',
    vistaEstadisticas: 'comunidad', // 'comunidad' | 'persona'
    persona: null                    // la persona elegida en "Por persona"
};

const fecha = (f) => new Date(f).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const vacio = (texto) => crear('p', { class: 'vacio-admin', text: texto });

// Estado de una cuenta como etiqueta (siempre con texto)
function etiquetaEstado(u) {
    if (u.eliminado_en) return crear('span', { class: 'etiqueta eliminada' }, icono('basura', 'icono-xs'), 'Eliminada por su dueño');
    if (u.baneado_en) return crear('span', { class: 'etiqueta baneada' }, icono('bloquear', 'icono-xs'), 'Baneada');
    if (u.suspendido_hasta && new Date(u.suspendido_hasta) > new Date()) {
        return crear('span', { class: 'etiqueta suspendida' }, icono('reloj', 'icono-xs'), `Suspendida hasta ${fecha(u.suspendido_hasta)}`);
    }
    return crear('span', { class: 'etiqueta activa' }, icono('check', 'icono-xs'), 'Activa');
}

// ---------------------------------------------------------
// Secciones (#hash)
// ---------------------------------------------------------
const SECCIONES = ['estadisticas', 'reportes', 'publicaciones', 'usuarios', 'equipo'];

function irA(nombre) {
    if (!SECCIONES.includes(nombre) || (nombre === 'equipo' && !estado.esAdmin)) nombre = 'estadisticas';
    estado.seccion = nombre;
    SECCIONES.forEach((s) => { $(`seccion-${s}`).hidden = s !== nombre; });
    document.querySelectorAll('[data-seccion]').forEach((a) => a.classList.toggle('activo', a.dataset.seccion === nombre));
    if (nombre === 'estadisticas') cargarEstadisticas();
    if (nombre === 'reportes') cargarReportes();
    if (nombre === 'publicaciones') cargarPublicaciones();
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
        [n.corazones, 'reacciones'],
        [n.reportes_pendientes, 'reportes pendientes']
    ];
}

// Las de una persona: las mismas 4 gráficas que ve ella en "Mis estadísticas"
const GRAFICAS_PERSONA = [
    { tipo: 'emocion', campo: 'emocion' },
    { tipo: 'tipo_sueno', campo: 'tipo_sueno' },
    { tipo: 'tema', campo: 'tema' },
    { tipo: 'horario', campo: 'horario', titulo: '¿A qué hora cuenta sus sueños?' }
];
function numerosPersona(d) {
    const n = d.numeros;
    return [
        [n.publicados + n.sin_publicar, 'sueños contados'],
        [n.publicados, 'publicados'],
        [n.sin_publicar, 'sin publicar'],
        [n.corazones, 'reacciones recibidas'],
        [n.comentarios, 'comentarios recibidos'],
        [n.amigos, 'amigos'],
        [d.persona.reportes, 'reportes recibidos']
    ];
}

const esDePersona = () => Boolean(estado.estadisticas?.persona);
const numerosActuales = () => (esDePersona() ? numerosPersona : numerosAdmin)(estado.estadisticas);
const graficasActuales = () => (esDePersona() ? GRAFICAS_PERSONA : GRAFICAS_ADMIN);

function pintarEstadisticas() {
    const d = estado.estadisticas;
    $('numeros').replaceChildren(...numerosActuales().map(([valor, etiqueta]) =>
        crear('div', { class: 'numero' }, crear('strong', { text: String(valor) }), crear('span', { text: etiqueta }))));
    $('graficas').replaceChildren(
        ...graficasActuales().map(({ tipo, campo, unidad, titulo }) =>
            crearGrafica(tipo, d[campo], { unidad, titulo, subtitulo: tipo === 'cuentas' ? 'Todas las cuentas de usuarios (sin importar el periodo)' : '' })),
        crearRanking(esDePersona() ? 'Símbolos de sus sueños' : 'Símbolos más frecuentes', d.simbolos, { subtitulo: 'Elementos que aparecen en los sueños.', marcarRepetidos: esDePersona() }),
        crearRanking(esDePersona() ? 'Acciones en sus sueños' : 'Acciones más frecuentes', d.acciones, { subtitulo: 'Lo que ocurre en los sueños.' }));
    $('numeros').hidden = false;
    $('graficas').hidden = false;
    $('estado-estadisticas').hidden = true;
}

// Encabezado, buscador y tarjeta según la vista (comunidad o una persona)
function pintarVistaEstadisticas() {
    const porPersona = estado.vistaEstadisticas === 'persona';
    const p = estado.persona;
    document.querySelectorAll('[data-vista-estadisticas]').forEach((c) => c.classList.toggle('activo', c.dataset.vistaEstadisticas === estado.vistaEstadisticas));
    $('titulo-estadisticas').textContent = porPersona ? (p ? `Estadísticas de ${p.apodo}` : 'Estadísticas por persona') : 'Estadísticas de Oniria';
    $('texto-estadisticas').textContent = porPersona
        ? 'Cómo sueña una persona: lo que contó a la IA, lo haya publicado o no.'
        : 'Cómo sueña la comunidad. La IA clasifica cada sueño al interpretarlo.';
    $('elegir-persona').hidden = !porPersona || Boolean(p);
    $('persona-elegida').hidden = !porPersona || !p;
    $('btn-png').disabled = $('btn-csv').disabled = porPersona && !p;
    if (porPersona && p) {
        $('persona-elegida').replaceChildren(crear('div', { class: 'tarjeta-fila' },
            p.eliminado_en ? crearAvatarEliminado() : crearAvatar(p.apodo, false, p.foto_perfil),
            crear('div', { class: 'tarjeta-persona' },
                crear('strong', { text: p.apodo }),
                crear('small', { text: [p.nombre, p.email].filter(Boolean).join(' · ') })),
            crear('div', { class: 'etiquetas' }, etiquetaEstado(p)),
            crear('button', { type: 'button', class: 'btn-accion', onclick: () => elegirPersona(null) }, icono('buscar', 'icono-sm'), 'Cambiar persona')));
    }
    if (porPersona && !p) {
        $('numeros').hidden = true;
        $('graficas').hidden = true;
        $('estado-estadisticas').hidden = true;
        estado.estadisticas = null;
        buscarPersonas();
    }
}

async function cargarEstadisticas() {
    pintarVistaEstadisticas();
    if (estado.vistaEstadisticas === 'persona' && !estado.persona) return;
    $('estado-estadisticas').hidden = false;
    $('estado-estadisticas').textContent = 'Calculando…';
    try {
        const periodo = $('periodo').value;
        const consulta = periodo ? `?dias=${periodo}` : '';
        if (estado.vistaEstadisticas === 'persona') {
            estado.estadisticas = await api(`/api/admin/usuarios/${estado.persona.id_usuario}/estadisticas${consulta}`);
            estado.persona = estado.estadisticas.persona;
            pintarVistaEstadisticas();
        } else {
            estado.estadisticas = await api(`/api/admin/estadisticas${consulta}`);
            pintarGloboReportes(estado.estadisticas.numeros.reportes_pendientes);
        }
        pintarEstadisticas();
    } catch (err) {
        $('estado-estadisticas').textContent = err.message;
    }
}
$('periodo').addEventListener('change', cargarEstadisticas);

document.querySelectorAll('[data-vista-estadisticas]').forEach((chip) => chip.addEventListener('click', () => {
    if (estado.vistaEstadisticas === chip.dataset.vistaEstadisticas) return;
    estado.vistaEstadisticas = chip.dataset.vistaEstadisticas;
    cargarEstadisticas();
}));

// Elegir (o quitar, con null) a la persona; desde Usuarios también se llega aquí
function elegirPersona(persona) {
    estado.persona = persona;
    estado.vistaEstadisticas = 'persona';
    if (estado.seccion === 'estadisticas') cargarEstadisticas();
    else location.hash = 'estadisticas'; // irA() carga las estadísticas
    if (!persona) setTimeout(() => $('buscar-persona').focus(), 50);
    window.scrollTo({ top: 0 });
}

let temporizadorPersona = null;
async function buscarPersonas() {
    const lista = $('resultados-persona');
    try {
        const usuarios = await api(`/api/admin/usuarios?buscar=${encodeURIComponent($('buscar-persona').value.trim())}&filtro=todas`);
        lista.replaceChildren(...(usuarios.length ? usuarios.map((u) => crear('button', {
            type: 'button', class: 'tarjeta-admin opcion-persona', onclick: () => elegirPersona(u)
        }, crear('div', { class: 'tarjeta-fila' },
            crearAvatar(u.apodo, false, u.foto_perfil),
            crear('div', { class: 'tarjeta-persona' },
                crear('strong', { text: u.apodo }),
                crear('small', { text: `${u.nombre} · ${u.suenos} sueño${u.suenos === 1 ? '' : 's'} publicado${u.suenos === 1 ? '' : 's'}` })),
            icono('derecha', 'icono-sm')))) : [vacio('No hay cuentas que coincidan.')]));
    } catch (err) {
        lista.replaceChildren(vacio(err.message));
    }
}
$('buscar-persona').addEventListener('input', () => {
    clearTimeout(temporizadorPersona);
    temporizadorPersona = setTimeout(buscarPersonas, 300);
});

// Nombre de archivo: "oniria-estadisticas[-apodo]-2026-11-21[-30dias]"
const sufijoArchivo = () => {
    const quien = esDePersona() ? `-${estado.estadisticas.persona.apodo.normalize('NFD').replace(/[^\w-]+/g, '').toLowerCase() || 'persona'}` : '';
    return `${quien}-${new Date().toISOString().slice(0, 10)}${$('periodo').value ? `-${$('periodo').value}dias` : ''}`;
};

$('btn-png').addEventListener('click', async (e) => {
    const d = estado.estadisticas;
    if (!d) return;
    const boton = e.currentTarget;
    boton.disabled = true;
    try {
        const blob = await exportarImagen({
            titulo: esDePersona() ? `Los sueños de ${d.persona.apodo}` : 'Estadísticas de la comunidad',
            subtitulo: PERIODOS[$('periodo').value],
            numeros: numerosActuales().slice(0, 3),
            graficas: graficasActuales().map(({ tipo, campo, unidad, titulo }) => ({ tipo, conteos: d[campo], unidad, titulo }))
        });
        descargarBlob(blob, `oniria-estadisticas${sufijoArchivo()}.png`);
    } catch (err) {
        avisar(err.message || 'No se pudo crear la imagen.');
    } finally {
        boton.disabled = false;
    }
});

$('btn-csv').addEventListener('click', () => {
    const d = estado.estadisticas;
    if (!d) return;
    const quien = esDePersona() ? `${d.persona.apodo}, ` : '';
    exportarCSV([
        { titulo: `Resumen (${quien}${PERIODOS[$('periodo').value]})`, conteos: numerosActuales().map(([v, e]) => [e, v]) },
        ...graficasActuales().map(({ tipo, campo }) => ({ tipo, conteos: d[campo] }))
    ], `oniria-estadisticas${sufijoArchivo()}.csv`);
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

        agregar(dialogo,
            crear('div', { class: 'pregunta-icono' }, icono(banear ? 'bloquear' : 'reloj')),
            crear('h2', { class: 'pregunta-titulo', text: banear ? `¿Banear a ${apodo}?` : `Suspender a ${apodo}` }),
            crear('p', { class: 'pregunta-texto', text: banear
                ? 'No podrá volver a entrar y se borrarán sus amistades. Sus sueños y comentarios se quedan, firmados como "Cuenta eliminada" (los puedes borrar en Publicaciones). Se le avisará por su canal preferido.'
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
            r.publicacion_texto || '',
            estado.esAdmin ? crear('div', { class: 'acciones-admin' },
                crear('button', {
                    type: 'button', class: 'btn-accion peligro',
                    onclick: async (e) => {
                        const boton = e.currentTarget;
                        if (await borrarPublicacion({ id_publicacion: r.id_publicacion, titulo: r.publicacion_titulo, autor: r.reportado, cuentaActiva: !r.baneado_en && !r.eliminado_en }, boton)) cargarReportes();
                    }
                }, icono('basura', 'icono-sm'), 'Borrar este sueño')) : null) : null
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
        crear('button', { type: 'button', class: 'btn-accion', onclick: (e) => resolver('descartar', e.currentTarget) }, icono('check', 'icono-sm'), r.eliminado_en ? 'Cerrar reporte' : 'Descartar')
    ];
    if (!r.eliminado_en) {
        botones.push(crear('button', { type: 'button', class: 'btn-accion peligro', onclick: (e) => resolver('suspender', e.currentTarget) }, icono('reloj', 'icono-sm'), 'Suspender'));
    }
    if (estado.esAdmin && !r.eliminado_en) {
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
// Publicaciones (todas; solo el admin puede borrar)
// ---------------------------------------------------------
// Pregunta (con motivo opcional) y borra. Devuelve true si se borró.
function borrarPublicacion(p, boton) {
    return new Promise((resolver) => {
        const dialogo = crear('dialog', { class: 'pregunta sancion peligro' });
        const motivo = crear('textarea', { rows: '3', maxlength: '300', placeholder: 'Opcional. Se le enviará a la persona por correo o SMS' });
        const error = crear('p', { class: 'error-admin', hidden: true });
        const aceptar = crear('button', { type: 'button', class: 'pregunta-btn principal peligro', text: 'Borrar sueño' });
        const cancelar = crear('button', { type: 'button', class: 'pregunta-btn', text: 'Cancelar' });
        let borrada = false;

        agregar(dialogo,
            crear('div', { class: 'pregunta-icono' }, icono('basura')),
            crear('h2', { class: 'pregunta-titulo', text: '¿Borrar este sueño?' }),
            crear('p', { class: 'pregunta-texto', text: `«${p.titulo || 'Sin título'}» de ${p.autor} se borrará del feed con sus imágenes, corazones y comentarios. No se puede deshacer.` }),
            p.cuentaActiva ? crear('label', { class: 'campo-admin' }, crear('span', { text: 'Motivo' }), motivo) : null,
            error,
            crear('div', { class: 'pregunta-acciones' }, cancelar, aceptar)
        );
        cancelar.addEventListener('click', () => dialogo.close());
        dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
        aceptar.addEventListener('click', async () => {
            aceptar.disabled = true;
            error.hidden = true;
            try {
                await api(`/api/admin/publicaciones/${p.id_publicacion}`, { method: 'DELETE', body: JSON.stringify({ motivo: motivo.value.trim() }) });
                borrada = true;
                dialogo.close();
            } catch (err) {
                error.textContent = err.message;
                error.hidden = false;
                aceptar.disabled = false;
            }
        });
        dialogo.addEventListener('close', () => {
            setTimeout(() => dialogo.remove(), 150);
            if (boton && !borrada) boton.disabled = false;
            resolver(borrada);
        });
        if (boton) boton.disabled = true;
        document.body.append(dialogo);
        dialogo.showModal();
        cancelar.focus();
    });
}

// Nombre bonito de la clasificación de la IA (feliz -> "Feliz")
const nombreCategoria = (tipo, clave) => CATEGORIAS_GRAFICAS[tipo].items.find(([c]) => c === clave)?.[1];
const ESTADOS_PUBLICACION = { procesando: 'Procesando', error: 'Con error' };

function tarjetaPublicacion(p) {
    const cuentaIda = Boolean(p.baneado_en || p.eliminado_en);
    const texto = crear('p', { class: 'pub-texto', text: p.sueno_texto || '' });
    let leerMas = null;
    if ((p.sueno_texto || '').length > 320) {
        texto.classList.add('colapsada');
        leerMas = crear('button', {
            type: 'button', class: 'btn-enlace', text: 'Leer todo',
            onclick: () => { leerMas.textContent = texto.classList.toggle('colapsada') ? 'Leer todo' : 'Leer menos'; }
        });
    }
    const medios = (p.medios || []).length ? crear('div', { class: 'pub-medios' }, ...p.medios.map((m) =>
        crear('a', { href: m.url, target: '_blank', rel: 'noopener', title: m.es_ia ? 'Imagen creada por IA' : 'Imagen del soñador' },
            m.tipo === 'video' ? crear('video', { src: m.url, preload: 'metadata', muted: '' })
                : crear('img', { src: m.url, alt: m.es_ia ? 'Imagen creada por IA' : 'Imagen del soñador', loading: 'lazy' })))) : null;
    const clasificacion = [['emocion', p.emocion], ['tipo_sueno', p.tipo_sueno], ['tema', p.tema]]
        .map(([tipo, clave]) => clave && nombreCategoria(tipo, clave)).filter(Boolean);

    const tarjeta = crear('article', { class: 'tarjeta-admin', 'data-publicacion': p.id_publicacion },
        crear('div', { class: 'tarjeta-fila' },
            p.eliminado_en ? crearAvatarEliminado() : crearAvatar(p.autor, false, p.autor_foto),
            crear('div', { class: 'tarjeta-persona' },
                crear('strong', { text: p.autor }),
                crear('small', { text: `${fecha(p.creado_en)}${cuentaIda ? ' · en el feed sale como "Cuenta eliminada"' : ''}` })),
            crear('div', { class: 'etiquetas' },
                etiquetaEstado(p),
                ESTADOS_PUBLICACION[p.estado] ? crear('span', { class: 'etiqueta suspendida', text: ESTADOS_PUBLICACION[p.estado] }) : null,
                p.total_reportes ? crear('span', { class: 'etiqueta baneada' }, icono('bandera', 'icono-xs'), `${p.total_reportes} reporte${p.total_reportes === 1 ? '' : 's'}`) : null)),
        crear('h2', { class: 'pub-titulo', text: p.titulo || 'Sin título' }),
        texto, leerMas, medios,
        p.interpretacion_ia ? crear('details', { class: 'pub-interpretacion' },
            crear('summary', { text: 'Ver la interpretación de la IA' }), crear('p', { text: p.interpretacion_ia })) : null,
        crear('div', { class: 'etiquetas' },
            ...clasificacion.map((t) => crear('span', { class: 'etiqueta motivo', text: t })),
            crear('span', { class: 'etiqueta' }, icono('corazon', 'icono-xs'), String(p.total_corazones)),
            crear('span', { class: 'etiqueta' }, icono('comentario', 'icono-xs'), String(p.total_comentarios)))
    );
    if (estado.esAdmin) {
        tarjeta.append(crear('div', { class: 'acciones-admin' },
            crear('button', {
                type: 'button', class: 'btn-accion peligro',
                onclick: async (e) => {
                    if (await borrarPublicacion({ ...p, cuentaActiva: !cuentaIda }, e.currentTarget)) {
                        tarjeta.remove();
                        if (!$('lista-publicaciones').children.length) cargarPublicaciones();
                    }
                }
            }, icono('basura', 'icono-sm'), 'Borrar sueño')));
    }
    return tarjeta;
}

let temporizadorPublicaciones = null;
let ultimaPublicacion = null; // para "Ver más"
async function cargarPublicaciones({ mas = false } = {}) {
    const lista = $('lista-publicaciones');
    const boton = $('btn-mas-publicaciones');
    try {
        const buscar = $('buscar-publicaciones').value.trim();
        const { publicaciones, hayMas } = await api(`/api/admin/publicaciones?buscar=${encodeURIComponent(buscar)}&filtro=${estado.filtroPublicaciones}${mas && ultimaPublicacion ? `&antes=${ultimaPublicacion}` : ''}`);
        const tarjetas = publicaciones.map(tarjetaPublicacion);
        if (mas) lista.append(...tarjetas);
        else lista.replaceChildren(...(tarjetas.length ? tarjetas : [vacio(buscar || estado.filtroPublicaciones !== 'todas' ? 'No hay publicaciones que coincidan.' : 'Todavía nadie ha publicado un sueño.')]));
        if (publicaciones.length) ultimaPublicacion = publicaciones[publicaciones.length - 1].id_publicacion;
        boton.hidden = !hayMas;
    } catch (err) {
        if (!mas) lista.replaceChildren(vacio(err.message));
        else avisar(err.message);
    }
}
$('buscar-publicaciones').addEventListener('input', () => {
    clearTimeout(temporizadorPublicaciones);
    temporizadorPublicaciones = setTimeout(cargarPublicaciones, 300);
});
$('btn-mas-publicaciones').addEventListener('click', () => cargarPublicaciones({ mas: true }));
document.querySelectorAll('[data-filtro-publicaciones]').forEach((chip) => chip.addEventListener('click', () => {
    estado.filtroPublicaciones = chip.dataset.filtroPublicaciones;
    document.querySelectorAll('[data-filtro-publicaciones]').forEach((c) => c.classList.toggle('activo', c === chip));
    cargarPublicaciones();
}));

// ---------------------------------------------------------
// Usuarios
// ---------------------------------------------------------
function tarjetaUsuario(u) {
    const sancionado = Boolean(u.baneado_en) || (u.suspendido_hasta && new Date(u.suspendido_hasta) > new Date());
    const sancionar = async (accion, boton) => {
        let cuerpo = { accion };
        if (accion === 'quitar') {
            if (!(await preguntar({ titulo: `¿Reactivar a ${u.apodo}?`, texto: 'Podrá volver a entrar y sus sueños volverán a mostrar su nombre. Se le avisará.', aceptar: 'Reactivar', icono: 'check' }))) return;
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

    const botones = [
        crear('button', { type: 'button', class: 'btn-accion', onclick: () => elegirPersona(u) }, icono('grafica', 'icono-sm'), 'Estadísticas')
    ];
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
