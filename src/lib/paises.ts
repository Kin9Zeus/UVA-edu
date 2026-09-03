export type Pais = {
  /** ISO 3166-1 alpha-2, usado como `value` del selector. */
  codigo: string;
  nombre: string;
  indicativo: string;
};

// Gremio de arquitectura/construcción de habla hispana: Colombia primero
// (mercado principal, ver Wompi en docs/technical-spec.md), resto en orden
// alfabético.
export const PAISES: Pais[] = [
  { codigo: "CO", nombre: "Colombia", indicativo: "+57" },
  { codigo: "AR", nombre: "Argentina", indicativo: "+54" },
  { codigo: "BO", nombre: "Bolivia", indicativo: "+591" },
  { codigo: "BR", nombre: "Brasil", indicativo: "+55" },
  { codigo: "CL", nombre: "Chile", indicativo: "+56" },
  { codigo: "CR", nombre: "Costa Rica", indicativo: "+506" },
  { codigo: "EC", nombre: "Ecuador", indicativo: "+593" },
  { codigo: "SV", nombre: "El Salvador", indicativo: "+503" },
  { codigo: "ES", nombre: "España", indicativo: "+34" },
  { codigo: "US", nombre: "Estados Unidos", indicativo: "+1" },
  { codigo: "GT", nombre: "Guatemala", indicativo: "+502" },
  { codigo: "HN", nombre: "Honduras", indicativo: "+504" },
  { codigo: "MX", nombre: "México", indicativo: "+52" },
  { codigo: "NI", nombre: "Nicaragua", indicativo: "+505" },
  { codigo: "PA", nombre: "Panamá", indicativo: "+507" },
  { codigo: "PY", nombre: "Paraguay", indicativo: "+595" },
  { codigo: "PE", nombre: "Perú", indicativo: "+51" },
  { codigo: "DO", nombre: "República Dominicana", indicativo: "+1" },
  { codigo: "UY", nombre: "Uruguay", indicativo: "+598" },
  { codigo: "VE", nombre: "Venezuela", indicativo: "+58" },
];

export const PAIS_POR_DEFECTO = PAISES[0]!;

export function buscarPaisPorCodigo(codigo: string): Pais {
  return PAISES.find((pais) => pais.codigo === codigo) ?? PAIS_POR_DEFECTO;
}

/**
 * Emoji de bandera a partir del `pais` guardado en `perfiles`
 * (texto libre igual al `nombre` de un `Pais` de esta lista, ver
 * actualizarPerfil). Se compone de los dos "Regional Indicator Symbols"
 * del código ISO — no es una imagen ni depende de una librería, así que
 * cualquier país fuera de esta lista corta también renderizaría bien si
 * algún día se agrega. Devuelve null si no hay país guardado.
 */
export function banderaDePais(nombre: string | null): string | null {
  const pais = PAISES.find((pais) => pais.nombre === nombre);
  if (!pais) return null;
  return [...pais.codigo]
    .map((letra) => String.fromCodePoint(127397 + letra.charCodeAt(0)))
    .join("");
}

/**
 * Separa un celular guardado como "+57 300 123 4567" en indicativo + resto,
 * para precargar el formulario. Si no matchea ningún indicativo conocido
 * (dato viejo sin indicativo, por ejemplo) devuelve el país por defecto y
 * el celular completo como número local.
 */
export function partirCelular(celular: string | null): { pais: Pais; numero: string } {
  const valor = (celular ?? "").trim();
  if (!valor) return { pais: PAIS_POR_DEFECTO, numero: "" };

  // Indicativos más largos primero (+591 antes que +59...) para no cortar
  // uno corto que es prefijo de otro.
  const porLargoDeIndicativo = [...PAISES].sort((a, b) => b.indicativo.length - a.indicativo.length);
  for (const pais of porLargoDeIndicativo) {
    if (valor.startsWith(pais.indicativo)) {
      return { pais, numero: valor.slice(pais.indicativo.length).trim() };
    }
  }

  return { pais: PAIS_POR_DEFECTO, numero: valor };
}
