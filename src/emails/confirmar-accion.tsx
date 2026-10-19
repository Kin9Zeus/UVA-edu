import type { ReactNode } from "react";
import { Boton, EnlaceRespaldo, Ficha, Fuerte, MarcoCorreo, Nota, Parrafo, Titulo } from "./marco/marco";
import { primerNombre } from "./marco/nombres";

/**
 * Hoja 09. Las acciones de Supabase Auth sin correo propio: invitación,
 * enlace mágico, cambio de correo y reautenticación. Ningún flujo de la app
 * las dispara hoy (solo el panel de Supabase), pero si llegan salen con el
 * mismo diseño y no como texto plano.
 */

type Variante = {
  asunto: string;
  vistaPrevia: string;
  titulo: string;
  texto: string;
  boton: string;
  aviso: string;
};

const VARIANTES: Record<string, Variante> = {
  invite: {
    asunto: "Te invitaron a U.V.A.",
    vistaPrevia: "Acepta la invitación para crear tu cuenta.",
    titulo: "Te invitaron a U.V.A.",
    texto: "Te invitaron a crear tu cuenta en U.V.A. Acepta la invitación para entrar a la plataforma.",
    boton: "Aceptar invitación",
    aviso: "Si no esperabas esta invitación, ignora este correo.",
  },
  magiclink: {
    asunto: "Tu enlace para entrar a U.V.A.",
    vistaPrevia: "Entra sin escribir tu contraseña.",
    titulo: "Entra a U.V.A.",
    texto: "Usa este botón para iniciar sesión sin escribir tu contraseña.",
    boton: "Iniciar sesión",
    aviso: "Si no pediste entrar, ignora este correo: nadie puede entrar sin este enlace.",
  },
  email_change: {
    asunto: "Confirma el cambio de correo en U.V.A.",
    vistaPrevia: "Confirma para terminar el cambio.",
    titulo: "Confirma tu nuevo correo",
    texto: "Pediste cambiar el correo de tu cuenta U.V.A. Confirma para que el cambio quede hecho.",
    boton: "Confirmar cambio de correo",
    aviso: "Si no pediste este cambio, ignora este correo: tu cuenta sigue con el correo actual.",
  },
  reauthentication: {
    asunto: "Confirma que eres tú en U.V.A.",
    vistaPrevia: "Hace falta confirmar para seguir.",
    titulo: "Confirma que eres tú",
    texto: "Para terminar una acción sensible en tu cuenta, confirma que eres tú.",
    boton: "Confirmar y continuar",
    aviso: "Si no estabas haciendo nada en tu cuenta, ignora este correo.",
  },
};

const GENERICA: Variante = {
  asunto: "Confirma tu acción en U.V.A.",
  vistaPrevia: "Hace falta confirmar para seguir.",
  titulo: "Confirma tu acción",
  texto: "Hace falta que confirmes una acción en tu cuenta U.V.A.",
  boton: "Confirmar",
  aviso: "Si no pediste esto, ignora este correo.",
};

function variante(tipo: string): Variante {
  return VARIANTES[tipo] ?? GENERICA;
}

export function asuntoConfirmarAccion(tipo: string): string {
  return variante(tipo).asunto;
}

type ConfirmarAccionEmailProps = {
  /** `email_action_type` de Supabase. */
  tipo: string;
  actionLink: string;
  nombre?: string;
  correo: string;
  /** Solo en el cambio de correo (`user.new_email`). */
  correoNuevo?: string;
};

export function ConfirmarAccionEmail({ tipo, actionLink, nombre, correo, correoNuevo }: ConfirmarAccionEmailProps) {
  const v = variante(tipo);
  const corto = primerNombre(nombre);
  let ficha: ReactNode = null;
  if (tipo === "email_change" && correoNuevo) {
    ficha = (
      <Ficha
        filas={[
          { etiqueta: "Correo actual", valor: correo },
          { etiqueta: "Correo nuevo", valor: correoNuevo },
        ]}
      />
    );
  }
  return (
    <MarcoCorreo
      vistaPrevia={v.vistaPrevia}
      seccion="Seguridad de la cuenta"
      nombre="Confirmar acción"
      hoja="09"
      motivo="Recibes este correo porque se pidió una acción en tu cuenta de U.V.A."
    >
      <Titulo>{v.titulo}</Titulo>
      <Parrafo>
        {corto ? (
          <>
            Hola, <Fuerte>{corto}</Fuerte>.{" "}
          </>
        ) : (
          "Hola. "
        )}
        {v.texto}
      </Parrafo>
      {ficha}
      <Boton href={actionLink}>{v.boton}</Boton>
      <Nota>{v.aviso} El enlace vence pronto por seguridad y se usa una sola vez.</Nota>
      <EnlaceRespaldo href={actionLink} />
    </MarcoCorreo>
  );
}
