// =========================================================
// Red de seguridad de Oniria: detección de riesgo INDEPENDIENTE de la IA.
// Es la versión en JavaScript de seguridad.py (mismos patrones y mismas pruebas).
//
// Se ejecuta ANTES de llamar a cualquier IA (Gemini u Oniria). Si detecta que la persona
// habla de hacerse daño o de no querer vivir, se responde con un mensaje fijo y la IA no
// interviene.
//
// Criterio:
//   - Se detecta lo que la persona dice de SU VIDA DESPIERTA ("no quiero seguir viviendo",
//     "me hago daño"...), esté en el relato del sueño o en sus mensajes.
//   - El CONTENIDO del sueño por sí solo NO dispara la alerta: "me perseguía alguien que
//     quería matarme" o "soñé con mi funeral" no son crisis.
//   - Los modismos ("me quería morir de vergüenza", "me muero de risa") no disparan.
//
// Es deliberadamente conservador: prefiere una falsa alarma a pasar por alto un caso real.
//
// LIMITACIONES:
//   - Son expresiones regulares: no entienden contexto ni cubren toda forma de decir algo.
//   - Solo español y solo riesgo para la propia persona.
//   - El mensaje y los recursos deben ser revisados por un profesional de salud mental
//     antes de abrir la app al público.
//
// Pruebas:  node seguridad.js
// =========================================================

// Minúsculas, sin acentos, sin puntuación y con espacios simples (igual que normalizar_texto en Python)
function normalizarTexto(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

// ---------------------------------------------------------------- modismos
// "morir de vergüenza", "me muero de risa"...: no son deseo de morir.
const CAUSAS = 'verguenza|risa|miedo|hambre|sueno|calor|frio|envidia|ganas|celos|pena|aburrimiento|'
    + 'curiosidad|cansancio|nervios|panico|susto|asco|sed|amor|pereza|lastima|coraje|rabia|'
    + 'tristeza|felicidad|emocion|gusto|ansiedad|estres|sorpresa|pavor|angustia';
const MODISMO = new RegExp(
    String.raw`\b(?:morir|morirme|morirse|morirnos|muero|mueres|muere|muerto|muerta|muriendo|moria|queria morir|quiero morir|quiero morirme)`
    + String.raw` (?:de|por|con) (?:${CAUSAS})\b`, 'g');

// ---------------------------------------------------------------- patrones
const INTENCION_FUERTE = '(?:quiero|quisiera|me gustaria|tengo ganas de|me dan ganas de|pienso en|pensando en|he pensado en|'
    + 'he estado pensando en|estoy pensando en|pensaba en|a veces pienso en|voy a|planeo|he intentado|'
    + 'intente|trate de|no dejo de pensar en)';
const INTENCION_PENSAR = '(?:quiero|quisiera|me gustaria|tengo ganas de|me dan ganas de|pienso en|pensando en|he pensado en|'
    + 'he estado pensando en|estoy pensando en|pensaba en|a veces pienso en|no dejo de pensar en)';
const NO_ESTO = '(?! (?:esto|eso|lo|antes|rapido|ya|pronto|de|del))';

const PATRONES = [
    ['no_quiere_vivir', /\bno quiero (?:seguir )?(?:viviendo|vivir|existir|estar vivo|estar viva)\b/],
    ['no_quiere_despertar', /\bno quiero (?:volver a )?despertar(?:me)?(?: nunca| mas| jamas)\b/],
    ['no_quiere_estar_aqui', /\bno quiero estar aqui\b(?! (?:en|con|ni|hoy|trabajando|esperando|mas tiempo|mucho|un rato|ahorita))/],
    ['querer_morir', new RegExp(String.raw`\b(?:quiero|quisiera|me gustaria|tengo ganas de|me dan ganas de) `
        + String.raw`(?:morir|morirme|estar muert[oa]|no existir|no estar vivo|no estar viva|desaparecer para siempre|`
        + String.raw`dormir y no despertar|no despertar)\b`)],
    ['me_quiero_morir', /\bme quiero (?:morir|matar|suicidar)\b/],
    ['ojala', /\bojala (?:me muriera|no despertara|desapareciera|no existiera)\b/],
    ['pensar_en_ambiguo', new RegExp(String.raw`\b${INTENCION_PENSAR} (?:morir|morirme|desaparecer|lastimarme|`
        + String.raw`(?:terminar|acabar) con todo${NO_ESTO}\b)`)],
    ['pensar_en_grave', new RegExp(String.raw`\b${INTENCION_FUERTE} (?:matarme|suicidarme|quitarme la vida|quitarme mi vida|`
        + String.raw`(?:acabar|terminar) con mi vida|hacerme dano|autolesionarme|hacerme sangrar|`
        + String.raw`cortarme (?:las venas|los brazos|las munecas|las piernas|la piel))\b`)],
    ['suicidio', new RegExp(String.raw`\b(?:suicidarme|pensamientos suicidas|ideas suicidas|ideacion suicida|intento suicida|`
        + String.raw`intento de suicidio|(?:pensando|pensar|pienso|pense|he pensado) en (?:el )?suicidio)\b`)],
    ['sin_sentido', new RegExp(String.raw`\bno (?:vale la pena|tiene sentido) (?:seguir|vivir|viviendo|la vida|continuar)\b`
        + String.raw`(?! (?:con|intentando|discutiendo|estudiando|trabajando|esperando|peleando|gastando|insistiendo|luchando|aqui))`)],
    ['sin_ganas_de_vivir', new RegExp(String.raw`\b(?:sin ganas de (?:vivir|seguir viviendo)|(?:ya )?no tengo ganas de (?:vivir|seguir viviendo)|`
        + String.raw`perdi las ganas de vivir|no le encuentro sentido a (?:la vida|vivir|seguir viviendo))\b`)],
    ['mejor_sin_mi', new RegExp(String.raw`\b(?:(?:todos|mi familia|los demas|mis padres|mis hijos|mis amigos|mi pareja) (?:estarian|estaria) mejor sin mi|`
        + String.raw`mejor (?:no despertar|no existir|estar muert[oa]|morir|no estar aqui)|`
        + String.raw`desaparecer (?:seria|sera|es) (?:un )?(?:descanso|alivio|lo mejor|mejor))\b`)],
    ['autolesion', new RegExp(String.raw`\b(?:me hago dano|me estoy haciendo dano|me he estado haciendo dano|me (?:hice|he hecho) dano a proposito|`
        + String.raw`autolesion\w*|me lastimo a proposito|me (?:quemo|quemaba) a proposito|`
        + String.raw`me (?:corto|cortaba|corte|he cortado) (?:los brazos|el brazo|las munecas|la muneca|las piernas|la piel|las venas|los muslos))\b`)],
    ['autolesion_cortarse', new RegExp(String.raw`\b(?:me estoy cortando|me he estado cortando|me sigo cortando|he estado cortandome|estoy cortandome|`
        + String.raw`estuve cortandome|volvi a cortarme)\b(?! (?:el pelo|el cabello|las unas|la barba|el flequillo))`)],
    ['a_punto_de', /\ba punto de (?:quitarme la vida|hacerme dano|hacerme algo malo|hacerme algo|matarme|suicidarme)\b/],
    ['que_todo_termine', /\b(?:quiero|quisiera) que todo (?:termine|acabe|se acabe) para siempre\b/],
    ['dormir_y_no_despertar', new RegExp(String.raw`\b(?:dormirme|dormir|quedarme dormid[oa]) y (?:ya )?no (?:despertar|despierte|me despierten|despertarme)\b|`
        + String.raw`\bque (?:ya )?no me despierten nunca\b|\bno despertar nunca\b`)],
    ['preferir_no_vivir', /\b(?:prefiero|preferiria) (?:no estar (?:vivo|viva)|morir|estar muert[oa]|no vivir)\b/],
    ['no_haber_nacido', /\b(?:quisiera|ojala|hubiera querido) no (?:haber nacido|hubiera nacido|existir)\b/],
    ['da_igual_vivir', /\bme da igual (?:vivir o morir|morir|morirme|si me muero|si vivo o muero)\b/],
    ['sin_salida', /\bya no le veo (?:sentido|salida) a nada\b|\bno le veo (?:sentido|salida) a (?:nada|la vida)\b/],
    ['irse_del_mundo', /\b(?:me quiero ir|quiero irme|quisiera irme|me gustaria irme) de (?:este|el) mundo\b/],
    ['nadie_extranaria', new RegExp(String.raw`\b(?:a nadie le (?:haria|hara) falta|nadie me (?:extranaria|echaria de menos|lloraria)|`
        + String.raw`nadie (?:notaria|se daria cuenta) si (?:yo )?(?:no estuviera|desapareciera|me fuera))\b`)],
    ['no_abrir_los_ojos', /\bganas de no (?:volver a )?(?:abrir los ojos|despertar|levantarme nunca)\b/],
    ['volvi_a_lastimarme', new RegExp(String.raw`\b(?:volvi a lastimarme|me volvi a lastimar|me lastime otra vez|volvi a hacerme dano|me volvi a hacer dano|`
        + String.raw`volvi a cortarme(?! (?:el pelo|el cabello|las unas|la barba|el flequillo)))\b`)]
];

// Escrituras informales muy comunes que se normalizan antes de buscar.
const VARIANTES = [
    [/\bkiero\b/g, 'quiero'],
    [/\bkisiera\b/g, 'quisiera'],
    [/\bno quero\b/g, 'no quiero'],
    [/\bq(?= quiero| no| me)\b/g, 'que']
];

// Devuelve { riesgo: boolean, motivos: [nombres de patrón] }.
// No devuelve el texto de la persona (para no filtrarlo a registros).
function evaluarRiesgo(sueno = '', respuestas = '') {
    let texto = normalizarTexto(`${sueno} . ${respuestas || ''}`);
    texto = texto.replace(MODISMO, ' modismo ');
    for (const [patron, reemplazo] of VARIANTES) texto = texto.replace(patron, reemplazo);
    const motivos = PATRONES.filter(([, patron]) => patron.test(texto)).map(([nombre]) => nombre);
    return { riesgo: motivos.length > 0, motivos };
}

// ----------------------------------------------------------- respuesta fija
// REVISAR CON UN PROFESIONAL DE SALUD MENTAL antes de publicar.
const MENSAJE_CRISIS = 'Gracias por contarme esto, de verdad. Lo que cuentas es más importante que cualquier '
    + 'interpretación de un sueño, y no quiero pasarlo por alto. Siento que estés cargando con '
    + 'tanto dolor, y no tienes que hacerlo a solas. Si puedes, habla hoy mismo con alguien de '
    + 'confianza o con un profesional de salud mental. Si sientes que podrías hacerte daño pronto '
    + 'o estás en peligro, contacta de inmediato a los servicios de emergencia de tu país o a una '
    + 'línea de ayuda; abajo encontrarás recursos. Aquí sigo contigo.';

// VERIFICAR que los teléfonos sigan vigentes antes de publicar.
const RECURSOS = {
    MX: [
        { nombre: 'Emergencias', contacto: '911' },
        { nombre: 'Línea de la Vida (apoyo en crisis y salud mental)', contacto: '800 911 2000' },
        { nombre: 'Locatel CDMX (apoyo psicológico, 24 horas)', contacto: '55 5658 1111' }
    ]
};
const RECURSOS_GENERICOS = [
    { nombre: 'Servicios de emergencia de tu país', contacto: '' },
    { nombre: 'Directorio internacional de líneas de ayuda', contacto: 'findahelpline.com' }
];
const recursosPara = (pais) => RECURSOS[String(pais || '').toUpperCase()] || RECURSOS_GENERICOS;

// Texto listo para mostrar en el chat (mensaje + recursos), sin tocar el front-end.
function textoCrisis(pais = 'MX', mensaje = MENSAJE_CRISIS) {
    const lineas = recursosPara(pais).map((r) => (r.contacto ? `• ${r.nombre}: ${r.contacto}` : `• ${r.nombre}`));
    return `${mensaje}\n\n${lineas.join('\n')}`;
}

module.exports = { evaluarRiesgo, normalizarTexto, textoCrisis, recursosPara, MENSAJE_CRISIS, RECURSOS };

// ------------------------------------------------------------------ pruebas
if (require.main === module) {
    const DEBE_ALERTAR = [
        'Ya no aguanto más y nada me importa. A veces pienso que a nadie le haría falta.',
        'Hace meses que despierto con ganas de no volver a abrir los ojos.',
        'Creo que me quiero ir de este mundo. Ya no le veo sentido a nada.',
        'Anoche volví a lastimarme otra vez y no sé a quién decírselo.',
        'No quiero seguir viviendo.',
        'Ya no quiero estar aquí. He pensado en terminar con todo.',
        'A veces pienso en hacerme daño.',
        'Me hago daño cuando me siento mal y esta semana lo hice otra vez.',
        'Siento que no vale la pena vivir.',
        'Pienso que desaparecer sería un descanso.',
        'Quiero quitarme la vida.',
        'Tengo pensamientos suicidas desde hace semanas.',
        'Me quiero morir.',
        'Siento que todos estarían mejor sin mí.',
        'Sería mejor no despertar.',
        'Pienso en matarme.',
        'Me corto los brazos cuando no aguanto.',
        'No quiero despertar nunca.',
        'Últimamente no tengo ganas de vivir.',
        'Quiero que todo termine para siempre.',
        'Quiero dormirme y que ya no me despierten nunca.',
        'No soporto seguir así, prefiero no estar viva.',
        'Estuve a punto de hacerme algo malo anoche.',
        'He estado cortándome otra vez.',
        'Quisiera no haber nacido.',
        'NO QUIERO SEGUIR VIVIENDO!!!',
        'no kiero seguir viviendo',
        'Me da igual vivir o morir.'
    ];
    const NO_DEBE_ALERTAR = [
        'Me muero de ganas de que termine el semestre para descansar.',
        'Soñé que me iba de este mundo en una nave espacial y era divertido.',
        'No le veo sentido a esta tarea del trabajo, es repetitiva.',
        'Me quería morir de vergüenza.',
        'Me muero de risa con mi hermano.',
        'Me quiero morir de pena por lo que dije.',
        'Estoy muerta de cansancio.',
        'Un hombre intentaba matarme por la calle y yo corría.',
        'Alguien quería hacerme daño y yo me escondía.',
        'Soñé con mi propio funeral y veía a mis amigos llorar.',
        'Soñé que mi mejor amigo se moría en un accidente.',
        'Soñé que mi amigo se suicidaba y yo no pude ayudarlo.',
        'No quiero estar aquí en la fiesta, se me hace aburrida.',
        'No quiero despertar temprano mañana.',
        'Quiero terminar con todo esto antes del viernes.',
        'No tiene sentido seguir con esta tesis tan larga.',
        'Voy a desaparecer un tiempo de las redes.',
        'Me corté el pelo y me siento rara.',
        'Se me cayó una ola gigante encima y sentí que moría.',
        'Me hice daño en la rodilla jugando futbol.',
        'Quiero que todo termine bien en mi boda.',
        'Me da igual vivir en una ciudad o en otra.',
        'Volví a cortarme el pelo y me gusta.',
        'Mi tío se quitó la vida hace un año y soñé con él.',
        'Estoy leyendo un libro sobre prevención del suicidio para mi tesis.',
        'Soñé que me tiraba de un puente pero volaba.',
        'Me da mucho miedo morir cuando vuelo en avión.',
        'Prefiero no estar en esa reunión.',
        'Me quedé dormida y no desperté a tiempo para el examen.'
    ];
    let fallos = 0;
    for (const t of DEBE_ALERTAR) {
        if (!evaluarRiesgo(t).riesgo) { console.log(`  FALLO (debía alertar): ${t}`); fallos++; }
    }
    for (const t of NO_DEBE_ALERTAR) {
        const r = evaluarRiesgo(t);
        if (r.riesgo) { console.log(`  FALLO (no debía alertar): ${t} -> ${r.motivos}`); fallos++; }
    }
    console.log(`Frases de prueba: ${DEBE_ALERTAR.length} deben alertar, ${NO_DEBE_ALERTAR.length} no. Fallos: ${fallos}`);
    process.exit(fallos ? 1 : 0);
}
