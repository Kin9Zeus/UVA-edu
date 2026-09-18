"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import {
  DESCRIPCION_TIPO,
  esTipoCreable,
  ETIQUETA_TIPO,
  MAXIMO_OPCIONES_POR_PREGUNTA,
  MAXIMO_PARES_EMPAREJAR,
  TIPOS_CREABLES,
  type OpcionPregunta,
  type ParEmparejar,
  type PreguntaCompleta,
  type TipoPreguntaImplementado,
} from "@/lib/examenes/tipos";
import type { DocumentoContenido } from "@/lib/editor/tipos";

/**
 * Editor de una pregunta, en línea debajo de su fila — mismo patrón que
 * LeccionEditorPanel dentro de ModuloCard (el editor enriquecido no cabe en
 * una columna lateral angosta).
 *
 * Estado local con botón "Guardar pregunta" explícito, no autoguardado: una
 * pregunta a medio escribir (con dos opciones marcadas como correctas, o sin
 * ninguna) no valida en el servidor, así que guardar en cada tecla solo
 * produciría errores constantes. El aviso de cambios sin guardar lo maneja
 * ExamenTab.
 */
export function PreguntaEditor({
  pregunta,
  numero,
  onGuardar,
  onEliminar,
  onDirtyChange,
  pending,
}: {
  pregunta: PreguntaCompleta;
  numero: number;
  onGuardar: (cambios: {
    tipo: TipoPreguntaImplementado;
    enunciado: DocumentoContenido;
    puntos: number;
    opciones: OpcionPregunta[] | ParEmparejar[] | null;
    respuestasAceptadas: string[];
    explicacion: DocumentoContenido | null;
  }) => Promise<void>;
  onEliminar: () => void;
  onDirtyChange: (dirty: boolean) => void;
  pending: boolean;
}) {
  const [tipo, setTipo] = useState<TipoPreguntaImplementado>(pregunta.tipo);
  const [enunciado, setEnunciado] = useState<DocumentoContenido>(pregunta.enunciado);
  const [puntos, setPuntos] = useState(pregunta.puntos);
  const [opciones, setOpciones] = useState<OpcionPregunta[]>(
    pregunta.tipo === "EMPAREJAR" ? [] : (pregunta.opciones as OpcionPregunta[] | null) ?? [],
  );
  const [pares, setPares] = useState<ParEmparejar[]>(
    pregunta.tipo === "EMPAREJAR"
      ? (pregunta.opciones as ParEmparejar[] | null) ?? []
      : [
          { id: crypto.randomUUID(), izquierda: "", derecha: "" },
          { id: crypto.randomUUID(), izquierda: "", derecha: "" },
        ],
  );
  const [respuestas, setRespuestas] = useState<string[]>(
    pregunta.respuestasAceptadas.length > 0 ? pregunta.respuestasAceptadas : [""],
  );
  const [explicacion, setExplicacion] = useState<DocumentoContenido | null>(pregunta.explicacion);
  const [error, setError] = useState<string | null>(null);

  // OPCION_MULTIPLE y RELLENAR_ESPACIO ya no se pueden CREAR (`TIPOS_CREABLES`
  // en src/lib/examenes/tipos.ts), pero una pregunta que ya era de uno de esos
  // dos tipos antes del cambio sigue abriéndose acá para editar su enunciado,
  // puntos u opciones — por eso el tipo actual se agrega a la lista si no es
  // creable, en vez de desaparecer del selector y forzar un cambio no pedido.
  const opcionesTipo = esTipoCreable(pregunta.tipo) ? TIPOS_CREABLES : [pregunta.tipo, ...TIPOS_CREABLES];

  function marcarSucio() {
    onDirtyChange(true);
  }

  function cambiarTipo(nuevo: TipoPreguntaImplementado) {
    setTipo(nuevo);
    marcarSucio();

    // Verdadero/falso tiene exactamente dos opciones fijas: se reponen al
    // cambiar a ese tipo en vez de dejar las que hubiera (que podrían ser
    // cuatro, y el servidor las rechazaría).
    if (nuevo === "VERDADERO_FALSO") {
      setOpciones([
        { id: crypto.randomUUID(), texto: "Verdadero", correcta: true },
        { id: crypto.randomUUID(), texto: "Falso", correcta: false },
      ]);
      return;
    }

    if (nuevo === "EMPAREJAR") {
      if (pares.length < 2) {
        setPares([
          { id: crypto.randomUUID(), izquierda: "", derecha: "" },
          { id: crypto.randomUUID(), izquierda: "", derecha: "" },
        ]);
      }
      return;
    }

    if (nuevo !== "RELLENAR_ESPACIO" && opciones.length < 2) {
      setOpciones([
        { id: crypto.randomUUID(), texto: "", correcta: true },
        { id: crypto.randomUUID(), texto: "", correcta: false },
      ]);
    }

    // Pasar de opción múltiple a única con varias marcadas dejaría una
    // pregunta que el servidor rechaza; se conserva solo la primera correcta.
    if (nuevo === "OPCION_UNICA") {
      setOpciones((actuales) => {
        let yaMarcada = false;
        return actuales.map((opcion) => {
          if (opcion.correcta && !yaMarcada) {
            yaMarcada = true;
            return opcion;
          }
          return { ...opcion, correcta: false };
        });
      });
    }
  }

  function alternarCorrecta(id: string) {
    marcarSucio();
    setOpciones((actuales) =>
      actuales.map((opcion) => {
        if (tipo === "OPCION_MULTIPLE") {
          return opcion.id === id ? { ...opcion, correcta: !opcion.correcta } : opcion;
        }
        // Única y verdadero/falso: marcar una desmarca el resto.
        return { ...opcion, correcta: opcion.id === id };
      }),
    );
  }

  const esEmparejar = tipo === "EMPAREJAR";
  const esOpciones = tipo !== "RELLENAR_ESPACIO" && !esEmparejar;
  const puedeAgregarOpcion =
    tipo !== "VERDADERO_FALSO" && opciones.length < MAXIMO_OPCIONES_POR_PREGUNTA;
  const puedeAgregarPar = pares.length < MAXIMO_PARES_EMPAREJAR;

  async function handleGuardar() {
    setError(null);
    const limpias = respuestas.map((respuesta) => respuesta.trim()).filter(Boolean);

    // Validación de cortesía: la del servidor manda, pero avisar acá evita el
    // viaje de ida y vuelta para los errores más comunes.
    if (esEmparejar) {
      if (pares.length < 2) {
        setError("Un emparejamiento necesita al menos dos pares.");
        return;
      }
      if (pares.some((par) => par.izquierda.trim() === "" || par.derecha.trim() === "")) {
        setError("Hay pares sin completar.");
        return;
      }
    } else if (esOpciones) {
      if (opciones.some((opcion) => opcion.texto.trim() === "")) {
        setError("Hay opciones sin texto.");
        return;
      }
      if (!opciones.some((opcion) => opcion.correcta)) {
        setError("Marca cuál es la respuesta correcta.");
        return;
      }
    } else if (limpias.length === 0) {
      setError("Escribe al menos una respuesta aceptada.");
      return;
    }

    await onGuardar({
      tipo,
      enunciado,
      puntos,
      opciones: esEmparejar
        ? pares.map((par) => ({ ...par, izquierda: par.izquierda.trim(), derecha: par.derecha.trim() }))
        : esOpciones
          ? opciones.map((o) => ({ ...o, texto: o.texto.trim() }))
          : null,
      respuestasAceptadas: esOpciones || esEmparejar ? [] : limpias,
      explicacion,
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-uva-md border border-uva-divider bg-uva-surface-2 p-4">
      {error && (
        <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor={`tipo-${pregunta.id}`}>Tipo de pregunta</Label>
          {/* <select> nativo y no el Select de Radix: son cuatro opciones fijas
              dentro de un panel que ya tiene bastante interacción, y el nativo
              es accesible por teclado sin ninguna configuración extra. */}
          <select
            id={`tipo-${pregunta.id}`}
            value={tipo}
            onChange={(event) => cambiarTipo(event.target.value as TipoPreguntaImplementado)}
            className="h-9 w-full rounded-uva-md border border-uva-divider bg-uva-surface px-3 text-[13.5px] text-uva-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
          >
            {opcionesTipo.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETA_TIPO[valor]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-uva-text-faint">{DESCRIPCION_TIPO[tipo]}</p>
        </div>

        <div className="w-[110px]">
          <Label htmlFor={`puntos-${pregunta.id}`}>Puntos</Label>
          <Input
            id={`puntos-${pregunta.id}`}
            type="number"
            min={1}
            max={100}
            value={puntos}
            onChange={(event) => {
              setPuntos(Number(event.target.value));
              marcarSucio();
            }}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`enunciado-${pregunta.id}`}>Enunciado</Label>
        <div className="mt-1.5 rounded-uva-md border border-uva-divider bg-uva-surface">
          <RichTextEditor
            initialContent={enunciado}
            onChange={(contenido) => {
              setEnunciado(contenido);
              marcarSucio();
            }}
            placeholder={`Escribe la pregunta ${numero}…`}
          />
        </div>
      </div>

      {esEmparejar ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-semibold text-uva-text">
            Pares a relacionar
            <span className="ml-2 font-normal text-uva-text-faint">
              El estudiante empareja cada izquierda con su derecha correcta.
            </span>
          </legend>

          {pares.map((par, indice) => (
            <div key={par.id} className="flex items-center gap-2.5">
              <Input
                value={par.izquierda}
                onChange={(event) => {
                  const izquierda = event.target.value;
                  setPares((actuales) =>
                    actuales.map((item) => (item.id === par.id ? { ...item, izquierda } : item)),
                  );
                  marcarSucio();
                }}
                placeholder={`Izquierda ${indice + 1}`}
                aria-label={`Elemento izquierdo del par ${indice + 1}`}
              />
              <Input
                value={par.derecha}
                onChange={(event) => {
                  const derecha = event.target.value;
                  setPares((actuales) =>
                    actuales.map((item) => (item.id === par.id ? { ...item, derecha } : item)),
                  );
                  marcarSucio();
                }}
                placeholder={`Derecha ${indice + 1}`}
                aria-label={`Elemento derecho del par ${indice + 1}`}
              />
              {pares.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Eliminar el par ${indice + 1}`}
                  onClick={() => {
                    setPares((actuales) => actuales.filter((item) => item.id !== par.id));
                    marcarSucio();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}

          {puedeAgregarPar && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => {
                setPares((actuales) => [
                  ...actuales,
                  { id: crypto.randomUUID(), izquierda: "", derecha: "" },
                ]);
                marcarSucio();
              }}
            >
              <Plus className="size-4" />
              Agregar par
            </Button>
          )}
        </fieldset>
      ) : esOpciones ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-semibold text-uva-text">
            Opciones
            <span className="ml-2 font-normal text-uva-text-faint">
              {tipo === "OPCION_MULTIPLE"
                ? "Marca todas las correctas."
                : "Marca la única correcta."}
            </span>
          </legend>

          {opciones.map((opcion, indice) => (
            <div key={opcion.id} className="flex items-center gap-2.5">
              {/* type=checkbox también para opción única: un radio real
                  obligaría a un `name` compartido y a que una quede siempre
                  marcada, y acá el estado lo lleva `alternarCorrecta`.
                  `role="radio"` + aria-checked comunica la semántica correcta
                  al lector de pantalla en el caso de una sola respuesta. */}
              <input
                type="checkbox"
                checked={opcion.correcta}
                onChange={() => alternarCorrecta(opcion.id)}
                role={tipo === "OPCION_MULTIPLE" ? undefined : "radio"}
                aria-checked={opcion.correcta}
                aria-label={`Marcar la opción ${indice + 1} como correcta`}
                className="size-4 shrink-0 accent-uva-accent"
              />
              <Input
                value={opcion.texto}
                readOnly={tipo === "VERDADERO_FALSO"}
                onChange={(event) => {
                  const texto = event.target.value;
                  setOpciones((actuales) =>
                    actuales.map((item) => (item.id === opcion.id ? { ...item, texto } : item)),
                  );
                  marcarSucio();
                }}
                placeholder={`Opción ${indice + 1}`}
                aria-label={`Texto de la opción ${indice + 1}`}
              />
              {tipo !== "VERDADERO_FALSO" && opciones.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Eliminar la opción ${indice + 1}`}
                  onClick={() => {
                    setOpciones((actuales) => actuales.filter((item) => item.id !== opcion.id));
                    marcarSucio();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}

          {puedeAgregarOpcion && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => {
                setOpciones((actuales) => [
                  ...actuales,
                  { id: crypto.randomUUID(), texto: "", correcta: false },
                ]);
                marcarSucio();
              }}
            >
              <Plus className="size-4" />
              Agregar opción
            </Button>
          )}
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-semibold text-uva-text">
            Respuestas aceptadas
            <span className="ml-2 font-normal text-uva-text-faint">
              Se comparan ignorando mayúsculas, tildes y signos.
            </span>
          </legend>

          {respuestas.map((respuesta, indice) => (
            <div key={indice} className="flex items-center gap-2.5">
              <Input
                value={respuesta}
                onChange={(event) => {
                  const valor = event.target.value;
                  setRespuestas((actuales) =>
                    actuales.map((item, i) => (i === indice ? valor : item)),
                  );
                  marcarSucio();
                }}
                placeholder="Ej. V-Ray"
                aria-label={`Respuesta aceptada ${indice + 1}`}
              />
              {respuestas.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Eliminar la respuesta aceptada ${indice + 1}`}
                  onClick={() => {
                    setRespuestas((actuales) => actuales.filter((_, i) => i !== indice));
                    marcarSucio();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => {
              setRespuestas((actuales) => [...actuales, ""]);
              marcarSucio();
            }}
          >
            <Plus className="size-4" />
            Agregar variante
          </Button>
        </fieldset>
      )}

      <div>
        <Label htmlFor={`explicacion-${pregunta.id}`}>Explicación (opcional)</Label>
        {/* No se le muestra al estudiante mientras le queden intentos — con 3
            intentos, mostrarla permitiría reconstruir el examen. Queda para el
            reporte del admin y para la revisión posterior. */}
        <p className="mt-0.5 mb-1.5 text-xs text-uva-text-faint">
          Para tu registro. No se le muestra al estudiante al reprobar.
        </p>
        <div className="rounded-uva-md border border-uva-divider bg-uva-surface">
          <RichTextEditor
            initialContent={explicacion}
            onChange={(contenido) => {
              setExplicacion(contenido);
              marcarSucio();
            }}
            placeholder="Por qué esta es la respuesta correcta…"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="primary" size="sm" disabled={pending} onClick={handleGuardar}>
          {pending ? "Guardando…" : "Guardar pregunta"}
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={onEliminar}>
          <Trash2 className="size-4" />
          Eliminar pregunta
        </Button>
      </div>
    </div>
  );
}
