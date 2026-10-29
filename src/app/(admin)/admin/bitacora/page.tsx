import type { Metadata } from "next";
import { BITACORA_POR_TANDA, BITACORA_VENTANA, getBitacora } from "@/lib/admin/bitacora";
import { TIPOS_BITACORA, type TipoBitacora } from "@/lib/admin/bitacora-tipos";
import { tiempoRelativo } from "@/lib/admin/format";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";
import { ResumenBitacora } from "@/components/admin/bitacora/ResumenBitacora";
import { FiltrosBitacora } from "@/components/admin/bitacora/FiltrosBitacora";
import { LineaTiempoBitacora } from "@/components/admin/bitacora/LineaTiempoBitacora";
import { fechaDeFiltro, numeroDePagina, parametroUnico, textoDeBusqueda, type ParametroUrl } from "@/lib/parametros-url";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Bitácora",
};

type Parametros = {
  tipo?: ParametroUrl;
  admin?: ParametroUrl;
  sensibles?: ParametroUrl;
  q?: ParametroUrl;
  desde?: ParametroUrl;
  hasta?: ParametroUrl;
  mostrar?: ParametroUrl;
};

function tipoDeFiltro(valor: ParametroUrl): TipoBitacora | null {
  const texto = parametroUnico(valor);
  return TIPOS_BITACORA.find((t) => t.clave === texto)?.clave ?? null;
}

export default async function AdminBitacoraPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  // Tipo real (un parámetro repetido llega como arreglo) y valores inválidos
  // ignorados en vez de dar 500: ver lib/parametros-url.ts.
  const parametros = await searchParams;
  const filtros = {
    tipo: tipoDeFiltro(parametros.tipo),
    admin: parametroUnico(parametros.admin) ?? null,
    sensibles: parametroUnico(parametros.sensibles) === "1",
    busqueda: textoDeBusqueda(parametros.q) ?? null,
    desde: fechaDeFiltro(parametros.desde),
    hasta: fechaDeFiltro(parametros.hasta),
    mostrar: parametros.mostrar ? numeroDePagina(parametros.mostrar, BITACORA_VENTANA) : BITACORA_POR_TANDA,
  };
  const resultado = await getBitacora(filtros);

  const actuales = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    const unico = parametroUnico(valor);
    if (unico && clave !== "mostrar") actuales.set(clave, unico);
  }
  const hayFiltros = Boolean(filtros.tipo || filtros.admin || filtros.sensibles || filtros.busqueda || filtros.desde || filtros.hasta);

  return (
    <div className="flex flex-col gap-7">
      <EncabezadoPagina
        titulo="Bitácora"
        descripcion="Quién hizo qué en el panel. Cada acción queda aquí y no se puede editar ni borrar."
      />
      <ResumenBitacora
        resumen={resultado.resumen}
        ultimaTexto={resultado.resumen.ultima ? tiempoRelativo(resultado.resumen.ultima) : null}
      />
      <section aria-label="Registro de acciones" className="flex flex-col gap-4">
        <FiltrosBitacora admins={resultado.admins} />
        <LineaTiempoBitacora
          entradas={resultado.entradas}
          total={resultado.total}
          truncada={resultado.truncada}
          mostrar={Math.max(BITACORA_POR_TANDA, filtros.mostrar)}
          hayFiltros={hayFiltros}
          parametros={actuales.toString()}
        />
      </section>
    </div>
  );
}
