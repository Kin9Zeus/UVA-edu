import type { Metadata } from "next";
import { getUsuarios } from "@/lib/admin/usuarios";
import { getResumenUsuarios } from "@/lib/admin/usuarios-estudio";
import { UsuariosTable } from "@/components/admin/usuarios/UsuariosTable";
import { ResumenUsuarios } from "@/components/admin/usuarios/ResumenUsuarios";
import {
  fechaDeFiltro,
  numeroDePagina,
  parametroUnico,
  textoDeBusqueda,
  type ParametroUrl,
} from "@/lib/parametros-url";
import { EncabezadoPagina } from "@/components/admin/EncabezadoPagina";
import { PRECIOS_HABILITADOS } from "@/lib/features";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Usuarios",
};

export default async function AdminUsuariosPage({
  searchParams,
}: {
  // Tipo real (un parámetro repetido llega como arreglo): ver lib/parametros-url.ts.
  searchParams: Promise<{
    q?: ParametroUrl;
    desde?: ParametroUrl;
    hasta?: ParametroUrl;
    rol?: ParametroUrl;
    estado?: ParametroUrl;
    suscripcion?: ParametroUrl;
    estudio?: ParametroUrl;
    origen?: ParametroUrl;
    page?: ParametroUrl;
  }>;
}) {
  const filtros = await searchParams;

  // Las invitaciones (cuántas quedan, cuánta gente entró) viven en Códigos de
  // invitación; los rankings de avance, en Cursos. Aquí: quién estudia.
  // La gráfica y las cifras no reciben los filtros: son de toda la plataforma.
  const [resultado, resumen] = await Promise.all([
    getUsuarios({
      query: textoDeBusqueda(filtros.q),
      desde: fechaDeFiltro(filtros.desde),
      hasta: fechaDeFiltro(filtros.hasta),
      rol: parametroUnico(filtros.rol),
      estado: parametroUnico(filtros.estado),
      suscripcion: parametroUnico(filtros.suscripcion),
      estudio: parametroUnico(filtros.estudio),
      origen: parametroUnico(filtros.origen),
      // Sin tope: esta tabla no pasa por unstable_cache (motivo de PAGINA_MAXIMA).
      pagina: numeroDePagina(filtros.page, Number.MAX_SAFE_INTEGER),
    }),
    getResumenUsuarios(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion={
          PRECIOS_HABILITADOS
            ? "Quién paga, quién estudia y quién dejó de hacerlo."
            : "Quién estudia, quién dejó de hacerlo y quién nunca empezó."
        }
      />
      <ResumenUsuarios resumen={resumen} />
      <UsuariosTable resultado={resultado} conCobro={PRECIOS_HABILITADOS} ahora={new Date().toISOString()} />
    </div>
  );
}
