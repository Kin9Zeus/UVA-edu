import { Boton, BotonSecundario, Ficha, Fila, Fuerte, MarcoCorreo, Recuadro, Separador, Titulo } from "./marco/marco";
import { CLARO, CORREO_SOPORTE, LETRA } from "./marco/paleta";

export const ASUNTO_PASSWORD_ACTUALIZADA = "Tu contraseña de U.V.A. cambió";

type ContrasenaActualizadaEmailProps = {
  correo: string;
  /** Fecha y hora del cambio, ya formateada en hora de Colombia. */
  fechaCambio: string;
  urlLogin: string;
};

/** Hoja 03. Aviso de seguridad al guardar una contraseña nueva. */
export function ContrasenaActualizadaEmail({ correo, fechaCambio, urlLogin }: ContrasenaActualizadaEmailProps) {
  return (
    <MarcoCorreo
      vistaPrevia="Si no fuiste tú, escríbenos de inmediato."
      seccion="Seguridad de la cuenta"
      nombre="Contraseña actualizada"
      hoja="03"
      motivo="Te avisamos cada vez que cambia la contraseña de tu cuenta."
    >
      <Titulo>Tu contraseña cambió</Titulo>
      <Recuadro icono="listo">
        Guardamos la contraseña nueva de <Fuerte>{correo}</Fuerte>. Ya puedes iniciar sesión con ella.
      </Recuadro>
      <Ficha
        filas={[
          { etiqueta: "Cuenta", valor: correo },
          { etiqueta: "Cambio", valor: fechaCambio },
        ]}
      />
      <Boton href={urlLogin}>Iniciar sesión</Boton>
      <Separador />
      <Fila pad="0 0 14px">
        <p className="c-suave" style={{ margin: 0, fontFamily: LETRA, fontSize: 15, lineHeight: "24px", color: CLARO.suave }}>
          <Fuerte>¿No fuiste tú?</Fuerte> Alguien más podría estar usando tu cuenta. Escríbenos de inmediato para protegerla.
        </p>
      </Fila>
      <BotonSecundario href={`mailto:${CORREO_SOPORTE}`}>Escribir a soporte</BotonSecundario>
    </MarcoCorreo>
  );
}
