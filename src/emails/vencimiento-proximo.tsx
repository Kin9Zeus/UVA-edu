import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type VencimientoProximoEmailProps = {
  nombre: string;
  planNombre: string;
  /** Días de calendario colombiano que faltan. 0 = vence hoy. */
  diasRestantes: number;
  /** Ya formateada por `formatFecha`. */
  fechaVencimiento: string;
  urlPlanes: string;
};

/**
 * Aviso de que el acceso está por terminar.
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
export function VencimientoProximoEmail({
  nombre,
  planNombre,
  diasRestantes,
  fechaVencimiento,
  urlPlanes,
}: VencimientoProximoEmailProps) {
  // "vence hoy" / "vence mañana" / "quedan N días": decir "quedan 0 días" es
  // la clase de frase que solo escribe un programa.
  const cuando =
    diasRestantes <= 0
      ? "termina hoy"
      : diasRestantes === 1
        ? "termina mañana"
        : `termina en ${diasRestantes} días`;

  return (
    <Html>
      <Head />
      <Preview>Tu acceso a U.V.A {cuando}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={logo}>U.V.A</Text>
          </Section>

          <Section style={content}>
            <Text style={heading}>Tu acceso {cuando}</Text>
            <Text style={paragraph}>
              Hola {nombre}: tu <strong>{planNombre}</strong> va hasta el{" "}
              <strong>{fechaVencimiento}</strong>. Después de esa fecha dejarás
              de ver los cursos, pero tu progreso y tus certificados se quedan
              donde están.
            </Text>
            <Text style={paragraph}>
              Si quieres seguir, renovar toma menos de un minuto.
            </Text>

            <Button href={urlPlanes} style={button}>
              Renovar mi acceso
            </Button>
          </Section>

          <Hr style={hr} />

          <Section>
            <Text style={footer}>U.V.A — Unidad Vectorial de Arquitectura</Text>
            <Text style={footer}>¿Necesitas ayuda? Escríbenos a soporte@uva.edu</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#09090B",
  padding: "32px 0",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container = {
  backgroundColor: "#18181B",
  border: "1px solid #27272A",
  borderRadius: "6px",
  padding: "32px",
  maxWidth: "480px",
  margin: "0 auto",
};

const logo = {
  color: "#FAFAFA",
  fontSize: "20px",
  fontWeight: 700,
  letterSpacing: "1px",
  margin: 0,
};

const content = { marginTop: "24px" };

const heading = {
  color: "#FAFAFA",
  fontSize: "18px",
  fontWeight: 600,
  margin: "0 0 12px",
};

const paragraph = {
  color: "#A1A1AA",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 16px",
};

const button = {
  backgroundColor: "#FF007A",
  color: "#FAFAFA",
  borderRadius: "6px",
  padding: "12px 24px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};

const hr = { borderColor: "#27272A", margin: "24px 0" };

const footer = {
  color: "#71717A",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 4px",
};

export default VencimientoProximoEmail;
