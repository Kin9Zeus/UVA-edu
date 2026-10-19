import { Boton, Carne, EnlaceRespaldo, Fuerte, MarcoCorreo, Nota, Parrafo, Titulo } from "./marco/marco";
import { primerNombre } from "./marco/nombres";

export const ASUNTO_CONFIRMAR_CUENTA = "Confirma tu correo para activar tu carné U.V.A.";

type ConfirmarCuentaEmailProps = {
  actionLink: string;
  /** El nombre que la persona escribió al registrarse (`user_metadata.nombre`). */
  nombre?: string;
  correo: string;
};

/** Hoja 01. Lo envía el gancho de correos de Supabase al registrarse. */
export function ConfirmarCuentaEmail({ actionLink, nombre, correo }: ConfirmarCuentaEmailProps) {
  const corto = primerNombre(nombre);
  return (
    <MarcoCorreo
      vistaPrevia="Un clic y tu cuenta queda activa."
      seccion="Confirmación de cuenta"
      nombre="Confirmar cuenta"
      hoja="01"
      motivo="Recibes este correo porque se creó una cuenta con esta dirección en U.V.A."
    >
      <Titulo>Confirma tu correo</Titulo>
      <Parrafo>
        {corto ? (
          <>
            Hola, <Fuerte>{corto}</Fuerte>.{" "}
          </>
        ) : (
          "Hola. "
        )}
        Gracias por registrarte en U.V.A. Confirma tu correo para activar tu carné y empezar tus cursos.
      </Parrafo>
      <Carne nombre={nombre?.trim() || correo} correo={correo} sello={{ texto: "Pendiente de confirmar", tono: "pendiente" }} />
      <Boton href={actionLink}>Confirmar mi correo</Boton>
      <Nota>El enlace vence pronto por seguridad y se usa una sola vez. Si no creaste esta cuenta, ignora este correo.</Nota>
      <EnlaceRespaldo href={actionLink} />
    </MarcoCorreo>
  );
}
