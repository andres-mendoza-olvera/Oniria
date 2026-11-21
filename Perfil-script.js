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
    // Lo que quedó escrito en el teléfono la vez pasada se descarta
    $('tel-input').value = '';
    $('tel-codigo').value = '';
    elegirPais(PAISES[0], { enfocar: false });
    pintarTelefono();
    $('dialogo-editar').showModal();
}

// ---------------------------------------------------------
// Teléfono: código por SMS (se guarda solo al verificar,
// no depende del botón "Guardar")
// ---------------------------------------------------------
// Países del selector: [código ISO, nombre, lada, dígitos del número (sin lada), ejemplo]
// México va primero porque es el de casi todos.
const PAISES = [
    ['mx', 'México', '52', 10, '55 1234 5678'],
    ['us', 'Estados Unidos', '1', 10, '201 555 0123'],
    ['ca', 'Canadá', '1', 10, '204 555 0123'],
    ['gt', 'Guatemala', '502', 8, '5123 4567'],
    ['sv', 'El Salvador', '503', 8, '7012 3456'],
    ['hn', 'Honduras', '504', 8, '9123 4567'],
    ['ni', 'Nicaragua', '505', 8, '8123 4567'],
    ['cr', 'Costa Rica', '506', 8, '8312 3456'],
    ['pa', 'Panamá', '507', 8, '6123 4567'],
    ['cu', 'Cuba', '53', 8, '5123 4567'],
    ['do', 'República Dominicana', '1', 10, '809 234 5678'],
    ['pr', 'Puerto Rico', '1', 10, '787 234 5678'],
    ['co', 'Colombia', '57', 10, '321 123 4567'],
    ['ve', 'Venezuela', '58', 10, '412 123 4567'],
    ['ec', 'Ecuador', '593', 9, '99 123 4567'],
    ['pe', 'Perú', '51', 9, '912 345 678'],
    ['bo', 'Bolivia', '591', 8, '7123 4567'],
    ['cl', 'Chile', '56', 9, '9 6123 4567'],
    ['ar', 'Argentina', '54', 11, '9 11 2345 6789'],
    ['uy', 'Uruguay', '598', 8, '9412 3456'],
    ['py', 'Paraguay', '595', 9, '961 456 789'],
    ['br', 'Brasil', '55', 11, '11 96123 4567'],
    ['es', 'España', '34', 9, '612 34 56 78'],
    ['fr', 'Francia', '33', 9, '6 12 34 56 78'],
    ['de', 'Alemania', '49', 11, '1512 3456789'],
    ['it', 'Italia', '39', 10, '312 345 6789'],
    ['gb', 'Reino Unido', '44', 10, '7400 123456'],
    ['pt', 'Portugal', '351', 9, '912 345 678'],
    ['jp', 'Japón', '81', 10, '90 1234 5678'],
    ['cn', 'China', '86', 11, '131 2345 6789'],
    ['kr', 'Corea del Sur', '82', 10, '10 2345 6789']
].map(([iso, nombre, lada, digitos, ejemplo]) => ({ iso, nombre, lada, digitos, ejemplo }));

const urlBandera = (iso) => `https://flagcdn.com/w40/${iso}.png`;
let paisElegido = PAISES[0];

function elegirPais(pais, { enfocar = true } = {}) {
    paisElegido = pais;
    $('pais-bandera').src = urlBandera(pais.iso);
    $('pais-bandera').alt = pais.nombre;
    $('pais-lada').textContent = `+${pais.lada}`;
    $('btn-pais').title = pais.nombre;
    $('tel-input').placeholder = pais.ejemplo;
    $('tel-input').maxLength = pais.digitos + 6; // deja lugar para espacios
    $('tel-ayuda').textContent = `Escribe tu número de ${pais.digitos} dígitos, sin la lada (+${pais.lada}).`;
    cerrarPaises();
    if (enfocar) $('tel-input').focus();
}

function pintarPaises(filtro = '') {
    const texto = filtro.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^\+/, '');
    const visibles = PAISES.filter((p) => !texto
        || p.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(texto)
        || p.lada.startsWith(texto));
    $('pais-lista').replaceChildren(...(visibles.length ? visibles.map((p) => {
        const item = crear('li', {
            role: 'option', tabindex: '-1', class: 'pais-item',
            'aria-selected': p === paisElegido ? 'true' : 'false'
        },
            crear('img', { class: 'bandera', src: urlBandera(p.iso), alt: '', width: '22', height: '16', loading: 'lazy' }),
            crear('span', { class: 'pais-nombre', text: p.nombre }),
            crear('span', { class: 'pais-codigo', text: `+${p.lada}` }));
        item.addEventListener('click', () => elegirPais(p));
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegirPais(p); }
        });
        return item;
    }) : [crear('li', { class: 'pais-vacio', text: 'Sin resultados' })]));
}

function abrirPaises() {
    $('pais-buscar').value = '';
    pintarPaises();
    $('pais-menu').hidden = false;
    $('btn-pais').setAttribute('aria-expanded', 'true');
    $('pais-buscar').focus();
    $('pais-lista').querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

function cerrarPaises() {
    $('pais-menu').hidden = true;
    $('btn-pais').setAttribute('aria-expanded', 'false');
}

$('btn-pais').addEventListener('click', () => ($('pais-menu').hidden ? abrirPaises() : cerrarPaises()));
$('pais-buscar').addEventListener('input', (e) => pintarPaises(e.target.value));
$('pais-buscar').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { // Enter elige el primero de la lista
        e.preventDefault();
        $('pais-lista').querySelector('.pais-item')?.click();
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        $('pais-lista').querySelector('.pais-item')?.focus();
    }
});
$('pais-lista').addEventListener('keydown', (e) => {
    const actual = document.activeElement;
    if (e.key === 'ArrowDown') { e.preventDefault(); actual.nextElementSibling?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (actual.previousElementSibling || $('pais-buscar')).focus(); }
});
$('pais-selector').addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('pais-menu').hidden) {
        e.preventDefault();
        e.stopPropagation(); // que Escape no cierre toda la ventana de "Editar perfil"
        cerrarPaises();
        $('btn-pais').focus();
    }
});
document.addEventListener('click', (e) => {
    if (!$('pais-menu').hidden && !$('pais-selector').contains(e.target)) cerrarPaises();
});

// Si pegan el número completo con "+lada", se elige el país solo y se deja el resto
$('tel-input').addEventListener('input', (e) => {
    const valor = e.target.value;
    if (!valor.trim().startsWith('+')) return;
    const digitos = valor.replace(/\D/g, '');
    const pais = paisDeNumero('+' + digitos);
    if (pais) {
        elegirPais(pais, { enfocar: false });
        let resto = digitos.slice(pais.lada.length);
        if (pais.iso === 'mx' && resto.length === 11 && resto.startsWith('1')) resto = resto.slice(1); // el "1" viejo de celulares
        e.target.value = resto;
    }
});

// El país de un número completo (+52...): la lada más larga que coincida.
// Para la lada +1 se queda con el país que ya estaba elegido si también es +1.
function paisDeNumero(numero) {
    const digitos = String(numero || '').replace(/\D/g, '');
    const candidatos = PAISES.filter((p) => digitos.startsWith(p.lada)).sort((a, b) => b.lada.length - a.lada.length);
    if (!candidatos.length) return null;
    const mejor = candidatos.filter((p) => p.lada === candidatos[0].lada);
    return mejor.find((p) => p === paisElegido) || mejor[0];
}

// Número completo para mandar al servidor: +lada + número
function numeroCompleto() {
    let digitos = $('tel-input').value.replace(/\D/g, '');
    if (digitos.startsWith(paisElegido.lada) && digitos.length > paisElegido.digitos) digitos = digitos.slice(paisElegido.lada.length);
    return digitos ? `+${paisElegido.lada}${digitos}` : '';
}

elegirPais(PAISES[0], { enfocar: false });

function mensajeTelefono(texto, ok = false) {
    $('tel-mensaje').textContent = texto || '';
    $('tel-mensaje').classList.toggle('ok', ok);
    $('tel-mensaje').hidden = !texto;
}

function pintarTelefono(paso) {
    const tel = estado.perfil.telefono;
    paso = paso || (tel ? 'verificado' : 'numero');
    $('telefono').classList.remove('pendiente');
    $('tel-verificado').hidden = paso !== 'verificado';
    $('tel-paso-numero').hidden = paso !== 'numero';
    $('tel-paso-codigo').hidden = paso !== 'codigo';
    if (tel) {
        // "+52 55 1234 5678" con su bandera
        const pais = paisDeNumero(tel);
        const nacional = pais ? tel.slice(pais.lada.length + 1) : tel;
        const bonito = nacional.length === 10 ? nacional.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1 $2 $3') : nacional;
        $('tel-numero').textContent = pais ? `+${pais.lada} ${bonito}` : tel;
        $('tel-bandera').hidden = !pais;
        if (pais) { $('tel-bandera').src = urlBandera(pais.iso); $('tel-bandera').alt = pais.nombre; }
    }
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
        const telefono = numeroCompleto();
        if (!telefono) throw new Error('Escribe tu número de teléfono.');
        const r = await api('/api/telefono/enviar', { method: 'POST', body: JSON.stringify({ telefono }) });
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

// Cancelar: se olvida el número escrito y vuelve como estaba (con o sin teléfono verificado)
$('btn-tel-cancelar').addEventListener('click', () => {
    $('tel-input').value = '';
    $('tel-codigo').value = '';
    $('telefono').classList.remove('pendiente');
    pintarTelefono();
});

// ¿Dejó la verificación del teléfono a medias?
//   - ya pidió el código pero no lo ha verificado, o
//   - escribió un número pero no pidió el código
function telefonoAMedias() {
    if (!$('tel-paso-codigo').hidden) {
        return 'Te falta verificar tu teléfono: escribe el código que te llegó por SMS y pica "Verificar", o pica "Cancelar verificación".';
    }
    if (!$('tel-paso-numero').hidden && $('tel-input').value.replace(/\D/g, '')) {
        return 'Escribiste un teléfono pero no lo has verificado. Pica "Enviarme un código por SMS" o borra el número.';
    }
    return null;
}

// Al corregir algo en el teléfono se quita el resaltado rojo
['tel-input', 'tel-codigo'].forEach((id) => $(id).addEventListener('input', () => $('telefono').classList.remove('pendiente')));

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
    // No se guarda con la verificación del teléfono a medias
    const pendiente = telefonoAMedias();
    if (pendiente) {
        mensajeTelefono(pendiente);
        $('telefono').classList.add('pendiente');
        $('telefono').scrollIntoView({ block: 'center', behavior: 'smooth' });
        (!$('tel-paso-codigo').hidden ? $('tel-codigo') : $('tel-input')).focus({ preventScroll: true });
        return;
    }
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
