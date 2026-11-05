# Pruebas visuales (capturas comparadas)

`e2e/retroceso-visual.spec.ts` toma capturas de pantalla completas y las compara contra las de referencia guardadas en `e2e/retroceso-visual.spec.ts-snapshots/`. Corre en CI en cada pull request (job `e2e`) y, si alguna cambia, el PR queda en rojo.

- **Pantallas:** portada, catálogo, ficha del curso, login, panel del estudiante y una lección.
- **Variantes:** 375, 768 y 1440 px, cada una en tema claro y oscuro (36 capturas).
- **Tolerancia:** hasta 1 % de píxeles distintos (`playwright.config.ts`), para el suavizado de texto e imágenes. Un color, un tamaño o un elemento movido la supera.
- **Límite conocido:** el panel y la lección tienen su propio contenedor con scroll (`h-dvh`), así que la captura solo cubre lo visible en la primera pantalla (900 px de alto); lo de más abajo en esas dos no se compara.
- **Lo que se tapa:** lo que cambia solo con el paso del tiempo (la tarjeta «Tu acceso» con los días que quedan y la frase «hasta el …»). Si aparece otra zona así, se agrega en `variables()` dentro del spec.

## Por qué solo en Linux

Las fuentes y el suavizado de texto cambian entre Windows, Mac y Linux. Una captura generada en Windows nunca coincide con la de CI aunque la página sea idéntica. Por eso las de referencia se generan en el runner de GitHub (Linux) y en Windows o Mac la prueba se salta.

## Cuando el cambio visual es intencional

Si cambiaste a propósito cómo se ve una pantalla, el CI del PR fallará en el paso «Capturas comparadas». Para aceptar el cambio:

1. **Revisa qué cambió.** En la corrida fallida del PR, descarga el artefacto `playwright-e2e`. En `test-results/` hay, por cada captura distinta, tres imágenes: la esperada (`-expected`), la actual (`-actual`) y la diferencia en rojo (`-diff`). Confirma que la diferencia es justo la que buscabas y nada más.
2. **Regenera las capturas.** En GitHub: **Actions → CI → Run workflow**, elige la rama de tu PR (nunca `master`) y marca **actualizar_capturas**. Corre solo el job «Regenerar capturas de referencia»: tarda unos 8 a 10 minutos y sube un commit «Pruebas: capturas de referencia actualizadas» a esa rama. (Vive dentro de `ci.yml` porque GitHub solo deja lanzar a mano workflows que ya están en `master`.)
3. **Vuelve a correr el CI del PR.** El commit del paso anterior no lo dispara solo: en el PR, **Re-run all jobs**, o empuja cualquier commit.
4. **El revisor mira las capturas en el diff del PR.** GitHub muestra las imágenes nuevas lado a lado con las viejas.

Si una captura falla y **no** cambiaste nada visual a propósito, es justo el retroceso que esta prueba busca: arregla el código, no regeneres las capturas.

## Con Docker (opcional)

Para ver o regenerar las capturas en tu PC antes de subir, con el mismo Linux que CI:

```bash
docker run --rm -it -v "$PWD":/work -w /work --ipc=host mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -c "npm ci && npm run build && npx playwright test e2e/retroceso-visual.spec.ts --update-snapshots"
```

Necesita las mismas variables de entorno que `.env.local` (staging). La versión de la imagen debe coincidir con `@playwright/test` en `package.json`.
