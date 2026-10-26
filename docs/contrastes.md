# Tabla de contrastes

Contraste WCAG 2.2 de los tokens de color de `src/app/globals.css`. Este archivo lo escribe `npm run audit:contraste`: no se edita a mano.

Mínimos: **4,5:1** para texto normal y **3:1** para bordes de controles, foco e indicadores. Los colores con transparencia se miden ya mezclados con el fondo de abajo. Si un par obligatorio baja de su mínimo, falla `src/lib/diseno/contraste.test.ts`.

Estado: todos los pares obligatorios pasan AA en los dos temas.

## Texto sobre fondos, tema claro

| Token | Valor | Fondo | Tarjeta | Superficie 2 | Hover |
| --- | --- | ---: | ---: | ---: | ---: |
| `--uva-text` | `#18181b` | 16,12 | 17,72 | 14,62 | 16,12 |
| `--uva-text-muted` | `rgba(24, 24, 27, 0.7)` | 6,26 | 6,54 | 5,97 | 6,26 |
| `--uva-text-faint` | `rgba(24, 24, 27, 0.65)` | 5,29 | 5,49 | 5,08 | 5,29 |
| `--uva-muted` | `#52525b` | 7,03 | 7,73 | 6,38 | 7,03 |
| `--uva-muted-2` | `#66666e` | 5,18 | 5,69 | 4,70 | 5,18 |
| `--uva-accent-ink` | `#c2005b` | 5,55 | 6,10 | 5,03 | 5,55 |
| `--uva-accent-text` | `#b30054` | 6,27 | 6,90 | 5,69 | 6,27 |
| `--uva-link-hover` | `#9e004a` | 7,48 | 8,23 | 6,79 | 7,48 |
| `--uva-accent-2-text` | `#8a5b00` | 5,34 | 5,87 | 4,85 | 5,34 |
| `--uva-danger-text` | `#c2005b` | 5,55 | 6,10 | 5,03 | 5,55 |
| `--uva-error-text` | `#b91c1c` | 5,89 | 6,47 | 5,34 | 5,89 |
| `--uva-warning-text` | `#a14a07` | 5,46 | 6,00 | 4,95 | 5,46 |
| `--uva-valid` | `#137536` | 5,27 | 5,79 | 4,78 | 5,27 |
| `--uva-success-text` | `#8a5b00` | 5,34 | 5,87 | 4,85 | 5,34 |

## Texto sobre fondos, tema oscuro

| Token | Valor | Fondo | Tarjeta | Superficie 2 | Hover |
| --- | --- | ---: | ---: | ---: | ---: |
| `--uva-text` | `#fafafa` | 19,06 | 16,97 | 18,59 | 16,27 |
| `--uva-text-muted` | `rgba(250, 250, 250, 0.6)` | 7,04 | 6,75 | 7,01 | 6,60 |
| `--uva-text-faint` | `rgba(250, 250, 250, 0.55)` | 6,04 | 5,87 | 6,04 | 5,76 |
| `--uva-muted` | `#b4b4bb` | 9,65 | 8,59 | 9,41 | 8,24 |
| `--uva-muted-2` | `#b4b4bb` | 9,65 | 8,59 | 9,41 | 8,24 |
| `--uva-accent-ink` | `#ff1a87` | 5,45 | 4,85 | 5,31 | 4,65 |
| `--uva-accent-text` | `#ff7ab8` | 8,27 | 7,36 | 8,07 | 7,06 |
| `--uva-link-hover` | `#ff4d9e` | 6,45 | 5,74 | 6,29 | 5,51 |
| `--uva-accent-2-text` | `#ffc400` | 12,46 | 11,09 | 12,15 | 10,63 |
| `--uva-danger-text` | `#ff7ab8` | 8,27 | 7,36 | 8,07 | 7,06 |
| `--uva-error-text` | `#f87171` | 7,19 | 6,40 | 7,02 | 6,14 |
| `--uva-warning-text` | `#fbbf24` | 11,92 | 10,61 | 11,62 | 10,17 |
| `--uva-valid` | `#22c55e` | 8,73 | 7,78 | 8,52 | 7,45 |
| `--uva-success-text` | `#ffc400` | 12,46 | 11,09 | 12,15 | 10,63 |

## Texto sobre rellenos de color e insignias

| Par | Mínimo | Claro | Oscuro |
| --- | ---: | ---: | ---: |
| `--uva-on-accent` sobre `--uva-btn` | 4,50 | 5,54 | 5,54 |
| `--uva-on-accent` sobre `--uva-btn-hover` | 4,50 | 6,56 | 6,56 |
| `--uva-on-accent` sobre `--uva-btn-active` | 4,50 | 7,82 | 7,82 |
| `--uva-on-bright` sobre `--uva-accent` | 4,50 | 5,24 | 5,24 |
| `--uva-on-bright` sobre `--uva-accent-2` | 4,50 | 12,46 | 12,46 |
| `--uva-on-bright` sobre `--uva-whatsapp` | 4,50 | 10,03 | 10,03 |
| `--uva-bg` sobre `--uva-valid` | 4,50 | 5,27 | 8,73 |
| `--uva-badge-success-fg` sobre `--uva-badge-success-bg` | 4,50 | 6,73 | 9,04 |
| `--uva-badge-warn-fg` sobre `--uva-badge-warn-bg` | 4,50 | 5,31 | 9,20 |
| `--uva-badge-danger-fg` sobre `--uva-badge-danger-bg` | 4,50 | 5,53 | 7,90 |
| `--uva-badge-neutral-fg` sobre `--uva-badge-neutral-bg` | 4,50 | 7,03 | 7,23 |

## Bordes de controles y acento

Los campos de texto, selects, áreas de texto y casillas usan `--uva-line-strong` de borde. El magenta marca el foco y el progreso.

| Par | Mínimo | Claro | Oscuro |
| --- | ---: | ---: | ---: |
| `--uva-line-strong` sobre `--uva-surface` | 3,00 | 3,42 | 3,67 |
| `--uva-line-strong` sobre `--uva-bg` | 3,00 | 3,11 | 4,12 |
| `--uva-accent` sobre `--uva-surface` | 3,00 | 3,80 | 4,67 |
| `--uva-accent` sobre `--uva-bg` | 3,00 | 3,45 | 5,24 |

## Exentos

Deshabilitados y separadores decorativos: WCAG no les pide contraste. Medidos sobre la tarjeta, solo como referencia. No se usan para texto que haya que leer ni para el borde de un control.

| Token | Claro | Oscuro |
| --- | ---: | ---: |
| `--uva-dim` | 2,56 | 2,29 |
| `--uva-text-disabled` | 2,40 | 2,84 |
| `--uva-divider` | 1,27 | 1,19 |
