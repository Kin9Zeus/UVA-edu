import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components";

type RecuperarPasswordEmailProps = {
  actionLink: string;
};

export function RecuperarPasswordEmail({
  actionLink,
}: RecuperarPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Recupera tu contraseña en U.V.A</Preview>
      <Body style={{ backgroundColor: "#09090B", padding: "32px 0" }}>
        <Container
          style={{
            backgroundColor: "#18181B",
            border: "1px solid #27272A",
            borderRadius: "6px",
            padding: "32px",
            maxWidth: "480px",
          }}
        >
          <Text style={{ color: "#FAFAFA", fontSize: "20px", fontWeight: 600 }}>
            Recupera tu contraseña
          </Text>
          <Text style={{ color: "#A1A1AA", fontSize: "14px", lineHeight: "1.5" }}>
            Recibimos una solicitud para restablecer tu contraseña en U.V.A.
            Si no fuiste tú, puedes ignorar este correo.
          </Text>
          <Button
            href={actionLink}
            style={{
              backgroundColor: "#FF007A",
              color: "#FAFAFA",
              borderRadius: "6px",
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
              marginTop: "16px",
            }}
          >
            Restablecer contraseña
          </Button>
          <Text style={{ color: "#71717A", fontSize: "12px", marginTop: "24px" }}>
            Este enlace expira pronto por seguridad. Si no funciona, copia y
            pega esta URL en tu navegador: {actionLink}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
