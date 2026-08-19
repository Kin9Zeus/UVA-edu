# Nota para Claude Code

Este `design-spec/` es el bundle de handoff exportado directamente desde Claude Design (claude.ai/design). Sigue las instrucciones de `README.md` (viene del propio export, no lo edites).

**Aclaración sobre `project/uploads/`:** esa subcarpeta contiene imágenes y un archivo `UVA_spec_driven.md` que el usuario subió como referencia *mientras diseñaba* en Claude Design — no son parte del mockup en sí y **no están importadas** por los `.dc.html`. No las uses como fuente visual.

## Actualización — segunda versión de este handoff (agosto 2026)

Esta carpeta reemplaza una versión anterior. Cambios relevantes respecto a la versión con la que ya se construyeron Home, Login y Registro:

1. **Nuevo archivo: `Uva - Panel Admin.dc.html`** — mockup completo del panel administrativo, antes inexistente. Es la fuente de verdad visual para el CRUD de categorías/cursos/módulos/lecciones de Fase 2.

2. **Botón principal "COMENZAR YA" / CTAs de acento cambiaron de degradado a color sólido:**
   - Antes: `background:linear-gradient(96deg,#FF007A 0%,#FF6A3D 52%,#F2C012 100%)`
   - Ahora: `background-color:#FF007A` (magenta sólido, sin degradado)
   - **Esto afecta el Home ya construido — hay que actualizarlo.**

3. **Pantalla "Recuperar contraseña" ahora está detallada en el mockup** con sus dos estados (formulario para pedir el enlace, y confirmación "Revisa tu correo"). Comparar contra la implementación ya construida.

4. **Nuevo item en el menú del usuario (avatar):** "Panel de administrador", con ícono y navegación al Panel Admin.

5. **Nuevo token de acento secundario, antes no registrado:** amarillo vial `#F2C012` (tinte claro `#FFDD55`) — se usaba únicamente en los badges de trazabilidad (`M1 · RF-M1.1`, ya excluidos por decisión del equipo), pero ahora también aparece como opción de acento configurable. Confirmar con el equipo si tiene uso real en la UI final o si sigue siendo solo interno de la herramienta de diseño.

6. **Badges de trazabilidad (`M1 · RF-M1.1`, etc.):** el flag interno `showNotes` de esta versión viene con `default:false` (antes `true`) — confirma a nivel de herramienta la decisión ya tomada de omitirlos en la UI final. Ver punto correspondiente más abajo.

7. **Nuevas carpetas `descargables/` y `export/` / `export-acceso/`:** exports HTML standalone de Home y de Acceso (login/registro) por separado del `.dc.html` principal. Son redundantes con el `.dc.html` principal — **usar `Uva - Mockups.dc.html` y `Uva - Panel Admin.dc.html` como única fuente de verdad**, no estas carpetas alternativas, para evitar inconsistencias entre versiones.

8. **Nuevos archivos `prompt-*.md`** (dashboard-exacto, dashboard-inicio-perfil, home, panel-admin): son prompts redactados para generar HTML/CSS/JS plano sin framework ("sin build ni dependencias, abribles con doble clic") — **NO pasarlos tal cual a Claude Code**, el proyecto real usa Next.js + TypeScript + Tailwind + Supabase, no HTML estático. Útiles únicamente como referencia de contenido/copys/estructura, ya adaptados en los prompts reales que sí se usan en este proyecto.

## Regla general (sigue aplicando)

El objetivo sigue siendo el mismo que dice el README original: recrear pixel-perfecto las pantallas en Next.js + TypeScript + Tailwind CSS (según `technical-spec.md` y `CLAUDE.md` en la raíz del proyecto), sin copiar la estructura interna del prototipo, y sin las anotaciones de trazabilidad (`M1 · RF-M1.1`) que son solo internas de la herramienta de diseño.
