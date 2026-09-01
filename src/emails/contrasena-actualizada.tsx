import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export function ContrasenaActualizadaEmail() {
  return (
    <Html>
      <Head />
      <Preview>Tu contraseña de U.V.A fue actualizada</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={logo}>U.V.A</Text>
          </Section>

          <Section style={content}>
            <Text style={heading}>Tu contraseña fue actualizada</Text>
            <Text style={paragraph}>
              Confirmamos que la contraseña de tu cuenta en U.V.A se cambió
              correctamente. Ya puedes iniciar sesión con tu contraseña
              nueva.
            </Text>
            <Text style={{ ...paragraph, marginBottom: 0 }}>
              Si no fuiste tú quien hizo este cambio,{" "}
              <Link href="mailto:soporte@uva.edu" style={link}>
                contáctanos de inmediato
              </Link>{" "}
              para proteger tu cuenta.
            </Text>
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
  margin: "0 0 12px",
};

const link = {
  color: "#FF007A",
  textDecoration: "underline",
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

export default ContrasenaActualizadaEmail;
