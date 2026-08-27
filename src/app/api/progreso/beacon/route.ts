import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Excepción deliberada a CLAUDE.md §3.1 ("Route Handlers reservados
 * únicamente para Webhooks externos"): `navigator.sendBeacon`, que es el
 * único transporte del navegador que garantiza el envío al cerrar la
 * pestaña (Revf3, "usar sendBeacon para el guardado final"), no permite
 * fijar el header `Next-Action` que Next.js exige para enrutar una llamada
 * a un Server Action. No hay forma de cumplir ese requisito sin un endpoint
 * de URL plana — este es ese único caso, acotado a esto.
 *
 * Hace exactamente lo mismo que guardarSegundoActual en
 * actions/progreso/marcar.ts (mismo cliente con sesión de cookies, mismo
 * upsert acotado a `segundo_actual`, nunca toca `completado`, nunca usa
 * service role) — solo cambia el transporte.
 */

const cuerpoSchema = z.object({
  leccionId: z.string().uuid(),
  segundos: z.number().int().min(0).max(24 * 60 * 60),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const resultado = cuerpoSchema.safeParse(payload);
  if (!resultado.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });

  await supabase.from("progreso").upsert(
    {
      id_usuario: user.id,
      id_leccion: resultado.data.leccionId,
      segundo_actual: resultado.data.segundos,
    },
    { onConflict: "id_usuario,id_leccion" },
  );

  return NextResponse.json({ ok: true });
}
