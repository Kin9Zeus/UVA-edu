import { Boton, Cota, Fuerte, MarcoCorreo, Parrafo, Titulo } from "./marco/marco";
import { primerNombre } from "./marco/nombres";

/** "termina hoy" / "termina mañana" / "termina en N días": "quedan 0 días" solo lo escribe un programa. */
function cuando(diasRestantes: number): string {
  if (diasRestantes <= 0) return "termina hoy";
  if (diasRestantes === 1) return "termina mañana";
  return `termina en ${diasRestantes} días`;
}

function etiquetaCota(diasRestantes: number): string {
  if (diasRestantes <= 0) return "Último día";
  if (diasRestantes === 1) return "Falta 1 día";
  return `Faltan ${diasRestantes} días`;
}

export function asuntoVencimientoProximo(diasRestantes: number): string {
  return `Tu acceso a U.V.A. ${cuando(diasRestantes)}`;
}

type VencimientoProximoEmailProps = {
  nombre: string;
  planNombre: string;
  /** Días de calendario colombiano que faltan. 0 = vence hoy. */
  diasRestantes: number;
  /** Ya formateadas por `formatFecha`. */
  fechaHoy: string;
  fechaVencimiento: string;
  urlPlanes: string;
};

/**
 * Hoja 07. Aviso de que el acceso está por terminar.
 *
 * Este correo ES el modelo de negocio. Wompi no tiene cobro recurrente sobre
 * PSE ni Nequi —y para tarjeta todavía no lo construimos—, así que el acceso
 * se compra por períodos y nadie lo renueva solo. Sin este aviso, el
 * estudiante no se entera de que venció: simplemente un día deja de poder
 * entrar, y eso se lee como que el producto se rompió.
 *
 * El tono no es de cobro sino de aviso: el estudiante no debe nada, tiene algo
 * que está por terminarse. Por eso no hay "renueva ya" ni urgencia inventada.
 */
export function VencimientoProximoEmail({ nombre, planNombre, diasRestantes, fechaHoy, fechaVencimiento, urlPlanes }: VencimientoProximoEmailProps) {
  const corto = primerNombre(nombre);
  return (
    <MarcoCorreo
      vistaPrevia="Tu progreso y tus certificados se quedan donde están."
      seccion="Tu acceso"
      nombre="Acceso por vencer"
      hoja="07"
      motivo="Te avisamos unos días antes de que termine tu acceso."
    >
      <Titulo>{`Tu acceso ${cuando(diasRestantes)}`}</Titulo>
      <Cota etiqueta={etiquetaCota(diasRestantes)} desde={fechaHoy} hasta={fechaVencimiento} />
      <Parrafo pad="0 0 14px">
        {corto ? (
          <>
            Hola, <Fuerte>{corto}</Fuerte>.{" "}
          </>
        ) : (
          "Hola. "
        )}
        Tu <Fuerte>{planNombre}</Fuerte> va hasta el <Fuerte>{fechaVencimiento}</Fuerte>. Después dejarás de ver los cursos, pero tu progreso y tus
        certificados se quedan donde están.
      </Parrafo>
      <Parrafo>Si quieres seguir, puedes renovarlo desde tu cuenta.</Parrafo>
      <Boton href={urlPlanes} pad="4px 0 0">
        Renovar mi acceso
      </Boton>
    </MarcoCorreo>
  );
}
