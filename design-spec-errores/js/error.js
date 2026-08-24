// Boton "Reintentar" de la pantalla 500.
// En Next.js (error.tsx) reemplazar por la prop reset() del boundary.
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-retry]');
  if (!btn) return;
  window.location.reload();
});
