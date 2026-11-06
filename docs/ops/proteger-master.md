# Proteger la rama `master` en GitHub

**Para:** quien administra el repositorio `Kin9Zeus/UVA-edu` en GitHub (hace falta rol **Admin**).
**Tiempo:** unos 5 minutos.

## Por qué

En cada pull request, el CI (`.github/workflows/ci.yml`) corre pruebas automáticas:

- llaves filtradas en el código;
- tipos, lint y pruebas unitarias;
- permisos de la base (RLS);
- el recorrido crítico del estudiante, la accesibilidad y la comparación de capturas.

Hoy esas pruebas **solo avisan**. Un PR con el CI en rojo se puede fusionar igual, y un `git push` directo a `master` se salta todo. Railway despliega lo que llegue a `master`.

Esta regla hace que **un PR solo se pueda fusionar con esas pruebas en verde** y que nadie empuje directo a `master`. **No exige aprobación de otra persona**: el autor fusiona su propio PR cuando el CI pasa.

## Pasos

1. Entra a <https://github.com/Kin9Zeus/UVA-edu> → **Settings** (pestaña de arriba a la derecha).
2. Menú izquierdo: **Rules → Rulesets** → **New ruleset → New branch ruleset**.
3. **Ruleset Name:** `Proteger master`.
4. **Enforcement status:** **Active**.
5. **Bypass list** → **Add bypass** → **Repository admin** → en su desplegable, **Always allow**.
   Permite a los administradores saltarse la regla en una emergencia. GitHub deja registro de cada vez que se usa.
6. **Target branches** → **Add target** → **Include default branch** (es `master`).
7. En **Rules**, marca solo estas:
   - ☑ **Restrict deletions**
   - ☑ **Block force pushes**
   - ☑ **Require a pull request before merging**
     - **Required approvals:** `0`
     - Las demás opciones de esta regla, desmarcadas.
   - ☑ **Require status checks to pass**
     - **Desmarcado:** «Require branches to be up to date before merging». Si se marca, cada vez que `master` avanza hay que volver a correr el CI completo (~18 min) en cada PR abierto.
     - **Add checks** → escribe parte del nombre y agrega estos **4**, uno por uno (fuente: **GitHub Actions**):
       - `Llaves en el código (gitleaks)`
       - `Tipos, lint y pruebas unitarias`
       - `Migraciones, RLS y autorización (base real)`
       - `Recorrido crítico, accesibilidad y capturas (Playwright, staging)`
8. Clic en **Create**, al final de la página.

**No agregar** como obligatorios `Lighthouse CI (móvil)` (solo avisa, a propósito) ni `Regenerar capturas de referencia` (solo corre cuando se lanza a mano).

Si un check no aparece al buscarlo, es que todavía no ha corrido en este repositorio. Todos ya corrieron al menos una vez el 2026-11-06, así que deberían aparecer.

## Cómo comprobar que quedó bien

- En **Settings → Rules → Rulesets** aparece `Proteger master` como **Active**.
- En cualquier PR abierto, al final, sale «Merging is blocked» mientras el CI corre o si falla, y el botón **Merge pull request** se habilita solo con los 4 checks en verde.

## Opcional: Railway

Para que Railway tampoco despliegue un commit de `master` con el CI en rojo (por ejemplo, uno que entró por el bypass): en Railway → servicio de la app → **Settings → Wait for CI** → activado.

## Cómo se trabaja desde ahora

1. Cada cambio va en su propia rama, que se sube a GitHub.
2. Se abre un PR hacia `master` y el CI corre solo (~18 min).
3. Con todo en verde, el autor fusiona.
4. Si un cambio visual es intencional y fallan las capturas, la forma de actualizarlas está en `docs/qa/pruebas-visuales.md`.
