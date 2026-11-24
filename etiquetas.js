// =========================================================
// Limpieza de los "elementos" y "acciones" de cada sueño.
//
// Los elementos (plato, puente, casa) y las acciones (romper, volar) los escribe la IA con
// sus propias palabras, así que antes de guardarlos se normalizan para poder CONTARLOS:
//   1. Minúsculas, sin acentos ni signos, máximo 2 palabras ("Casa  vieja!" -> "casa vieja").
//   2. Sinónimos: varias formas de decir lo mismo cuentan como una ("hogar" -> "casa").
//   3. Se descartan palabras vacías ("cosa", "algo", "lugar"...).
//   4. Se descarta lo que NO aparece en el texto del sueño (la IA pequeña a veces inventa):
//      se compara por raíz, así "romper" coincide con "rompí" o "rompiendo".
//   5. Sin repetidos, y un máximo por sueño.
//
// Cómo mantenerlo: cuando veas variantes en tus datos reales (casa/hogar/vivienda), agrégalas a
// SINONIMOS. La consulta de revisar_etiquetas.sql (en esta carpeta) lista las más frecuentes.
//
// Pruebas:  node etiquetas.js
// =========================================================
const { normalizarTexto } = require('./seguridad');

// forma que se quiere -> formas que se convierten en ella
const GRUPOS_SINONIMOS = {
    casa: ['hogar', 'vivienda'],
    carro: ['coche', 'auto', 'automovil'],
    celular: ['telefono', 'movil'],
    escuela: ['colegio'],
    dinero: ['plata', 'billete'],
    perro: ['perrito', 'cachorro'],
    gato: ['gatito'],
    bebe: ['recien nacido'],
    hablar: ['platicar', 'conversar', 'charlar'],
    mirar: ['observar', 'ver'],
    caminar: ['andar'],
    correr: ['trotar']
};
const SINONIMOS = new Map();
for (const [forma, otras] of Object.entries(GRUPOS_SINONIMOS)) for (const o of otras) SINONIMOS.set(o, forma);

// Palabras que no dicen nada como símbolo o acción
const VACIAS = new Set(['cosa', 'algo', 'lugar', 'momento', 'sueno', 'parte', 'vez', 'tipo', 'forma', 'todo', 'nada',
    'persona', 'gente', 'ser', 'estar', 'tener', 'hacer', 'haber',
    // verbos que casi siempre son "relleno" al contar un sueño (no dicen qué pasó en él)
    'comenzar', 'empezar', 'despertar', 'pensar', 'preguntar', 'sentir', 'continuar', 'terminar', 'parecer',
    'quedar', 'recordar', 'saber', 'poder', 'querer', 'deber', 'intentar', 'tratar']);

// Conectores que no cuentan al armar un símbolo de varias palabras ("estación de tren" -> "estacion tren")
const CONECTORES = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'en', 'con', 'al', 'y', 'a', 'para', 'por']);

const MAX_PALABRAS = 2;

// Singular prudente: solo los casos claros ("platos" -> "plato", "flores" -> "flor", "luces" -> "luz").
// Los plurales en -es dudosos (paredes, puentes) se dejan como vengan: el modelo ya escribe en singular
// y, si aparecen variantes en tus datos, se arreglan en SINONIMOS.
const NO_SINGULARIZAR = new Set(['crisis', 'tesis', 'virus', 'pais', 'gas', 'tos', 'dios', 'atlas', 'lentes', 'gafas',
    'lunes', 'martes', 'jueves', 'viernes', 'pantalones', 'vacaciones']);
function singular(t) {
    if (t.includes(' ') || t.length < 5 || NO_SINGULARIZAR.has(t)) return t;
    if (t.endsWith('ciones')) return `${t.slice(0, -6)}cion`;
    if (t.endsWith('ces')) return `${t.slice(0, -3)}z`;
    if (t.endsWith('ores')) return t.slice(0, -2);
    if (/[aiou]s$/.test(t)) return t.slice(0, -1); // casas, platos (las terminadas en -es se dejan)
    return t;
}

// Raíces con las que se busca la palabra dentro del texto del sueño (admite plurales y conjugaciones)
function raices(palabra) {
    const base = palabra.slice(0, Math.max(3, palabra.length - 2));
    const variantes = new Set([base]);
    if (base.endsWith('z')) variantes.add(`${base.slice(0, -1)}c`); // luz -> luces
    if (base.endsWith('c')) variantes.add(`${base.slice(0, -1)}z`);
    return [...variantes];
}

function aparece(elemento, palabrasTexto) {
    const palabras = elemento.split(' ').filter((p) => p.length >= 3);
    return palabras.some((p) => {
        const rs = raices(p);
        return palabrasTexto.some((t) => rs.some((r) => t.startsWith(r)));
    });
}

// valores: lo que devolvió la IA (puede venir sucio o con otro tipo de dato)
// textoSueno: el relato; sirve para descartar lo inventado. Si es '' no se aplica ese filtro.
function limpiarLista(valores, textoSueno = '', { max = 8, exigirTexto = true } = {}) {
    if (!Array.isArray(valores)) return [];
    const palabrasTexto = normalizarTexto(textoSueno).split(' ').filter(Boolean);
    const salida = [];
    for (const v of valores) {
        if (typeof v !== 'string') continue;
        let palabras = normalizarTexto(v).split(' ').filter(Boolean);
        const sinConectores = palabras.filter((p) => !CONECTORES.has(p));
        if (sinConectores.length) palabras = sinConectores;
        let t = palabras.slice(0, MAX_PALABRAS).join(' ');
        if (t.length < 3 || t.length > 30) continue;
        t = SINONIMOS.get(singular(t)) || SINONIMOS.get(t) || singular(t);
        if (VACIAS.has(t)) continue;
        if (exigirTexto && palabrasTexto.length && !aparece(t, palabrasTexto)) continue;
        if (!salida.includes(t)) salida.push(t);
        if (salida.length >= max) break;
    }
    return salida;
}

module.exports = { limpiarLista, SINONIMOS };

// ------------------------------------------------------------------ pruebas
if (require.main === module) {
    const sueno = 'Estaba en una reunión familiar y mi tía decía en voz alta algo que yo le había contado en secreto. '
        + 'Sentía el calor subirme a la cara, todos se reían y yo rompía un plato al salir. Luego volaba sobre las luces del puente.';
    const casos = [
        ['sinónimos y acentos', ['Reunión', 'PLATO', 'Plato!!', 'hogar'], ['reunion', 'plato']],
        ['plurales y conjugaciones en acciones', ['romper', 'reir', 'volar', 'salir', 'decir'], ['romper', 'reir', 'volar', 'salir', 'decir']],
        ['luz/luces', ['luz', 'puente'], ['luz', 'puente']],
        ['inventado se descarta', ['sol', 'dragon', 'plato'], ['plato']],
        ['palabras vacías', ['cosa', 'algo', 'lugar', 'plato'], ['plato']],
        ['máximo 2 palabras', ['plato roto en pedazos'], ['plato roto']],
        ['verbos de relleno', ['comenzar', 'despertar', 'pensar', 'preguntar', 'romper'], ['romper']],
        ['tipos raros', [null, 42, {}, 'plato', ''], ['plato']],
        ['no es lista', 'plato', []],
        ['repetidos', ['plato', 'platos', 'Plato'], ['plato']]
    ];
    let fallos = 0;
    for (const [nombre, entrada, esperado] of casos) {
        const r = limpiarLista(entrada, sueno);
        const bien = JSON.stringify(r) === JSON.stringify(esperado);
        if (!bien) fallos++;
        console.log(`${bien ? '  OK    ' : '  FALLO '} ${nombre}: ${JSON.stringify(r)}${bien ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
    }
    const r5 = limpiarLista(['platos', 'casas', 'flores', 'luces', 'crisis', 'lunes', 'virus', 'puentes'],
        'platos casas flores luces crisis lunes virus puentes');
    const bien5 = JSON.stringify(r5) === JSON.stringify(['plato', 'casa', 'flor', 'luz', 'crisis', 'lunes', 'virus', 'puentes']);
    if (!bien5) fallos++;
    console.log(`${bien5 ? '  OK    ' : '  FALLO '} singular prudente: ${JSON.stringify(r5)}`);
    // Sinónimo que se convierte en una forma que SÍ está en el texto
    const r2 = limpiarLista(['hogar', 'coche'], 'Soñé que estaba en mi casa y subía a un carro.');
    const bien2 = JSON.stringify(r2) === JSON.stringify(['casa', 'carro']);
    if (!bien2) fallos++;
    console.log(`${bien2 ? '  OK    ' : '  FALLO '} sinónimo -> forma presente en el texto: ${JSON.stringify(r2)}`);
    // Los conectores no cuentan: "estación de tren" no se corta en "estacion de"
    const r6 = limpiarLista(['Estación de tren', 'puerta de la casa'], 'Estaba en una estación de tren vacía y vi la puerta de la casa.');
    const bien6 = JSON.stringify(r6) === JSON.stringify(['estacion tren', 'puerta casa']);
    if (!bien6) fallos++;
    console.log(`${bien6 ? '  OK    ' : '  FALLO '} conectores no cuentan: ${JSON.stringify(r6)}`);
    // Sin texto no se filtra por presencia
    const r3 = limpiarLista(['sol', 'plato'], '');
    const bien3 = JSON.stringify(r3) === JSON.stringify(['sol', 'plato']);
    if (!bien3) fallos++;
    console.log(`${bien3 ? '  OK    ' : '  FALLO '} sin texto no se filtra por presencia: ${JSON.stringify(r3)}`);
    // Máximo
    const r4 = limpiarLista(['uno', 'dos', 'tres', 'cuatro'], '', { max: 2 });
    const bien4 = r4.length === 2;
    if (!bien4) fallos++;
    console.log(`${bien4 ? '  OK    ' : '  FALLO '} máximo por sueño: ${JSON.stringify(r4)}`);
    console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo bien');
    process.exit(fallos ? 1 : 0);
}
