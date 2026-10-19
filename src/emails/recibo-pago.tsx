import { Boton, Enlace, Ficha, MarcoCorreo, Parrafo, Recuadro, Titulo } from "./marco/marco";
import { primerNombre } from "./marco/nombres";
import { CORREO_SOPORTE } from "./marco/paleta";

export function asuntoReciboPago(vigenteHasta: string): string {
  return `Recibimos tu pago: acceso activo hasta el ${vigenteHasta}`;
}

type ReciboPagoEmailProps = {
  nombre: string;
  planNombre: string;
  /** Ya formateado por `formatearPrecio` — la plantilla no hace cuentas. */
  montoFormateado: string;
  /** Ya formateada en el calendario colombiano por `formatFecha`. */
  fechaPago: string;
  /** Hasta cuándo llega el acceso que se acaba de comprar. */
  vigenteHasta: string;
  /** La referencia del pago: es lo que hay que citarnos si algo no cuadra. */
  referencia: string;
  urlSuscripcion: string;
};

/** Hoja 08. Recibo de un pago aprobado (el cobro está apagado mientras el acceso sea por invitación). */
export function ReciboPagoEmail({ nombre, planNombre, montoFormateado, fechaPago, vigenteHasta, referencia, urlSuscripcion }: ReciboPagoEmailProps) {
  const corto = primerNombre(nombre);
  return (
    <MarcoCorreo
      vistaPrevia={`Recibimos tu pago de ${montoFormateado}.`}
      seccion="Pagos"
      nombre="Recibo de pago"
      hoja="08"
      motivo="Guarda este correo como comprobante."
      ayuda={
        <>
          ¿Algo no cuadra? Escríbenos a <Enlace href={`mailto:${CORREO_SOPORTE}`}>{CORREO_SOPORTE}</Enlace> con la referencia del pago.
        </>
      }
    >
      <Titulo>{corto ? `Listo, ${corto}. Tu acceso está activo` : "Listo. Tu acceso está activo"}</Titulo>
      <Parrafo>Recibimos tu pago y ya puedes entrar a todo el catálogo.</Parrafo>
      <Ficha
        filas={[
          { etiqueta: "Plan", valor: planNombre },
          { etiqueta: "Monto", valor: montoFormateado, codigo: true },
          { etiqueta: "Fecha de pago", valor: fechaPago },
          { etiqueta: "Acceso hasta", valor: vigenteHasta },
          { etiqueta: "Referencia", valor: referencia, codigo: true },
        ]}
      />
      <Recuadro icono="listo">
        Tu acceso no se renueva solo. Te avisamos por correo unos días antes de que termine para que decidas si sigues.
      </Recuadro>
      <Boton href={urlSuscripcion} pad="4px 0 0">
        Ver mi suscripción
      </Boton>
    </MarcoCorreo>
  );
}
