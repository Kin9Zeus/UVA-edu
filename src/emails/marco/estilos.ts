import { BASE, FIJOS } from "./paleta";

type Paleta = typeof BASE;

/**
 * Reglas de color por clase. Cada clase `c-*` marca qué propiedad cambia con
 * el tema; las usa marco.tsx, una plantilla no las escribe a mano.
 * `antes` es el prefijo del selector (vacío, o el atributo que pone Outlook).
 */
function reglasDeColor(p: Paleta, antes = ""): string {
  const s = (clase: string) => `${antes}${clase}`;
  return [
    `${s(".c-pagina")}{background-color:${p.pagina}!important;}`,
    `${s(".c-tarjeta")}{background-color:${p.tarjeta}!important;border-color:${p.tinta}!important;}`,
    `${s(".c-tinta")}{color:${p.tinta}!important;}`,
    `${s(".c-suave")}{color:${p.suave}!important;}`,
    `${s(".c-linea")}{border-color:${p.linea}!important;}`,
    `${s(".c-borde")}{border-color:${p.tinta}!important;}`,
    `${s(".c-fondo-suave")}{background-color:${p.fondoSuave}!important;}`,
    `${s(".c-fondo-tarjeta")}{background-color:${p.tarjeta}!important;}`,
    `${s(".c-fondo-tinta")}{background-color:${p.tinta}!important;}`,
    `${s(".c-separador")}{background-color:${p.linea}!important;}`,
    `${s(".c-enlace")}{color:${p.enlace}!important;}`,
  ].join("\n  ");
}

/** Los colores de marca no cambian con el tema: nadie debe recolorearlos. */
function reglasFijas(antes = ""): string {
  const s = (clase: string) => `${antes}${clase}`;
  return [
    `${s(".c-amarillo")}{background-color:${FIJOS.amarillo}!important;color:${FIJOS.sobreAmarillo}!important;}`,
    `${s(".c-borde-amarillo")}{border-color:${FIJOS.amarillo}!important;}`,
    `${s(".c-boton")}{background-color:${FIJOS.boton}!important;color:${FIJOS.sobreBoton}!important;}`,
    `${s(".c-borde-magenta")}{border-color:${FIJOS.magenta}!important;}`,
  ].join("\n  ");
}

/**
 * Estilos del <head> de todos los correos. Lo esencial va en línea en cada
 * elemento, en tema OSCURO (muchos clientes descartan el <head>). Esto agrega:
 *   - celular (menos de 600 px): márgenes, título y rótulo apilado;
 *   - tema oscuro repetido: un cliente que ve reglas propias de oscuro sabe
 *     que el correo ya está pensado para ese tema y no lo recolorea;
 *   - Outlook (Outlook.com y las apps del celular) recolorea igual con su
 *     propio modo oscuro y marca lo que cambió con `data-ogsc` (texto) y
 *     `data-ogsb` (fondo): esas reglas devuelven los colores del diseño.
 *     Sin ellas, el fondo casi negro salía gris y el amarillo, café.
 *     Además cada fondo va también como degradado (`fondo()` en marco.tsx),
 *     que la app de Outlook del celular no recolorea.
 *
 * No hay versión clara: los correos son oscuros siempre, también para quien
 * tiene el teléfono en modo claro (decisión del 2026-10-20).
 */
export const ESTILOS_CORREO = `
body{margin:0;padding:0;}
@media only screen and (max-width:600px){
  .c-pad{padding-left:20px!important;padding-right:20px!important;}
  .c-h1{font-size:24px!important;line-height:30px!important;}
  .c-rot td.c-rc{display:block!important;width:auto!important;border-left:0!important;border-top:1.5px solid ${BASE.tinta}!important;}
  .c-rot td.c-rc0{border-top:0!important;}
  .c-carne{width:100%!important;}
}
@media (prefers-color-scheme:dark){
  ${reglasDeColor(BASE)}
  ${reglasFijas()}
}
${reglasDeColor(BASE, "[data-ogsb] ")}
${reglasDeColor(BASE, "[data-ogsc] ")}
${reglasFijas("[data-ogsb] ")}
${reglasFijas("[data-ogsc] ")}
`;
