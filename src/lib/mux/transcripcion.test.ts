import { describe, expect, it } from "vitest";
import { vttATextoPlano } from "./transcripcion";

describe("vttATextoPlano", () => {
  it("quita la cabecera, los identificadores de cue y las marcas de tiempo", () => {
    const vtt = [
      "WEBVTT",
      "",
      "1",
      "00:00:01.000 --> 00:00:04.000",
      "Hoy vamos a configurar la iluminación global.",
      "",
      "2",
      "00:00:04.000 --> 00:00:07.500",
      "El parámetro más importante es la subdivisión.",
      "",
    ].join("\n");

    expect(vttATextoPlano(vtt)).toBe(
      "Hoy vamos a configurar la iluminación global. El parámetro más importante es la subdivisión.",
    );
  });

  it("quita los ajustes de posición de la línea de tiempo", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000 align:start position:0%\nHola.";
    expect(vttATextoPlano(vtt)).toBe("Hola.");
  });

  it("quita las etiquetas inline de locutor y de tiempo", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Profesor>Esto <00:00:01.500>es <b>clave</b>.";
    expect(vttATextoPlano(vtt)).toBe("Esto es clave.");
  });

  // Los subtítulos rollup repiten la última línea del cue anterior. Sin
  // deduplicar, cada frase queda escrita dos veces y el modelo genera preguntas
  // duplicadas sobre ellas.
  it("deduplica líneas consecutivas repetidas del efecto rollup", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:03.000",
      "primera línea",
      "",
      "00:00:03.000 --> 00:00:05.000",
      "primera línea",
      "segunda línea",
      "",
    ].join("\n");

    expect(vttATextoPlano(vtt)).toBe("primera línea segunda línea");
  });

  it("no deduplica una repetición legítima que no es consecutiva", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nsí\nno\nsí";
    expect(vttATextoPlano(vtt)).toBe("sí no sí");
  });

  it("ignora los bloques NOTE y STYLE", () => {
    const vtt = "WEBVTT\n\nNOTE esto es un comentario\n\n00:00:01.000 --> 00:00:02.000\nTexto real.";
    expect(vttATextoPlano(vtt)).toBe("Texto real.");
  });

  it("desescapa las entidades de WebVTT", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nA &amp; B &lt;algo&gt;";
    expect(vttATextoPlano(vtt)).toBe("A & B <algo>");
  });

  it("tolera saltos de línea de Windows", () => {
    const vtt = "WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nHola.\r\n";
    expect(vttATextoPlano(vtt)).toBe("Hola.");
  });

  // Una pista vacía tiene que salir vacía para que el llamador la trate como
  // ausente en vez de guardar una transcripción sin contenido.
  it("devuelve vacío cuando el VTT no tiene ni una línea de diálogo", () => {
    expect(vttATextoPlano("WEBVTT\n\n")).toBe("");
  });
});
