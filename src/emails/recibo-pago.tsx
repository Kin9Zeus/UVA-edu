import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from "@react-email/components";

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

/**
 * Recibo de un pago aprobado.
 *
 * No es "gracias por tu compra" y ya: un recibo tiene que poder usarse como
 * comprobante, así que lleva monto, fecha, qué se compró, hasta cuándo vale y
 * la referencia con la que soporte puede encontrar la transacción.
 *
 * `vigenteHasta` es la línea que hace falta en el modelo prepagado: el
 * estudiante compró un período, no una suscripción que se renueva sola, y el
 * recibo es el primer sitio donde se le dice con todas las letras.
 */
export function ReciboPagoEmail({
  nombre,
  planNombre,
  montoFormateado,
  fechaPago,
  vigenteHasta,
  referencia,
  urlSuscripcion,
}: ReciboPagoEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Recibimos tu pago de {montoFormateado} — tu acceso está activo hasta el {vigenteHasta}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={logo}>U.V.A</Text>
          </Section>

          <Section style={content}>
            <Text style={heading}>Listo, {nombre}. Tu acceso está activo.</Text>
            <Text style={paragraph}>
              Recibimos tu pago y ya puedes entrar a todo el catálogo.
            </Text>

            <Section style={caja}>
              <Row style={fila}>
                <Column style={etiqueta}>Plan</Column>
                <Column style={valor}>{planNombre}</Column>
              </Row>
              <Row style={fila}>
                <Column style={etiqueta}>Monto</Column>
                <Column style={valorFuerte}>{montoFormateado}</Column>
              </Row>
              <Row style={fila}>
                <Column style={etiqueta}>Fecha</Column>
                <Column style={valor}>{fechaPago}</Column>
              </Row>
              <Row style={fila}>
                <Column style={etiqueta}>Acceso hasta</Column>
                <Column style={valorFuerte}>{vigenteHasta}</Column>
              </Row>
            </Section>

            <Text style={aviso}>
              Tu acceso no se renueva solo. Te avisamos por correo unos días
              antes de que termine, para que decidas si sigues.
            </Text>

            <Button href={urlSuscripcion} style={button}>
              Ver mi suscripción
            </Button>

            <Text style={codigo}>Referencia: {referencia}</Text>
          </Section>

          <Hr style={hr} />

          <Section>
            <Text style={footer}>U.V.A — Unidad Vectorial de Arquitectura</Text>
            <Text style={footer}>¿Algo no cuadra? Escríbenos a soporte@uva.edu</Text>
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

const caja = {
  backgroundColor: "#141417",
  border: "1px solid #27272A",
  borderRadius: "6px",
  padding: "16px",
  margin: "0 0 16px",
};

const fila = { marginBottom: "8px" };

const etiqueta = {
  color: "#71717A",
  fontSize: "13px",
  width: "40%",
};

const valor = {
  color: "#A1A1AA",
  fontSize: "13px",
  textAlign: "right" as const,
};

const valorFuerte = {
  color: "#FAFAFA",
  fontSize: "13px",
  fontWeight: 600,
  fontFamily: "'JetBrains Mono', monospace",
  textAlign: "right" as const,
};

const aviso = {
  color: "#A1A1AA",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 20px",
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

const codigo = {
  color: "#71717A",
  fontSize: "11px",
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: "0.04em",
  margin: "20px 0 0",
};

const hr = { borderColor: "#27272A", margin: "24px 0" };

const footer = {
  color: "#71717A",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 4px",
};

export default ReciboPagoEmail;
