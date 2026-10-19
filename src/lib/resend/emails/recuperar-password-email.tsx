import { Boton, EnlaceRespaldo, Fuerte, MarcoCorreo, Nota, Parrafo, Recuadro, Titulo } from "@/emails/marco/marco";
import { primerNombre } from "@/emails/marco/nombres";

export const ASUNTO_RECUPERAR_PASSWORD = "Crea una contraseña nueva para U.V.A.";

type RecuperarPasswordEmailProps = {
  actionLink: string;
  nombre?: string;
  correo: string;
};

/** Hoja 02. Lo envía el gancho de correos de Supabase al pedir "Olvidé mi contraseña". */
export function RecuperarPasswordEmail({ actionLink, nombre, correo }: RecuperarPasswordEmailProps) {
  const corto = primerNombre(nombre);
  return (
    <MarcoCorreo
      vistaPrevia="Pediste cambiar tu contraseña."
      seccion="Seguridad de la cuenta"
      nombre="Recuperar contraseña"
      hoja="02"
      motivo="Recibes este correo porque alguien pidió cambiar la contraseña de esta cuenta."
    >
      <Titulo>Crea una contraseña nueva</Titulo>
      <Parrafo>
        {corto ? (
          <>
            Hola, <Fuerte>{corto}</Fuerte>.{" "}
          </>
        ) : (
          "Hola. "
        )}
        Recibimos una solicitud para cambiar la contraseña de tu cuenta <Fuerte>{correo}</Fuerte>.
      </Parrafo>
      <Boton href={actionLink} pad="4px 0 18px">
        Crear contraseña nueva
      </Boton>
      <Recuadro icono="alerta">
        <Fuerte>¿No fuiste tú?</Fuerte> Ignora este correo. Tu contraseña actual sigue igual y nadie puede cambiarla sin este enlace.
      </Recuadro>
      <Nota>El enlace vence pronto por seguridad y se usa una sola vez.</Nota>
      <EnlaceRespaldo href={actionLink} />
    </MarcoCorreo>
  );
}
