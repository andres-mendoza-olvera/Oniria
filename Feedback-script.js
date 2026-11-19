// =========================================================
// 1. ESTADO DEL FEED (íconos, tema, crear() y api() vienen de Comun.js)
// =========================================================
const lista = document.getElementById('lista-publicaciones');
const estadoFeed = document.getElementById('estado-feed');
const btnCargarMas = document.getElementById('btn-cargar-mas');
const avisoNuevos = document.getElementById('aviso-nuevos');

let miId = null;              // id_usuario de quien está viendo el feed
let idMasViejo = null;        // para "Ver más" (pedir publicaciones anteriores)
let idMasNuevo = 0;           // la publicación más reciente que ya tenemos
let feedCargado = false;
const pendientes = new Set(); // sueños nuevos de otros que aún no se muestran


// Fila de "historias": los soñadores que aparecen en el feed, sin repetir
const historias = document.getElementById('historias');
let miApodo = null;

function irAPublicacionDe(apodo) {
    const tarjeta = [...lista.querySelectorAll('.post-card')].find((t) => t.dataset.autor === apodo);
    if (!tarjeta) return;
    tarjeta.scrollIntoView({ behavior: 'smooth', block: 'start' });
    tarjeta.classList.add('resaltada');
    setTimeout(() => tarjeta.classList.remove('resaltada'), 1600);
}

function actualizarHistorias() {
    historias.querySelectorAll('.historia[data-autor]').forEach((h) => h.remove());
    const vistos = new Set();
    for (const tarjeta of lista.querySelectorAll('.post-card')) {
        const apodo = tarjeta.dataset.autor;
        if (!apodo || apodo === miApodo || vistos.has(apodo)) continue;
        vistos.add(apodo);
        const historia = crear('button', {
            type: 'button',
            class: 'historia',
            'data-autor': apodo,
            title: `Ver el sueño de ${apodo}`,
            onclick: () => irAPublicacionDe(apodo)
        }, crearAvatar(apodo, true), crear('span', { class: 'historia-nombre', text: apodo }));
        historias.append(historia);
        if (vistos.size >= 20) break;
    }
}

// "hace 5 minutos", "hace 2 días", etc.
const formatoRelativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
function tiempoRelativo(fecha) {
    const segundos = Math.round((new Date(fecha) - Date.now()) / 1000);
    const unidades = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unidad, duracion] of unidades) {
        if (Math.abs(segundos) >= duracion) return formatoRelativo.format(Math.round(segundos / duracion), unidad);
    }
    return 'justo ahora';
}

function buscarTarjeta(id) {
    return lista.querySelector(`.post-card[data-id="${id}"]`);
}

function revisarVacio() {
    if (lista.children.length === 0) {
        estadoFeed.hidden = false;
        estadoFeed.textContent = 'Todavía nadie ha contado un sueño. ¡Sé el primero! 🌙';
    } else {
        estadoFeed.hidden = true;
    }
    actualizarHistorias();
}

// =========================================================
// 3. DIBUJAR UNA PUBLICACIÓN
// =========================================================
function crearMedio(medio, p) {
    if (medio.tipo === 'video') {
        return crear('video', { class: 'post-media', src: medio.url, controls: '', playsinline: '', preload: 'metadata' });
    }
    const alt = medio.es_ia ? `Imagen creada por IA: ${p.titulo || 'sueño'}` : `Imagen que compartió ${p.autor}`;
    return crear('img', { class: 'post-media', src: medio.url, alt, loading: 'lazy' });
}

// Una sola imagen, o un carrusel con flechas si hay varias (la de la IA va primero)
function crearMedios(p) {
    if (!p.medios || p.medios.length === 0) return null;
    return crearCarrusel(p.medios.map((m) => ({
        elemento: crearMedio(m, p),
        etiqueta: m.es_ia ? 'Creada por IA' : 'Imagen del soñador'
    })));
}

function crearInterpretacion(p) {
    if (!p.interpretacion_ia) return null;

    const texto = crear('div', { class: 'interpretacion-texto' });
    p.interpretacion_ia.split(/\n\s*\n/).forEach((parrafo) => texto.append(crear('p', { text: parrafo.trim() })));

    const bloque = crear('div', { class: 'interpretacion-ia' },
        crear('span', { class: 'interpretacion-etiqueta' }, icono('destellos', 'icono-xs'), 'Interpretación psicológica'),
        texto
    );

    // Si es larga, se muestra recortada con un botón "Leer más"
    if (p.interpretacion_ia.length > 400) {
        texto.classList.add('colapsada');
        const boton = crear('button', {
            class: 'btn-leer-mas',
            text: 'Leer más',
            onclick: () => {
                const colapsada = texto.classList.toggle('colapsada');
                boton.textContent = colapsada ? 'Leer más' : 'Leer menos';
            }
        });
        bloque.append(boton);
    }

    bloque.append(crear('p', {
        class: 'interpretacion-nota',
        text: 'Generada por IA como reflexión personal; no sustituye la opinión de un profesional.'
    }));
    return bloque;
}

function pintarCorazon(boton, activo, total) {
    boton.dataset.activo = activo ? '1' : '0';
    boton.classList.toggle('activo', activo);
    boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
    boton.replaceChildren(icono(activo ? 'corazon-lleno' : 'corazon'), crear('span', { text: total }));
}

function pintarComentarios(boton, total) {
    boton.replaceChildren(icono('comentario'), crear('span', { text: total }));
}

function crearPublicacion(p) {
    const esMia = p.id_usuario === miId;
    const tarjeta = crear('article', {
        class: 'post-card',
        'data-id': p.id_publicacion,
        'data-estado': p.estado,
        'data-autor': p.autor
    });

    // --- Encabezado ---
    const encabezado = crear('div', { class: 'post-header' },
        crearAvatar(p.autor, true),
        crear('div', { class: 'user-info' },
            crear('h2', { text: p.autor }),
            crear('span', { class: 'time', text: tiempoRelativo(p.creado_en) })
        )
    );
    if (esMia) {
        encabezado.append(crear('button', {
            class: 'btn-borrar',
            title: 'Borrar publicación',
            'aria-label': 'Borrar publicación',
            onclick: () => borrarPublicacion(p.id_publicacion)
        }, icono('basura')));
    }
    tarjeta.append(encabezado);

    // --- Imagen (o el aviso de que se está procesando) ---
    if (p.estado === 'procesando') {
        tarjeta.append(crear('div', { class: 'post-procesando' },
            icono('destellos'), 'Oniria está interpretando tu sueño…'));
    } else if (p.estado === 'error') {
        tarjeta.append(crear('div', { class: 'post-error' },
            icono('alerta'), 'No pudimos interpretar este sueño. Puedes borrarlo e intentarlo de nuevo.'));
    }
    const medios = crearMedios(p);
    if (medios) tarjeta.append(medios);

    // --- Corazones y comentarios (solo cuando ya está lista) ---
    let seccionComentarios = null;
    if (p.estado === 'listo') {
        const btnCorazon = crear('button', {
            class: 'action-btn btn-corazon',
            title: 'Me gusta',
            onclick: () => alternarCorazon(p.id_publicacion, btnCorazon)
        });
        pintarCorazon(btnCorazon, p.di_corazon, p.total_corazones);

        seccionComentarios = crear('div', { class: 'comentarios', hidden: '' });
        const btnComentarios = crear('button', {
            class: 'action-btn btn-comentarios',
            title: 'Comentarios',
            onclick: () => abrirComentarios(p.id_publicacion, tarjeta)
        });
        pintarComentarios(btnComentarios, p.total_comentarios);

        tarjeta.append(crear('div', { class: 'post-footer' }, btnCorazon, btnComentarios));
    }

    // --- Texto del sueño e interpretación (como el pie de foto) ---
    const cuerpo = crear('div', { class: 'post-body' });
    if (p.titulo) cuerpo.append(crear('h3', { class: 'post-titulo', text: p.titulo }));
    cuerpo.append(crear('p', { class: 'sueno-texto', text: p.sueno_texto }));
    const interpretacion = crearInterpretacion(p);
    if (interpretacion) cuerpo.append(interpretacion);
    tarjeta.append(cuerpo);

    if (seccionComentarios) tarjeta.append(seccionComentarios);
    return tarjeta;
}

// Vuelve a pedir una publicación y reemplaza su tarjeta
async function refrescarPublicacion(id) {
    const tarjeta = buscarTarjeta(id);
    if (!tarjeta) return;
    try {
        const p = await api(`/api/publicaciones/${id}`);
        tarjeta.replaceWith(crearPublicacion(p));
    } catch (err) {
        if (err.status === 404) tarjeta.remove(); // ya no existe
        revisarVacio();
    }
}

// =========================================================
// 4. CARGAR EL FEED
// =========================================================
async function cargarFeed() {
    btnCargarMas.hidden = true;
    estadoFeed.hidden = false;
    estadoFeed.textContent = 'Cargando sueños…';

    try {
        const url = idMasViejo ? `/api/feed?antes=${idMasViejo}` : '/api/feed';
        const { publicaciones, hayMas } = await api(url);

        publicaciones.forEach((p) => {
            if (!buscarTarjeta(p.id_publicacion)) lista.append(crearPublicacion(p));
            idMasNuevo = Math.max(idMasNuevo, p.id_publicacion);
        });
        if (publicaciones.length > 0) idMasViejo = publicaciones[publicaciones.length - 1].id_publicacion;

        revisarVacio();
        btnCargarMas.textContent = 'Ver más sueños';
        btnCargarMas.hidden = !hayMas;
        feedCargado = true;
    } catch (err) {
        estadoFeed.textContent = err.message;
        btnCargarMas.hidden = false;
        btnCargarMas.textContent = 'Reintentar';
    }
}

btnCargarMas.addEventListener('click', cargarFeed);

// =========================================================
// 5. TIEMPO REAL (el servidor nos avisa cuando pasa algo)
// =========================================================

// Botón "✨ N sueños nuevos" (no los metemos de golpe para no mover lo que estás leyendo)
function actualizarAviso() {
    const n = pendientes.size;
    avisoNuevos.hidden = n === 0;
    avisoNuevos.replaceChildren(icono('arriba'), n === 1 ? '1 sueño nuevo' : `${n} sueños nuevos`);
}

avisoNuevos.addEventListener('click', async () => {
    const ids = [...pendientes].sort((a, b) => a - b); // del más viejo al más nuevo
    pendientes.clear();
    actualizarAviso();

    for (const id of ids) {
        if (buscarTarjeta(id)) continue;
        try {
            const p = await api(`/api/publicaciones/${id}`);
            lista.prepend(crearPublicacion(p)); // el más nuevo termina hasta arriba
            idMasNuevo = Math.max(idMasNuevo, id);
        } catch {
            // se borró mientras tanto: la ignoramos
        }
    }
    revisarVacio();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Al (re)conectar: ponernos al día con lo que pasó mientras no estábamos conectados
async function sincronizar() {
    if (!feedCargado) return;

    // Mis sueños que seguían procesando
    lista.querySelectorAll('.post-card[data-estado="procesando"]')
        .forEach((t) => refrescarPublicacion(Number(t.dataset.id)));

    // Sueños nuevos de otros
    try {
        const { publicaciones } = await api(`/api/feed?despues=${idMasNuevo}`);
        publicaciones.forEach((p) => {
            if (!buscarTarjeta(p.id_publicacion) && p.estado === 'listo') pendientes.add(p.id_publicacion);
        });
        actualizarAviso();
    } catch {
        // si falla, lo intentará en la siguiente reconexión
    }
}

const manejadores = {
    // Un sueño terminó de procesarse
    'publicacion-actualizada': ({ id_publicacion, estado }) => {
        if (buscarTarjeta(id_publicacion)) {
            refrescarPublicacion(id_publicacion); // es mío (o ya lo tenía): mostrar el resultado
        } else if (estado === 'listo') {
            pendientes.add(id_publicacion);
            actualizarAviso();
        }
    },

    'publicacion-borrada': ({ id_publicacion }) => {
        buscarTarjeta(id_publicacion)?.remove();
        pendientes.delete(id_publicacion);
        actualizarAviso();
        if (feedCargado) revisarVacio();
    },

    // Alguien dio o quitó corazón: solo cambia el número (mi corazón sigue igual)
    corazones: ({ id_publicacion, total_corazones }) => {
        const boton = buscarTarjeta(id_publicacion)?.querySelector('.btn-corazon');
        if (boton) pintarCorazon(boton, boton.dataset.activo === '1', total_corazones);
    },

    'comentario-nuevo': ({ id_publicacion, comentario, total_comentarios }) => {
        const tarjeta = buscarTarjeta(id_publicacion);
        if (!tarjeta) return;
        const boton = tarjeta.querySelector('.btn-comentarios');
        if (boton) pintarComentarios(boton, total_comentarios);
        agregarComentario(tarjeta, comentario);
    },

    'comentario-borrado': ({ id_publicacion, id_comentario, total_comentarios }) => {
        const tarjeta = buscarTarjeta(id_publicacion);
        if (!tarjeta) return;
        const boton = tarjeta.querySelector('.btn-comentarios');
        if (boton) pintarComentarios(boton, total_comentarios);
        tarjeta.querySelector(`[data-comentario="${id_comentario}"]`)?.remove();
    }
};

function conectarTiempoReal() {
    const fuente = new EventSource('/api/eventos');

    for (const [tipo, manejador] of Object.entries(manejadores)) {
        fuente.addEventListener(tipo, (e) => {
            try {
                manejador(JSON.parse(e.data));
            } catch (err) {
                console.error(`Error procesando evento ${tipo}:`, err);
            }
        });
    }

    fuente.addEventListener('open', sincronizar);

    // El navegador reconecta solo; si la conexión se cerró del todo (p. ej. la
    // sesión expiró), revisamos la sesión y volvemos a conectar.
    fuente.addEventListener('error', () => {
        if (fuente.readyState === EventSource.CLOSED) {
            setTimeout(() => api('/api/yo').then(conectarTiempoReal).catch(() => {}), 5000);
        }
    });
}

// =========================================================
// 6. ACCIONES: corazón, comentarios, borrar
// =========================================================
async function alternarCorazon(id, boton) {
    boton.disabled = true;
    try {
        const { di_corazon, total_corazones } = await api(`/api/publicaciones/${id}/corazon`, { method: 'POST' });
        pintarCorazon(boton, di_corazon, total_corazones);
        if (di_corazon) {
            boton.classList.remove('latido');
            void boton.offsetWidth; // reinicia la animación
            boton.classList.add('latido');
        }
    } catch (err) {
        alert(err.message);
    } finally {
        boton.disabled = false;
    }
}

async function borrarPublicacion(id) {
    if (!confirm('¿Borrar esta publicación? No se puede deshacer.')) return;
    try {
        await api(`/api/publicaciones/${id}`, { method: 'DELETE' });
        buscarTarjeta(id)?.remove();
        revisarVacio();
    } catch (err) {
        alert(err.message);
    }
}

function crearComentario(c, idPublicacion) {
    const item = crear('li', { class: 'comentario', 'data-comentario': c.id_comentario },
        crearAvatar(c.autor),
        crear('div', { class: 'comentario-cuerpo' },
            crear('div', { class: 'comentario-encabezado' },
                crear('strong', { text: c.autor }),
                crear('span', { class: 'time', text: tiempoRelativo(c.creado_en) })
            ),
            crear('p', { text: c.contenido })
        )
    );
    if (c.id_usuario === miId) {
        item.append(crear('button', {
            class: 'btn-borrar',
            title: 'Borrar comentario',
            'aria-label': 'Borrar comentario',
            onclick: async () => {
                if (!confirm('¿Borrar tu comentario?')) return;
                try {
                    const { total_comentarios } = await api(`/api/comentarios/${c.id_comentario}`, { method: 'DELETE' });
                    item.remove();
                    const boton = buscarTarjeta(idPublicacion)?.querySelector('.btn-comentarios');
                    if (boton) pintarComentarios(boton, total_comentarios);
                } catch (err) {
                    alert(err.message);
                }
            }
        }, icono('cerrar', 'icono-sm')));
    }
    return item;
}

// Agrega un comentario a la lista abierta (si ya está, no lo duplica)
function agregarComentario(tarjeta, comentario) {
    const listaComentarios = tarjeta.querySelector('.comentarios:not([hidden]) .comentarios-lista');
    if (!listaComentarios) return; // los comentarios están cerrados
    if (listaComentarios.querySelector(`[data-comentario="${comentario.id_comentario}"]`)) return;
    listaComentarios.append(crearComentario(comentario, Number(tarjeta.dataset.id)));
}

async function abrirComentarios(id, tarjeta) {
    const seccion = tarjeta.querySelector('.comentarios');
    // Segundo clic: cerrar
    if (!seccion.hidden) { seccion.hidden = true; return; }
    seccion.hidden = false;
    seccion.replaceChildren(crear('p', { class: 'comentarios-vacio', text: 'Cargando comentarios…' }));

    const listaComentarios = crear('ul', { class: 'comentarios-lista' });
    try {
        const comentarios = await api(`/api/publicaciones/${id}/comentarios`);
        comentarios.forEach((c) => listaComentarios.append(crearComentario(c, id)));
        pintarComentarios(tarjeta.querySelector('.btn-comentarios'), comentarios.length);
    } catch (err) {
        seccion.replaceChildren(crear('p', { class: 'comentarios-vacio', text: err.message }));
        return;
    }

    const input = crear('input', { type: 'text', maxlength: '1000', placeholder: 'Escribe un comentario…', required: '' });
    const form = crear('form', { class: 'comentario-form' }, input, crear('button', { type: 'submit', class: 'btn-enviar', text: 'Publicar' }));
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contenido = input.value.trim();
        if (!contenido) return;
        input.disabled = true;
        try {
            const { comentario, total_comentarios } = await api(`/api/publicaciones/${id}/comentarios`, {
                method: 'POST',
                body: JSON.stringify({ contenido })
            });
            agregarComentario(tarjeta, comentario);
            pintarComentarios(tarjeta.querySelector('.btn-comentarios'), total_comentarios);
            input.value = '';
        } catch (err) {
            alert(err.message);
        } finally {
            input.disabled = false;
            input.focus();
        }
    });

    seccion.replaceChildren(listaComentarios, form);
}

// =========================================================
// 7. ARRANQUE
// =========================================================
document.querySelectorAll('.js-ir-inicio').forEach((enlace) => {
    enlace.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

(async () => {
    try {
        const yo = await api('/api/yo');
        miId = yo.idUsuario;
        miApodo = yo.apodo;
        document.querySelectorAll('.js-mi-avatar').forEach((avatar) => {
            avatar.style.backgroundImage = `url("${urlAvatar(yo.apodo)}")`;
            avatar.title = yo.apodo;
        });
        document.querySelectorAll('.js-mi-apodo').forEach((el) => { el.textContent = yo.apodo; });
    } catch {
        // si falla, el feed igual intenta cargar
    }
    await cargarFeed();
    conectarTiempoReal();
})();
