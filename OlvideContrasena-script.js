// Leemos la URL para saber si el servidor mandó un aviso
const parametros = new URLSearchParams(window.location.search);

// Correo enviado -> mostramos el mensaje de éxito
if (parametros.get('enviado')) {
    document.getElementById('mensaje-exito').classList.add('visible');
}

// Hubo un error -> lo mostramos debajo del campo de correo
const mensajeError = parametros.get('error');
if (mensajeError) {
    const spanError = document.getElementById('error-email');
    spanError.textContent = mensajeError;
    spanError.style.display = 'block';
    document.getElementById('email').classList.add('input-error');
}

// Limpiamos la URL
if (parametros.toString()) {
    window.history.replaceState(null, null, window.location.pathname);
}
