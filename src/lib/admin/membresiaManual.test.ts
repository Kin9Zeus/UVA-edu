import { describe, expect, it } from "vitest";
import { mensajeMembresiaYaVigente } from "@/lib/admin/membresiaManual";

describe("mensajeMembresiaYaVigente", () => {
  it("dice cómo desbloquearlo cuando la membresía vigente es manual", () => {
    const mensaje = mensajeMembresiaYaVigente({
      estado: "ACTIVA",
      esManual: true,
      planNombre: "Plan Anual",
    });
    expect(mensaje).toContain("Plan Anual");
    // Lo accionable: revocar es el camino, y `revocarMembresia` sí acepta las manuales.
    expect(mensaje).toContain("Revócala");
  });

  it("no propone revocar cuando la vigente es de pago — revocarMembresia las rechaza", () => {
    const mensaje = mensajeMembresiaYaVigente({
      estado: "ACTIVA",
      esManual: false,
      planNombre: "Plan Mensual",
    });
    expect(mensaje).toContain("de pago");
    expect(mensaje).toContain("pasarela");
    expect(mensaje).not.toContain("Revócala");
  });

  it("nombra el acceso por invitación, que no tiene plan asociado", () => {
    const mensaje = mensajeMembresiaYaVigente({
      estado: "ACTIVA",
      esManual: true,
      planNombre: null,
    });
    expect(mensaje).toContain("Acceso por invitación");
  });

  it("trata PAST_DUE igual que ACTIVA — ambas ocupan el cupo del índice único", () => {
    const mensaje = mensajeMembresiaYaVigente({
      estado: "PAST_DUE",
      esManual: true,
      planNombre: "Plan Anual",
    });
    expect(mensaje).toContain("Revócala");
  });
});
