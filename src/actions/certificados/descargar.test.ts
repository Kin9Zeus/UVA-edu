import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/perfil", () => ({ getPerfilActual: vi.fn() }));
vi.mock("@/lib/certificados/pdf", () => ({ construirCertificadoPdf: vi.fn() }));
vi.mock("@/lib/site-url", () => ({ siteUrl: () => "https://uva.test" }));

import { getPerfilActual } from "@/lib/perfil";
import { construirCertificadoPdf } from "@/lib/certificados/pdf";
import { logError } from "@/lib/log";
import { descargarCertificadoPdf } from "@/actions/certificados/descargar";

/**
 * Descarga del certificado (P2-12, AUDIT-2026-11-23): un PDF con datos
 * personales que se guarda en Storage y se descarga durante años.
 */

const USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CERT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RUTA = `${USUARIO}/${CERT}-v2.pdf`;
const ERROR_PG = { message: "canceling statement due to statement timeout", code: "57014" };

const certificado = (archivo_pdf: string | null) => ({
  id: CERT,
  id_curso: "k1",
  fecha_emision: "2026-11-01T00:00:00Z",
  codigo_verificacion: "UVA-ABC123",
  archivo_pdf,
  nombre_estudiante: "Ana Pérez",
  nombre_curso: "Revit desde cero",
});
const FIRMADA = { data: { signedUrl: "https://proyecto.supabase.co/firmada" }, error: null };

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(getPerfilActual).mockResolvedValue({ user: { id: USUARIO }, perfil: { id: USUARIO } } as never);
  vi.mocked(construirCertificadoPdf).mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]));
  vi.mocked(logError).mockClear();
});

describe("descargarCertificadoPdf", () => {
  it("sin sesión no consulta nada", async () => {
    vi.mocked(getPerfilActual).mockResolvedValue({ user: null, perfil: null } as never);

    expect(await descargarCertificadoPdf(CERT)).toEqual({ error: "Debes iniciar sesión para descargar tu certificado." });
    expect(servidorFalso.llamadas).toHaveLength(0);
  });

  it("todo con la sesión del estudiante (RLS), nunca con la llave maestra", async () => {
    servidorFalso.responder("from:certificados", { data: certificado(RUTA) });
    servidorFalso.responder("storage:certificados", FIRMADA);

    await descargarCertificadoPdf(CERT);

    expect(servidorFalso.clientesCreados.admin ?? 0).toBe(0);
    expect(servidorFalso.llamadas.every((l) => l.cliente === "sesion")).toBe(true);
  });

  it("ya generado con el diseño vigente: no lo rehace, solo firma la descarga", async () => {
    servidorFalso.responder("from:certificados", { data: certificado(RUTA) });
    servidorFalso.responder("storage:certificados", FIRMADA);

    expect(await descargarCertificadoPdf(CERT)).toEqual({ url: "https://proyecto.supabase.co/firmada" });
    expect(construirCertificadoPdf).not.toHaveBeenCalled();
    expect(servidorFalso.encadenado("storage:certificados", "createSignedUrl")).toEqual([
      [RUTA, 300, { download: "certificado-uva-UVA-ABC123.pdf" }],
    ]);
  });

  it("primera vez (o diseño viejo): arma el PDF con la duración LISTO, lo sube a su carpeta y lo registra", async () => {
    servidorFalso.responder("from:certificados", { data: certificado(`${USUARIO}/${CERT}.pdf`) });
    servidorFalso.responder("from:lecciones", { data: [{ duracion: 3600 }, { duracion: 1800 }] });
    servidorFalso.responderEnOrden("storage:certificados", [{ data: {}, error: null }, FIRMADA]);

    expect(await descargarCertificadoPdf(CERT)).toEqual({ url: "https://proyecto.supabase.co/firmada" });

    expect(servidorFalso.encadenado("from:lecciones", "eq")).toContainEqual(["estado_procesamiento", "LISTO"]);
    expect(construirCertificadoPdf).toHaveBeenCalledWith(
      expect.objectContaining({ nombreEstudiante: "Ana Pérez", codigoVerificacion: "UVA-ABC123" }),
    );
    // El QR sale del dominio configurado, nunca del header Host.
    expect(vi.mocked(construirCertificadoPdf).mock.calls[0][0].urlVerificacionQr).toMatch(/^https:\/\/uva\.test\//);
    expect(servidorFalso.encadenado("storage:certificados", "upload")[0][0]).toBe(RUTA);
    expect(servidorFalso.argumentosDe("rpc:registrar_archivo_certificado")).toEqual({
      p_certificado_id: CERT,
      p_archivo_pdf: RUTA,
    });
  });

  it("un fallo al leer el certificado no se muestra como «no existe»", async () => {
    servidorFalso.responder("from:certificados", { data: null, error: ERROR_PG });

    expect(await descargarCertificadoPdf(CERT)).toEqual({ error: "No pudimos cargar tu certificado. Intenta de nuevo." });
    expect(logError).toHaveBeenCalled();
  });

  it("certificado ajeno o inexistente (RLS no lo devuelve): «No encontramos»", async () => {
    servidorFalso.responder("from:certificados", { data: null });

    expect(await descargarCertificadoPdf(CERT)).toEqual({ error: "No encontramos ese certificado." });
  });

  it("si falla la duración del curso, NO guarda un PDF incompleto (quedaría así por años)", async () => {
    servidorFalso.responder("from:certificados", { data: certificado(null) });
    servidorFalso.responder("from:lecciones", { data: null, error: ERROR_PG });

    expect(await descargarCertificadoPdf(CERT)).toEqual({ error: "No pudimos generar tu certificado. Intenta de nuevo." });
    expect(construirCertificadoPdf).not.toHaveBeenCalled();
    expect(servidorFalso.encadenado("storage:certificados", "upload")).toEqual([]);
  });

  it("si falla armar el PDF o subirlo, devuelve error y no lo registra", async () => {
    servidorFalso.responder("from:certificados", { data: certificado(null) });
    vi.mocked(construirCertificadoPdf).mockRejectedValueOnce(new Error("fuente"));
    expect(await descargarCertificadoPdf(CERT)).toEqual({ error: "No pudimos generar tu certificado. Intenta de nuevo." });

    servidorFalso.responder("storage:certificados", { data: null, error: { message: "storage caído" } });
    expect(await descargarCertificadoPdf(CERT)).toEqual({ error: "No pudimos guardar tu certificado. Intenta de nuevo." });

    expect(servidorFalso.llamadasA("rpc:registrar_archivo_certificado")).toHaveLength(0);
  });

  it("si solo falla registrar la ruta, la descarga sigue (el PDF ya está subido)", async () => {
    servidorFalso.responder("from:certificados", { data: certificado(null) });
    servidorFalso.responderEnOrden("storage:certificados", [{ data: {}, error: null }, FIRMADA]);
    servidorFalso.responder("rpc:registrar_archivo_certificado", { error: ERROR_PG });

    expect(await descargarCertificadoPdf(CERT)).toEqual({ url: "https://proyecto.supabase.co/firmada" });
    expect(logError).toHaveBeenCalledWith("descargarCertificadoPdf", "No se pudo registrar archivo_pdf", ERROR_PG, expect.anything());
  });

  it("si no se puede firmar el enlace, lo dice", async () => {
    servidorFalso.responder("from:certificados", { data: certificado(RUTA) });
    servidorFalso.responder("storage:certificados", { data: null, error: { message: "firma" } });

    expect(await descargarCertificadoPdf(CERT)).toEqual({ error: "No pudimos generar el enlace de descarga." });
  });
});
