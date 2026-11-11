// =========================================================
// MEDIDOR DE FUERZA DE CONTRASEÑA
// Funciona con cualquier input que tenga el atributo data-fuerza.
// Debajo del input debe existir un <div class="fuerza-contrasena">.
// =========================================================

function evaluarContrasena(texto) {
    // Lo que le falta a la contraseña para ser más fuerte
    const consejos = [];
    let puntos = 0;

    if (texto.length >= 8) puntos++; else consejos.push('usa 8 caracteres o más');
    if (texto.length >= 12) puntos++;
    if (/[a-z]/.test(texto) && /[A-Z]/.test(texto)) puntos++; else consejos.push('mezcla mayúsculas y minúsculas');
    if (/[0-9]/.test(texto)) puntos++; else consejos.push('agrega un número');
    if (/[^A-Za-z0-9]/.test(texto)) puntos++; else consejos.push('agrega un símbolo (!, #, $...)');

    // Restamos si es algo muy obvio
    if (/^(.)\1+$/.test(texto) || /123456|qwerty|password|contrase/i.test(texto)) puntos = Math.min(puntos, 1);

    if (texto.length < 6) return { nivel: 'corta',   etiqueta: 'Muy corta (mínimo 6 caracteres)', consejos };
    if (puntos <= 2)      return { nivel: 'debil',   etiqueta: 'Débil',   consejos };
    if (puntos === 3)     return { nivel: 'mediana', etiqueta: 'Mediana', consejos };
    return                       { nivel: 'fuerte',  etiqueta: 'Fuerte',  consejos };
}

document.querySelectorAll('input[data-fuerza]').forEach((input) => {
    // Buscamos el medidor que está dentro del mismo .input-group
    const medidor = input.closest('.input-group').querySelector('.fuerza-contrasena');
    if (!medidor) return;

    const textoNivel = medidor.querySelector('.fuerza-texto');
    const textoConsejo = medidor.querySelector('.fuerza-consejo');

    input.addEventListener('input', () => {
        const valor = input.value;

        // Si está vacío, escondemos el medidor
        if (!valor) {
            medidor.className = 'fuerza-contrasena';
            return;
        }

        const resultado = evaluarContrasena(valor);
        medidor.className = `fuerza-contrasena visible nivel-${resultado.nivel}`;
        textoNivel.textContent = resultado.etiqueta;
        textoConsejo.textContent = resultado.nivel === 'fuerte' || resultado.consejos.length === 0
            ? ''
            : 'Tip: ' + resultado.consejos[0];
    });
});
