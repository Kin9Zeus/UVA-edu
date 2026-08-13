export function AuthVisual() {
  return (
    <section className="auth-visual" aria-label="Presentación">
      <div className="auth-visual__brand">
        U.V.A<span>.</span>
      </div>

      <div className="auth-visual__pitch">
        <h1>
          Aprende el oficio.
          <br />
          Presupuesta de verdad.
        </h1>
        <p>
          Formación para arquitectos, residentes de obra y presupuestadores.
          Rutas, plantillas de APU y planos que puedes usar mañana en la obra.
        </p>

        <div className="auth-visual__stats">
          <div>
            <div className="auth-visual__stat-value">180+</div>
            <div className="auth-visual__stat-label">cursos del gremio</div>
          </div>
          <div>
            <div className="auth-visual__stat-value">340</div>
            <div className="auth-visual__stat-label">plantillas y planos</div>
          </div>
          <div>
            <div className="auth-visual__stat-value">12</div>
            <div className="auth-visual__stat-label">rutas curadas</div>
          </div>
        </div>
      </div>

      <div className="auth-visual__footer">
        Arquitectura · Construcción · Presupuestos
      </div>

      <div className="auth-visual__blob" aria-hidden="true" />
      <div className="auth-visual__ring" aria-hidden="true" />
    </section>
  );
}
