import sharp from "sharp";
import {
  TAMANO_MAXIMO_FOTO_PERFIL,
  ERROR_FORMATO_FOTO_PERFIL,
  ERROR_TAMANO_FOTO_PERFIL,
} from "@/lib/avatar";

/**
 * Formatos que se aceptan, por lo que la imagen ES y no por lo que el
 * cliente dice que es — mismo criterio que procesarPortada
 * (src/lib/admin/portada.ts). Sin SVG: es un documento con scripts, no un
 * mapa de bits, y servido desde un bucket público sería un XSS.
 */
const FORMATOS_ACEPTADOS = new Set(["jpeg", "png", "webp"]);

/**
 * Lado del cuadrado al que se normaliza toda foto de perfil. El Avatar de
 * la UI (`AvatarImage`, src/components/ui/avatar.tsx) ya fuerza
 * `aspect-square object-cover rounded-full` del lado del cliente, pero
 * normalizar acá también evita depender solo de eso: cualquier imagen que
 * llegue (un retrato vertical, una foto panorámica) sale recortada al
 * centro en un cuadrado antes de guardarse, así que se ve igual de bien en
 * cualquier lugar de la app que use un `<img>` sin pasar por ese
 * componente (los correos transaccionales, por ejemplo).
 */
const LADO_FOTO_PERFIL = 256;

export type FotoPerfilProcesada = {
  cuerpo: Buffer;
  contentType: string;
  extension: string;
};

/**
 * Valida y normaliza una foto de perfil: siempre sale un WebP cuadrado de
 * 256×256, recortado al centro (`fit: "cover"`, nunca estirado) — mismo
 * criterio que procesarPortada, adaptado a 1:1 en vez de 16:9.
 *
 * Server-only (importa `sharp`, un paquete de Node) — solo lo llama el
 * Server Action subirFotoPerfil (src/actions/perfil/foto.ts). Un
 * componente cliente que necesite las constantes de validación debe
 * importarlas de src/lib/avatar.ts, nunca de acá.
 */
export async function procesarFotoPerfil(
  archivo: File,
): Promise<{ foto: FotoPerfilProcesada } | { error: string }> {
  if (archivo.size === 0) return { error: "Selecciona una imagen." };
  if (archivo.size > TAMANO_MAXIMO_FOTO_PERFIL) return { error: ERROR_TAMANO_FOTO_PERFIL };

  const entrada = Buffer.from(await archivo.arrayBuffer());

  try {
    const { format } = await sharp(entrada).metadata();
    if (!format || !FORMATOS_ACEPTADOS.has(format)) {
      return { error: ERROR_FORMATO_FOTO_PERFIL };
    }

    const cuerpo = await sharp(entrada)
      .resize(LADO_FOTO_PERFIL, LADO_FOTO_PERFIL, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();

    return { foto: { cuerpo, contentType: "image/webp", extension: "webp" } };
  } catch {
    return { error: ERROR_FORMATO_FOTO_PERFIL };
  }
}
