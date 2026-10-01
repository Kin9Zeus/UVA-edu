---
name: uva-cerebro
description: Protocolo de memoria persistente del proyecto U.V.A usando Obsidian (MCP server "obsidian", herramientas mcp__obsidian__*) como segundo cerebro. Úsalo al empezar cualquier sesión de trabajo en este repo (para recuperar contexto) y al terminar cambios significativos — decisiones de arquitectura/producto, bugs relevantes resueltos, features entregadas, conceptos nuevos del dominio — para dejarlos registrados y enlazados. Dispara con "recuerdas...", "qué decidimos sobre...", "registra esto", "no se te olvide", o al detectar que se está por repetir una discusión ya resuelta antes.
metadata:
  type: proyecto
---

# Cerebro U.V.A (Obsidian)

El vault de Obsidian **es la raíz de este repo** (`C:\Proyecto_U.V.A\UVA-edu`). Toda la memoria persistente vive en la carpeta `Cerebro/`, gestionada vía el servidor MCP `obsidian` (herramientas `mcp__obsidian__*`: `search_notes`, `read_note`, `create_note`, `append_to_note`, `patch_note`, `list_notes`).

`Cerebro/` está en `.gitignore` — es memoria local de este entorno, no código fuente. No se comparte por git ni se despliega.

Punto de entrada: [[Cerebro/00-Indice]].

## Al empezar una sesión

1. Lee `Cerebro/00-Indice.md`.
2. Lee la nota más reciente en `Cerebro/01-Sesiones/` (la última listada en `00-Sesiones.md`) para saber en qué se quedó el trabajo.
3. Si la tarea toca un área con concepto propio (pagos, Mux, RLS, entornos, infraestructura...), busca con `search_notes` en `Cerebro/04-Conceptos/` antes de asumir que no hay contexto previo.
4. No repitas como hallazgo nuevo algo que ya está registrado como decisión de alcance o limitación conocida — cítalo y enlázalo en vez de re-descubrirlo.

## Al terminar trabajo significativo

No todo merece una nota — usa criterio. Sí registrar:

- **Decisiones de arquitectura o producto** no triviales (por qué se eligió A sobre B).
- **Bugs o incidentes** con causa raíz no obvia (no un typo).
- **Conceptos nuevos** del dominio o del stack que probablemente se vuelvan a necesitar.
- **Resumen de la sesión** si hubo trabajo sustancial (varias horas o varios archivos).

No registrar: cambios triviales, exploración que no llegó a nada, nada que ya esté perfectamente claro leyendo el código o `git log`.

### Cómo escribir cada tipo de nota

Todas usan `create_note` (falla si ya existe — para actualizar una existente usa `append_to_note` o `patch_note`, nunca la reescribas sin leerla primero).

**Sesión** — `Cerebro/01-Sesiones/YYYY-MM-DD - Título breve.md`
```yaml
---
title: Título breve
date: YYYY-MM-DD
tags: [sesion]
type: sesion
---
```
Secciones: `## Contexto`, `## Qué se hizo`, `## Decisiones tomadas` (enlaza a las notas de decisión), `## Siguiente paso`. Añade la entrada nueva a `Cerebro/01-Sesiones/00-Sesiones.md` y a "Última actividad" en `Cerebro/00-Indice.md` (con `append_to_note` o `patch_note`, no reescribas todo el archivo).

**Decisión (ADR)** — `Cerebro/02-Decisiones/YYYY-MM-DD - Título breve.md`
```yaml
---
title: Título breve
date: YYYY-MM-DD
tags: [decision]
type: decision
status: aceptada
---
```
Secciones: `## Contexto`, `## Opciones consideradas`, `## Decisión`, `## Por qué`, `## Consecuencias`. Añade la entrada a `Cerebro/02-Decisiones/00-Decisiones.md`.

**Bug/Incidente** — `Cerebro/03-Bugs-Incidentes/YYYY-MM-DD - Título breve.md`
```yaml
---
title: Título breve
date: YYYY-MM-DD
tags: [bug]
type: bug
---
```
Secciones: `## Síntoma`, `## Causa raíz`, `## Fix`, `## Cómo se verificó`, `## Cómo evitar que se repita`. Añade la entrada a `Cerebro/03-Bugs-Incidentes/00-Bugs.md`.

**Concepto** — `Cerebro/04-Conceptos/Nombre del concepto.md` (sin fecha en el nombre — es atemporal, se actualiza in place con `append_to_note`/`patch_note` cuando cambia).
```yaml
---
title: Nombre del concepto
tags: [concepto]
type: concepto
---
```
Libre, pero termina con `## Relacionado` enlazando conceptos/decisiones/bugs conexos. Añade la entrada a `Cerebro/04-Conceptos/00-Conceptos.md`.

## Reglas de enlace

- Usa wikilinks (`[[Nota]]` o `[[Nota|texto a mostrar]]`) para todo lo que esté dentro del vault, nunca rutas de archivo planas.
- Toda nota nueva enlaza hacia atrás al menos a la sesión que la originó, y toda sesión enlaza hacia adelante a las decisiones/bugs/conceptos que tocó. El objetivo es que nada quede huérfano en el grafo.
- Los archivos `AUDIT-*.md` y `docs/*.md` en la raíz del repo **no se editan** desde aquí — solo se enlazan desde `Cerebro/05-Auditorias/00-Indice-Auditorias.md` o donde corresponda.
- Antes de crear una nota de concepto, `search_notes` para comprobar que no exista ya con otro nombre (evita duplicados tipo "RLS" vs "Row Level Security").

## Relación con la memoria de `~/.claude/.../memory/`

Ese sistema (fuera del vault) guarda preferencias del usuario y feedback de colaboración — cómo trabajar con Juan Miguel. Este vault guarda el conocimiento *del proyecto* — qué se decidió y por qué, para cualquiera (incluido el propio Juan Miguel navegando el grafo) que necesite reconstruir el contexto. No dupliques contenido entre los dos; si algo es sobre cómo colaborar, va en la memoria; si es sobre el proyecto, va en `Cerebro/`.
