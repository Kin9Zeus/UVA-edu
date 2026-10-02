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

type RecuperarPasswordEmailProps = {
  actionLink: string;
  nombre?: string;
};

export function RecuperarPasswordEmail({
  actionLink,
  nombre,
}: RecuperarPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Recupera tu contraseña en U.V.A.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={logo}>U.V.A</Text>
          </Section>

          <Section style={content}>
            <Text style={heading}>Recupera tu contraseña</Text>
            <Text style={paragraph}>
              Hola{nombre ? ` ${nombre}` : ""}, recibimos una solicitud para
              restablecer la contraseña de tu cuenta en U.V.A. Haz clic en el
              botón para crear una nueva.
            </Text>

            <Button href={actionLink} style={button}>
              Restablecer contraseña
            </Button>

            <Text style={smallPrint}>
              Este enlace expira pronto por seguridad. Si no fuiste tú,
              puedes ignorar este correo.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section>
            <Text style={footer}>
              U.V.A. — Unidad Vectorial de Arquitectura
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

const smallPrint = {
  color: "#71717A",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "20px 0 0",
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

export default RecuperarPasswordEmail;
