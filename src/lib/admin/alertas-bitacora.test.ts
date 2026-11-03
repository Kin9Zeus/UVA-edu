import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

const Sentry = await import("@sentry/nextjs");
const { avisarAccionSensible, LOTE_GRANDE_DE_CODIGOS, motivoDeAlerta } = await import("@/lib/admin/alertas-bitacora");

const ACCIONES_QUE_AVISAN = [
  "Exportó la lista de usuarios a CSV",
  "Exportó la bitácora a CSV",
  "Dio rol de profesor",
  "Quitó el rol de profesor",
  "Quitó la verificación en dos pasos de otro administrador",
  "Suprimió los datos personales de una cuenta (Habeas Data)",
  "Generó un lote de códigos de invitación",
];

beforeEach(() => {
  vi.mocked(Sentry.captureMessage).mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("motivoDeAlerta", () => {
  it("avisa al exportar datos, cambiar un rol, quitar el 2FA de otro o suprimir una cuenta", () => {
    expect(motivoDeAlerta("Exportó la lista de usuarios a CSV")).toBe("exportar-datos");
    expect(motivoDeAlerta("Dio rol de profesor")).toBe("cambio-de-rol");
    expect(motivoDeAlerta("Quitó la verificación en dos pasos de otro administrador")).toBe("quitar-2fa");
    expect(motivoDeAlerta("Suprimió los datos personales de una cuenta (Habeas Data)")).toBe("irreversible");
  });

  it("un lote de códigos avisa solo desde el tamaño grande", () => {
    expect(motivoDeAlerta("Generó un lote de códigos de invitación", LOTE_GRANDE_DE_CODIGOS - 1)).toBeNull();
    expect(motivoDeAlerta("Generó un lote de códigos de invitación", LOTE_GRANDE_DE_CODIGOS)).toBe("lote-grande-de-codigos");
    expect(motivoDeAlerta("Generó un lote de códigos de invitación")).toBeNull();
  });

  it("el trabajo diario del panel no avisa", () => {
    expect(motivoDeAlerta("Publicó un curso")).toBeNull();
    expect(motivoDeAlerta("Editó el contenido de una lección")).toBeNull();
    expect(motivoDeAlerta("Creó un cupón")).toBeNull();
  });
});

describe("avisarAccionSensible", () => {
  it("manda un aviso a Sentry, distinto cada vez, sin los detalles", () => {
    const params = {
      idAdmin: "admin-1",
      accion: "Exportó la lista de usuarios a CSV",
      entidadAfectada: "perfiles",
      detalles: "ana@uva.co, beto@uva.co",
    };
    avisarAccionSensible(params);
    avisarAccionSensible(params);

    const llamadas = vi.mocked(Sentry.captureMessage).mock.calls;
    expect(llamadas).toHaveLength(2);
    const [mensaje, contexto] = llamadas[0] as [string, Record<string, unknown>];
    expect(mensaje).toBe("Alerta de administración: Exportó la lista de usuarios a CSV");
    expect(contexto).toMatchObject({ level: "warning", tags: { area: "alerta-admin", motivo: "exportar-datos" } });
    expect(JSON.stringify(contexto)).not.toContain("ana@uva.co");
    expect((llamadas[0][1] as { fingerprint: string[] }).fingerprint).not.toEqual(
      (llamadas[1][1] as { fingerprint: string[] }).fingerprint,
    );
  });

  it("una acción común no manda nada", () => {
    avisarAccionSensible({ idAdmin: "admin-1", accion: "Publicó un curso", entidadAfectada: "cursos" });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});

describe("las acciones que avisan existen tal cual en el código", () => {
  // Si alguien cambia el texto de una acción en src/actions, la alerta se
  // apagaría sin que nadie lo note. Esta prueba lo impide.
  const archivos = (carpeta: string): string[] =>
    readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) =>
      entrada.isDirectory() ? archivos(join(carpeta, entrada.name)) : [join(carpeta, entrada.name)],
    );
  const codigo = archivos(join(process.cwd(), "src", "actions"))
    .filter((ruta) => ruta.endsWith(".ts") && !ruta.endsWith(".test.ts"))
    .map((ruta) => readFileSync(ruta, "utf8"))
    .join("\n");

  it.each(ACCIONES_QUE_AVISAN)("«%s» se registra en alguna acción", (accion) => {
    expect(codigo).toContain(`"${accion}"`);
    expect(motivoDeAlerta(accion, LOTE_GRANDE_DE_CODIGOS)).not.toBeNull();
  });
});
