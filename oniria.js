// =========================================================
// Cliente del modelo propio de Oniria (beta) + traductor de etiquetas.
//
// El modelo corre aparte (API en Python/FastAPI, en la PC de quien lo entrenó o en un
// servidor con GPU). Este archivo solo lo llama por HTTP desde el servidor; la clave NUNCA
// va al navegador.
//
// Variables de entorno:
//   ONIRIA_ACTIVO=1        enciende la beta (vacío o 0 = todo sigue con Gemini)
//   ONIRIA_URL             dirección de la API, p. ej. http://127.0.0.1:8000 o la URL del túnel
//   ONIRIA_API_KEY         la misma clave que se puso en la API del modelo (ONIRIA_API_KEY)
//   ONIRIA_TIMEOUT_MS      tiempo máximo de espera por llamada (por defecto 90000)
//
// Si el modelo no responde (PC apagada, túnel caído, error), se devuelve null/lanza error y
// el servidor sigue con Gemini sin que la persona note nada. Tras una caída, no se vuelve a
// intentar durante 60 segundos para no hacer esperar a nadie.
// =========================================================
const URL_BASE = (process.env.ONIRIA_URL || '').replace(/\/+$/, '');
const CLAVE = process.env.ONIRIA_API_KEY || '';
const TIMEOUT_MS = Number(process.env.ONIRIA_TIMEOUT_MS) || 90000;
const ACTIVO = process.env.ONIRIA_ACTIVO === '1' && Boolean(URL_BASE);
const PAUSA_TRAS_CAIDA_MS = 60000;

let pausadoHasta = 0;

// ¿Se puede usar el modelo propio ahora mismo?
function disponible() {
    return ACTIVO && Date.now() >= pausadoHasta;
}

async function llamar(ruta, cuerpo) {
    let respuesta;
    try {
        respuesta = await fetch(`${URL_BASE}${ruta}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': CLAVE },
            body: JSON.stringify(cuerpo),
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
    } catch (err) {
        pausadoHasta = Date.now() + PAUSA_TRAS_CAIDA_MS; // PC apagada, túnel caído, tiempo agotado...
        throw new Error(`Oniria sin respuesta (${err.name})`);
    }
    if (!respuesta.ok) {
        // 401 = clave mala; 5xx = el túnel responde pero el modelo no. En ambos casos, pausa corta.
        pausadoHasta = Date.now() + PAUSA_TRAS_CAIDA_MS;
        throw new Error(`Oniria respondió ${respuesta.status}`);
    }
    const datos = await respuesta.json().catch(() => null);
    if (!datos || typeof datos !== 'object') throw new Error('Oniria devolvió algo que no es JSON');
    return datos;
}

// Paso 1: análisis. Devuelve { ok, alerta, analisis, lectura_inicial, preguntas, publicable }
// o, si hay riesgo, { ok, alerta: 'atencion', mensaje, recursos }.
const analizar = (sueno, pais = 'MX') => llamar('/analizar', { sueno, pais });

// Paso 2: interpretación con las respuestas de la persona (o null si no quiso responder).
// Devuelve { ok, alerta, interpretacion, etiquetas } o la alerta de atención.
const interpretar = (sueno, respuestas, pais = 'MX') => llamar('/interpretar', { sueno, respuestas: respuestas || null, pais });

// ¿La persona prefirió no responder las preguntas?
const OMITIR = new Set(['', 'omitir', 'no', 'no quiero', 'prefiero no responder', 'paso', 'saltar']);
const quiereOmitir = (texto) => OMITIR.has(String(texto || '').trim().toLowerCase().replace(/[.!¡]+$/g, ''));

// ---------------------------------------------------------------- texto para el chat
// Primer mensaje: lo que se muestra en el chat (análisis + lectura inicial + preguntas).
function textoAnalisis(a) {
    const partes = [String(a.analisis || '').trim()];
    if (a.lectura_inicial) partes.push(`Una primera lectura, solo como posibilidad: ${String(a.lectura_inicial).trim()}`);
    const preguntas = (a.preguntas || []).map((p) => String(p).trim()).filter(Boolean);
    if (preguntas.length) partes.push(`Para entenderlo mejor, cuéntame (si quieres): ${preguntas.join(' ')}`);
    return partes.filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------- etiquetas -> estadísticas
// El panel de estadísticas usa 6 emociones, 4 tipos de sueño y 6 temas. El modelo usa
// categorías más finas; aquí se agrupan. Los grupos son una decisión editable: si quieres
// que "ansiedad" cuente como otra cosa, cámbialo en estas tablas.
const EMOCION_A_GRUPO = {
    alegria: 'feliz', alivio: 'feliz', amor: 'feliz',
    tristeza: 'triste', nostalgia: 'triste', soledad: 'triste',
    miedo: 'miedo', ansiedad: 'miedo',
    calma: 'calma',
    confusion: 'confusion', curiosidad: 'confusion', sorpresa: 'confusion',
    enojo: 'otra', culpa: 'otra'
};
const TEMA_A_GRUPO = {
    persecucion: 'peligro', escape: 'peligro', conflicto: 'peligro',
    caida: 'volar_caer', libertad: 'volar_caer',
    familia: 'personas', pareja: 'personas', vinculos: 'personas', reencuentro: 'personas'
};
const ENTORNO_A_GRUPO = { bosque: 'naturaleza', agua: 'naturaleza', naturaleza: 'naturaleza', cielo: 'naturaleza' };
const PERSONAJE_A_GRUPO = {
    familiar: 'personas', pareja: 'personas', amistad: 'personas', persona_conocida: 'personas',
    animal: 'naturaleza', criatura: 'fantasia'
};
const PESO = { alta: 3, media: 2, baja: 1 };

// Devuelve { emocion, tipo_sueno, tema } con los valores que esperan las estadísticas
// (cualquiera puede ser null si no hay datos suficientes: entonces no se pisa lo que ya había).
function etiquetasAEstadisticas(et) {
    if (!et || typeof et !== 'object') return { emocion: null, tipo_sueno: null, tema: null };

    // Emoción dominante = la de mayor intensidad (luego mayor confianza; si empatan, la primera)
    let emocion = null;
    let mejor = -1;
    for (const e of Array.isArray(et.emotions) ? et.emotions : []) {
        const puntos = (PESO[e.intensity] || 2) * 10 + (PESO[e.confidence] || 2);
        if (puntos > mejor && EMOCION_A_GRUPO[e.tag]) { mejor = puntos; emocion = EMOCION_A_GRUPO[e.tag]; }
    }

    const caract = new Set(et.characteristics || []);
    const tipo_sueno = caract.has('pesadilla') ? 'pesadilla'
        : caract.has('lucido') ? 'lucido'
            : caract.has('recurrente') ? 'recurrente' : 'normal';

    // Tema: el primer tema del modelo que tenga grupo; si no, entorno, personajes y rasgos.
    // (Se asume que el modelo lista primero el tema más importante: conviene revisarlo con datos reales.)
    let tema = null;
    for (const t of et.themes || []) { if (TEMA_A_GRUPO[t]) { tema = TEMA_A_GRUPO[t]; break; } }
    if (!tema) for (const t of et.environment || []) { if (ENTORNO_A_GRUPO[t]) { tema = ENTORNO_A_GRUPO[t]; break; } }
    if (!tema) for (const t of et.characters || []) { if (PERSONAJE_A_GRUPO[t]) { tema = PERSONAJE_A_GRUPO[t]; break; } }
    if (!tema && caract.has('surrealista')) tema = 'fantasia';
    return { emocion, tipo_sueno, tema: tema || 'otro' };
}

// ¿El modelo se negó a interpretar por falta de contexto? (pasa cuando la persona no responde las preguntas)
const EVASIVA = /sin m[aá]s contexto|no puedo asegur|prefiero no (darle|dar|interpret)|no (tengo|cuento con|hay) (suficiente|m[aá]s) (contexto|informaci[oó]n)/i;
const esEvasiva = (texto) => EVASIVA.test(String(texto || ''));

module.exports = { disponible, analizar, interpretar, quiereOmitir, esEvasiva, textoAnalisis, etiquetasAEstadisticas };
