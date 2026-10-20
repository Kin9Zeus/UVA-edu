import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { aRgba, razon } from "@/lib/diseno/contraste";
import { siteUrl } from "@/lib/site-url";
import { FIJOS, OSCURO } from "./marco/paleta";
import { ASUNTO_CONFIRMAR_CUENTA, ConfirmarCuentaEmail } from "./confirmar-cuenta";
import { ASUNTO_RECUPERAR_PASSWORD, RecuperarPasswordEmail } from "@/lib/resend/emails/recuperar-password-email";
import { ASUNTO_PASSWORD_ACTUALIZADA, ContrasenaActualizadaEmail } from "./contrasena-actualizada";
import { ASUNTO_BIENVENIDA, WelcomeEmail } from "./welcome";
import { asuntoComunidadModerada, ComunidadModeradaEmail } from "./comunidad-moderada";
import { asuntoCertificadoEmitido, CertificadoEmitidoEmail } from "./certificado-emitido";
import { asuntoVencimientoProximo, VencimientoProximoEmail } from "./vencimiento-proximo";
import { asuntoReciboPago, ReciboPagoEmail } from "./recibo-pago";
import { asuntoConfirmarAccion, ConfirmarAccionEmail } from "./confirmar-accion";
import { conTextoPlano } from "./marco/texto-plano";

const ENLACE = "https://uva.test/auth/confirm?token_hash=abc&type=signup";

const correos = {
  confirmar: () => ConfirmarCuentaEmail({ actionLink: ENLACE, nombre: "Laura Mejía", correo: "laura@uva.test" }),
  recuperar: () => RecuperarPasswordEmail({ actionLink: ENLACE, nombre: "Laura Mejía", correo: "laura@uva.test" }),
  password: () => ContrasenaActualizadaEmail({ correo: "laura@uva.test", fechaCambio: "19 oct 2026, 09:18 a. m.", urlLogin: "https://uva.test/login" }),
  bienvenida: () => WelcomeEmail({ nombre: "Laura Mejía", correo: "laura@uva.test", urlAcceso: "https://uva.test/dashboard" }),
  comunidad: () =>
    ComunidadModeradaEmail({
      nombre: "Laura Mejía",
      tipoContenido: "publicación",
      tituloPost: "¿Cómo exporto planos?",
      motivo: "Datos personales",
      urlComunidad: "https://uva.test/dashboard/comunidad",
    }),
  certificado: () =>
    CertificadoEmitidoEmail({
      nombre: "Laura Mejía",
      cursoTitulo: "Revit desde Cero",
      codigoVerificacion: "K7M2Q-XP4TB",
      urlCertificados: "https://uva.test/dashboard/certificados",
      urlVerificacion: "https://uva.test/verificar-certificado/K7M2Q-XP4TB",
    }),
  vencimiento: () =>
    VencimientoProximoEmail({
      nombre: "Laura Mejía",
      planNombre: "Acceso U.V.A.",
      diasRestantes: 3,
      fechaHoy: "19 oct 2026",
      fechaVencimiento: "22 oct 2026",
      urlPlanes: "https://uva.test/dashboard/planes",
    }),
  recibo: () =>
    ReciboPagoEmail({
      nombre: "Laura Mejía",
      planNombre: "Acceso mensual",
      montoFormateado: "$ 10.000 COP",
      fechaPago: "19 oct 2026",
      vigenteHasta: "19 nov 2026",
      referencia: "UVA-PAY-1",
      urlSuscripcion: "https://uva.test/dashboard/suscripcion",
    }),
  accion: () =>
    ConfirmarAccionEmail({ tipo: "email_change", actionLink: ENLACE, nombre: "Laura", correo: "laura@uva.test", correoNuevo: "nuevo@uva.test" }),
};

describe("las nueve plantillas", () => {
  for (const [nombre, crear] of Object.entries(correos)) {
    describe(nombre, () => {
      it("no usan SVG ni imágenes incrustadas, que Gmail y Outlook descartan", async () => {
        const html = await render(crear());
        expect(html).not.toContain("<svg");
        expect(html).not.toContain("data:image");
      });

      it("llevan el logo PNG alojado en el sitio, con texto alternativo", async () => {
        const html = await render(crear());
        expect(html).toContain(`src="${siteUrl()}/correo/logo-sobre-oscuro.png"`);
        expect(html).toContain('alt="U.V.A."');
      });

      it("son oscuros siempre: sin versión clara ni logo alternativo", async () => {
        const html = await render(crear());
        expect(html).toMatch(/class="c-pagina"[^>]*background-color:#09090B/i);
        expect(html).not.toContain("prefers-color-scheme:light");
        expect(html).not.toContain("logo-sobre-claro");
        expect(html).toContain('<meta name="color-scheme" content="dark"/>');
      });

      it("pintan cada fondo también como degradado, que Outlook no recolorea", async () => {
        const html = await render(crear());
        expect(html).toContain("background-image:linear-gradient(#09090B,#09090B)");
        expect(html).toContain("background-image:linear-gradient(#18181B,#18181B)");
        expect(html).toContain("background-image:linear-gradient(#FFC400,#FFC400)");
        expect(html).not.toMatch(/background:#/i);
      });

      it("fijan sus colores para que el modo oscuro del cliente no los recoloree", async () => {
        const html = await render(crear());
        // Oscuro repetido: el cliente ve que el correo ya está pensado para oscuro.
        const oscuro = html.slice(html.indexOf("@media (prefers-color-scheme:dark)"));
        expect(oscuro.indexOf(".c-pagina{background-color:#09090B!important;}")).toBeGreaterThan(0);
        expect(oscuro.indexOf(".c-pagina{background-color:#09090B!important;}")).toBeLessThan(oscuro.indexOf("}\n"));
        // Outlook marca lo que recolorea con data-ogsb / data-ogsc.
        expect(html).toContain("[data-ogsb] .c-tarjeta{background-color:#18181B!important;");
        expect(html).toContain("[data-ogsc] .c-tinta{color:#FAFAFA!important;}");
        expect(html).toContain("[data-ogsb] .c-amarillo{background-color:#FFC400!important;");
        expect(html).toContain('class="c-boton"');
      });

      it("pintan el botón con el magenta de la app (AA), no con el magenta puro", async () => {
        const html = await render(crear());
        expect(html).toMatch(/background-color:#CC006D/i);
        expect(html).not.toMatch(/background(-color)?:#FF007A/i);
      });

      it("no escriben rótulos en mayúsculas ni valores vacíos", async () => {
        const html = await render(crear());
        expect(html).not.toMatch(/>(CORREO|HOJA)</);
        expect(html).not.toMatch(/>(undefined|null)</);
      });

      it("traen la versión en texto plano con el contenido", async () => {
        const texto = await render(crear(), { plainText: true });
        expect(texto.length).toBeGreaterThan(80);
        expect(texto).toContain("Unidad Vectorial de Arquitectura");
      });
    });
  }
});

describe("contenido de cada correo", () => {
  it("confirmar cuenta: saluda por el nombre, muestra el carné pendiente y el enlace de respaldo", async () => {
    const html = await render(correos.confirmar());
    expect(html).toContain("Laura</strong>");
    expect(html).toContain("Pendiente de confirmar");
    expect(html.split(ENLACE.replace(/&/g, "&amp;")).length - 1).toBeGreaterThanOrEqual(2);
  });

  it("confirmar cuenta sin nombre: saluda sin nombre y el carné usa el correo", async () => {
    const html = await render(ConfirmarCuentaEmail({ actionLink: ENLACE, correo: "sin@uva.test" }));
    expect(html).toContain("Hola. ");
    expect(html).toContain("sin@uva.test");
  });

  it("recuperar contraseña: dice a qué cuenta aplica", async () => {
    const html = await render(correos.recuperar());
    expect(html).toContain("laura@uva.test");
    expect(html).toContain("¿No fuiste tú?");
  });

  it("contraseña actualizada: muestra la fecha del cambio y el botón a soporte", async () => {
    const html = await render(correos.password());
    expect(html).toContain("19 oct 2026, 09:18 a. m.");
    expect(html).toContain("mailto:");
  });

  it("comunidad: no promete que se lea una respuesta al correo", async () => {
    const html = await render(correos.comunidad());
    expect(html).not.toContain("Responde a este correo");
    expect(html).toContain("Retiramos tu publicación");
  });

  it("comunidad: cambia el texto para una respuesta", async () => {
    const html = await render(
      ComunidadModeradaEmail({ nombre: "Ana", tipoContenido: "respuesta", tituloPost: "Tema", motivo: "Spam", urlComunidad: "https://uva.test" }),
    );
    expect(html).toContain("Retiramos tu respuesta");
    expect(html).toContain("En la publicación");
  });

  it("certificado: enlaza a la verificación de su propio código", async () => {
    const html = await render(correos.certificado());
    expect(html).toContain('href="https://uva.test/verificar-certificado/K7M2Q-XP4TB"');
    expect(html).toContain("K7M2Q-XP4TB");
  });

  it("vencimiento: la cota va de hoy al último día", async () => {
    const html = await render(correos.vencimiento());
    expect(html).toContain("Faltan 3 días");
    expect(html).toContain("19 oct 2026");
    expect(html).toContain("22 oct 2026");
  });

  it("confirmar acción: el cambio de correo muestra las dos direcciones", async () => {
    const html = await render(correos.accion());
    expect(html).toContain("nuevo@uva.test");
    expect(html).toContain("Confirmar cambio de correo");
  });

  it("confirmar acción: un tipo desconocido cae en la variante genérica", async () => {
    const html = await render(ConfirmarAccionEmail({ tipo: "otra_cosa", actionLink: ENLACE, correo: "a@uva.test" }));
    expect(html).toContain("Confirma tu acción");
  });
});

describe("asuntos", () => {
  it("son los del rediseño", () => {
    expect(ASUNTO_CONFIRMAR_CUENTA).toBe("Confirma tu correo para activar tu carné U.V.A.");
    expect(ASUNTO_RECUPERAR_PASSWORD).toBe("Crea una contraseña nueva para U.V.A.");
    expect(ASUNTO_PASSWORD_ACTUALIZADA).toBe("Tu contraseña de U.V.A. cambió");
    expect(ASUNTO_BIENVENIDA).toBe("Tu carné U.V.A. está activo");
    expect(asuntoComunidadModerada("publicación")).toBe("Retiramos tu publicación de la Comunidad");
    expect(asuntoCertificadoEmitido("Revit")).toBe("Tu certificado de Revit está listo");
    expect(asuntoReciboPago("19 nov 2026")).toBe("Recibimos tu pago: acceso activo hasta el 19 nov 2026");
  });

  it("el de vencimiento dice hoy, mañana o en N días", () => {
    expect(asuntoVencimientoProximo(0)).toBe("Tu acceso a U.V.A. termina hoy");
    expect(asuntoVencimientoProximo(1)).toBe("Tu acceso a U.V.A. termina mañana");
    expect(asuntoVencimientoProximo(3)).toBe("Tu acceso a U.V.A. termina en 3 días");
  });

  it("confirmar acción tiene uno por tipo de Supabase", () => {
    expect(asuntoConfirmarAccion("invite")).toBe("Te invitaron a U.V.A.");
    expect(asuntoConfirmarAccion("magiclink")).toBe("Tu enlace para entrar a U.V.A.");
    expect(asuntoConfirmarAccion("email_change")).toBe("Confirma el cambio de correo en U.V.A.");
    expect(asuntoConfirmarAccion("reauthentication")).toBe("Confirma que eres tú en U.V.A.");
    expect(asuntoConfirmarAccion("desconocido")).toBe("Confirma tu acción en U.V.A.");
  });
});

describe("texto plano", () => {
  it("conTextoPlano agrega la versión en texto de la misma plantilla", async () => {
    const envio = await conTextoPlano({ to: "a@uva.test", react: correos.confirmar() });
    expect(envio.text).toContain("Confirma tu correo");
    expect(envio.text).toContain(ENLACE);
    expect(envio.react).toBeDefined();
  });

  it("respeta un texto que ya venga escrito", async () => {
    const envio = await conTextoPlano({ react: correos.confirmar(), text: "propio" });
    expect(envio.text).toBe("propio");
  });
});

describe("origen de las imágenes", () => {
  it("usa CORREO_ORIGEN_IMAGENES si está definida, sin barra final", async () => {
    const antes = process.env.CORREO_ORIGEN_IMAGENES;
    process.env.CORREO_ORIGEN_IMAGENES = "https://uva.test/";
    try {
      const html = await render(correos.confirmar());
      expect(html).toContain('src="https://uva.test/correo/logo-sobre-oscuro.png"');
    } finally {
      if (antes === undefined) delete process.env.CORREO_ORIGEN_IMAGENES;
      else process.env.CORREO_ORIGEN_IMAGENES = antes;
    }
  });
});

describe("logos del correo", () => {
  // Gmail en el celular recolorea los fondos y nunca las imágenes: un logo
  // con transparencia desaparece sobre el fondo recoloreado. Tipo de color 2
  // en la cabecera PNG = RGB sin canal alfa.
  for (const archivo of ["logo-sobre-oscuro", "logo-sobre-oscuro-gruesa", "logo-sobre-claro", "logo-sobre-claro-gruesa"]) {
    it(`${archivo}.png es opaco`, () => {
      const png = readFileSync(join(process.cwd(), "public/correo", `${archivo}.png`));
      expect(png[25]).toBe(2);
    });
  }
});

describe("paleta del correo", () => {
  const r = (a: string, b: string) => razon(aRgba(a), aRgba(b));

  for (const [tema, p] of [["oscuro", OSCURO]] as const) {
    it(`en ${tema}, el texto pasa AA sobre la tarjeta, la página y los bloques apartados`, () => {
      for (const fondo of [p.tarjeta, p.pagina, p.fondoSuave]) {
        for (const color of [p.tinta, p.suave, p.enlace]) {
          expect(r(color, fondo), `${color} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`en ${tema}, el borde del marco se distingue de la tarjeta (3:1)`, () => {
      expect(r(p.tinta, p.tarjeta)).toBeGreaterThanOrEqual(3);
    });
  }

  it("el texto de los rellenos de color pasa AA", () => {
    expect(r(FIJOS.sobreBoton, FIJOS.boton)).toBeGreaterThanOrEqual(4.5);
    expect(r(FIJOS.sobreAmarillo, FIJOS.amarillo)).toBeGreaterThanOrEqual(4.5);
  });
});
