// =========================================================
// CÓDIGO COMPARTIDO entre el feed (Feedback-script.js) y el chat (Sueno-script.js)
// =========================================================

// =========================================================
// 0. ÍCONOS (SVG fijos escritos aquí; nunca contienen texto de usuarios)
// =========================================================
const ICONOS = {
    inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    mas: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
    'mas-simple': '<path d="M12 5v14M5 12h14"/>',
    luna: '<path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    escudo: '<path d="M12 3 4.5 6v5.5c0 4.4 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5.1 7.5-9.5V6z"/>',
    salir: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
    imagen: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L6 21"/>',
    destellos: '<path d="M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    corazon: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
    'corazon-lleno': '<path fill="currentColor" d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
    comentario: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6l-4.6 1.4 1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/>',
    basura: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
    alerta: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
    arriba: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    atras: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    izquierda: '<path d="m15 18-6-6 6-6"/>',
    derecha: '<path d="m9 18 6-6-6-6"/>',
    microfono: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    enviar: '<path d="M5 12h13M12 5l7 7-7 7"/>',
    detener: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    clip: '<path d="m20.5 11.5-8.3 8.3a5.3 5.3 0 0 1-7.5-7.5l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9"/>'
};

function svgIcono(nombre) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;
}

function icono(nombre, clase = '') {
    const span = document.createElement('span');
    span.className = `icono ${clase}`.trim();
    span.innerHTML = svgIcono(nombre);
    return span;
}

// Llenar los íconos que ya vienen en el HTML (<span data-icono="...">)
document.querySelectorAll('[data-icono]').forEach((el) => { el.innerHTML = svgIcono(el.dataset.icono); });

// =========================================================
// 1. TEMA CLARO / OSCURO (Tema.js ya lo aplicó al cargar)
// =========================================================
function pintarBotonesTema() {
    const oscuro = document.documentElement.classList.contains('dark-theme');
    document.querySelectorAll('.js-tema').forEach((boton) => {
        let span = boton.querySelector('.icono');
        if (!span) { span = icono('luna'); boton.prepend(span); }
        span.innerHTML = svgIcono(oscuro ? 'sol' : 'luna');
        const texto = boton.querySelector('.js-tema-texto');
        if (texto) texto.textContent = oscuro ? 'Tema claro' : 'Tema oscuro';
    });
}

document.querySelectorAll('.js-tema').forEach((boton) => {
    boton.addEventListener('click', () => {
        const oscuro = document.documentElement.classList.toggle('dark-theme');
        try { localStorage.setItem('vibe_tema', oscuro ? 'Oscuro' : 'Claro'); } catch { /* sin almacenamiento */ }
        pintarBotonesTema();
    });
});
pintarBotonesTema();

// =========================================================
// 2. UTILIDADES
// =========================================================
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
    // Si el cuerpo es texto (JSON) se avisa; si es FormData (con imágenes) el navegador pone el tipo solo
    const respuesta = await fetch(url, {
        ...opciones,
        headers: typeof opciones.body === 'string' ? { 'Content-Type': 'application/json' } : undefined
    });
    if (respuesta.status === 401) {
        window.location.href = '/'; // la sesión terminó
        throw new Error('Sesión terminada');
    }
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
        const error = new Error(datos.error || 'Ocurrió un error, intenta de nuevo.');
        error.status = respuesta.status;
        throw error;
    }
    return datos;
}

// Avatar automático a partir del apodo
function urlAvatar(apodo) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(apodo || 'oniria')}`;
}

function crearAvatar(apodo, conAnillo = false) {
    const avatar = crear('div', { class: 'avatar' });
    avatar.style.backgroundImage = `url("${urlAvatar(apodo)}")`;
    return conAnillo ? crear('div', { class: 'anillo' }, avatar) : avatar;
}

// Carrusel de imágenes con flechas, puntitos y contador (si hay más de una).
// items = [{ elemento, etiqueta }]; la etiqueta es un letrerito opcional.
function crearCarrusel(items) {
    const marco = crear('div', { class: `carrusel-marco${items.length > 1 ? ' multiple' : ''}` });
    const pista = crear('div', { class: 'carrusel' });
    items.forEach(({ elemento, etiqueta }) => {
        pista.append(crear('div', { class: 'carrusel-item' },
            elemento,
            etiqueta ? crear('span', { class: 'carrusel-etiqueta', text: etiqueta }) : null));
    });
    marco.append(pista);
    if (items.length < 2) return marco;

    let indice = 0;
    const ir = (i) => pista.scrollTo({ left: i * pista.clientWidth, behavior: 'smooth' });
    const anterior = crear('button', { type: 'button', class: 'carrusel-flecha izquierda', 'aria-label': 'Imagen anterior', onclick: () => ir(indice - 1) }, icono('izquierda'));
    const siguiente = crear('button', { type: 'button', class: 'carrusel-flecha derecha', 'aria-label': 'Imagen siguiente', onclick: () => ir(indice + 1) }, icono('derecha'));
    const puntos = crear('div', { class: 'carrusel-puntos', 'aria-hidden': 'true' });
    items.forEach(() => puntos.append(crear('span')));
    const contador = crear('span', { class: 'carrusel-contador' });

    function actualizar() {
        indice = Math.round(pista.scrollLeft / (pista.clientWidth || 1));
        anterior.hidden = indice <= 0;
        siguiente.hidden = indice >= items.length - 1;
        [...puntos.children].forEach((p, k) => p.classList.toggle('activo', k === indice));
        contador.textContent = `${indice + 1}/${items.length}`;
    }
    pista.addEventListener('scroll', () => requestAnimationFrame(actualizar), { passive: true });

    marco.append(anterior, siguiente, puntos, contador);
    actualizar();
    return marco;
}
