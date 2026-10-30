import { LEGAL_HABILITADO } from "@/lib/features";
import { esTemaSoporte } from "@/lib/soporte";
import { rutaLegal, type SlugLegal } from "@/lib/legal/slugs";
import { getSlugsConTextoVigente } from "@/lib/legal/textos";

/**
 * Los temas "Términos" y "Privacidad" de /soporte (y de /dashboard/soporte)
 * hoy dicen "Contenido en preparación". Cuando los textos legales estén
 * publicados esos dos enlaces —que ya andan compartidos, el `?tema=` es parte
 * del contrato público (lib/soporte.tsx)— deben llevar al texto de verdad.
 *
 * "Privacidad" apunta a la política de tratamiento de datos personales: es la
 * que responde lo que alguien busca ahí (qué datos, para qué, cómo borrarlos).
 * El aviso de privacidad es un resumen que se muestra junto a los formularios.
 */
const TEMA_A_TEXTO: Record<string, SlugLegal> = {
  terminos: "terminos",
  privacidad: "datos-personales",
};

/**
 * La ruta a la que redirigir, o `null` para dejar la página de soporte como
 * está. Solo redirige si la bandera está encendida Y ese texto tiene una
 * versión vigente: redirigir a un 404 sería peor que el aviso de "en
 * preparación".
 */
export async function destinoLegalDeTema(tema: string | undefined): Promise<string | null> {
  if (!LEGAL_HABILITADO || !esTemaSoporte(tema)) return null;
  const slug = TEMA_A_TEXTO[tema];
  if (!slug) return null;
  const publicados = await getSlugsConTextoVigente();
  return publicados.includes(slug) ? rutaLegal(slug) : null;
}
