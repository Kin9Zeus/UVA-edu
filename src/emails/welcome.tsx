import { Boton, Carne, MarcoCorreo, Parrafo, Titulo } from "./marco/marco";
import { primerNombre } from "./marco/nombres";

export const ASUNTO_BIENVENIDA = "Tu carné U.V.A. está activo";

type WelcomeEmailProps = {
  nombre: string;
  correo: string;
  urlAcceso: string;
};

/** Hoja 04. Al canjear un código de invitación: cierra la historia del carné "pendiente". */
export function WelcomeEmail({ nombre, correo, urlAcceso }: WelcomeEmailProps) {
  const corto = primerNombre(nombre);
  return (
    <MarcoCorreo
      vistaPrevia="Ya tienes acceso completo a los cursos."
      seccion="Acceso"
      nombre="Bienvenida"
      hoja="04"
      motivo="Recibes este correo porque canjeaste un código de invitación en U.V.A."
    >
      <Titulo>{corto ? `¡Hola, ${corto}! Tu carné está activo` : "¡Hola! Tu carné está activo"}</Titulo>
      <Parrafo>Canjeaste tu código de invitación y ya tienes acceso completo a los cursos de U.V.A.</Parrafo>
      <Carne nombre={nombre.trim() || correo} correo={correo} sello={{ texto: "Acceso activo", tono: "activo" }} />
      <Boton href={urlAcceso} pad="4px 0 0">
        Ir a mi plataforma
      </Boton>
    </MarcoCorreo>
  );
}
