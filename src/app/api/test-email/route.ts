import { NextResponse } from "next/server";
import { enviarCorreoBienvenida } from "@/lib/resend";

// SOLO PARA DESARROLLO: ruta manual para probar el envío de correos con
// Resend desde el navegador. Elimínala (o protégela con verificación de
// rol ADMINISTRADOR) antes de desplegar a producción — el bloqueo por
// NODE_ENV de abajo es una red de seguridad, no un sustituto de borrarla.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const destinatario = process.env.RESEND_TEST_EMAIL;
  if (!destinatario) {
    return NextResponse.json(
      {
        success: false,
        error: "Falta configurar RESEND_TEST_EMAIL en .env",
      },
      { status: 500 },
    );
  }

  const resultado = await enviarCorreoBienvenida(
    destinatario,
    "Juan",
    "http://localhost:3000/",
  );

  return NextResponse.json(resultado, {
    status: resultado.success ? 200 : 500,
  });
}
