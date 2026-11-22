// =========================================================
// GRÁFICAS DE PASTEL (las usan el panel /admin y /estadisticas)
// - Cada gráfica es una dona con su leyenda: nombre, cantidad y porcentaje
//   (así nunca se depende solo del color).
// - Al pasar el mouse por una rebanada o por la leyenda se resalta y sale un globito.
// - exportarImagen() dibuja todo en un <canvas> para descargarlo o compartirlo (PNG).
// - exportarCSV() genera la tabla de datos.
// =========================================================

// Categorías en orden FIJO: el orden decide el color (nunca cambia aunque una salga en 0).
const CATEGORIAS_GRAFICAS = {
    emocion: {
        titulo: 'Emociones de los sueños',
        items: [['feliz', 'Feliz'], ['triste', 'Triste'], ['miedo', 'Miedo'], ['calma', 'Calma'], ['confusion', 'Confusión'], ['otra', 'Otra']]
    },
    tipo_sueno: {
        titulo: 'Tipo de sueño',
        items: [['normal', 'Normal'], ['pesadilla', 'Pesadilla'], ['lucido', 'Lúcido'], ['recurrente', 'Recurrente']]
    },
    tema: {
        titulo: 'Temas',
        items: [['personas', 'Personas'], ['peligro', 'Peligro o persecución'], ['volar_caer', 'Volar o caer'], ['naturaleza', 'Naturaleza y agua'], ['fantasia', 'Fantasía'], ['otro', 'Otro']]
    },
    horario: {
        titulo: '¿A qué hora cuentas tus sueños?',
        items: [['madrugada', 'Madrugada (0–6 h)'], ['manana', 'Mañana (6–12 h)'], ['tarde', 'Tarde (12–19 h)'], ['noche', 'Noche (19–24 h)']]
    },
    cuentas: {
        titulo: 'Estado de las cuentas',
        items: [['activas', 'Activas'], ['sin_verificar', 'Sin verificar'], ['suspendidas', 'Suspendidas'], ['baneadas', 'Baneadas']]
    }
};

const ES_OTRO = new Set(['otra', 'otro']);

// Color de la rebanada i (leído del CSS, así respeta el tema claro/oscuro)
function colorSerie(i, clave) {
    const estilo = getComputedStyle(document.documentElement);
    const variable = ES_OTRO.has(clave) ? '--serie-otro' : `--serie-${i + 1}`;
    return estilo.getPropertyValue(variable).trim() || '#888';
}

// [{ clave, nombre, total, color, porcentaje }] en el orden fijo de la categoría
function datosGrafica(tipo, conteos) {
    const { items } = CATEGORIAS_GRAFICAS[tipo];
    const total = items.reduce((suma, [clave]) => suma + (conteos?.[clave] || 0), 0);
    let indiceColor = 0;
    return {
        total,
        partes: items.map(([clave, nombre]) => {
            const n = conteos?.[clave] || 0;
            const color = colorSerie(ES_OTRO.has(clave) ? 0 : indiceColor++, clave);
            return { clave, nombre, total: n, color, porcentaje: total ? (n / total) * 100 : 0 };
        })
    };
}

const formatoPorcentaje = (p) => (p > 0 && p < 1 ? '<1 %' : `${Math.round(p)} %`);

// Rebanada de dona como "path" SVG (ángulos en radianes, 0 = arriba, sentido del reloj)
function rebanada(cx, cy, rExt, rInt, inicio, fin) {
    const punto = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const grande = fin - inicio > Math.PI ? 1 : 0;
    // Una sola rebanada del 100 %: dos medias vueltas (un arco de 360° no se dibuja)
    if (fin - inicio >= Math.PI * 2 - 1e-6) {
        return [
            `M ${punto(rExt, 0)}`, `A ${rExt} ${rExt} 0 1 1 ${punto(rExt, Math.PI)}`, `A ${rExt} ${rExt} 0 1 1 ${punto(rExt, 0)}`,
            `M ${punto(rInt, 0)}`, `A ${rInt} ${rInt} 0 1 0 ${punto(rInt, Math.PI)}`, `A ${rInt} ${rInt} 0 1 0 ${punto(rInt, 0)}`, 'Z'
        ].join(' ');
    }
    const [x1, y1] = punto(rExt, inicio);
    const [x2, y2] = punto(rExt, fin);
    const [x3, y3] = punto(rInt, fin);
    const [x4, y4] = punto(rInt, inicio);
    return `M ${x1} ${y1} A ${rExt} ${rExt} 0 ${grande} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInt} ${rInt} 0 ${grande} 0 ${x4} ${y4} Z`;
}

let tooltipGrafica = null;
function mostrarTooltip(x, y, parte, unidad) {
    if (!tooltipGrafica) {
        tooltipGrafica = document.createElement('div');
        tooltipGrafica.className = 'grafica-tooltip';
        tooltipGrafica.setAttribute('role', 'status');
        document.body.append(tooltipGrafica);
    }
    tooltipGrafica.replaceChildren();
    const fuerte = document.createElement('b');
    fuerte.textContent = parte.nombre;
    tooltipGrafica.append(fuerte, document.createElement('br'),
        `${parte.total} ${parte.total === 1 ? unidad[0] : unidad[1]} · ${formatoPorcentaje(parte.porcentaje)}`);
    tooltipGrafica.style.left = `${x}px`;
    tooltipGrafica.style.top = `${y}px`;
    tooltipGrafica.hidden = false;
}
function ocultarTooltip() { if (tooltipGrafica) tooltipGrafica.hidden = true; }

// Crea la tarjeta de una gráfica. unidad = ['sueño', 'sueños'] (singular, plural)
function crearGrafica(tipo, conteos, { unidad = ['sueño', 'sueños'], subtitulo = '' } = {}) {
    const { titulo } = CATEGORIAS_GRAFICAS[tipo];
    const { total, partes } = datosGrafica(tipo, conteos);
    const tarjeta = crear('section', { class: 'grafica', 'aria-label': titulo },
        crear('h3', { class: 'grafica-titulo', text: titulo }),
        subtitulo ? crear('p', { class: 'grafica-sub', text: subtitulo }) : null);

    if (!total) {
        tarjeta.append(crear('p', { class: 'grafica-vacia', text: 'Todavía no hay datos para esta gráfica.' }));
        return tarjeta;
    }

    // Dona (SVG)
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${titulo}: ${partes.filter((p) => p.total).map((p) => `${p.nombre} ${formatoPorcentaje(p.porcentaje)}`).join(', ')}`);
    const dona = crear('div', { class: 'dona' }, svg,
        crear('div', { class: 'dona-centro' }, crear('strong', { text: String(total) }), crear('span', { text: total === 1 ? unidad[0] : unidad[1] })));

    const leyenda = crear('ul', { class: 'leyenda' });
    const resaltar = (clave) => {
        dona.classList.toggle('enfocada', Boolean(clave));
        svg.querySelectorAll('path').forEach((p) => p.classList.toggle('activa', p.dataset.clave === clave));
        leyenda.querySelectorAll('li').forEach((li) => li.classList.toggle('activa', li.dataset.clave === clave));
    };

    let angulo = 0;
    for (const parte of partes) {
        if (parte.total) {
            const fin = angulo + (parte.total / total) * Math.PI * 2;
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', rebanada(100, 100, 96, 62, angulo, fin));
            path.setAttribute('fill', parte.color);
            path.dataset.clave = parte.clave;
            path.addEventListener('mousemove', (e) => { resaltar(parte.clave); mostrarTooltip(e.clientX, e.clientY, parte, unidad); });
            path.addEventListener('mouseleave', () => { resaltar(null); ocultarTooltip(); });
            svg.append(path);
            angulo = fin;
        }
        const li = crear('li', { 'data-clave': parte.clave },
            crear('span', { class: 'muestra', style: `background:${parte.color}` }),
            crear('span', { class: 'nombre', text: parte.nombre }),
            crear('span', { class: 'cuanto', text: String(parte.total) }),
            crear('span', { class: 'porcentaje', text: formatoPorcentaje(parte.porcentaje) }));
        li.addEventListener('mouseenter', () => resaltar(parte.clave));
        li.addEventListener('mouseleave', () => resaltar(null));
        leyenda.append(li);
    }

    tarjeta.append(crear('div', { class: 'grafica-cuerpo' }, dona, leyenda));
    return tarjeta;
}

// ---------------------------------------------------------
// Exportar como imagen (PNG) para descargar o compartir
// ---------------------------------------------------------
// graficas = [{ tipo, conteos, unidad }], numeros = [[valor, etiqueta], ...]
async function exportarImagen({ titulo, subtitulo, numeros = [], graficas }) {
    await document.fonts?.ready;
    const oscuro = document.documentElement.classList.contains('dark-theme');
    const c = {
        fondo: oscuro ? '#0b0d14' : '#f5f6fa',
        tarjeta: oscuro ? '#141824' : '#ffffff',
        borde: oscuro ? '#252b3c' : '#e7e9f0',
        texto: oscuro ? '#eceef6' : '#12141f',
        suave: oscuro ? '#9aa1b8' : '#6b7086'
    };
    const ancho = 1080;
    const filas = Math.ceil(graficas.length / 2);
    const altoGrafica = 470;
    const alto = 250 + (numeros.length ? 150 : 0) + filas * (altoGrafica + 30) + 70;
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext('2d');
    const fuente = (peso, tam) => `${peso} ${tam}px Inter, "Segoe UI", system-ui, sans-serif`;
    const cajaRedonda = (x, y, w, h, r, relleno, borde) => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fillStyle = relleno;
        ctx.fill();
        if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = 2; ctx.stroke(); }
    };

    // Fondo y encabezado con el degradado de Oniria
    ctx.fillStyle = c.fondo;
    ctx.fillRect(0, 0, ancho, alto);
    ctx.font = fuente(800, 64);
    const anchoLogo = ctx.measureText('Oniria').width;
    const degradado = ctx.createLinearGradient(60, 0, 60 + anchoLogo, 0);
    degradado.addColorStop(0, '#5b7cfa');
    degradado.addColorStop(0.55, '#a463f2');
    degradado.addColorStop(1, '#f36fb0');
    ctx.fillStyle = degradado;
    ctx.fillText('Oniria', 60, 110);
    ctx.fillStyle = c.texto;
    ctx.font = fuente(700, 40);
    ctx.fillText(titulo, 60, 175);
    ctx.fillStyle = c.suave;
    ctx.font = fuente(500, 26);
    ctx.fillText(subtitulo, 60, 218);

    let y = 250;
    // Números grandes
    if (numeros.length) {
        const anchoNum = (ancho - 120 - (numeros.length - 1) * 20) / numeros.length;
        numeros.forEach(([valor, etiqueta], i) => {
            const x = 60 + i * (anchoNum + 20);
            cajaRedonda(x, y, anchoNum, 120, 22, c.tarjeta, c.borde);
            ctx.fillStyle = c.texto;
            ctx.font = fuente(800, 46);
            ctx.fillText(String(valor), x + 24, y + 62);
            ctx.fillStyle = c.suave;
            ctx.font = fuente(500, 22);
            ctx.fillText(etiqueta, x + 24, y + 96, anchoNum - 40);
        });
        y += 150;
    }

    // Donas de 2 en 2
    const anchoTarjeta = (ancho - 140) / 2;
    graficas.forEach(({ tipo, conteos, unidad = ['sueño', 'sueños'] }, i) => {
        const x = 60 + (i % 2) * (anchoTarjeta + 20);
        const yT = y + Math.floor(i / 2) * (altoGrafica + 30);
        cajaRedonda(x, yT, anchoTarjeta, altoGrafica, 28, c.tarjeta, c.borde);
        ctx.fillStyle = c.texto;
        ctx.font = fuente(700, 28);
        ctx.fillText(CATEGORIAS_GRAFICAS[tipo].titulo, x + 28, yT + 50, anchoTarjeta - 56);

        const { total, partes } = datosGrafica(tipo, conteos);
        const cx = x + anchoTarjeta / 2;
        const cy = yT + 185;
        if (!total) {
            ctx.fillStyle = c.suave;
            ctx.font = fuente(500, 24);
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos todavía', cx, cy);
            ctx.textAlign = 'left';
            return;
        }
        let a = -Math.PI / 2;
        for (const parte of partes.filter((p) => p.total)) {
            const fin = a + (parte.total / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 120, a, fin);
            ctx.arc(cx, cy, 76, fin, a, true);
            ctx.closePath();
            ctx.fillStyle = parte.color;
            ctx.fill();
            ctx.strokeStyle = c.tarjeta; // separación entre rebanadas
            ctx.lineWidth = 4;
            ctx.stroke();
            a = fin;
        }
        ctx.textAlign = 'center';
        ctx.fillStyle = c.texto;
        ctx.font = fuente(800, 44);
        ctx.fillText(String(total), cx, cy + 10);
        ctx.fillStyle = c.suave;
        ctx.font = fuente(500, 20);
        ctx.fillText(total === 1 ? unidad[0] : unidad[1], cx, cy + 38);
        ctx.textAlign = 'left';

        // Leyenda: las 4 partes más grandes, una por renglón (nombre completo + porcentaje)
        const principales = partes.filter((p) => p.total).sort((p1, p2) => p2.total - p1.total).slice(0, 4);
        const derecha = x + anchoTarjeta - 28;
        principales.forEach((parte, k) => {
            const lx = x + 28;
            const ly = yT + 342 + k * 32;
            cajaRedonda(lx, ly - 16, 18, 18, 5, parte.color);
            ctx.font = fuente(600, 21);
            ctx.fillStyle = c.texto;
            // Si no cabe, se corta con "…" (nunca se aplasta)
            let nombre = parte.nombre;
            const disponible = derecha - (lx + 30) - 70;
            while (ctx.measureText(nombre).width > disponible && nombre.length > 4) nombre = `${nombre.slice(0, -2)}…`;
            ctx.fillText(nombre, lx + 30, ly);
            ctx.fillStyle = c.suave;
            ctx.textAlign = 'right';
            ctx.fillText(formatoPorcentaje(parte.porcentaje), derecha, ly);
            ctx.textAlign = 'left';
        });
    });

    ctx.fillStyle = c.suave;
    ctx.font = fuente(500, 20);
    ctx.fillText(`Generado el ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })} · oniria`, 60, alto - 30);

    return new Promise((resolver) => lienzo.toBlob(resolver, 'image/png'));
}

// Comparte la imagen (celular) o la descarga (computadora)
async function compartirODescargar(blob, nombreArchivo, textoCompartir) {
    const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
    if (navigator.canShare?.({ files: [archivo] })) {
        try {
            await navigator.share({ files: [archivo], title: 'Mis sueños en Oniria', text: textoCompartir });
            return 'compartido';
        } catch (err) {
            if (err.name === 'AbortError') return 'cancelado';
        }
    }
    descargarBlob(blob, nombreArchivo);
    return 'descargado';
}

function descargarBlob(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const enlace = crear('a', { href: url, download: nombreArchivo });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// CSV (se abre en Excel): sección, categoría, cantidad, porcentaje
function exportarCSV(secciones, nombreArchivo) {
    const fila = (celdas) => celdas.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
    const lineas = [fila(['Sección', 'Categoría', 'Cantidad', 'Porcentaje'])];
    for (const { tipo, conteos, titulo } of secciones) {
        if (tipo) {
            const { partes } = datosGrafica(tipo, conteos);
            for (const p of partes) lineas.push(fila([CATEGORIAS_GRAFICAS[tipo].titulo, p.nombre, p.total, `${p.porcentaje.toFixed(1)}%`]));
        } else {
            for (const [etiqueta, valor] of conteos) lineas.push(fila([titulo, etiqueta, valor, '']));
        }
    }
    // BOM para que Excel lea bien los acentos
    descargarBlob(new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), nombreArchivo);
}
