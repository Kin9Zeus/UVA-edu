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

type CertificadoEmitidoEmailProps = {
  nombre: string;
  cursoTitulo: string;
  codigoVerificacion: string;
  urlCertificados: string;
};

export function CertificadoEmitidoEmail({
  nombre,
  cursoTitulo,
  codigoVerificacion,
  urlCertificados,
}: CertificadoEmitidoEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Tu certificado de {cursoTitulo} ya está listo</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={logo}>U.V.A</Text>
          </Section>

          <Section style={content}>
            <Text style={heading}>¡Felicitaciones, {nombre}!</Text>
            <Text style={paragraph}>
              Terminaste <strong>{cursoTitulo}</strong> y tu certificado ya
              está disponible para descargar.
            </Text>
            <Text style={codigo}>{codigoVerificacion}</Text>

            <Button href={urlCertificados} style={button}>
              Descargar mi certificado
            </Button>
          </Section>

          <Hr style={hr} />

          <Section>
            <Text style={footer}>
              U.V.A — Unidad Vectorial de Arquitectura
            </Text>
            <Text style={footer}>
              ¿Necesitas ayuda? Escríbenos a soporte@uva.edu
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#09090B",
  padding: "32px 0",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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

const content = {
  marginTop: "24px",
};

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

const codigo = {
  color: "#A1A1AA",
  fontSize: "12px",
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: "0.06em",
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

const hr = {
  borderColor: "#27272A",
  margin: "24px 0",
};

const footer = {
  color: "#71717A",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 4px",
};

export default CertificadoEmitidoEmail;
