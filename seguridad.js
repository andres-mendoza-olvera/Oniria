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

// ------------------------------------------------- segundo nivel: "cuidado"
// Ideación PASIVA: no dice "me quiero matar", pero expresa cansancio de vivir o ganas de desaparecer,
// aunque sea dentro del relato de un sueño ("pensé que sería agradable dejar de estar allí",
// "estaba cansado de tener que continuar", "que nadie notara mi ausencia").
// Respuesta: mensaje de cuidado (más suave que el de crisis), sin que intervenga ninguna IA.
// Lo que le pasa a OTRAS personas o a personajes del sueño ("mi abuelo quería morir") no cuenta.
const CONTINUAR_SIN_OBJETO = String.raw`(?! (?:con|corriendo|caminando|esperando|trabajando|estudiando|haciendo|discutiendo|peleando|buscando|intentando|`
    + String.raw`insistiendo|escribiendo|leyendo|viendo|jugando|manejando|subiendo|bajando|el|la|los|las|este|esta|ese|esa|mi|mis|tu|un|una|asi))`;
const CUIDADO = [
    ['cansado_de_continuar', new RegExp(String.raw`\b(?:cansad[oa]|harto|harta|agotad[oa]|fatigad[oa]) de (?:tener que )?(?:continuar|seguir|luchar)\b${CONTINUAR_SIN_OBJETO}`)],
    ['cansado_de_vivir', /\b(?:cansad[oa]|harto|harta|agotad[oa]|fatigad[oa]) de (?:tener que )?(?:vivir|existir)\b(?! (?:aqui|alli|en (?:esta|esa|este|ese) (?:ciudad|casa|pais|barrio|departamento)|con (?:mis|mi|tanto|ruido)))/],
    ['dejar_de_existir', /\bdejar de (?:existir|respirar)\b|\bdejar de estar (?:alli|aqui|ahi|en este mundo|en el mundo|presente)\b/],
    ['nadie_notara_ausencia', /\bnadie (?:notara|notaria|se dara cuenta de|se daria cuenta de|se enterara de|se enteraria de) (?:mi )?(?:ausencia|que (?:ya )?no estoy|que me (?:fui|voy|vaya))\b/],
    ['desear_desaparecer', /\b(?:quisiera|queria|quiero|me gustaria|desearia|seria (?:agradable|lindo|bonito|un alivio|un descanso|mejor)) (?:simplemente |solo |solamente )?(?:desaparecer(?! (?:del mapa|de las redes|de redes|un rato|un tiempo|por (?:unos|un)|unos dias|de aqui un))|no existir|no estar aqui|no estar alli|dejar de ser)\b/],
    ['no_seguir_adelante', /\b(?:ya )?no quiero (?:seguir|continuar) (?:adelante|asi|con mi vida|con todo|con nada)\b/],
    ['sin_fuerzas_para_vivir', /\bno (?:tengo|me quedan) (?:fuerzas|ganas|energia) (?:para|de) (?:seguir|continuar|vivir)\b(?! (?:con|el|la|los|las|este|esta|trabajando|estudiando))/],
    ['calma_ante_desaparecer', /\b(?:calma|paz|tranquilidad|alivio) (?:ante|con|al pensar en) (?:la idea de )?(?:desaparecer|no estar|no existir|irme para siempre)\b/],
    ['dudar_si_notarian', /\b(?:me pregunto|me pregunta|dudo|me da curiosidad|pienso|me cuestiono) (?:si )?(?:realmente |de verdad |acaso )?(?:notarian|extranarian|se darian cuenta de|les importaria|le importaria a alguien) (?:mi |que |si )?(?:ausencia|no estoy|no estuviera|me fuera|desapareciera)/],
    ['dudar_que_alguien_note', /\b(?:dudo que|no creo que|no se si) (?:alguien|nadie|la gente|mi familia|mis amigos) (?:notaria|notara|notase|extranaria|extranara|se daria cuenta de|se diera cuenta de|se enteraria de) (?:mi |que )?(?:ausencia|no estoy|no estuviera|me fuera|desapareciera)/],
    ['vidas_igual_sin_mi', /\b(?:sus|las|la|el mundo|todo) (?:vidas? )?(?:continuarian|seguirian|seguiria|continuaria) (?:exactamente )?igual sin mi\b/],
    ['que_todo_pare', /\b(?:quiero|queria|quisiera) que (?:el tiempo|todo|la vida) (?:se detuviera|se detenga|parara|pare|dejara de avanzar|dejara de seguir)\b.{0,80}\b(?:nadie|ausencia|desaparec|dejar de estar)\b/]
];

// Devuelve { cuidado: boolean, motivos }. Se usa SOLO si evaluarRiesgo no detectó crisis explícita.
function evaluarCuidado(sueno = '', respuestas = '') {
    let texto = normalizarTexto(`${sueno} . ${respuestas || ''}`);
    texto = texto.replace(MODISMO, ' modismo ');
    for (const [patron, reemplazo] of VARIANTES) texto = texto.replace(patron, reemplazo);
    const motivos = CUIDADO.filter(([, patron]) => patron.test(texto)).map(([nombre]) => nombre);
    return { cuidado: motivos.length > 0, motivos };
}

// ----------------------------------------------------------- respuesta fija
// REVISAR CON UN PROFESIONAL DE SALUD MENTAL antes de publicar.
const MENSAJE_CRISIS = 'Gracias por contarme esto, de verdad. Lo que cuentas es más importante que cualquier '
    + 'interpretación de un sueño, y no quiero pasarlo por alto. Siento que estés cargando con '
    + 'tanto dolor, y no tienes que hacerlo a solas. Si puedes, habla hoy mismo con alguien de '
    + 'confianza o con un profesional de salud mental. Si sientes que podrías hacerte daño pronto '
    + 'o estás en peligro, contacta de inmediato a los servicios de emergencia de tu país o a una '
    + 'línea de ayuda; abajo encontrarás recursos. Aquí sigo contigo.';

// REVISAR CON UN PROFESIONAL DE SALUD MENTAL antes de publicar.
const MENSAJE_CUIDADO = 'Gracias por contarme este sueño. Antes de interpretarlo quiero detenerme en algo: lo que escribes habla de '
    + 'mucho cansancio y de ganas de desaparecer o de que nadie lo note. Eso me importa más que cualquier interpretación. '
    + 'Si algo de eso lo sientes también cuando estás despierto, no tienes que cargarlo solo: hablar con alguien de confianza '
    + 'o con un profesional puede ayudar. Si en algún momento sientes que podrías hacerte daño, contacta de inmediato a '
    + 'emergencias; abajo hay líneas que atienden. Si solo quieres que miremos el sueño, cuéntame cómo te sentiste al '
    + 'despertar y seguimos con calma.';

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

module.exports = { evaluarRiesgo, evaluarCuidado, normalizarTexto, textoCrisis, recursosPara, MENSAJE_CRISIS, MENSAJE_CUIDADO, RECURSOS };

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

    // ---- segundo nivel: cuidado (ideación pasiva)
    const DEBE_CUIDAR = [
        'Soñé que estaba en una estación vacía. Pensé que sería agradable simplemente dejar de estar allí. No tenía miedo, estaba cansado de tener que continuar. Solo quería que el tiempo dejara de avanzar y que nadie notara mi ausencia.',
        'Estaba cansada de seguir y quería desaparecer.',
        'Sentía que nadie notaría mi ausencia si no estuviera.',
        'Quisiera dejar de existir un rato.',
        'Ya no quiero seguir adelante.',
        'No tengo fuerzas para seguir.',
        'Estoy harto de tener que vivir así.',
        'Quisiera desaparecer, simplemente no existir.',
        'Me pregunto si realmente notarían mi ausencia o si sus vidas continuarían exactamente igual sin mí.',
        'No sentí enojo, sino cierta calma ante la idea de desaparecer.',
        'Dudo que alguien se daría cuenta de mi ausencia.'
    ];
    const NO_DEBE_CUIDAR = [
        'Soñé que corría por un bosque y estaba cansado de seguir corriendo, pero llegué a una casa.',
        'Estoy cansada de seguir con este trabajo, quiero cambiar de empleo.',
        'Soñé que mi abuelo quería morir y yo se lo impedía.',
        'Soñé que dejaba de estar en la escuela y me daba alegría.',
        'Quiero dejar de estar triste, ¿qué puedo hacer?',
        'Soñé que el tiempo se detenía y yo podía volar sobre la ciudad.',
        'Voy a desaparecer un tiempo de las redes.',
        'Soñé que me escondía y nadie notaba mi presencia, fue divertido.',
        'No quiero seguir con esta tarea, es muy larga.',
        'Estaba cansado de seguir esperando el autobús.',
        'Soñé que estaba en mi casa y cayeron bombas del cielo.',
        'Soñé que explotaba la luna y desperté.',
        'No tengo ganas de seguir estudiando esta noche.',
        'Me gustaría desaparecer del mapa en vacaciones, irme a una playa.',
        'Me pregunto si mis amigos notarían el cambio de look que me hice.',
        'Sentí calma ante la idea de viajar sola.',
        'Soñé con la vida de mis abuelos y cómo seguirían igual sin mí en la foto, pero me reí.'
    ];
    let fallosCuidado = 0;
    for (const t of DEBE_CUIDAR) {
        if (!evaluarCuidado(t).cuidado) { console.log(`  FALLO (debía cuidar): ${t.slice(0, 70)}`); fallosCuidado++; }
    }
    for (const t of NO_DEBE_CUIDAR) {
        const r = evaluarCuidado(t);
        if (r.cuidado) { console.log(`  FALLO (no debía cuidar): ${t} -> ${r.motivos}`); fallosCuidado++; }
    }
    // El primer nivel no cambia: ninguna frase de cuidado debe quedar fuera de revisión, y las de crisis siguen siendo crisis
    console.log(`Cuidado: ${DEBE_CUIDAR.length} deben activarlo, ${NO_DEBE_CUIDAR.length} no. Fallos: ${fallosCuidado}`);
    fallos += fallosCuidado;
    process.exit(fallos ? 1 : 0);
}
