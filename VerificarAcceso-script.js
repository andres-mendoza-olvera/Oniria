// =========================================================
// CÓDIGO DE ACCESO (paso 2 de 2 al iniciar sesión)
// El servidor ya mandó un código al correo; aquí se escribe, se puede
// reenviar o pedir por SMS (si la persona verificó su teléfono).
// =========================================================
const $ = (id) => document.getElementById(id);

const estado = {
    metodo: null,          // 'correo' | 'sms' (por dónde se mandó el último código)
    metodos: {},           // { correo: 'd•••o@gmail.com', sms: '+52 ••• ••• 6015' | null }
    esperaHasta: 0         // no se puede reenviar antes de esta hora
};

// Regresa al login con un mensaje (cuando el proceso caducó)
function volverAlLogin(mensaje) {
    window.location.href = '/?error=' + encodeURIComponent(mensaje) + '&field=email';
}

async function api(url, opciones = {}) {
    const respuesta = await fetch(url, {
        ...opciones,
        headers: opciones.body ? { 'Content-Type': 'application/json' } : undefined
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (respuesta.status === 401) {
        volverAlLogin(datos.error || 'Tu inicio de sesión caducó. Vuelve a entrar.');
        throw new Error('caducó');
    }
    if (!respuesta.ok) throw new Error(datos.error || 'Ocurrió un error, intenta de nuevo.');
    return datos;
}

function aviso(texto, esError = false) {
    $('aviso').textContent = texto || '';
    $('aviso').classList.toggle('visible', Boolean(texto));
    $('aviso').classList.toggle('error', esError);
}

function errorCodigo(texto) {
    $('error-codigo').textContent = texto || '';
    $('error-codigo').style.display = texto ? 'block' : 'none';
    $('codigo').classList.toggle('input-error', Boolean(texto));
}

// Textos según por dónde llegó el código
function pintar(destino) {
    const porSms = estado.metodo === 'sms';
    $('titulo-medio').textContent = porSms ? 'celular' : 'correo';
    $('aviso-spam').hidden = porSms || !destino; // la imagen solo aplica al correo
    $('instrucciones').textContent = destino
        ? `Para proteger tu cuenta, escribe el código de 6 dígitos que te mandamos ${porSms ? 'por SMS al' : 'a'} ${destino}.`
        : 'No pudimos mandarte el código. Pica "Reenviar código" para intentarlo de nuevo.';

    // El "otro" método disponible
    const otro = porSms ? 'correo' : 'sms';
    const destinoOtro = estado.metodos[otro];
    $('btn-otro-metodo').hidden = !destinoOtro;
    if (destinoOtro) {
        $('btn-otro-metodo').textContent = otro === 'sms' ? `Mandarlo por SMS a ${destinoOtro}` : `Mandarlo a mi correo (${destinoOtro})`;
        $('btn-otro-metodo').dataset.metodo = otro;
    }
}

// Cuenta regresiva para "Reenviar código" (el servidor permite uno por minuto)
function iniciarEspera() {
    estado.esperaHasta = Date.now() + 60 * 1000;
    actualizarEspera();
}
function actualizarEspera() {
    const faltan = Math.ceil((estado.esperaHasta - Date.now()) / 1000);
    const bloqueado = faltan > 0;
    $('btn-reenviar').disabled = bloqueado;
    $('btn-otro-metodo').disabled = bloqueado;
    $('btn-reenviar').textContent = bloqueado ? `Reenviar código (${faltan} s)` : 'Reenviar código';
    if (bloqueado) setTimeout(actualizarEspera, 1000);
}

async function enviar(metodo) {
    aviso('');
    errorCodigo('');
    $('btn-reenviar').disabled = true;
    $('btn-otro-metodo').disabled = true;
    try {
        const r = await api('/api/acceso/enviar', { method: 'POST', body: JSON.stringify({ metodo }) });
        estado.metodo = r.metodo;
        pintar(r.destino);
        aviso(r.metodo === 'sms' ? `📱 Te mandamos un código nuevo por SMS a ${r.destino}.` : `✉️ Te mandamos un código nuevo a ${r.destino}.`);
        $('codigo').value = '';
        $('codigo').focus();
        iniciarEspera();
    } catch (err) {
        if (err.message === 'caducó') return;
        aviso(err.message, true);
        actualizarEspera();
    }
}

$('btn-reenviar').addEventListener('click', () => enviar(estado.metodo || 'correo'));
$('btn-otro-metodo').addEventListener('click', (e) => enviar(e.currentTarget.dataset.metodo));

// Solo números en la casilla; con 6 dígitos se manda solo
$('codigo').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    errorCodigo('');
    if (e.target.value.length === 6) $('form-codigo').requestSubmit();
});

$('form-codigo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = $('codigo').value;
    if (codigo.length !== 6) return errorCodigo('Escribe los 6 dígitos del código.');

    const boton = $('btn-verificar');
    boton.disabled = true;
    boton.textContent = 'Revisando…';
    try {
        const r = await api('/api/acceso/verificar', { method: 'POST', body: JSON.stringify({ codigo }) });
        boton.textContent = '¡Listo!';
        window.location.href = r.ir || '/feed';
    } catch (err) {
        if (err.message === 'caducó') return;
        errorCodigo(err.message);
        $('codigo').select();
        boton.disabled = false;
        boton.textContent = 'Entrar';
    }
});

// Arranque: ¿a dónde se mandó el primer código?
(async () => {
    try {
        const info = await api('/api/acceso');
        estado.metodo = info.metodo || 'correo';
        estado.metodos = info.metodos;
        pintar(info.destino);
        if (info.error) aviso(info.error, true);
        else if (info.destino) iniciarEspera();
        $('codigo').focus();
    } catch (err) {
        if (err.message !== 'caducó') aviso(err.message, true);
    }
})();
