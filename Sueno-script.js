// =========================================================
// CHAT DEL SUEÑO
// (íconos, tema, crear(), api(), crearAvatar() y crearCarrusel() vienen de Comun.js)
//
// Cada conversación se guarda en el perfil (solo la ve su dueño):
//   /sueno       -> empieza un sueño nuevo (se guarda cuando la IA lo interpreta)
//   /sueno?c=ID  -> retoma esa conversación
// "Publicar" la manda al feed (y queda de solo lectura); "Eliminar" la borra.
// =========================================================
const MAX_IMAGENES = 3;

const listaMensajes = document.getElementById('mensajes');
const bienvenida = document.getElementById('bienvenida');
const estadoBot = document.getElementById('estado-bot');
const form = document.getElementById('form-chat');
const textarea = document.getElementById('texto');
const btnEnviar = document.getElementById('btn-enviar');
const btnMicrofono = document.getElementById('btn-microfono');
const inputImagenes = document.getElementById('input-imagenes');
const etiquetaAdjuntar = inputImagenes.closest('label');
const contenedorAdjuntos = document.getElementById('adjuntos');
const errorChat = document.getElementById('error-chat');
const acciones = document.getElementById('acciones');
const btnPublicar = document.getElementById('btn-publicar');
const btnDescartar = document.getElementById('btn-descartar');
const vistaPrevia = document.getElementById('vista-previa');
const avisoPublicada = document.getElementById('aviso-publicada');

const estado = {
    yo: null,          // { idUsuario, apodo }
    borrador: null,    // la conversación en curso: { id, titulo, relato, interpretacion, imagenIA, imagenes[], publicada }
    adjuntos: [],      // imágenes elegidas que aún no se envían: { archivo, url }
    enviando: false,
    oniriaActivo: false // el modelo propio (beta) está encendido y disponible: sus respuestas tardan 1-4 min
};

// ---------------------------------------------------------
// Utilidades de la interfaz
// ---------------------------------------------------------
function mostrarError(mensaje) {
    errorChat.textContent = mensaje || '';
    errorChat.hidden = !mensaje;
}

function bajarAlFinal() {
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
}

function ajustarAltura() {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
}

function parrafos(texto) {
    // Los saltos de línea dentro de un párrafo se respetan (p. ej. la lista de teléfonos de ayuda, uno por línea)
    return String(texto || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
        .map((p) => crear('p', { text: p, class: p.includes('\n') ? 'con-saltos' : '' }));
}

// URL (en Storage) de una imagen de la conversación: 'ia' o el número de imagen del usuario
function urlImagenBorrador(cual) {
    return cual === 'ia' ? estado.borrador?.imagenIA : estado.borrador?.imagenes?.[cual];
}

function imagenesDisponibles() {
    return MAX_IMAGENES - (estado.borrador?.imagenes?.length || 0) - estado.adjuntos.length;
}

// Actualiza botones y textos según haya o no un sueño en curso
function actualizarInterfaz() {
    const hayBorrador = Boolean(estado.borrador);
    const publicada = Boolean(estado.borrador?.publicada);
    // Publicada: se puede seguir platicando (en privado), pero ya no hay botones de publicar/eliminar
    acciones.hidden = !hayBorrador || publicada;
    form.hidden = false;
    avisoPublicada.hidden = !publicada;
    document.getElementById('btn-nuevo').hidden = !hayBorrador;
    bienvenida.hidden = listaMensajes.children.length > 0;
    textarea.placeholder = hayBorrador ? 'Pregunta o cuenta más…' : '¿Qué soñaste?';
    btnEnviar.disabled = estado.enviando;
    btnPublicar.disabled = estado.enviando;
    btnDescartar.disabled = estado.enviando;
    etiquetaAdjuntar.classList.toggle('desactivado', imagenesDisponibles() <= 0 || estado.enviando);
    estadoBot.textContent = estado.enviando ? 'escribiendo…' : 'Intérprete de sueños';
    estadoBot.classList.toggle('escribiendo', estado.enviando);
}

// ---------------------------------------------------------
// Dibujar mensajes
// ---------------------------------------------------------
function mensajeUsuario(texto, urlsImagenes) {
    const li = crear('li', { class: 'mensaje usuario' });
    if (urlsImagenes.length) {
        const fotos = crear('div', { class: 'mensaje-imagenes' });
        urlsImagenes.forEach((url) => fotos.append(crear('img', { src: url, alt: 'Imagen que adjuntaste' })));
        li.append(fotos);
    }
    if (texto) li.append(crear('div', { class: 'burbuja', text: texto }));
    return li;
}

// Etiqueta "Beta" para las respuestas del modelo propio de Oniria
function insigniaBeta() {
    return crear('span', { class: 'insignia-beta', title: 'Respuesta de Oniria, nuestro modelo propio. Está en fase beta: puede equivocarse.' },
        icono('destellos', 'icono-xs'),
        crear('span', { class: 'insignia-beta-texto' }, 'Oniria ', crear('b', { text: 'Beta' })));
}

function mensajeIA(m) {
    const li = crear('li', { class: 'mensaje ia' });
    const avatar = crear('div', { class: 'bot-avatar chico', 'aria-hidden': 'true' }, icono('destellos'));

    // Primera respuesta: título, imagen creada por la IA e interpretación
    if (m.tipo === 'interpretacion') {
        const burbuja = crear('div', { class: 'burbuja interpretacion' });
        if (m.imagenIA) {
            burbuja.append(crear('img', { class: 'imagen-ia', src: urlImagenBorrador('ia'), alt: `Imagen creada por IA: ${m.titulo || 'tu sueño'}` }));
        }
        const contenido = crear('div', { class: 'contenido' });
        if (m.titulo) contenido.append(crear('h3', { class: 'interpretacion-titulo', text: m.titulo }));
        // Con el modelo propio, este primer mensaje es la "primera lectura" (análisis + preguntas);
        // la interpretación completa llega cuando la persona responde o pide verla.
        const primeraLectura = m.motor === 'oniria';
        if (!m.imagenIA) {
            contenido.append(crear('p', { class: 'sin-imagen', text: primeraLectura
                ? 'No pude crear la imagen esta vez.'
                : 'No pude crear la imagen esta vez, pero aquí está la interpretación.' }));
        }
        contenido.append(
            crear('span', { class: 'interpretacion-etiqueta' }, icono('destellos', 'icono-xs'), primeraLectura ? 'Primera lectura' : 'Interpretación psicológica'),
            ...(primeraLectura ? [insigniaBeta()] : []),
            ...parrafos(m.texto)
        );
        if (primeraLectura) {
            contenido.append(crear('button', {
                type: 'button', class: 'btn-ver-interpretacion',
                title: 'Oniria te da su interpretación sin que respondas las preguntas',
                onclick: () => { if (estado.enviando) return; textarea.value = 'omitir'; enviar(); }
            }, icono('destellos', 'icono-xs'), 'Ver la interpretación completa'));
        }
        // Lo que Oniria recordó de sueños anteriores (privado: no se publica en el feed)
        if (m.conexion) {
            contenido.append(crear('div', { class: 'memoria-conexion' },
                crear('span', { class: 'interpretacion-etiqueta' }, icono('luna', 'icono-xs'), 'Recordando tus sueños anteriores'),
                ...parrafos(m.conexion),
                crear('a', { class: 'memoria-enlace', href: '/perfil#memoria', text: 'Solo tú ves esto · Ver, borrar o apagar tu memoria' })));
        }
        burbuja.append(contenido);
        li.append(avatar, burbuja);
        return li;
    }

    // Respuestas siguientes
    const burbuja = crear('div', { class: 'burbuja' }, ...(m.motor === 'oniria' ? [insigniaBeta()] : []), ...parrafos(m.texto));
    if (m.relatoActualizado || m.interpretacionActualizada) {
        const cambios = crear('div', { class: 'cambios' });
        if (m.relatoActualizado) cambios.append(crear('span', { class: 'cambio' }, icono('check', 'icono-xs'), 'Detalles agregados a tu relato'));
        if (m.interpretacionActualizada) cambios.append(crear('span', { class: 'cambio' }, icono('destellos', 'icono-xs'), 'Interpretación actualizada'));
        burbuja.append(cambios);
    }
    li.append(avatar, burbuja);
    return li;
}

function mensajeEscribiendo(primero, lenta = false) {
    // "lenta" = responde el modelo propio de Oniria, que tarda de 1 a 4 minutos
    const texto = lenta
        ? 'Oniria está leyendo tu sueño con calma. Puede tardar de 1 a 4 minutos; no cierres esta página.'
        : primero ? 'Interpretando tu sueño y creando su imagen…' : 'Pensando…';
    return crear('li', { class: 'mensaje ia', id: 'escribiendo' },
        crear('div', { class: 'bot-avatar chico', 'aria-hidden': 'true' }, icono('destellos')),
        crear('div', { class: 'burbuja escribiendo-burbuja' },
            crear('span', { class: 'puntos' }, crear('span'), crear('span'), crear('span')),
            texto
        )
    );
}

// Reconstruye la conversación guardada en el servidor (al recargar la página)
function pintarConversacion(mensajes) {
    listaMensajes.replaceChildren();
    for (const m of mensajes) {
        if (m.rol === 'usuario') listaMensajes.append(mensajeUsuario(m.texto, (m.imagenes || []).map(urlImagenBorrador)));
        else listaMensajes.append(mensajeIA(m));
    }
    quitarBotonesInterpretacion(true);
}

// El botón "Ver la interpretación completa" solo tiene sentido mientras la primera lectura
// sea el último mensaje; en cuanto hay otra respuesta, se quita.
function quitarBotonesInterpretacion(soloLosViejos = false) {
    const botones = [...listaMensajes.querySelectorAll('.btn-ver-interpretacion')];
    (soloLosViejos ? botones.filter((b) => b.closest('.mensaje') !== listaMensajes.lastElementChild) : botones).forEach((b) => b.remove());
}

// ---------------------------------------------------------
// Imágenes adjuntas
// ---------------------------------------------------------
// Las fotos de celular pesan mucho: las reducimos a 1600 px antes de subirlas
async function prepararImagen(archivo) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) return archivo; // HEIC se manda tal cual
    try {
        const bitmap = await createImageBitmap(archivo);
        const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        if (escala === 1 && archivo.size < 1.5 * 1024 * 1024) return archivo;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * escala);
        canvas.height = Math.round(bitmap.height * escala);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // fondo blanco por si el PNG es transparente
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolver) => canvas.toBlob(resolver, 'image/jpeg', 0.85));
        if (!blob) return archivo;
        return new File([blob], archivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
        return archivo;
    }
}

// Aviso al adjuntar imágenes: el modelo propio todavía no lee imágenes
const avisoImagenes = crear('p', { id: 'aviso-imagenes', class: 'aviso-imagenes', role: 'note', hidden: true },
    icono('destellos', 'icono-xs'),
    crear('span', { text: 'Oniria está en desarrollo y aún no cuenta con un modelo especializado en leer imágenes, '
        + 'por lo que puede equivocarse al interpretarlas. Cuéntanos también tu sueño con palabras: ayuda mucho.' }));
avisoImagenes.hidden = true;
contenedorAdjuntos.before(avisoImagenes);

function pintarAdjuntos() {
    avisoImagenes.hidden = estado.adjuntos.length === 0;
    contenedorAdjuntos.replaceChildren(...estado.adjuntos.map((adjunto, i) =>
        crear('div', { class: 'adjunto' },
            crear('img', { src: adjunto.url, alt: `Imagen adjunta ${i + 1}` }),
            crear('button', {
                type: 'button',
                'aria-label': 'Quitar imagen',
                onclick: () => {
                    URL.revokeObjectURL(adjunto.url);
                    estado.adjuntos.splice(i, 1);
                    pintarAdjuntos();
                }
            }, icono('cerrar'))
        )
    ));
    contenedorAdjuntos.hidden = estado.adjuntos.length === 0;
    actualizarInterfaz();
}

inputImagenes.addEventListener('change', async () => {
    mostrarError('');
    const elegidos = [...inputImagenes.files];
    inputImagenes.value = ''; // para poder elegir la misma imagen otra vez
    const lugares = imagenesDisponibles();
    if (elegidos.length > lugares) {
        mostrarError(lugares > 0
            ? `Solo puedes agregar ${lugares} imagen${lugares === 1 ? '' : 'es'} más (máximo ${MAX_IMAGENES} por sueño).`
            : `Ya llegaste al máximo de ${MAX_IMAGENES} imágenes por sueño.`);
    }
    for (const original of elegidos.slice(0, Math.max(lugares, 0))) {
        const archivo = await prepararImagen(original);
        if (archivo.size > 5 * 1024 * 1024) {
            mostrarError('Cada imagen debe pesar menos de 5 MB.');
            continue;
        }
        estado.adjuntos.push({ archivo, url: URL.createObjectURL(archivo) });
    }
    pintarAdjuntos();
});

// ---------------------------------------------------------
// Micrófono (dictado por voz con el reconocimiento del navegador)
// ---------------------------------------------------------
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
let dictado = null;

function detenerDictado() {
    if (dictado) dictado.stop();
}

function pintarMicrofono(grabando) {
    btnMicrofono.classList.toggle('grabando', grabando);
    btnMicrofono.setAttribute('aria-pressed', grabando ? 'true' : 'false');
    btnMicrofono.title = grabando ? 'Detener el dictado' : 'Dictar con el micrófono';
    btnMicrofono.replaceChildren(icono(grabando ? 'detener' : 'microfono'));
}

if (Reconocimiento) {
    btnMicrofono.hidden = false;
    btnMicrofono.addEventListener('click', () => {
        if (dictado) return detenerDictado();
        mostrarError('');

        const rec = new Reconocimiento();
        rec.lang = 'es-MX';
        rec.continuous = true;
        rec.interimResults = true;

        // Lo dictado se agrega después de lo que ya estaba escrito
        let base = textarea.value;
        if (base && !/\s$/.test(base)) base += ' ';

        rec.onresult = (e) => {
            let texto = '';
            for (const resultado of e.results) texto += resultado[0].transcript;
            textarea.value = (base + texto).slice(0, 2000);
            ajustarAltura();
        };
        rec.onerror = (e) => {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                mostrarError('No tengo permiso para usar el micrófono. Actívalo en la configuración del navegador.');
            } else if (e.error === 'network') {
                mostrarError('El dictado necesita conexión a internet.');
            } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
                mostrarError('No pude escucharte bien. Intenta de nuevo.');
            }
        };
        rec.onend = () => {
            dictado = null;
            pintarMicrofono(false);
            textarea.focus();
        };

        try {
            rec.start();
            dictado = rec;
            pintarMicrofono(true);
        } catch {
            mostrarError('No se pudo iniciar el micrófono.');
        }
    });
}

// ---------------------------------------------------------
// Enviar un mensaje
// ---------------------------------------------------------
async function enviar() {
    if (estado.enviando) return;
    detenerDictado();
    mostrarError('');

    const texto = textarea.value.trim();
    const adjuntos = [...estado.adjuntos];
    if (!texto && adjuntos.length === 0) return;
    if (!estado.borrador && !texto) {
        return mostrarError('Cuéntame tu sueño con palabras; las imágenes lo acompañan.');
    }

    const datos = new FormData();
    datos.append('texto', texto);
    if (estado.borrador) datos.append('conversacion', estado.borrador.id);
    adjuntos.forEach((a) => datos.append('imagenes', a.archivo, a.archivo.name));

    quitarBotonesInterpretacion();
    // Mostrar el mensaje de inmediato y limpiar la caja
    const esPrimero = !estado.borrador;
    const burbujaUsuario = mensajeUsuario(texto, adjuntos.map((a) => a.url));
    listaMensajes.append(burbujaUsuario);
    // Con el modelo propio (y sin imágenes) las respuestas de las dos primeras vueltas tardan minutos
    const turnosPrevios = listaMensajes.querySelectorAll('.mensaje.usuario').length;
    const lenta = estado.oniriaActivo && adjuntos.length === 0 && (esPrimero || (estado.borrador?.motor === 'oniria' && turnosPrevios === 1));
    const escribiendo = mensajeEscribiendo(esPrimero, lenta);
    listaMensajes.append(escribiendo);
    textarea.value = '';
    ajustarAltura();
    estado.adjuntos = [];
    contenedorAdjuntos.replaceChildren();
    contenedorAdjuntos.hidden = true;
    estado.enviando = true;
    actualizarInterfaz();
    bajarAlFinal();

    try {
        const { mensaje, conversacion } = await api('/api/sueno/mensaje', { method: 'POST', body: datos });
        if (conversacion) {
            estado.borrador = conversacion;
            // La dirección queda como /sueno?c=ID: al recargar (o desde el perfil) se retoma
            if (esPrimero) history.replaceState(null, '', `/sueno?c=${conversacion.id}`);
        }
        escribiendo.replaceWith(mensajeIA(mensaje));
        mostrarOpinion();
    } catch (err) {
        // Regresamos el texto y las imágenes para que pueda intentarlo otra vez
        escribiendo.remove();
        burbujaUsuario.remove();
        if (!textarea.value) textarea.value = texto;
        ajustarAltura();
        estado.adjuntos = adjuntos;
        pintarAdjuntos();
        mostrarError(err.message);
    } finally {
        estado.enviando = false;
        actualizarInterfaz();
        bajarAlFinal();
        revisarEstadoIA();
    }
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    enviar();
});

// En computadora, Enter envía y Shift+Enter hace un salto de línea
textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer: fine)').matches) {
        e.preventDefault();
        enviar();
    }
});
textarea.addEventListener('input', ajustarAltura);

// ---------------------------------------------------------
// Publicar o descartar
// ---------------------------------------------------------
function construirVistaPrevia() {
    const b = estado.borrador;
    const imagenes = [];
    if (b.imagenIA) {
        imagenes.push({ elemento: crear('img', { class: 'post-media', src: b.imagenIA, alt: 'Imagen creada por IA' }), etiqueta: 'Creada por IA' });
    }
    for (const url of b.imagenes) {
        imagenes.push({ elemento: crear('img', { class: 'post-media', src: url, alt: 'Tu imagen' }), etiqueta: 'Tu imagen' });
    }

    const tarjeta = crear('article', { class: 'post-card' },
        crear('div', { class: 'post-header' },
            crearAvatar(estado.yo?.apodo, true, estado.yo?.foto),
            crear('div', { class: 'user-info' },
                crear('h2', { text: estado.yo?.apodo || 'Tú' }),
                crear('span', { class: 'time', text: 'justo ahora' })
            )
        ),
        imagenes.length ? crearCarrusel(imagenes) : null,
        crear('div', { class: 'post-body' },
            b.titulo ? crear('h3', { class: 'post-titulo', text: b.titulo }) : null,
            crear('p', { class: 'sueno-texto', text: b.relato }),
            crear('div', { class: 'interpretacion-ia' },
                crear('span', { class: 'interpretacion-etiqueta' }, icono('destellos', 'icono-xs'), 'Interpretación psicológica'),
                crear('div', { class: 'interpretacion-texto' }, ...parrafos(b.interpretacion))
            )
        )
    );
    document.getElementById('vista-previa-contenido').replaceChildren(tarjeta);
}

btnPublicar.addEventListener('click', () => {
    if (!estado.borrador || estado.enviando) return;
    construirVistaPrevia();
    vistaPrevia.showModal();
});

document.getElementById('btn-cerrar-vista').addEventListener('click', () => vistaPrevia.close());
document.getElementById('btn-seguir').addEventListener('click', () => {
    vistaPrevia.close();
    textarea.focus();
});
// Cerrar al hacer clic fuera de la ventana
vistaPrevia.addEventListener('click', (e) => { if (e.target === vistaPrevia) vistaPrevia.close(); });

const btnConfirmar = document.getElementById('btn-confirmar-publicar');
btnConfirmar.addEventListener('click', async () => {
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Publicando…';
    try {
        await api(`/api/conversaciones/${estado.borrador.id}/publicar`, { method: 'POST' });
        window.location.href = '/feed';
    } catch (err) {
        vistaPrevia.close();
        mostrarError(err.message);
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Publicar';
    }
});

btnDescartar.addEventListener('click', async () => {
    if (!estado.borrador) return;
    if (!(await preguntar({ titulo: '¿Eliminar este sueño?', texto: 'Se borrará la conversación con sus imágenes y no se podrá recuperar.', aceptar: 'Eliminar', cancelar: 'Seguir contando', peligro: true, icono: 'basura' }))) return;
    try {
        await api(`/api/conversaciones/${estado.borrador.id}`, { method: 'DELETE' });
        window.location.href = '/sueno'; // empezar uno nuevo
    } catch (err) {
        mostrarError(err.message);
    }
});

// Bienvenida de un sueño nuevo: los que quedaron sin publicar, para retomarlos
async function pintarPendientes() {
    try {
        const conversaciones = await api('/api/conversaciones');
        const pendientes = conversaciones.filter((c) => !c.publicada).slice(0, 3);
        if (!pendientes.length) return;
        document.getElementById('lista-pendientes').replaceChildren(...pendientes.map((c) =>
            crear('li', {},
                crear('a', { href: `/sueno?c=${c.id}`, class: 'pendiente' },
                    c.imagenIA ? crear('img', { src: c.imagenIA, alt: '', loading: 'lazy' }) : crear('span', { class: 'pendiente-sin-imagen' }, icono('luna', 'icono-sm')),
                    crear('span', { class: 'pendiente-textos' },
                        crear('strong', { text: c.titulo || 'Sueño sin título' }),
                        crear('small', { text: c.extracto || '' })),
                    crear('span', { class: 'pendiente-continuar', text: 'Continuar' })))));
        document.getElementById('pendientes').hidden = false;
    } catch { /* si falla, solo no se muestra la lista */ }
}

// ---------------------------------------------------------
// Opinión durante el chat: "¿Cómo ha sido tu experiencia hasta ahora?" + comentario opcional
// ---------------------------------------------------------
const CARITAS = [[1, '😞', 'Muy mal'], [2, '🙁', 'Mal'], [3, '😐', 'Regular'], [4, '🙂', 'Bien'], [5, '😍', 'Excelente']];

function crearOpinion() {
    let valoracion = null;
    const caja = crear('div', { class: 'opinion-caja', hidden: true });
    const texto = crear('textarea', { class: 'opinion-texto', rows: '3', maxlength: '1000', 'aria-label': 'Tu comentario',
        placeholder: 'Cuéntanos qué te gustó o qué podría mejorar (opcional si ya elegiste una carita)…' });
    const gracias = crear('p', { class: 'opinion-gracias', role: 'status', hidden: true });
    const error = crear('p', { class: 'opinion-error', role: 'alert', hidden: true });
    const botones = CARITAS.map(([valor, emoji, nombre]) => crear('button', {
        type: 'button', class: 'opinion-carita', 'aria-label': nombre, 'aria-pressed': 'false', title: nombre,
        onclick: () => {
            valoracion = valoracion === valor ? null : valor;
            botones.forEach((b, i) => { const activo = CARITAS[i][0] === valoracion; b.setAttribute('aria-pressed', String(activo)); b.classList.toggle('activa', activo); });
            caja.hidden = false;
        }
    }, emoji));
    const enviarBtn = crear('button', { type: 'button', class: 'opinion-enviar', text: 'Enviar opinión' });
    const fila = crear('div', { class: 'opinion-fila' },
        crear('span', { class: 'opinion-pregunta', text: '¿Cómo ha sido tu experiencia hasta ahora?' }),
        crear('span', { class: 'opinion-caritas', role: 'group', 'aria-label': 'Valora tu experiencia' }, ...botones),
        crear('button', { type: 'button', class: 'opinion-enlace', text: 'Dejar un comentario', onclick: () => { caja.hidden = false; texto.focus(); } }));
    const cuadro = crear('div', { id: 'opinion', class: 'opinion' }, fila, caja, error, gracias);
    caja.append(texto, crear('div', { class: 'opinion-acciones' }, enviarBtn,
        crear('button', { type: 'button', class: 'opinion-cancelar', text: 'Cancelar', onclick: () => { caja.hidden = true; } })));

    enviarBtn.addEventListener('click', async () => {
        error.hidden = true;
        const comentario = texto.value.trim();
        if (valoracion === null && !comentario) { error.textContent = 'Elige una carita o escribe un comentario.'; error.hidden = false; return; }
        enviarBtn.disabled = true;
        try {
            const r = await api('/api/opiniones', { method: 'POST',
                body: JSON.stringify({ conversacion: estado.borrador?.id || null, valoracion, comentario }) });
            gracias.replaceChildren(crear('span', { text: '¡Gracias por tu opinión! Nos ayuda a mejorar Oniria. 💜' }));
            if (r.apoyo) gracias.append(crear('span', { class: 'opinion-apoyo', text: r.apoyo }));
            gracias.hidden = false; fila.hidden = true; caja.hidden = true;
            texto.value = ''; valoracion = null; botones.forEach((b) => { b.setAttribute('aria-pressed', 'false'); b.classList.remove('activa'); });
            // Vuelve a aparecer más tarde por si quiere decir algo más
            setTimeout(() => { gracias.hidden = true; fila.hidden = false; }, r.apoyo ? 60000 : 8000);
        } catch (err) {
            error.textContent = err.message; error.hidden = false;
        } finally {
            enviarBtn.disabled = false;
        }
    });
    return cuadro;
}

// Se muestra solo cuando ya hay una conversación con respuesta de la IA
function mostrarOpinion() {
    if (!estado.borrador || document.getElementById('opinion')) return;
    form.before(crearOpinion());
}

// ---------------------------------------------------------
// Aviso cuando Gemini (Google) está saturado: así no se culpa a la página ni a Oniria
// ---------------------------------------------------------
async function revisarEstadoIA() {
    try {
        const { gemini, oniria } = await api('/api/estado-ia');
        estado.oniriaActivo = Boolean(oniria);
        let aviso = document.getElementById('aviso-servicio');
        if (gemini === 'saturado' && !aviso) {
            aviso = crear('div', { id: 'aviso-servicio', class: 'aviso-servicio', role: 'status' },
                icono('destellos', 'icono-xs'),
                crear('span', { text: 'Gemini (el servicio de Google que usamos para títulos, imágenes y clasificación) está saturado ahora mismo. '
                    + 'No es un fallo de tu sueño ni de Oniria: puede tardar o fallar. Intenta de nuevo en unos minutos.' }));
            form.before(aviso);
        } else if (gemini !== 'saturado' && aviso) {
            aviso.remove();
        }
    } catch { /* sin aviso si no se pudo consultar */ }
}

// ---------------------------------------------------------
// Arranque: quién soy y si había un sueño en curso
// ---------------------------------------------------------
(async () => {
    actualizarInterfaz();
    try {
        const idConversacion = Number(new URLSearchParams(location.search).get('c')) || null;
        const [yo, datos] = await Promise.all([
            api('/api/yo'),
            idConversacion ? api(`/api/conversaciones/${idConversacion}`) : null
        ]);
        estado.yo = yo;
        revisarPoliticas(yo);
        if (datos?.conversacion) {
            const { mensajes, ...resumen } = datos.conversacion;
            estado.borrador = resumen;
            document.title = `${resumen.titulo || 'Tu sueño'} - Oniria`;
            pintarConversacion(mensajes);
            if (mensajes.some((m) => m.rol === 'ia')) mostrarOpinion();
            bajarAlFinal();
        } else {
            pintarPendientes();
        }
    } catch (err) {
        mostrarError(err.message);
    }
    actualizarInterfaz();
    revisarEstadoIA();
    textarea.focus();
})();
