import { CLARO, OSCURO } from "./paleta";

/**
 * Estilos del <head> de todos los correos. Lo esencial va en línea en cada
 * elemento (muchos clientes descartan el <head>); esto solo agrega:
 *   - celular (menos de 600 px): márgenes, título y rótulo apilado;
 *   - tema oscuro, para los clientes que respetan `prefers-color-scheme`.
 *
 * Cada clase `c-*` marca qué propiedad cambia en oscuro. Las usa marco.tsx;
 * una plantilla no las escribe a mano.
 */
export const ESTILOS_CORREO = `
body{margin:0;padding:0;}
.c-logo-oscuro{display:none;}
@media only screen and (max-width:600px){
  .c-pad{padding-left:20px!important;padding-right:20px!important;}
  .c-h1{font-size:24px!important;line-height:30px!important;}
  .c-rot td.c-rc{display:block!important;width:auto!important;border-left:0!important;border-top:1.5px solid ${CLARO.tinta}!important;}
  .c-rot td.c-rc0{border-top:0!important;}
  .c-carne{width:100%!important;}
}
@media (prefers-color-scheme:dark){
  .c-pagina{background:${OSCURO.pagina}!important;}
  .c-tarjeta{background:${OSCURO.tarjeta}!important;border-color:${OSCURO.tinta}!important;}
  .c-tinta{color:${OSCURO.tinta}!important;}
  .c-suave{color:${OSCURO.suave}!important;}
  .c-linea{border-color:${OSCURO.linea}!important;}
  .c-borde{border-color:${OSCURO.tinta}!important;}
  .c-fondo-suave{background:${OSCURO.fondoSuave}!important;}
  .c-fondo-tarjeta{background:${OSCURO.tarjeta}!important;}
  .c-fondo-tinta{background:${OSCURO.tinta}!important;}
  .c-separador{background:${OSCURO.linea}!important;}
  .c-enlace{color:${OSCURO.enlace}!important;}
  .c-logo-claro{display:none!important;}
  .c-logo-oscuro{display:block!important;}
  .c-rot td.c-rc{border-top-color:${OSCURO.tinta}!important;}
}
`;
