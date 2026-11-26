/**
 * Para registros que se repiten en ráfaga cuando algo de afuera se cae (la
 * base, Supabase): con 200 personas viendo video, el guardado del avance
 * fallaría unas 20 veces por segundo y agotaría la cuota de Sentry justo
 * durante la caída. Con un aviso por minuto por sitio basta para enterarse.
 *
 * ponytail: en memoria, así que es uno por minuto POR INSTANCIA del servidor
 * (hoy Railway corre una). Con varias réplicas, pasar a un contador en la base.
 */
const ultimoAviso = new Map<string, number>();

export function unaVezPorMinuto(clave: string, ahora = Date.now()): boolean {
  const anterior = ultimoAviso.get(clave);
  if (anterior !== undefined && ahora - anterior < 60_000) return false;
  ultimoAviso.set(clave, ahora);
  return true;
}

/** Solo para pruebas. */
export function reiniciarUnaVezPorMinuto(): void {
  ultimoAviso.clear();
}
