/**
 * Constantes de foto de perfil, sin el procesamiento (`sharp`) — separadas a
 * propósito, mismo motivo que src/lib/comunidad-tipos.ts documenta: este
 * archivo lo importa `EditorFotoPerfil.tsx` (componente cliente) para
 * validar del lado del navegador antes de subir, y un import de `sharp`
 * acá arrastraría ese paquete de Node entero al bundle del navegador
 * ("Module not found: Can't resolve 'child_process'"). El procesamiento
 * real vive en src/lib/fotoPerfilServidor.ts, que solo importa el Server
 * Action (src/actions/perfil/foto.ts).
 */

/** Límite del lado del cliente — el que manda es el del servidor (procesarFotoPerfil). */
export const TAMANO_MAXIMO_FOTO_PERFIL = 3 * 1024 * 1024;

/** Formatos aceptados, en el orden en que se le muestran al usuario. */
export const FORMATOS_FOTO_PERFIL = ["JPG", "PNG", "WebP"] as const;

/** Valor del `accept` del input de archivo. Coincide con FORMATOS_FOTO_PERFIL. */
export const ACCEPT_FOTO_PERFIL = "image/jpeg,image/png,image/webp";

export const ERROR_FORMATO_FOTO_PERFIL = `La imagen debe ser ${FORMATOS_FOTO_PERFIL.join(", ")}.`;
export const ERROR_TAMANO_FOTO_PERFIL = `La imagen no puede superar los ${TAMANO_MAXIMO_FOTO_PERFIL / 1024 / 1024} MB.`;
