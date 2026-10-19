import { Boton, Codigo, Enlace, Ficha, Fuerte, MarcoCorreo, Nota, Parrafo, Titulo } from "./marco/marco";
import { primerNombre } from "./marco/nombres";

export function asuntoCertificadoEmitido(cursoTitulo: string): string {
  return `Tu certificado de ${cursoTitulo} está listo`;
}

type CertificadoEmitidoEmailProps = {
  nombre: string;
  cursoTitulo: string;
  codigoVerificacion: string;
  urlCertificados: string;
  /** Página pública de verificación de ESTE código. */
  urlVerificacion: string;
};

/**
 * Hoja 06. "Tu certificado ya está listo".
 *
 * Los datos del certificado van en una ficha de texto y no en una imagen: una
 * imagen fija mostraría el nombre de otra persona, y una imagen incrustada
 * (data:) la bloquea Gmail. Una miniatura personalizada exigiría generarla y
 * alojarla al emitir el certificado.
 */
export function CertificadoEmitidoEmail({ nombre, cursoTitulo, codigoVerificacion, urlCertificados, urlVerificacion }: CertificadoEmitidoEmailProps) {
  const corto = primerNombre(nombre);
  return (
    <MarcoCorreo
      vistaPrevia="Ya puedes descargarlo y compartirlo."
      seccion="Certificados"
      nombre="Certificado listo"
      hoja="06"
      motivo="Recibes este correo porque terminaste un curso en U.V.A."
    >
      <Titulo>{corto ? `¡Felicitaciones, ${corto}!` : "¡Felicitaciones!"}</Titulo>
      <Parrafo>
        Terminaste <Fuerte>{cursoTitulo}</Fuerte> y tu certificado ya está listo para descargar.
      </Parrafo>
      <Ficha
        filas={[
          { etiqueta: "Certificado de", valor: nombre },
          { etiqueta: "Curso", valor: cursoTitulo },
          { etiqueta: "Código", valor: codigoVerificacion, codigo: true },
        ]}
      />
      <Boton href={urlCertificados}>Descargar mi certificado</Boton>
      <Nota pad="0">
        Quien reciba tu certificado puede comprobarlo con el código <Codigo>{codigoVerificacion}</Codigo> en{" "}
        <Enlace href={urlVerificacion}>la página de verificación</Enlace>.
      </Nota>
    </MarcoCorreo>
  );
}
