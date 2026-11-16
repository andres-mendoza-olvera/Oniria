// =========================================================
// 1. TEMA CLARO / OSCURO
// =========================================================
const themeBtn = document.getElementById('theme-toggle');

// Revisar si el usuario ya había elegido un tema antes y aplicarlo al cargar la página
const temaGuardado = localStorage.getItem('vibe_tema');

if (temaGuardado === 'Oscuro') {
    document.body.classList.add('dark-theme');
    if (themeBtn) themeBtn.textContent = '🌙';
} else {
    if (themeBtn) themeBtn.textContent = '☀️';
}

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');

        if (document.body.classList.contains('dark-theme')) {
            themeBtn.textContent = '🌙';
            localStorage.setItem('vibe_tema', 'Oscuro');
        } else {
            themeBtn.textContent = '☀️';
            localStorage.setItem('vibe_tema', 'Claro');
        }
    });
}

// =========================================================
// 2. UTILIDADES
// =========================================================
const lista = document.getElementById('lista-publicaciones');
const estadoFeed = document.getElementById('estado-feed');
const btnCargarMas = document.getElementById('btn-cargar-mas');

let miId = null;            // id_usuario de quien está viendo el feed
let ultimoId = null;        // para pedir la siguiente página
const enProceso = new Map(); // id_publicacion -> intentos de revisar si ya terminó

// Crea un elemento HTML. Usamos textContent (nunca innerHTML) para que el
// texto que escriben los usuarios no se pueda ejecutar como código.
function crear(etiqueta, props = {}, ...hijos) {
    const el = document.createElement(etiqueta);
    for (const [clave, valor] of Object.entries(props)) {
        if (valor === undefined || valor === null || valor === false) continue;
        if (clave === 'class') el.className = valor;
        else if (clave === 'text') el.textContent = valor;
        else if (clave.startsWith('on')) el.addEventListener(clave.slice(2), valor);
        else el.setAttribute(clave, valor);
    }
    for (const hijo of hijos) if (hijo) el.append(hijo);
    return el;
}

// Llama a la API del servidor y devuelve el JSON (o lanza un error con mensaje)
async function api(url, opciones = {}) {
    const respuesta = await fetch(url, {
        ...opciones,
        headers: opciones.body ? { 'Content-Type': 'application/json' } : undefined
    });
    if (respuesta.status === 401) {
        window.location.href = '/'; // la sesión terminó
        throw new Error('Sesión terminada');
    }
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error || 'Ocurrió un error, intenta de nuevo.');
    return datos;
}

// Avatar automático a partir del apodo
function urlAvatar(apodo) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(apodo || 'oniria')}`;
}

function crearAvatar(apodo) {
    const avatar = crear('div', { class: 'avatar avatar-img' });
    avatar.style.backgroundImage = `url("${urlAvatar(apodo)}")`;
    return avatar;
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

// =========================================================
// 3. DIBUJAR UNA PUBLICACIÓN
// =========================================================
function crearMedio(medio, titulo) {
    if (medio.tipo === 'video') {
        return crear('video', { class: 'post-media', src: medio.url, controls: '', playsinline: '', preload: 'metadata' });
    }
    return crear('img', { class: 'post-media', src: medio.url, alt: titulo || 'Imagen del sueño', loading: 'lazy' });
}

function crearMedios(p) {
    if (!p.medios || p.medios.length === 0) return null;
    if (p.medios.length === 1) return crearMedio(p.medios[0], p.titulo);

    // Varias imágenes: carrusel que se desliza de lado
    const carrusel = crear('div', { class: 'carrusel' });
    p.medios.forEach((m) => carrusel.append(crearMedio(m, p.titulo)));
    return carrusel;
}

function crearHistoria(p) {
    if (!p.historia_ia) return null;

    const texto = crear('div', { class: 'historia-texto' });
    p.historia_ia.split(/\n\s*\n/).forEach((parrafo) => texto.append(crear('p', { text: parrafo.trim() })));

    const bloque = crear('div', { class: 'historia-ia' },
        crear('span', { class: 'historia-etiqueta', text: '📖 La historia del sueño' }),
        texto
    );

    // Si la historia es larga, se muestra recortada con un botón "Leer más"
    if (p.historia_ia.length > 400) {
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
    return bloque;
}

function crearPublicacion(p) {
    const esMia = p.id_usuario === miId;
    const tarjeta = crear('article', { class: 'post-card', 'data-id': p.id_publicacion });

    // --- Encabezado ---
    const encabezado = crear('div', { class: 'post-header' },
        crearAvatar(p.autor),
        crear('div', { class: 'user-info' },
            crear('h2', { text: p.autor }),
            crear('span', { class: 'time', text: tiempoRelativo(p.creado_en) })
        )
    );
    if (esMia) {
        encabezado.append(crear('button', {
            class: 'btn-borrar',
            title: 'Borrar publicación',
            text: '🗑️',
            onclick: () => borrarPublicacion(p.id_publicacion, tarjeta)
        }));
    }
    tarjeta.append(encabezado);

    // --- Cuerpo ---
    const cuerpo = crear('div', { class: 'post-body' });
    if (p.titulo) cuerpo.append(crear('h3', { class: 'post-titulo', text: p.titulo }));
    cuerpo.append(crear('p', { class: 'sueno-texto', text: p.sueno_texto }));

    if (p.estado === 'procesando') {
        cuerpo.append(crear('div', { class: 'post-procesando', text: '✨ Oniria está interpretando tu sueño…' }));
    } else if (p.estado === 'error') {
        cuerpo.append(crear('div', { class: 'post-error', text: '😔 No pudimos interpretar este sueño. Puedes borrarlo e intentarlo de nuevo.' }));
    }

    cuerpo.append(crearMedios(p) || '', crearHistoria(p) || '');
    tarjeta.append(cuerpo);

    // --- Corazones y comentarios (solo cuando ya está lista) ---
    if (p.estado === 'listo') {
        const btnCorazon = crear('button', {
            class: 'action-btn' + (p.di_corazon ? ' activo' : ''),
            text: `${p.di_corazon ? '❤️' : '🤍'} ${p.total_corazones}`,
            title: 'Me gusta',
            onclick: () => alternarCorazon(p.id_publicacion, btnCorazon)
        });

        const seccionComentarios = crear('div', { class: 'comentarios', hidden: '' });
        const btnComentarios = crear('button', {
            class: 'action-btn',
            text: `💬 ${p.total_comentarios}`,
            title: 'Comentarios',
            onclick: () => abrirComentarios(p.id_publicacion, seccionComentarios, btnComentarios)
        });

        tarjeta.append(crear('div', { class: 'post-footer' }, btnCorazon, btnComentarios), seccionComentarios);
    }

    return tarjeta;
}

// =========================================================
// 4. CARGAR EL FEED
// =========================================================
async function cargarFeed() {
    btnCargarMas.hidden = true;
    estadoFeed.hidden = false;
    estadoFeed.textContent = 'Cargando sueños…';

    try {
        const url = ultimoId ? `/api/feed?antes=${ultimoId}` : '/api/feed';
        const { publicaciones, hayMas } = await api(url);

        publicaciones.forEach((p) => {
            lista.append(crearPublicacion(p));
            if (p.estado === 'procesando') vigilar(p.id_publicacion);
        });
        if (publicaciones.length > 0) ultimoId = publicaciones[publicaciones.length - 1].id_publicacion;

        if (lista.children.length === 0) {
            estadoFeed.textContent = 'Todavía nadie ha contado un sueño. ¡Sé el primero! 🌙';
        } else {
            estadoFeed.hidden = true;
        }
        btnCargarMas.hidden = !hayMas;
    } catch (err) {
        estadoFeed.textContent = err.message;
        btnCargarMas.hidden = false;
        btnCargarMas.textContent = 'Reintentar';
    }
}

btnCargarMas.addEventListener('click', () => {
    btnCargarMas.textContent = 'Ver más sueños';
    cargarFeed();
});

// Mientras la IA trabaja, revisamos cada 5 segundos si la publicación ya quedó
function vigilar(id) {
    enProceso.set(id, 0);
}

setInterval(async () => {
    for (const [id, intentos] of enProceso) {
        if (intentos > 60) { enProceso.delete(id); continue; } // ~5 minutos máximo
        enProceso.set(id, intentos + 1);
        try {
            const p = await api(`/api/publicaciones/${id}`);
            if (p.estado !== 'procesando') {
                enProceso.delete(id);
                lista.querySelector(`[data-id="${id}"]`)?.replaceWith(crearPublicacion(p));
            }
        } catch {
            enProceso.delete(id); // se borró o hubo error: dejamos de revisar
        }
    }
}, 5000);

// =========================================================
// 5. ACCIONES: corazón, comentarios, borrar
// =========================================================
async function alternarCorazon(id, boton) {
    boton.disabled = true;
    try {
        const { di_corazon, total_corazones } = await api(`/api/publicaciones/${id}/corazon`, { method: 'POST' });
        boton.textContent = `${di_corazon ? '❤️' : '🤍'} ${total_corazones}`;
        boton.classList.toggle('activo', di_corazon);
    } catch (err) {
        alert(err.message);
    } finally {
        boton.disabled = false;
    }
}

async function borrarPublicacion(id, tarjeta) {
    if (!confirm('¿Borrar esta publicación? No se puede deshacer.')) return;
    try {
        await api(`/api/publicaciones/${id}`, { method: 'DELETE' });
        enProceso.delete(id);
        tarjeta.remove();
        if (lista.children.length === 0) {
            estadoFeed.hidden = false;
            estadoFeed.textContent = 'Todavía nadie ha contado un sueño. ¡Sé el primero! 🌙';
        }
    } catch (err) {
        alert(err.message);
    }
}

function crearComentario(c, alBorrar) {
    const item = crear('li', { class: 'comentario' },
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
            text: '✕',
            onclick: async () => {
                if (!confirm('¿Borrar tu comentario?')) return;
                try {
                    await api(`/api/comentarios/${c.id_comentario}`, { method: 'DELETE' });
                    item.remove();
                    alBorrar();
                } catch (err) {
                    alert(err.message);
                }
            }
        }));
    }
    return item;
}

async function abrirComentarios(id, seccion, btnComentarios) {
    // Segundo clic: cerrar
    if (!seccion.hidden) { seccion.hidden = true; return; }
    seccion.hidden = false;
    seccion.replaceChildren(crear('p', { class: 'comentarios-vacio', text: 'Cargando comentarios…' }));

    let total = 0;
    const actualizarContador = () => { btnComentarios.textContent = `💬 ${total}`; };

    const listaComentarios = crear('ul', { class: 'comentarios-lista' });
    const agregar = (c) => {
        listaComentarios.append(crearComentario(c, () => { total--; actualizarContador(); }));
    };

    try {
        const comentarios = await api(`/api/publicaciones/${id}/comentarios`);
        comentarios.forEach(agregar);
        total = comentarios.length;
        actualizarContador();
    } catch (err) {
        seccion.replaceChildren(crear('p', { class: 'comentarios-vacio', text: err.message }));
        return;
    }

    const input = crear('input', { type: 'text', maxlength: '1000', placeholder: 'Escribe un comentario…', required: '' });
    const form = crear('form', { class: 'comentario-form' }, input, crear('button', { type: 'submit', class: 'btn-publish', text: 'Enviar' }));
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contenido = input.value.trim();
        if (!contenido) return;
        input.disabled = true;
        try {
            const nuevo = await api(`/api/publicaciones/${id}/comentarios`, {
                method: 'POST',
                body: JSON.stringify({ contenido })
            });
            agregar(nuevo);
            total++;
            actualizarContador();
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
// 6. ARRANQUE
// =========================================================
// Evitar publicar dos veces por doble clic
document.getElementById('form-crear').addEventListener('submit', (e) => {
    const boton = e.target.querySelector('.btn-publish');
    boton.disabled = true;
    boton.textContent = 'Publicando…';
});

(async () => {
    try {
        const yo = await api('/api/yo');
        miId = yo.idUsuario;
        const miAvatar = document.getElementById('mi-avatar');
        miAvatar.style.backgroundImage = `url("${urlAvatar(yo.apodo)}")`;
        miAvatar.title = yo.apodo;
        const avatarCrear = document.getElementById('avatar-crear');
        avatarCrear.classList.add('avatar-img');
        avatarCrear.style.backgroundImage = `url("${urlAvatar(yo.apodo)}")`;
    } catch {
        // si falla, el feed igual intenta cargar
    }
    cargarFeed();
})();
