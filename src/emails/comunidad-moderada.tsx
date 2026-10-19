import { Boton, Cita, Enlace, Ficha, Fuerte, MarcoCorreo, Nota, Parrafo, Titulo } from "./marco/marco";
import { primerNombre } from "./marco/nombres";
import { CORREO_SOPORTE } from "./marco/paleta";

type TipoContenido = "publicación" | "respuesta";

export function asuntoComunidadModerada(tipoContenido: TipoContenido): string {
  return `Retiramos tu ${tipoContenido} de la Comunidad`;
}

type ComunidadModeradaEmailProps = {
  nombre: string;
  /** "publicación" o "respuesta" — varía el copy sin duplicar la plantilla. */
  tipoContenido: TipoContenido;
  /** Título de la publicación afectada — o donde vivía la respuesta afectada. */
  tituloPost: string;
  motivo: string;
  urlComunidad: string;
};

/** Hoja 05. Al autor, cuando un administrador retira lo que publicó. */
export function ComunidadModeradaEmail({ nombre, tipoContenido, tituloPost, motivo, urlComunidad }: ComunidadModeradaEmailProps) {
  const corto = primerNombre(nombre);
  const esRespuesta = tipoContenido === "respuesta";
  return (
    <MarcoCorreo
      vistaPrevia="Te contamos el motivo y cómo escribirnos."
      seccion="Comunidad"
      nombre={esRespuesta ? "Respuesta retirada" : "Publicación retirada"}
      hoja="05"
      motivo="Recibes este correo porque publicaste en la Comunidad de U.V.A."
    >
      <Titulo>{esRespuesta ? "Retiramos tu respuesta" : "Retiramos tu publicación"}</Titulo>
      <Parrafo>
        {corto ? (
          <>
            Hola, <Fuerte>{corto}</Fuerte>.{" "}
          </>
        ) : (
          "Hola. "
        )}
        Un administrador retiró tu {tipoContenido} de la Comunidad de U.V.A. por este motivo:
      </Parrafo>
      <Cita titulo="Motivo del administrador">“{motivo}”</Cita>
      <Ficha
        filas={[
          { etiqueta: esRespuesta ? "En la publicación" : "Publicación", valor: tituloPost },
          { etiqueta: "Tipo", valor: esRespuesta ? "Respuesta" : "Publicación" },
        ]}
      />
      <Boton href={urlComunidad}>Ir a la Comunidad</Boton>
      <Nota pad="0">
        ¿Crees que fue un error? Escríbenos a <Enlace href={`mailto:${CORREO_SOPORTE}`}>{CORREO_SOPORTE}</Enlace> y lo revisamos.
      </Nota>
    </MarcoCorreo>
  );
}
