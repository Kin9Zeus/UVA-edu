# Variantes del nombre y opciones de nombre oficial

**Fase 14. Identidad de marca**
**Fecha:** 13 de noviembre de 2026
**Estado:** diagnóstico y opciones listos. **La decisión del nombre sigue abierta** y es mía. Lo que depende de ella queda marcado `BLOQUEADO`.

## Qué encontré

En `src/` hay **231 apariciones** de la marca en cuatro formas (sin contar pruebas automáticas). La tabla completa, con archivo, línea, variante y superficie, está en [`00-variantes-nombre.csv`](00-variantes-nombre.csv). Se abre en Excel o Google Sheets.

| Forma | Apariciones |
| --- | ---: |
| `U.V.A.` | 171 |
| `UVA` | 37 |
| `U.V.A` (sin el punto final) | 19 |
| `Unidad Vectorial de Arquitectura` | 4 |

Por superficie:

| Superficie | Apariciones |
| --- | ---: |
| Páginas públicas y textos | 65 |
| Otros archivos | 51 |
| Panel del estudiante | 27 |
| Correos | 27 |
| Panel de administración | 25 |
| Certificados en PDF | 15 |
| Otras rutas (seguridad, acceso denegado, vista previa) | 13 |
| SEO, metadata y datos estructurados | 8 |

### Dónde pesa más (títulos y JSON-LD)

| Archivo | Línea | Qué es |
| --- | ---: | --- |
| `src/app/layout.tsx` | 38 | Título por defecto: «U.V.A. — Unidad Vectorial de Arquitectura» |
| `src/app/layout.tsx` | 39 | Descripción por defecto: «Plataforma de cursos de U.V.A.» |
| `src/lib/seo/metadata.ts` | 43 | Prefijo del título de cada página pública |
| `src/lib/seo/organizacion.ts` | 25 | Nombre de la organización en los datos estructurados |

### Fuera de la plataforma (consultado el 13 de noviembre de 2026)

- La web actual usa «UVA Arquitectura» en los datos estructurados (`UVAWebDL`, `src/lib/seo.ts`) y «UVA» en las tarjetas de X.
- Las redes usan el usuario `uvarq` (Instagram, YouTube, TikTok) y el dominio es `uvarq.com`.
- Un hallazgo del repositorio: `src/lib/contacto.ts` ya documenta que el dominio `uva.edu` es de la Universidad de Virginia. «UVA» solo se confunde con eso y con la fruta, y los datos estructurados deben dejar claro cuál es la entidad.

## Opciones

| Opción | Nombre completo | Nombre corto | Pros | Contras |
| --- | --- | --- | --- | --- |
| **A. Recomendación registrada en el plan** | UVA, Unidad Vectorial de Arquitectura | UVA | Corto. Sin puntos, así que desaparecen los problemas de puntuación (por ejemplo, «Te invito a U.V.A, la plataforma…»). Mantiene el nombre completo cerca. | «UVA» solo es ambiguo: la fruta, la Universidad de Virginia. Funciona si el nombre completo o la palabra «arquitectura» acompañan al corto en títulos y fichas. |
| **B. Corto con apellido** | UVA, Unidad Vectorial de Arquitectura | UVA Arquitectura | Desambigua por sí solo. Ya lo usa la web actual en los datos estructurados. | Es una forma más que mantener. |
| **C. Con puntos (lo actual)** | U.V.A. Unidad Vectorial de Arquitectura | U.V.A. | No cambia nada del código. | Es la forma que menos coincide con las redes y con cómo la gente la escribe. Genera problemas de puntuación al final de frase. 171 apariciones con puntos. |
| **D. Marca sobre el dominio** | Unidad Vectorial de Arquitectura | UVArq | Igual al dominio y a las redes. | Hoy solo existe como usuario de las redes, no como nombre. |

**Mi lectura:** la opción A es la que ya registró el plan. Para que funcione hay que cumplir una regla: **en los títulos de página, en la ficha oficial y en los datos estructurados, el corto siempre va acompañado** del nombre completo o de la palabra «arquitectura». Si prefieres no depender de esa regla, la opción B lo resuelve sola. La decisión es tuya.

## Qué queda bloqueado hasta decidir

- Ficha oficial definitiva (`01-ficha-identidad.md`).
- Cambios de nombre en perfiles (`02-checklist-perfiles.md`).
- Datos estructurados de la organización (`03-sameas.md`).
- Los 231 textos de la interfaz y los correos (lo toma el equipo con el glosario, ver `docs/textos/02-glosario.md`).

## Qué me toca a mí

Elegir A, B, C o D. Con eso se desbloquean los otros documentos.
