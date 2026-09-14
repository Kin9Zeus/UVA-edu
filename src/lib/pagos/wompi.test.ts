import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { firmaIntegridad, generarReferencia, urlCheckout, type ConfigWompi } from "@/lib/pagos/wompi";

const CONFIG: ConfigWompi = {
  publicKey: "pub_test_llave",
  privateKey: "prv_test_llave",
  integritySecret: "test_integrity_secreto",
  checkoutUrl: "https://checkout.wompi.co",
  apiUrl: "https://sandbox.wompi.co/v1",
};

describe("firmaIntegridad", () => {
  /**
   * El caso que de verdad valida la implementación: el ejemplo LITERAL de la
   * documentación de Wompi (docs.wompi.co, "Widget y Checkout Web"), con la
   * concatenación que ellos publican.
   *
   *   referencia + monto + moneda + secreto
   *
   * Se recalcula con `createHash` aquí en vez de pegar un hash constante a
   * propósito: lo que se está fijando es el ORDEN y el FORMATO de la
   * concatenación, que es donde están los errores reales. Un hash pegado a
   * mano solo comprobaría que SHA-256 sigue siendo SHA-256.
   */
  it("concatena referencia + monto + moneda + secreto, en ese orden", () => {
    const esperado = createHash("sha256")
      .update("sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6", "utf8")
      .digest("hex");

    expect(
      firmaIntegridad(
        "sk8-438k4-xmxm392-sn2m24",
        90000,
        "COP",
        "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6",
      ),
    ).toBe(esperado);
  });

  /**
   * `monto_centavos` es BigInt en el esquema (el techo de $21.474.836 COP de
   * un INTEGER en centavos), así que el monto llega como bigint desde la base
   * y como number desde el cálculo del desglose. Los dos tienen que firmar
   * igual o la firma dependería de por dónde vino el número.
   *
   * Sin literal `8990000n`: el target del tsconfig es anterior a ES2020.
   */
  it("un bigint firma igual que el mismo número", () => {
    expect(firmaIntegridad("ref_1", BigInt(8990000), "COP", "s")).toBe(
      firmaIntegridad("ref_1", 8990000, "COP", "s"),
    );
  });

  /**
   * El punto de la firma: cambiar el monto cambia el hash. Si esto fallara,
   * un estudiante podría editar el monto en la URL y pagar $1.000 por el plan
   * anual.
   */
  it("cambiar el monto cambia la firma", () => {
    const original = firmaIntegridad("ref_1", 8990000, "COP", "s");
    expect(firmaIntegridad("ref_1", 100000, "COP", "s")).not.toBe(original);
  });

  it("cambiar la referencia cambia la firma", () => {
    const original = firmaIntegridad("ref_1", 8990000, "COP", "s");
    expect(firmaIntegridad("ref_2", 8990000, "COP", "s")).not.toBe(original);
  });
});

describe("urlCheckout", () => {
  it("incluye los cinco parámetros obligatorios", () => {
    const url = new URL(
      urlCheckout(
        {
          referencia: "uva_abc",
          montoCentavos: 8990000,
          moneda: "COP",
          urlRetorno: "https://uva.test/dashboard/suscripcion",
        },
        CONFIG,
      ),
    );

    expect(url.origin + url.pathname).toBe("https://checkout.wompi.co/p/");
    expect(url.searchParams.get("public-key")).toBe("pub_test_llave");
    expect(url.searchParams.get("currency")).toBe("COP");
    expect(url.searchParams.get("amount-in-cents")).toBe("8990000");
    expect(url.searchParams.get("reference")).toBe("uva_abc");
    expect(url.searchParams.get("signature:integrity")).toBe(
      firmaIntegridad("uva_abc", 8990000, "COP", CONFIG.integritySecret),
    );
  });

  /**
   * `signature:integrity` lleva dos puntos literales en el nombre. Si se
   * armara la query concatenando strings, ese carácter rompería el parámetro
   * y Wompi respondería "firma inválida" sin más pistas.
   */
  it("codifica el nombre con dos puntos sin romper la query", () => {
    const url = urlCheckout(
      { referencia: "r", montoCentavos: 1, moneda: "COP", urlRetorno: "https://uva.test/x" },
      CONFIG,
    );
    expect(url).toContain("signature%3Aintegrity=");
  });

  it("la url de retorno sobrevive entera, con su query", () => {
    const retorno = "https://uva.test/dashboard/suscripcion?ref=uva_abc";
    const url = new URL(
      urlCheckout(
        { referencia: "uva_abc", montoCentavos: 1, moneda: "COP", urlRetorno: retorno },
        CONFIG,
      ),
    );
    expect(url.searchParams.get("redirect-url")).toBe(retorno);
  });

  it("solo manda el correo si se le pasa uno", () => {
    const base = { referencia: "r", montoCentavos: 1, moneda: "COP", urlRetorno: "https://uva.test/x" };

    const sin = new URL(urlCheckout(base, CONFIG));
    expect(sin.searchParams.has("customer-data:email")).toBe(false);

    const con = new URL(urlCheckout({ ...base, correoCliente: "a@uva.test" }, CONFIG));
    expect(con.searchParams.get("customer-data:email")).toBe("a@uva.test");
  });
});

describe("generarReferencia", () => {
  it("no se repite", () => {
    const generadas = new Set(Array.from({ length: 500 }, generarReferencia));
    expect(generadas.size).toBe(500);
  });

  it("solo usa caracteres que Wompi admite en una referencia", () => {
    // Alfanuméricos, guiones y guiones bajos.
    expect(generarReferencia()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
