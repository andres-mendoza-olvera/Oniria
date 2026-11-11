const themeBtn = document.getElementById('theme-toggle');

// 1. Revisar si el usuario ya había elegido un tema antes y aplicarlo al cargar la página
const temaGuardado = localStorage.getItem('vibe_tema');

if (temaGuardado === 'Oscuro') {
    document.body.classList.add('dark-theme');
    if (themeBtn) themeBtn.textContent = '🌙';
} else {
    if (themeBtn) themeBtn.textContent = '☀️';
}

// 2. Funcionalidad del botón al hacer clic
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        // Alterna la clase en el body
        document.body.classList.toggle('dark-theme');
        
        // Cambia el icono y guarda la preferencia en la memoria del navegador
        if (document.body.classList.contains('dark-theme')) {
            themeBtn.textContent = '🌙';
            localStorage.setItem('vibe_tema', 'Oscuro');
        } else {
            themeBtn.textContent = '☀️';
            localStorage.setItem('vibe_tema', 'Claro');
        }
    });
}