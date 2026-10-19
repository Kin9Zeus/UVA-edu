import type { CSSProperties, ReactNode } from "react";
import { Body, Head, Html, Img, Preview } from "@react-email/components";
import { siteUrl } from "@/lib/site-url";
import { ESTILOS_CORREO } from "./estilos";
import { CLARO, CORREO_SOPORTE, FIJOS, LETRA, LETRA_CODIGO } from "./paleta";

/*
 * Marco común de los correos de U.V.A. (rediseño "carné"): cabecera con logo,
 * banda amarilla, cuerpo, rótulo de plano y pie de ayuda.
 *
 * Todo es tabla con estilos en línea: es lo único que Gmail y Outlook
 * respetan igual. El logo es PNG alojado en /public/correo porque Gmail y
 * Outlook de escritorio eliminan los SVG en línea.
 */

const tabla = { role: "presentation", width: "100%", cellPadding: 0, cellSpacing: 0, border: 0 } as const;

function texto(estilo: CSSProperties): CSSProperties {
  return { fontFamily: LETRA, margin: 0, ...estilo };
}

/** Logo de trazo. `gruesa` para tamaños chicos (rótulo). */
function Logo({ ancho, gruesa = false }: { ancho: number; gruesa?: boolean }) {
  const alto = Math.round((ancho * 23) / 70);
  const base = `${siteUrl()}/correo/logo-${gruesa ? "%s-gruesa" : "%s"}.png`;
  const estilo: CSSProperties = { display: "block", border: 0, outline: "none", width: ancho, height: alto };
  return (
    <>
      <Img className="c-logo-claro" src={base.replace("%s", "tinta")} width={ancho} height={alto} alt="U.V.A." style={estilo} />
      <Img
        className="c-logo-oscuro"
        src={base.replace("%s", "claro")}
        width={ancho}
        height={alto}
        alt=""
        style={{ ...estilo, display: "none", msoHide: "all" } as CSSProperties}
      />
    </>
  );
}

/** Una fila del cuerpo. Todas las piezas viven dentro de una. */
export function Fila({ pad = "0 0 18px", children }: { pad?: string; children: ReactNode }) {
  return (
    <tr>
      <td style={{ padding: pad }}>{children}</td>
    </tr>
  );
}

export function Titulo({ children }: { children: ReactNode }) {
  return (
    <Fila pad="0 0 12px">
      <h1
        className="c-h1 c-tinta"
        style={texto({ fontSize: 28, lineHeight: "34px", fontWeight: 800, letterSpacing: "-0.6px", color: CLARO.tinta })}
      >
        {children}
      </h1>
    </Fila>
  );
}

/** Texto en tinta y negrita dentro de un párrafo suave (nombres, correos, fechas). */
export function Fuerte({ children }: { children: ReactNode }) {
  return (
    <strong className="c-tinta" style={{ color: CLARO.tinta, fontWeight: 700 }}>
      {children}
    </strong>
  );
}

export function Parrafo({ children, pad }: { children: ReactNode; pad?: string }) {
  return (
    <Fila pad={pad}>
      <p className="c-suave" style={texto({ fontSize: 16, lineHeight: "26px", color: CLARO.suave })}>
        {children}
      </p>
    </Fila>
  );
}

/** Letra chica para avisos secundarios (vencimiento del enlace, verificación). */
export function Nota({ children, pad = "0 0 14px" }: { children: ReactNode; pad?: string }) {
  return (
    <Fila pad={pad}>
      <p className="c-suave" style={texto({ fontSize: 13, lineHeight: "21px", color: CLARO.suave })}>
        {children}
      </p>
    </Fila>
  );
}

export function Enlace({ href, children, quebrar = false }: { href: string; children: ReactNode; quebrar?: boolean }) {
  return (
    <a
      className="c-enlace"
      href={href}
      target="_blank"
      style={{ color: CLARO.enlace, textDecoration: "underline", wordBreak: quebrar ? "break-all" : "normal" }}
    >
      {children}
    </a>
  );
}

export function Codigo({ children }: { children: ReactNode }) {
  return (
    <span className="c-tinta" style={{ fontFamily: LETRA_CODIGO, fontSize: 14, letterSpacing: "0.5px", color: CLARO.tinta }}>
      {children}
    </span>
  );
}

/** Botón principal a todo el ancho: fácil de tocar en el celular. */
export function Boton({ href, children, pad = "4px 0 14px" }: { href: string; children: ReactNode; pad?: string }) {
  return (
    <Fila pad={pad}>
      <a
        href={href}
        target="_blank"
        style={texto({
          display: "block",
          background: FIJOS.boton,
          borderRadius: 10,
          padding: "16px 20px",
          fontSize: 16,
          lineHeight: "20px",
          fontWeight: 700,
          color: FIJOS.sobreBoton,
          textAlign: "center",
          textDecoration: "none",
        })}
      >
        {children}
      </a>
    </Fila>
  );
}

export function BotonSecundario({ href, children, pad = "0" }: { href: string; children: ReactNode; pad?: string }) {
  return (
    <Fila pad={pad}>
      <a
        className="c-borde c-tinta"
        href={href}
        target="_blank"
        style={texto({
          display: "block",
          border: `1.5px solid ${CLARO.tinta}`,
          borderRadius: 10,
          padding: "14px 20px",
          fontSize: 16,
          lineHeight: "20px",
          fontWeight: 700,
          color: CLARO.tinta,
          textAlign: "center",
          textDecoration: "none",
        })}
      >
        {children}
      </a>
    </Fila>
  );
}

export function Separador() {
  return (
    <Fila pad="6px 0 16px">
      <div className="c-separador" style={{ height: 1, lineHeight: "1px", fontSize: 0, background: CLARO.linea }}>
        &nbsp;
      </div>
    </Fila>
  );
}

/** Para los enlaces de un solo uso: la dirección copiable por si el botón no abre. */
export function EnlaceRespaldo({ href }: { href: string }) {
  return (
    <>
      <Separador />
      <Nota pad="0">
        ¿El botón no funciona? Copia este enlace en tu navegador:
        <br />
        <Enlace href={href} quebrar>
          {href}
        </Enlace>
      </Nota>
    </>
  );
}

/** Recuadro de aviso: `alerta` (¿no fuiste tú?) o `listo` (confirmación). */
export function Recuadro({ icono, children }: { icono: "alerta" | "listo"; children: ReactNode }) {
  const marca =
    icono === "alerta" ? (
      <span
        className="c-enlace"
        style={texto({
          display: "inline-block",
          width: 20,
          height: 20,
          borderRadius: 11,
          border: `2px solid ${FIJOS.magenta}`,
          color: CLARO.enlace,
          fontSize: 13,
          lineHeight: "20px",
          fontWeight: 800,
          textAlign: "center",
        })}
      >
        !
      </span>
    ) : (
      <span
        style={texto({
          display: "inline-block",
          width: 22,
          height: 22,
          borderRadius: 11,
          background: FIJOS.amarillo,
          color: FIJOS.sobreAmarillo,
          fontSize: 13,
          lineHeight: "22px",
          fontWeight: 800,
          textAlign: "center",
        })}
      >
        ✓
      </span>
    );
  return (
    <Fila>
      <table {...tabla} className="c-linea" style={{ borderCollapse: "separate", border: `1px solid ${CLARO.linea}`, borderRadius: 10 }}>
        <tbody>
          <tr>
            <td width={34} valign="top" style={{ width: 34, padding: "14px 0 14px 16px" }}>
              {marca}
            </td>
            <td className="c-tinta" style={texto({ padding: "14px 16px 14px 10px", fontSize: 15, lineHeight: "23px", color: CLARO.tinta })}>
              {children}
            </td>
          </tr>
        </tbody>
      </table>
    </Fila>
  );
}

export type FilaFicha = { etiqueta: string; valor: ReactNode; codigo?: boolean };

/** Ficha de datos: etiqueta a la izquierda, valor a la derecha. */
export function Ficha({ filas }: { filas: FilaFicha[] }) {
  const celda: CSSProperties = { padding: "11px 16px", fontFamily: LETRA, fontSize: 14, lineHeight: "20px", verticalAlign: "top" };
  return (
    <Fila>
      <table {...tabla} className="c-linea" style={{ borderCollapse: "separate", border: `1px solid ${CLARO.linea}`, borderRadius: 10 }}>
        <tbody>
          {filas.map((fila, i) => {
            const borde: CSSProperties = i === 0 ? {} : { borderTop: `1px solid ${CLARO.linea}` };
            return (
              <tr key={fila.etiqueta}>
                <td className="c-linea c-suave" style={{ ...celda, ...borde, width: "38%", color: CLARO.suave }}>
                  {fila.etiqueta}
                </td>
                <td className="c-linea" style={{ ...celda, ...borde, fontWeight: 600, textAlign: "right" }}>
                  {fila.codigo ? <Codigo>{fila.valor}</Codigo> : <span className="c-tinta" style={{ color: CLARO.tinta }}>{fila.valor}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Fila>
  );
}

/** Bloque con borde amarillo para una cita (el motivo de moderación). */
export function Cita({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Fila>
      <table
        {...tabla}
        className="c-fondo-suave"
        style={{ borderCollapse: "separate", borderLeft: `4px solid ${FIJOS.amarillo}`, background: CLARO.fondoSuave, borderRadius: "0 10px 10px 0" }}
      >
        <tbody>
          <tr>
            <td style={{ padding: "14px 16px 14px 18px" }}>
              <p className="c-suave" style={texto({ margin: "0 0 4px", fontSize: 13, lineHeight: "18px", fontWeight: 700, color: CLARO.suave })}>
                {titulo}
              </p>
              <p className="c-tinta" style={texto({ fontSize: 15, lineHeight: "24px", fontStyle: "italic", color: CLARO.tinta })}>
                {children}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </Fila>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0] ?? "").slice(0, 2);
  return letras.toUpperCase() || "U";
}

/**
 * El carné de las pantallas de acceso, con su sello: "pendiente" (magenta,
 * por confirmar) o "activo" (amarillo, ya entró).
 */
export function Carne({
  nombre,
  correo,
  sello,
}: {
  nombre: string;
  correo: string;
  sello: { texto: string; tono: "pendiente" | "activo" };
}) {
  const etiqueta = texto({ fontSize: 11, fontWeight: 600, color: CLARO.suave });
  const dato = texto({ margin: "2px 0 0", fontSize: 14, fontWeight: 600, color: CLARO.tinta });
  const estiloSello: CSSProperties =
    sello.tono === "pendiente"
      ? { border: `2px solid ${FIJOS.magenta}`, color: CLARO.enlace }
      : { border: `2px solid ${CLARO.tinta}`, background: FIJOS.amarillo, color: FIJOS.sobreAmarillo };
  return (
    <Fila pad="2px 0 22px">
      <table
        {...tabla}
        align="center"
        width={300}
        className="c-carne c-borde c-fondo-tarjeta"
        style={{ borderCollapse: "separate", border: `2px solid ${CLARO.tinta}`, borderRadius: 14, overflow: "hidden", background: CLARO.tarjeta }}
      >
        <tbody>
          <tr>
            <td style={{ padding: "16px 18px 0" }}>
              <table {...tabla}>
                <tbody>
                  <tr>
                    <td>
                      <Logo ancho={58} />
                    </td>
                    <td className="c-suave" align="right" style={texto({ fontSize: 12, fontWeight: 600, color: CLARO.suave })}>
                      Carné de obra
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "16px 18px 0" }}>
              <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
                <tbody>
                  <tr>
                    <td
                      className="c-borde c-fondo-suave c-tinta"
                      width={60}
                      height={72}
                      align="center"
                      style={texto({
                        width: 60,
                        height: 72,
                        border: `2px solid ${CLARO.tinta}`,
                        borderRadius: 7,
                        background: CLARO.fondoSuave,
                        fontSize: 24,
                        fontWeight: 800,
                        color: CLARO.tinta,
                      })}
                    >
                      {iniciales(nombre)}
                    </td>
                    <td style={{ paddingLeft: 14 }}>
                      <p className="c-suave" style={etiqueta}>
                        Nombre
                      </p>
                      <p
                        className="c-tinta"
                        style={texto({ margin: "2px 0 0", fontSize: 20, lineHeight: "24px", fontWeight: 800, letterSpacing: "-0.4px", color: CLARO.tinta })}
                      >
                        {nombre}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "14px 18px 0" }}>
              <p className="c-suave" style={etiqueta}>
                Correo
              </p>
              <p className="c-tinta" style={{ ...dato, wordBreak: "break-all" }}>
                {correo}
              </p>
              <p className="c-suave" style={{ ...etiqueta, margin: "10px 0 0" }}>
                Rol
              </p>
              <p className="c-tinta" style={dato}>
                Estudiante U.V.A.
              </p>
            </td>
          </tr>
          <tr>
            <td align="right" style={{ padding: "14px 16px 12px" }}>
              <span
                className={sello.tono === "pendiente" ? "c-enlace" : undefined}
                style={texto({
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 4,
                  fontSize: 12,
                  lineHeight: "15px",
                  fontWeight: 800,
                  transform: "rotate(-4deg)",
                  ...estiloSello,
                })}
              >
                {sello.texto}
              </span>
            </td>
          </tr>
          <tr>
            <td
              className="c-borde"
              style={texto({
                background: FIJOS.amarillo,
                borderTop: `2px solid ${CLARO.tinta}`,
                padding: "9px 18px",
                fontSize: 12,
                fontWeight: 700,
                color: FIJOS.sobreAmarillo,
              })}
            >
              Acceso por invitación
            </td>
          </tr>
        </tbody>
      </table>
    </Fila>
  );
}

/** Los días que faltan, dibujados como una cota de plano de hoy al último día. */
export function Cota({ etiqueta, desde, hasta }: { etiqueta: string; desde: string; hasta: string }) {
  const extremo: CSSProperties = { width: 2, background: CLARO.tinta, fontSize: 0, lineHeight: 0 };
  const lado = texto({ fontSize: 13, color: CLARO.suave });
  return (
    <Fila>
      <table {...tabla} className="c-linea" style={{ borderCollapse: "separate", border: `1px solid ${CLARO.linea}`, borderRadius: 12 }}>
        <tbody>
          <tr>
            <td style={{ padding: "18px 18px 16px" }}>
              <table {...tabla}>
                <tbody>
                  <tr>
                    <td colSpan={3} align="center" style={{ padding: "0 0 8px" }}>
                      <span
                        style={texto({
                          display: "inline-block",
                          padding: "4px 12px",
                          borderRadius: 999,
                          background: FIJOS.amarillo,
                          fontSize: 14,
                          fontWeight: 800,
                          color: FIJOS.sobreAmarillo,
                        })}
                      >
                        {etiqueta}
                      </span>
                    </td>
                  </tr>
                  <tr style={{ height: 16 }}>
                    <td width={2} className="c-fondo-tinta" style={extremo}>
                      &nbsp;
                    </td>
                    <td style={{ height: 16 }}>
                      <div className="c-borde" style={{ height: 0, borderTop: `2px solid ${CLARO.tinta}`, marginTop: 7, fontSize: 0, lineHeight: 0 }}>
                        &nbsp;
                      </div>
                    </td>
                    <td width={2} className="c-fondo-tinta" style={extremo}>
                      &nbsp;
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} style={{ paddingTop: 8 }}>
                      <table {...tabla}>
                        <tbody>
                          <tr>
                            <td className="c-suave" style={lado}>
                              Hoy
                              <br />
                              <Fuerte>{desde}</Fuerte>
                            </td>
                            <td className="c-suave" align="right" style={lado}>
                              Último día
                              <br />
                              <Fuerte>{hasta}</Fuerte>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </Fila>
  );
}

export type MarcoCorreoProps = {
  /** Texto que la bandeja muestra junto al asunto. */
  vistaPrevia: string;
  /** Rótulo de la cabecera, a la derecha del logo ("Seguridad de la cuenta"). */
  seccion: string;
  /** Nombre del correo en el rótulo de plano. */
  nombre: string;
  /** Número de hoja del juego de correos, "01" a "09". */
  hoja: string;
  /** Por qué le llega este correo a la persona (última línea del pie). */
  motivo: string;
  /** Reemplaza la línea de ayuda del pie (el recibo pide citar la referencia). */
  ayuda?: ReactNode;
  children: ReactNode;
};

export function MarcoCorreo({ vistaPrevia, seccion, nombre, hoja, motivo, ayuda, children }: MarcoCorreoProps) {
  const etiquetaRotulo = texto({ fontSize: 10, fontWeight: 700, color: CLARO.suave });
  const valorRotulo = texto({ margin: "2px 0 0", fontSize: 13, lineHeight: "17px", fontWeight: 700, color: CLARO.tinta });
  return (
    <Html lang="es">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        {/* Correo, no página de Next: la regla de fuentes de _document no aplica.
            Gmail ignora la hoja y usa Arial; Apple Mail e iOS cargan la letra. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: ESTILOS_CORREO }} />
      </Head>
      <Preview>{vistaPrevia}</Preview>
      <Body className="c-pagina" style={{ margin: 0, padding: 0, background: CLARO.pagina }}>
        <table {...tabla} className="c-pagina" style={{ background: CLARO.pagina }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: "28px 12px" }}>
                <table
                  {...tabla}
                  className="c-tarjeta"
                  style={{
                    maxWidth: 560,
                    background: CLARO.tarjeta,
                    border: `2px solid ${CLARO.tinta}`,
                    borderRadius: 14,
                    borderCollapse: "separate",
                    overflow: "hidden",
                  }}
                >
                  <tbody>
                    <tr>
                      <td className="c-pad" style={{ padding: "22px 32px 18px" }}>
                        <table {...tabla}>
                          <tbody>
                            <tr>
                              <td>
                                <Logo ancho={70} />
                              </td>
                              <td className="c-suave" align="right" style={texto({ fontSize: 13, fontWeight: 600, color: CLARO.suave })}>
                                {seccion}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td
                        className="c-borde"
                        style={{
                          height: 8,
                          background: FIJOS.amarillo,
                          borderTop: `2px solid ${CLARO.tinta}`,
                          borderBottom: `2px solid ${CLARO.tinta}`,
                          fontSize: 0,
                          lineHeight: 0,
                        }}
                      >
                        &nbsp;
                      </td>
                    </tr>
                    <tr>
                      <td className="c-pad" style={{ padding: "32px 32px 14px" }}>
                        <table {...tabla}>
                          <tbody>{children}</tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td className="c-pad" style={{ padding: "10px 32px 0" }}>
                        <table
                          {...tabla}
                          className="c-rot c-borde"
                          style={{ border: `1.5px solid ${CLARO.tinta}`, borderRadius: 4, borderCollapse: "separate" }}
                        >
                          <tbody>
                            <tr>
                              <td className="c-rc c-rc0" style={{ padding: "9px 12px", width: "40%" }}>
                                <Logo ancho={48} gruesa />
                                <p className="c-suave" style={texto({ margin: "4px 0 0", fontSize: 11, lineHeight: "14px", fontWeight: 600, color: CLARO.suave })}>
                                  Unidad Vectorial de Arquitectura
                                </p>
                              </td>
                              <td className="c-rc c-borde" style={{ padding: "9px 12px", borderLeft: `1.5px solid ${CLARO.tinta}`, width: "34%" }}>
                                <p className="c-suave" style={etiquetaRotulo}>
                                  Correo
                                </p>
                                <p className="c-tinta" style={valorRotulo}>
                                  {nombre}
                                </p>
                              </td>
                              <td className="c-rc c-borde" style={{ padding: "9px 12px", borderLeft: `1.5px solid ${CLARO.tinta}`, width: "26%" }}>
                                <p className="c-suave" style={etiquetaRotulo}>
                                  Hoja
                                </p>
                                <p className="c-tinta" style={{ ...valorRotulo, fontFamily: LETRA_CODIGO }}>
                                  {hoja}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td className="c-pad c-suave" style={texto({ padding: "14px 32px 24px", fontSize: 12, lineHeight: "19px", color: CLARO.suave })}>
                        {ayuda ?? (
                          <>
                            ¿Necesitas ayuda? Escríbenos a <Enlace href={`mailto:${CORREO_SOPORTE}`}>{CORREO_SOPORTE}</Enlace>.
                          </>
                        )}
                        <br />
                        {motivo}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}
