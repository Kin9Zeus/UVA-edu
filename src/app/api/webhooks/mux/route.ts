import { type NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";
import { createAdminClient } from "@/lib/supabase/admin";
import { marcarProcesado, registrarEvento } from "@/lib/webhooks/eventos";
import { logError } from "@/lib/log";

// A diferencia de Stripe, `new Mux({ tokenId: "", tokenSecret: "" })` no
// lanza, así que se puede construir en el ámbito del módulo sin riesgo de
// tumbar la ruta con las variables vacías. La verificación de firma solo usa
// MUX_WEBHOOK_SECRET; tokenId/tokenSecret son para llamar a la API de Mux.
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

/** Los campos de video.asset.ready / video.asset.errored que este handler necesita. */
type DatosAsset = {
  id: string;
  upload_id?: string;
  duration?: number;
  playback_ids?: Array<{ id: string; policy: string }>;
  errors?: { type?: string; messages?: string[] };
};

/** Los campos de video.upload.cancelled que este handler necesita. */
type DatosUpload = { id: string };

/** El evento que manda Mux, con los campos que este handler necesita. */
type EventoMux = { id: string; type: string; data?: DatosAsset | DatosUpload };

export async function POST(request: NextRequest) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    logError("webhook:mux", "falta MUX_WEBHOOK_SECRET; no se procesa nada", null, { area: "webhook" });
    return NextResponse.json({ error: "webhook no configurado" }, { status: 500 });
  }

  const payload = await request.text();

  let evento: EventoMux;
  try {
    // unwrap() verifica la firma y recién entonces parsea. El SDK v14 espera
    // las cabeceras completas (lee `mux-signature` por su cuenta), no el valor
    // suelto — y el cuerpo como string crudo, porque la firma se calcula sobre
    // "<timestamp>.<body>" y cualquier reserialización lo invalidaría.
    // Verifica además que el timestamp no tenga más de 5 minutos, lo que corta
    // el replay de un evento legítimo capturado.
    evento = (await mux.webhooks.unwrap(payload, request.headers, secret)) as EventoMux;
  } catch (error) {
    logError("webhook:mux", "firma inválida", error, { area: "webhook" });
    return NextResponse.json({ error: "firma inválida" }, { status: 400 });
  }

  const registro = await registrarEvento({
    proveedor: "mux",
    idEventoExterno: evento.id,
    tipoEvento: evento.type,
    payload: evento,
  });

  if (registro.estado === "duplicado") {
    return NextResponse.json({ received: true, duplicado: true });
  }
  if (registro.estado === "error") {
    logError("webhook:mux", "no se pudo registrar el evento", null, {
      area: "webhook",
      mensaje: registro.mensaje,
      idEvento: evento.id,
    });
    return NextResponse.json({ error: "no se pudo registrar el evento" }, { status: 500 });
  }

  // Cada case actualiza por id_mux_upload_id, no por id_video_mux ni por el
  // asset id: es el único identificador que existe desde ANTES de que Mux
  // cree el asset (se guarda en iniciarSubidaVideoLeccion, src/actions/admin/mux.ts),
  // así que es lo único común entre "nuestra fila" y "el evento de Mux" en
  // los tres casos. Si no hay ninguna fila con ese upload_id (p. ej. el
  // admin ya pidió una subida nueva y esta quedó superada), el UPDATE no
  // afecta filas y no es un error: es el comportamiento correcto, no hay
  // nada que corromper.
  const admin = createAdminClient();

  switch (evento.type) {
    case "video.asset.ready": {
      const data = evento.data as DatosAsset;
      const playbackId =
        data.playback_ids?.find((p) => p.policy === "signed")?.id ?? data.playback_ids?.[0]?.id;

      if (!data.upload_id || !playbackId) {
        logError("webhook:mux", "video.asset.ready sin upload_id o playback_id firmado", null, {
          area: "webhook",
          idEvento: evento.id,
          assetId: data.id,
        });
        break;
      }

      const { error } = await admin
        .from("lecciones")
        .update({
          id_video_mux: playbackId,
          id_mux_asset_id: data.id,
          duracion: data.duration != null ? Math.round(data.duration) : null,
          estado_procesamiento: "LISTO",
          error_procesamiento: null,
        })
        .eq("id_mux_upload_id", data.upload_id);

      if (error) {
        logError("webhook:mux", "no se pudo marcar la lección como LISTO", error, {
          area: "webhook",
          idEvento: evento.id,
          uploadId: data.upload_id,
        });
        return NextResponse.json({ error: "no se pudo actualizar la lección" }, { status: 500 });
      }
      break;
    }

    case "video.asset.errored": {
      const data = evento.data as DatosAsset;
      if (!data.upload_id) {
        logError("webhook:mux", "video.asset.errored sin upload_id", null, {
          area: "webhook",
          idEvento: evento.id,
          assetId: data.id,
        });
        break;
      }

      const mensaje = data.errors?.messages?.join(" ") || "Mux no pudo procesar el video.";
      const { error } = await admin
        .from("lecciones")
        .update({ estado_procesamiento: "ERROR", error_procesamiento: mensaje })
        .eq("id_mux_upload_id", data.upload_id);

      if (error) {
        logError("webhook:mux", "no se pudo marcar la lección como ERROR", error, {
          area: "webhook",
          idEvento: evento.id,
          uploadId: data.upload_id,
        });
        return NextResponse.json({ error: "no se pudo actualizar la lección" }, { status: 500 });
      }
      break;
    }

    case "video.upload.cancelled": {
      const data = evento.data as DatosUpload;
      const { error } = await admin
        .from("lecciones")
        .update({ estado_procesamiento: "ERROR", error_procesamiento: "La subida se canceló." })
        .eq("id_mux_upload_id", data.id);

      if (error) {
        logError("webhook:mux", "no se pudo marcar la lección tras cancelar la subida", error, {
          area: "webhook",
          idEvento: evento.id,
          uploadId: data.id,
        });
        return NextResponse.json({ error: "no se pudo actualizar la lección" }, { status: 500 });
      }
      break;
    }

    default:
      break;
  }

  await marcarProcesado(evento.id);
  return NextResponse.json({ received: true });
}
