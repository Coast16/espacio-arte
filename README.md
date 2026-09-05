# Espacio Arte

Landing del programa de exposiciones de la **Plaza de Toros Real de San Carlos**
(Colonia del Sacramento, Uruguay).

Sitio estático: HTML, CSS y JavaScript escritos a mano. Sin build, sin npm.
GSAP, Lenis y Three.js entran por CDN.

## Levantarlo

```bash
python3 serve.py     # http://localhost:8082
```

Usá `serve.py` y no `python3 -m http.server`: implementa *range requests* y
manda cabeceras anti-caché, las dos cosas hacen falta acá.

## Qué hay adentro

| archivo | qué es |
|---|---|
| `index.html` | la página entera |
| `css/style.css` | el sistema visual: cal, tinta y línea |
| `js/main.js` | motor de scroll, revelados y escenas |
| `js/redondel.js` | la portada en 3D |
| `js/ruedo.js` | la marca de la Plaza, en volumen |
| `js/recorrido.js` | la sala, caminada |
| `CLAUDE.md` | por qué cada cosa es como es — leelo antes de tocar |

## Pendiente

Falta el texto institucional, las fechas y fichas de artista de varias muestras,
los horarios, y la **licencia web de la tipografía Noah** (la que hay es de
escritorio). Está todo detallado en `CLAUDE.md`.
