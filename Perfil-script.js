// =========================================================
// PERFIL Y AMIGOS
// (íconos, tema, crear(), api(), avatares, carrusel y botones de amistad vienen de Comun.js)
//   /perfil       -> mi perfil (con "Editar perfil", buscador y solicitudes)
//   /perfil/<id>  -> el perfil de otra persona (con el botón de amistad)
// =========================================================
const $ = (id) => document.getElementById(id);

const estado = {
    yo: null,         // { idUsuario, apodo, foto, solicitudes }
    perfil: null,     // el perfil que se está viendo
    esMio: false,
    idMasViejo: null, // para "Ver más" en la cuadrícula
    pestana: 'suenos'
};

// ---------------------------------------------------------
// Cabecera del perfil
// ---------------------------------------------------------
function pintarCabecera() {
    const p = estado.perfil;
    document.title = `${p.apodo} - Oniria`;
    pintarAvatar($('perfil-avatar'), p.apodo, p.foto_perfil);
    $('perfil-apodo').textContent = p.apodo;
    $('perfil-suenos').textContent = p.total_suenos;
    $('perfil-amigos').textContent = p.total_amigos;
    $('etiqueta-suenos').textContent = p.total_suenos === 1 ? 'sueño' : 'sueños';
    $('etiqueta-amigos').textContent = p.total_amigos === 1 ? 'amigo' : 'amigos';
    $('perfil-bio').textContent = p.biografia || '';
    $('titulo-amigos').textContent = estado.esMio ? 'Tus amigos' : `Amigos de ${p.apodo}`;

    // En mi perfil, si no tengo biografía, una sugerencia (solo la veo yo)
    $('perfil-privado').hidden = !(estado.esMio && !p.biografia);
    $('perfil-privado').textContent = 'Todavía no tienes biografía. Agrega una en "Editar perfil" para que los demás te conozcan.';

    const acciones = $('perfil-acciones');
    if (estado.esMio) {
        acciones.replaceChildren(crear('button', { type: 'button', class: 'btn-amistad', onclick: abrirEditar }, icono('lapiz', 'icono-sm'), 'Editar perfil'));
    } else {
        acciones.replaceChildren(crearBotonesAmistad(p, async () => {
            await recargarPerfil();
            if (estado.pestana === 'amigos') cargarAmigos();
            if (estado.pestana === 'suenos') cargarSuenos(true);
        }, { conMenu: true }));
    }

    // Si yo la bloqueé, un aviso (sus sueños no se muestran)
    if (p.amistad === 'bloqueado') {
        $('perfil-privado').hidden = false;
        $('perfil-privado').textContent = `Bloqueaste a ${p.apodo}. No ven los sueños del otro ni pueden mandarse solicitudes.`;
    }
}

async function recargarPerfil() {
    estado.perfil = await api(`/api/perfil/${estado.perfil.id_usuario}`);
    pintarCabecera();
}

// ---------------------------------------------------------
// Pestañas
// ---------------------------------------------------------
function irAPestana(nombre) {
    // "#buscar" (acceso directo del menú) = pestaña Amigos con el cursor en el buscador
    const enfocarBuscador = nombre === 'buscar';
    if (enfocarBuscador) nombre = 'amigos';
    if (!['suenos', 'amigos', 'solicitudes'].includes(nombre)) nombre = 'suenos';
    if (!estado.esMio && nombre === 'solicitudes') nombre = 'suenos';
    estado.pestana = nombre;
    document.querySelectorAll('.pestana').forEach((b) => {
        const activa = b.dataset.pestana === nombre;
        b.classList.toggle('activa', activa);
        b.setAttribute('aria-selected', activa ? 'true' : 'false');
    });
    ['suenos', 'amigos', 'solicitudes'].forEach((p) => { $(`panel-${p}`).hidden = p !== nombre; });
    history.replaceState(null, '', nombre === 'suenos' ? location.pathname : `${location.pathname}#${nombre}`);

    if (nombre === 'amigos') cargarAmigos();
    if (nombre === 'solicitudes') cargarSolicitudes();
    if (enfocarBuscador && estado.esMio) {
        $('buscar-personas').focus();
        $('buscar-personas').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
}

// Si ya estoy en /perfil y pico "Buscar amigos" en el menú, la página no se recarga: solo cambia el #
window.addEventListener('hashchange', () => { if (estado.perfil) irAPestana(location.hash.slice(1) || 'suenos'); });

document.querySelectorAll('[data-pestana]').forEach((b) => b.addEventListener('click', () => irAPestana(b.dataset.pestana)));
document.querySelectorAll('[data-ir-pestana]').forEach((b) => b.addEventListener('click', () => irAPestana(b.dataset.irPestana)));

// ---------------------------------------------------------
// Sueños (cuadrícula estilo Instagram)
// ---------------------------------------------------------
function crearMosaico(p) {
    const portada = p.medios?.[0];
    const mosaico = crear('button', {
        type: 'button',
        class: 'mosaico',
        'aria-label': `Ver el sueño "${p.titulo || 'sin título'}"`,
        onclick: () => verSueno(p)
    });
    if (portada && portada.tipo === 'imagen') {
        mosaico.append(crear('img', { src: portada.url, alt: '', loading: 'lazy' }));
    } else {
        mosaico.append(crear('span', { class: 'mosaico-texto', text: p.titulo || p.sueno_texto.slice(0, 80) }));
    }
    if ((p.medios?.length || 0) > 1) mosaico.append(crear('span', { class: 'mosaico-varias' }, icono('cuadricula')));
    mosaico.append(crear('span', { class: 'mosaico-info', 'aria-hidden': 'true' },
        crear('span', {}, icono('corazon-lleno'), String(p.total_corazones)),
        crear('span', {}, icono('comentario'), String(p.total_comentarios))
    ));
    return mosaico;
}

// desdeCero = vaciar la cuadrícula y volver a pedir (p. ej. al bloquear o desbloquear)
async function cargarSuenos(desdeCero = false) {
    if (desdeCero) {
        estado.idMasViejo = null;
        $('cuadricula').replaceChildren();
    }
    const boton = $('btn-mas-suenos');
    boton.hidden = true;
    try {
        const url = `/api/perfil/${estado.perfil.id_usuario}/suenos${estado.idMasViejo ? `?antes=${estado.idMasViejo}` : ''}`;
        const { publicaciones, hayMas } = await api(url);
        publicaciones.forEach((p) => $('cuadricula').append(crearMosaico(p)));
        if (publicaciones.length) estado.idMasViejo = publicaciones.at(-1).id_publicacion;
        boton.hidden = !hayMas;

        const vacio = $('cuadricula').children.length === 0;
        $('suenos-vacio').hidden = !vacio;
        if (vacio) {
            $('suenos-vacio').replaceChildren(estado.esMio
                ? crear('span', {}, 'Aún no has publicado sueños. ', crear('a', { href: '/sueno', class: 'enlace', text: 'Cuenta el primero' }))
                : estado.perfil.amistad === 'bloqueado'
                    ? 'No ves los sueños de las personas que bloqueaste.'
                    : `${estado.perfil.apodo} todavía no ha publicado sueños.`);
        }
    } catch (err) {
        $('suenos-vacio').hidden = false;
        $('suenos-vacio').textContent = err.message;
    }
}
$('btn-mas-suenos').addEventListener('click', cargarSuenos);

function parrafos(texto) {
    return String(texto || '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean).map((t) => crear('p', { text: t }));
}

// Ver un sueño completo en una ventana
function verSueno(p) {
    const imagenes = (p.medios || []).filter((m) => m.tipo === 'imagen').map((m) => ({
        elemento: crear('img', { class: 'post-media', src: m.url, alt: m.es_ia ? 'Imagen creada por IA' : `Imagen de ${p.autor}` }),
        etiqueta: m.es_ia ? 'Creada por IA' : 'Imagen del soñador'
    }));
    const tarjeta = crear('article', { class: 'post-card' },
        crear('div', { class: 'post-header' },
            crearAvatar(p.autor, true, p.autor_foto),
            crear('div', { class: 'user-info' },
                crear('h2', { text: p.autor }),
                crear('span', { class: 'time', text: new Date(p.creado_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) })
            )
        ),
        imagenes.length ? crearCarrusel(imagenes) : null,
        crear('div', { class: 'post-footer' },
            crear('span', { class: 'action-btn' }, icono(p.di_corazon ? 'corazon-lleno' : 'corazon'), String(p.total_corazones)),
            crear('span', { class: 'action-btn' }, icono('comentario'), String(p.total_comentarios))
        ),
        crear('div', { class: 'post-body' },
            p.titulo ? crear('h3', { class: 'post-titulo', text: p.titulo }) : null,
            crear('p', { class: 'sueno-texto', text: p.sueno_texto }),
            p.interpretacion_ia ? crear('div', { class: 'interpretacion-ia' },
                crear('span', { class: 'interpretacion-etiqueta' }, icono('destellos', 'icono-xs'), 'Interpretación psicológica'),
                crear('div', { class: 'interpretacion-texto' }, ...parrafos(p.interpretacion_ia)),
                crear('p', { class: 'interpretacion-nota', text: 'Generada por IA como reflexión personal; no sustituye la opinión de un profesional.' })
            ) : null
        )
    );
    tarjeta.querySelector('.action-btn:first-child')?.classList.toggle('activo', Boolean(p.di_corazon));
    $('dialogo-sueno-contenido').replaceChildren(tarjeta);
    $('dialogo-sueno').showModal();
}

// ---------------------------------------------------------
// Listas de personas
// ---------------------------------------------------------
function filaPersona(persona, { subtitulo, conBotones = false, alCambiar } = {}) {
    return crear('div', { class: 'persona' },
        crear('a', { class: 'persona-enlace', href: `/perfil/${persona.id_usuario}` },
            crearAvatar(persona.apodo, false, persona.foto_perfil),
            crear('span', { class: 'persona-nombre', text: persona.apodo },
                subtitulo ? crear('span', { class: 'persona-sub', text: subtitulo }) : null)
        ),
        conBotones ? crearBotonesAmistad(persona, alCambiar) : null
    );
}

function mensajeVacio(texto) {
    return crear('p', { class: 'panel-vacio', text: texto });
}

async function cargarAmigos() {
    const lista = $('lista-amigos');
    try {
        const amigos = await api(`/api/amigos/${estado.perfil.id_usuario}`);
        lista.replaceChildren(...(amigos.length
            ? amigos.map((a) => filaPersona(a))
            : [mensajeVacio(estado.esMio ? 'Aún no tienes amigos en Oniria. Búscalos por su apodo aquí arriba.' : `${estado.perfil.apodo} todavía no tiene amigos.`)]));
    } catch (err) {
        lista.replaceChildren(mensajeVacio(err.message));
    }
}

async function cargarSolicitudes() {
    try {
        const { recibidas, enviadas } = await api('/api/solicitudes');
        const alCambiar = () => { cargarSolicitudes(); actualizarYo(); recargarPerfil(); };
        $('lista-recibidas').replaceChildren(...(recibidas.length
            ? recibidas.map((p) => filaPersona({ ...p, amistad: 'recibida' }, { subtitulo: tiempoRelativo(p.creado_en), conBotones: true, alCambiar }))
            : [mensajeVacio('No tienes solicitudes nuevas.')]));
        $('lista-enviadas').replaceChildren(...(enviadas.length
            ? enviadas.map((p) => filaPersona({ ...p, amistad: 'enviada' }, { subtitulo: tiempoRelativo(p.creado_en), conBotones: true, alCambiar }))
            : [mensajeVacio('No tienes solicitudes pendientes.')]));
        const bloqueados = await api('/api/bloqueos');
        $('bloque-bloqueados').hidden = bloqueados.length === 0;
        $('lista-bloqueados').replaceChildren(...bloqueados.map((p) =>
            filaPersona({ ...p, amistad: 'bloqueado' }, { subtitulo: `Bloqueado ${tiempoRelativo(p.creado_en)}`, conBotones: true, alCambiar })));
    } catch (err) {
        $('lista-recibidas').replaceChildren(mensajeVacio(err.message));
    }
}

// "hace 5 minutos", "hace 2 días"…
const formatoRelativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
function tiempoRelativo(fecha) {
    const segundos = Math.round((new Date(fecha) - Date.now()) / 1000);
    for (const [unidad, duracion] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
        if (Math.abs(segundos) >= duracion) return formatoRelativo.format(Math.round(segundos / duracion), unidad);
    }
    return 'justo ahora';
}

// Buscador (espera a que dejes de escribir para no pedir en cada letra)
let temporizadorBusqueda = null;
let busquedaActual = 0;
$('buscar-personas').addEventListener('input', (e) => {
    clearTimeout(temporizadorBusqueda);
    const texto = e.target.value.trim();
    const resultados = $('resultados-busqueda');
    if (texto.length < 2) {
        resultados.hidden = true;
        resultados.replaceChildren();
        return;
    }
    temporizadorBusqueda = setTimeout(async () => {
        const numero = ++busquedaActual;
        try {
            const personas = await api(`/api/usuarios?buscar=${encodeURIComponent(texto)}`);
            if (numero !== busquedaActual) return; // llegó una búsqueda más nueva
            resultados.replaceChildren(...(personas.length
                ? personas.map((p) => filaPersona(p, { conBotones: true, alCambiar: () => { recargarPerfil(); cargarAmigos(); } }))
                : [mensajeVacio(`Nadie con el apodo "${texto}".`)]));
            resultados.hidden = false;
        } catch (err) {
            resultados.replaceChildren(mensajeVacio(err.message));
            resultados.hidden = false;
        }
    }, 300);
});

// ---------------------------------------------------------
// Editar perfil
// ---------------------------------------------------------
const edicion = { foto: null, urlFoto: null, quitarFoto: false };

function abrirEditar() {
    const p = estado.perfil;
    edicion.foto = null;
    edicion.quitarFoto = false;
    pintarAvatar($('editar-avatar'), p.apodo, p.foto_perfil);
    $('editar-apodo').value = p.apodo_editable || p.apodo;
    $('editar-nombre').value = p.nombre || '';
    $('editar-bio').value = p.biografia || '';
    $('editar-correo').textContent = p.email || '';
    $('btn-quitar-foto').hidden = !p.foto_perfil;
    $('error-editar').hidden = true;
    actualizarContador();
    pintarTelefono();
    $('dialogo-editar').showModal();
}

// ---------------------------------------------------------
// Teléfono: código por SMS (se guarda solo al verificar,
// no depende del botón "Guardar")
// ---------------------------------------------------------
function mensajeTelefono(texto, ok = false) {
    $('tel-mensaje').textContent = texto || '';
    $('tel-mensaje').classList.toggle('ok', ok);
    $('tel-mensaje').hidden = !texto;
}

function pintarTelefono(paso) {
    const tel = estado.perfil.telefono;
    paso = paso || (tel ? 'verificado' : 'numero');
    $('tel-verificado').hidden = paso !== 'verificado';
    $('tel-paso-numero').hidden = paso !== 'numero';
    $('tel-paso-codigo').hidden = paso !== 'codigo';
    if (tel) $('tel-numero').textContent = tel;
    if (paso !== 'codigo') mensajeTelefono('');
}

async function botonOcupado(boton, texto, tarea) {
    const original = boton.textContent;
    boton.disabled = true;
    boton.textContent = texto;
    try { await tarea(); } finally { boton.disabled = false; boton.textContent = original; }
}

$('btn-tel-enviar').addEventListener('click', () => botonOcupado($('btn-tel-enviar'), 'Enviando…', async () => {
    mensajeTelefono('');
    try {
        const r = await api('/api/telefono/enviar', { method: 'POST', body: JSON.stringify({ telefono: $('tel-input').value }) });
        $('tel-enviado').textContent = `Te mandamos un SMS con un código de 6 dígitos al ${r.telefono}. Caduca en 10 minutos.`;
        $('tel-codigo').value = '';
        pintarTelefono('codigo');
        $('tel-codigo').focus();
    } catch (err) {
        mensajeTelefono(err.message);
    }
}));

$('btn-tel-verificar').addEventListener('click', () => botonOcupado($('btn-tel-verificar'), 'Revisando…', async () => {
    mensajeTelefono('');
    try {
        const r = await api('/api/telefono/verificar', { method: 'POST', body: JSON.stringify({ codigo: $('tel-codigo').value }) });
        estado.perfil.telefono = r.telefono;
        pintarTelefono('verificado');
        mensajeTelefono('¡Listo! Tu teléfono quedó verificado.', true);
    } catch (err) {
        mensajeTelefono(err.message);
    }
}));

$('btn-tel-cambiar').addEventListener('click', () => pintarTelefono('numero'));

$('btn-tel-quitar').addEventListener('click', () => {
    if (!confirm('¿Quitar tu teléfono de Oniria?')) return;
    botonOcupado($('btn-tel-quitar'), 'Quitando…', async () => {
        try {
            await api('/api/telefono', { method: 'DELETE' });
            estado.perfil.telefono = null;
            $('tel-input').value = '';
            pintarTelefono('numero');
        } catch (err) {
            mensajeTelefono(err.message);
        }
    });
});

// "Enter" en estos campos no debe mandar el formulario de "Guardar"
$('tel-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('btn-tel-enviar').click(); }
});
$('tel-codigo').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('btn-tel-verificar').click(); }
});

function actualizarContador() {
    $('contador-bio').textContent = `${$('editar-bio').value.length}/200`;
}
$('editar-bio').addEventListener('input', actualizarContador);

// Recorta la foto en cuadrado (del centro) y la reduce a 512 px antes de subirla
async function fotoCuadrada(archivo) {
    const bitmap = await createImageBitmap(archivo);
    const lado = Math.min(bitmap.width, bitmap.height);
    const tamano = Math.min(512, lado);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = tamano;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, tamano, tamano);
    ctx.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, tamano, tamano);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) throw new Error('No se pudo procesar la foto.');
    return new File([blob], 'perfil.jpg', { type: 'image/jpeg' });
}

$('input-foto').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    $('error-editar').hidden = true;
    try {
        edicion.foto = await fotoCuadrada(archivo);
        edicion.quitarFoto = false;
        if (edicion.urlFoto) URL.revokeObjectURL(edicion.urlFoto);
        edicion.urlFoto = URL.createObjectURL(edicion.foto);
        $('editar-avatar').style.backgroundImage = `url("${edicion.urlFoto}")`;
        $('btn-quitar-foto').hidden = false;
    } catch {
        $('error-editar').textContent = 'No pude abrir esa imagen. Prueba con una JPG o PNG.';
        $('error-editar').hidden = false;
    }
});

$('btn-quitar-foto').addEventListener('click', () => {
    edicion.foto = null;
    edicion.quitarFoto = true;
    pintarAvatar($('editar-avatar'), $('editar-apodo').value || estado.perfil.apodo, null);
    $('btn-quitar-foto').hidden = true;
});

$('form-editar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = $('btn-guardar');
    const datos = new FormData();
    datos.append('apodo', $('editar-apodo').value.trim());
    datos.append('nombre', $('editar-nombre').value.trim());
    datos.append('biografia', $('editar-bio').value.trim());
    if (edicion.foto) datos.append('foto', edicion.foto);
    if (edicion.quitarFoto) datos.append('quitar_foto', '1');

    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
        await api('/api/perfil', { method: 'PUT', body: datos });
        $('dialogo-editar').close();
        await Promise.all([recargarPerfil(), actualizarYo()]);
    } catch (err) {
        $('error-editar').textContent = err.message;
        $('error-editar').hidden = false;
    } finally {
        boton.disabled = false;
        boton.textContent = 'Guardar';
    }
});

// Cerrar ventanas con su botón o haciendo clic fuera
document.querySelectorAll('.dialogo').forEach((dialogo) => {
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
    dialogo.querySelectorAll('.js-cerrar-dialogo').forEach((b) => b.addEventListener('click', () => dialogo.close()));
});

// ---------------------------------------------------------
// Tiempo real: si alguien me manda / acepta una solicitud
// ---------------------------------------------------------
async function actualizarYo() {
    estado.yo = await api('/api/yo');
    pintarMiPerfil(estado.yo);
}

function conectarTiempoReal() {
    const fuente = new EventSource('/api/eventos');
    fuente.addEventListener('amistad', async (e) => {
        const { usuarios } = JSON.parse(e.data);
        await actualizarYo().catch(() => {});
        if (estado.esMio && estado.pestana === 'solicitudes') cargarSolicitudes();
        if (usuarios.includes(estado.perfil.id_usuario) || estado.esMio) {
            recargarPerfil().catch(() => {});
            if (estado.pestana === 'amigos') cargarAmigos();
        }
    });
}

// ---------------------------------------------------------
// Arranque
// ---------------------------------------------------------
(async () => {
    try {
        await actualizarYo();
        const idEnRuta = Number(location.pathname.split('/')[2]) || null;
        const id = idEnRuta || estado.yo.idUsuario;
        estado.esMio = id === estado.yo.idUsuario;

        // "Mi perfil" queda marcado en el menú solo cuando es el mío
        document.querySelectorAll('.js-menu-perfil').forEach((m) => m.classList.toggle('activo', estado.esMio));
        document.querySelectorAll('.js-solo-mio').forEach((el) => { el.hidden = !estado.esMio; });

        estado.perfil = await api(`/api/perfil/${id}`);
        pintarCabecera();
        $('estado-perfil').hidden = true;
        $('perfil').hidden = false;
        $('pestanas').hidden = false;

        cargarSuenos();
        irAPestana(location.hash.slice(1) || 'suenos');
        conectarTiempoReal();
    } catch (err) {
        $('estado-perfil').textContent = err.status === 404 ? 'Este perfil no existe.' : err.message;
    }
})();
