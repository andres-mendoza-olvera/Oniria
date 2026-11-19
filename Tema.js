// =========================================================
// TEMA CLARO / OSCURO (se carga en el <head> de todas las páginas)
// Se aplica antes de pintar la página para que no "parpadee".
// Si el usuario nunca eligió, se usa el tema de su sistema.
// =========================================================
(function () {
    var guardado = null;
    try { guardado = localStorage.getItem('vibe_tema'); } catch (e) { /* sin almacenamiento */ }

    var oscuro = guardado
        ? guardado === 'Oscuro'
        : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (oscuro) document.documentElement.classList.add('dark-theme');
})();
