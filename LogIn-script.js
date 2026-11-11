// Leemos la URL actual
const parametros = new URLSearchParams(window.location.search);
const mensajeError = parametros.get('error');
const campo = parametros.get('field'); // Leemos si fue 'email' o 'password'

if (mensajeError && campo) {
    // Buscamos las etiquetas exactas de ese campo
    const spanError = document.getElementById(`error-${campo}`);
    const inputError = document.getElementById(campo);

    if (spanError && inputError) {
        // Ponemos el mensaje y lo hacemos visible
        spanError.textContent = mensajeError;
        spanError.style.display = 'block';
        
        // Pintamos el borde de la caja de texto en rojo
        inputError.classList.add('input-error');
    }
    
    // Limpiamos la URL para que se vea limpia
    window.history.replaceState(null, null, window.location.pathname);
}

// --- FUNCIONALIDAD DEL OJO DE CONTRASEÑA ---
const togglePasswordBtn = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');

if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', function () {
        // Verificamos qué tipo de input es actualmente
        const tipoActual = passwordInput.getAttribute('type');
        
        // Si es password lo pasamos a texto, si es texto lo regresamos a password
        if (tipoActual === 'password') {
            passwordInput.setAttribute('type', 'text');
            this.textContent = '🙈'; // Ojo cerrado
        } else {
            passwordInput.setAttribute('type', 'password');
            this.textContent = '👁️'; // Ojo abierto
        }
    });
}