// =========================================================
// MIS ESTADÍSTICAS: 4 gráficas de pastel con mis sueños
// (Comun.js: crear, api, iconos, avisar · Graficas.js: crearGrafica, exportarImagen…)
// =========================================================
const $ = (id) => document.getElementById(id);
let datos = null;

const PERIODOS = { '': 'Desde siempre', 365: 'Último año', 90: 'Últimos 90 días', 30: 'Últimos 30 días', 7: 'Última semana' };

function numerosResumen(d) {
    const n = d.numeros;
    return [
        [n.publicados + n.sin_publicar, 'sueños contados'],
        [n.publicados, 'publicados'],
        [n.corazones, 'reacciones recibidas'],
        [n.comentarios, 'comentarios recibidos']
    ];
}

const GRAFICAS = [
    { tipo: 'emocion', campo: 'emocion' },
    { tipo: 'tipo_sueno', campo: 'tipo_sueno' },
    { tipo: 'tema', campo: 'tema' },
    { tipo: 'horario', campo: 'horario' }
];

function pintar() {
    $('numeros').replaceChildren(...numerosResumen(datos).map(([valor, etiqueta]) =>
        crear('div', { class: 'numero' }, crear('strong', { text: String(valor) }), crear('span', { text: etiqueta }))));
    $('graficas').replaceChildren(...GRAFICAS.map(({ tipo, campo }) => crearGrafica(tipo, datos[campo])));
    $('numeros').hidden = false;
    $('graficas').hidden = false;
    $('estado').hidden = true;
}

async function cargar() {
    $('estado').hidden = false;
    $('estado').textContent = 'Calculando tus estadísticas…';
    try {
        const periodo = $('periodo').value;
        datos = await api(`/api/mis-estadisticas${periodo ? `?dias=${periodo}` : ''}`);
        pintar();
    } catch (err) {
        $('estado').textContent = err.message;
    }
}

async function generarImagen() {
    return exportarImagen({
        titulo: `Los sueños de ${datos.numeros.apodo}`,
        subtitulo: PERIODOS[$('periodo').value],
        numeros: numerosResumen(datos).slice(0, 3),
        graficas: GRAFICAS.map(({ tipo, campo }) => ({ tipo, conteos: datos[campo] }))
    });
}

async function conBoton(boton, tarea) {
    if (!datos) return;
    boton.disabled = true;
    try { await tarea(); } catch (err) { avisar(err.message || 'No se pudo crear la imagen.'); } finally { boton.disabled = false; }
}

$('btn-descargar').addEventListener('click', (e) => conBoton(e.currentTarget, async () => {
    descargarBlob(await generarImagen(), 'mis-suenos-oniria.png');
}));

$('btn-compartir').addEventListener('click', (e) => conBoton(e.currentTarget, async () => {
    const resultado = await compartirODescargar(await generarImagen(), 'mis-suenos-oniria.png', 'Así se ven mis sueños en Oniria 🌙');
    if (resultado === 'descargado') {
        avisar('Tu navegador no permite compartir directo, así que descargamos la imagen. Ya la puedes enviar o subir a donde quieras.', 'Imagen descargada');
    }
}));

$('periodo').addEventListener('change', cargar);

// Redibuja con los colores del tema si se cambia claro/oscuro
new MutationObserver(() => { if (datos) pintar(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

// =========================================================
// CLIMA ONÍRICO: lo que soñó toda la comunidad esta semana (anónimo)
// =========================================================
const EMOCION_FRASE = {
    feliz: 'fue feliz', triste: 'tuvo tristeza', miedo: 'tuvo miedo',
    calma: 'se sintió en calma', confusion: 'fue confuso', otra: 'tuvo emociones variadas'
};
const TEMA_FRASE = {
    personas: 'la familia y las personas cercanas', peligro: 'el peligro y las persecuciones', volar_caer: 'volar o caer',
    naturaleza: 'la naturaleza y el agua', fantasia: 'los mundos de fantasía', otro: 'algo muy variado'
};

async function cargarClima() {
    const caja = $('clima');
    let c;
    try { c = await api('/api/clima-onirico'); } catch { return; } // si falla, la tarjeta no aparece
    const etiqueta = crear('span', { class: 'clima-etiqueta' }, icono('luna', 'icono-xs'), 'Clima onírico de la semana');
    if (!c.suficiente) {
        caja.replaceChildren(etiqueta,
            crear('p', { class: 'clima-frase', text: 'Esta semana todavía hay muy pocos sueños en Oniria para leer el clima.' }),
            crear('p', { class: 'clima-detalle' }, 'Se muestra cuando la comunidad cuenta al menos ', String(c.minimo), ' sueños. ',
                crear('a', { href: '/sueno', text: 'Cuenta el tuyo' })));
    } else {
        const partes = [`Esta semana, el ${c.emocion.porcentaje}% de los sueños en Oniria ${EMOCION_FRASE[c.emocion.clave] || 'tuvo otras emociones'}`];
        if (c.tema) partes.push(`el tema más común fue ${TEMA_FRASE[c.tema.clave] || 'algo muy variado'}`);
        const detalle = [`${c.total} sueños contados`];
        if (c.pesadillas) detalle.push(`${c.pesadillas}% pesadillas`);
        if (c.lucidos) detalle.push(`${c.lucidos}% lúcidos`);
        caja.replaceChildren(etiqueta,
            crear('p', { class: 'clima-frase', text: `${partes.join(' y ')}.` }),
            crear('p', { class: 'clima-detalle', text: detalle.join(' · ') }));
    }
    caja.append(crear('p', { class: 'clima-nota', text: 'Anónimo: son porcentajes de toda la comunidad en los últimos 7 días; nadie ve quién soñó qué.' }));
    caja.hidden = false;
}

(async () => {
    try { pintarMiPerfil(await api('/api/yo')); } catch { /* el menú queda sin foto */ }
    cargarClima();
    cargar();
})();
