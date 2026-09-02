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

type WelcomeEmailProps = {
  nombre: string;
  urlAcceso?: string;
};

export function WelcomeEmail({ nombre, urlAcceso }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Bienvenido a U.V.A, {nombre}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={logo}>U.V.A</Text>
          </Section>

          <Section style={content}>
            <Text style={heading}>¡Hola, {nombre}!</Text>
            <Text style={paragraph}>
              Ya canjeaste tu código de invitación y tienes acceso completo
              a los cursos de la plataforma.
            </Text>

            {urlAcceso && (
              <Button href={urlAcceso} style={button}>
                Ir a mi plataforma
              </Button>
            )}
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

export default WelcomeEmail;
