import type { Metadata } from "next";
import { Ticket, TicketCheck, UserCheck, Activity } from "lucide-react";
import { getUsuarios } from "@/lib/admin/usuarios";
import { getMetricasPanel, getAvanceCursos, getAbandonoLecciones } from "@/lib/admin/metricas";
import { MetricaCard } from "@/components/admin/MetricaCard";
import { AdminCard } from "@/components/admin/AdminCard";
import { UsuariosTable } from "@/components/admin/usuarios/UsuariosTable";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Usuarios",
};

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    desde?: string;
    hasta?: string;
    rol?: string;
    estado?: string;
    suscripcion?: string;
    page?: string;
  }>;
}) {
  const filtros = await searchParams;

  // Los KPIs y los rankings NO reciben los filtros: el rango de fechas actúa
  // solo sobre la tabla. "Cupos disponibles" es un saldo, no un flujo, y
  // acotarlo a un periodo no significa nada.
  const [resultado, metricas, avanceCursos, abandono] = await Promise.all([
    getUsuarios({
      query: filtros.q,
      desde: filtros.desde,
      hasta: filtros.hasta,
      rol: filtros.rol,
      estado: filtros.estado,
      suscripcion: filtros.suscripcion,
      pagina: filtros.page ? Number(filtros.page) : 1,
    }),
    getMetricasPanel(),
    getAvanceCursos(),
    getAbandonoLecciones(),
  ]);

  // "Cuántos invitados entraron" no se responde con una sola columna: hay dos
  // caminos de entrada y sumarlos es la única cifra honesta. Los otorgados a
  // mano no consumen invitación, por eso el desglose va en el subtítulo en
  // lugar de mezclarse en la aritmética de emitidas.
  const personasQueEntraron = metricas.cuposCanjeados + metricas.accesosOtorgadosAdmin;

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-3.5 text-sm text-uva-muted">
        Quién está usando la plataforma: invitaciones, acceso y avance real.
      </p>

      {/* Las cuatro tarjetas responden, en orden, las tres preguntas de la
          "Definición de terminado" de RevUsuariof4: cuántas invitaciones
          quedan, cuánta gente entró, y cuánta avanza de verdad.

          Solo cifras accionables. Las de cuadre contable (emitidas y
          caducadas) van en la línea de abajo: sirven para auditar la resta,
          no para decidir nada. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricaCard
          label="Invitaciones sin usar"
          valor={metricas.cuposDisponibles}
          detalle="personas que aún pueden entrar"
          icon={Ticket}
        />
        <MetricaCard
          label="Personas que entraron"
          valor={personasQueEntraron}
          detalle={
            metricas.accesosOtorgadosAdmin > 0
              ? `${metricas.cuposCanjeados} por invitación · ${metricas.accesosOtorgadosAdmin} por acceso directo`
              : "canjearon una invitación"
          }
          icon={TicketCheck}
        />
        <MetricaCard
          label="Con acceso hoy"
          valor={metricas.usuariosAccesoVigente}
          detalle={`de ${metricas.usuariosRegistrados} registrados · ${metricas.usuariosAccesoVencido} se les venció`}
          icon={UserCheck}
        />
        <MetricaCard
          label="Avanzando esta semana"
          valor={metricas.usuariosActivos7d}
          detalle="vieron contenido en los últimos 7 días"
          icon={Activity}
        />
      </div>

      {/* La resta tiene que poder auditarse: emitidas = usadas + sin usar +
          caducadas. Sin esta línea, 70 invitaciones caducadas simplemente
          desaparecerían del total y parecería un error de cálculo.

          Caducadas destaca en fucsia de marca (uva-accent-text) — visible sin
          ser una alerta aparte. Antes había un banner con umbral (caducadas >
          disponibles), pero ese acumulado solo crece con el tiempo (un código
          ya canjeado no se puede borrar, solo desactivar) y el banner
          terminaba prendido para siempre sin ninguna acción real que lo
          apagara. */}
      <p className="-mt-2 text-[12.5px] text-uva-muted-2">
        {metricas.cuposTotales} invitaciones emitidas en total:{" "}
        <span className="font-mono tabular-nums">{metricas.cuposCanjeados}</span> usadas,{" "}
        <span className="font-mono tabular-nums">{metricas.cuposDisponibles}</span> sin usar,{" "}
        <span className="font-mono font-semibold text-uva-accent-text tabular-nums">
          {metricas.cuposCaducados}
        </span>{" "}
        caducadas.
      </p>

      <UsuariosTable resultado={resultado} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminCard>
          <h2 className="font-heading text-[15px] font-bold">Cursos con más avance</h2>
          {avanceCursos.length === 0 ? (
            <p className="text-[13px] text-uva-muted-2">Todavía nadie ha empezado un curso.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {avanceCursos.map((curso) => (
                <li key={curso.cursoId} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[13px]">{curso.titulo}</span>
                  <span className="shrink-0 font-mono text-[12px] text-uva-muted tabular-nums">
                    {curso.avancePromedio}% · {curso.participantes}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard>
          <h2 className="font-heading text-[15px] font-bold">Dónde se atasca la gente</h2>
          {abandono.length === 0 ? (
            <p className="text-[13px] text-uva-muted-2">
              Ninguna lección lleva más de 14 días empezada sin terminar.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {abandono.map((leccion) => (
                <li key={leccion.leccionId} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[13px]">
                    {leccion.leccionTitulo}
                    <span className="text-uva-muted-2"> · {leccion.cursoTitulo}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-uva-muted tabular-nums">
                    {leccion.abandonos}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
