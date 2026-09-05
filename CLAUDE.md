# Espacio Arte — contexto para Claude Code

Landing del programa de exposiciones de la Plaza de Toros Real de San Carlos
(Colonia del Sacramento, Uruguay). Sin build, sin npm: HTML + CSS + JS a mano,
con GSAP, Lenis y Three.js por CDN.

La dueña del proyecto es Laura Brum. No programa. Explicá los cambios en
lenguaje llano y no metas toolchains salvo que los pida. El sitio tiene que
seguir abriéndose con un solo comando.

## Levantar el proyecto

```bash
python3 serve.py     # http://localhost:8082
```

`serve.py` implementa HTTP Range. No uses `python3 -m http.server`.

## La idea

El isotipo de Espacio Arte ya es un dibujo isométrico de tres paneles de
exposición con rueditas. La página lo usa como objeto 3D real: en la portada
los paneles se arman (primero el alambre, después la superficie) y al bajar se
enderezan hasta formar un pasillo de sala. De ahí sale todo lo demás.

La página no es un catálogo de muestras: es el lugar. Las muestras entran y
salen como entran y salen en la realidad.

## Regla de color

**La página es cal, tinta y línea. Todo el color lo aportan las obras.**
No agregues un color de acento de marca: los estados (hover, foco) se resuelven
con peso de línea y con `--tinta`. Si en algún momento aparece un azul o un rojo
de marca, se rompe el concepto.

**El fondo es cal, no noche.** La sala de la plaza está encalada y la página es
esa sala: fondo `#F4F2ED`, tinta `#101216`. Es lo contrario de la primera
versión y fue decisión de Mathias; el motivo es que remite al lugar real.

Los tokens son semánticos y ninguna regla sabe en qué bloque está:

| token | qué es |
|---|---|
| `--fondo` | el piso del bloque |
| `--realce` | una superficie levantada sobre el fondo |
| `--tinta` | el texto |
| `--humo` | el texto secundario |
| `--linea` / `--linea-fuerte` | los filetes |
| `--velo` | tres números RGB, para armar degradados sobre foto |

**`.invertido` da vuelta un bloque** redefiniendo esos mismos tokens. Lo llevan
el umbral, la cinta, el archivo de muestras, el pie y el visor: mayormente
blanco, con tramos en negro. El negro no es decorativo — separa el **archivo**
(oscuro, un depósito) del **recorrido** (blanco, la sala montada).

Cuidado al refactorizar el bloque de tokens: si un reemplazo global termina
escribiendo `--linea:var(--linea)`, la variable se auto-referencia, queda
inválida y **todos los filetes de los bloques oscuros desaparecen sin un solo
error en consola**. Ya pasó una vez.

La barra es fija y cruza tramos claros y oscuros: se da vuelta sola
(`.barra.en-oscuro`) midiendo qué bloque le toca el borde de abajo, y pinta su
propio fondo casi opaco para que el logo nunca quede partido en un borde.

## Arquitectura del movimiento

Un solo motor de scroll suave: **Lenis**. Nunca agregues un segundo (ni
ScrollSmoother ni Locomotive): se pelean y las escenas quedan desfasadas.

- `js/main.js` — motor de scroll, revelados, contadores y las escenas.
- `js/redondel.js` — la escena 3D de la portada.
- `js/ruedo.js` — la marca de la Plaza en volumen, al costado del texto.
- `js/recorrido.js` — la sala caminada.

Son **tres contextos WebGL**. Los tres se apagan con IntersectionObserver, así
que en la práctica corre uno solo por vez, pero si agregás un cuarto convendría
compartir un renderer.

Escenas y su tipo de scroll:

| # | Sección | Scroll | Cómo se pinea |
|---|---------|--------|---------------|
| 00 | `.umbral` | entrada, 1,85 s | overlay fijo |
| 01 | `.portada` | scrub 3D en dos tramos + polvo | `position: sticky` en CSS |
| 02 | `.lugar` | palabra por palabra + la marca girando | — |
| 03 | `.manifiesto` | palabra por palabra, scrubbeado | — |
| — | `.cinta` | corre sola | — |
| 03b | `.archivo` | diez paneles de alambre que se dibujan | — |
| 04 | `.muestras` | índice de fichas, una encendida por vez | — |
| 05 | `.recorrido` | scroll = caminar la sala en 3D | `position: sticky` en CSS |

**No queda ningún `pin` de GSAP en la página.** La portada y el recorrido se
sostienen con `position: sticky` del CSS. Si alguna vez agregás un pin de
ScrollTrigger, acordate de que corre todo lo que viene después: los triggers
creados antes quedan medidos sobre una página sin el pin y disparan miles de
píxeles más arriba. Eso ya pasó con el riel viejo.
| 06 | `.visitar` | normal, sin efectos | — |

El tramo 06 sin animación es deliberado: es el contraste que hace que el resto
se note.

### Lo que hace cada pieza nueva

- **Las capas (`.hoja`).** Los bloques grandes —muestras, recorrido, visitar,
  pie— montan 34 px sobre el anterior, con la esquina de arriba redondeada, un
  filete y una sombra corta hacia arriba. Se leen como hojas apoyadas una sobre
  otra. Es **solo apariencia**: no cambia el flujo ni el orden del documento, y
  se saca quitando la clase. Donde mejor se ve es en los cambios de claro a
  oscuro; entre dos bloques del mismo tono lo único que marca el borde es el
  filete.
- **La portada tiene dos tramos.** De 0 a 0,42 el logo se abre y se endereza;
  de 0,42 a 1 la cámara **entra y lo atraviesa**, con los paneles abriéndose
  para dejarla pasar. Por eso `.portada` mide 285vh y no 205vh. El segundo
  tramo no es relleno: es información espacial nueva, y rima con la sección 05,
  donde el scroll también te camina por adentro. Al entrar la cámara **deja de
  mirar al origen y mira hacia adelante**; si siguiera apuntando al centro, al
  pasarlo la escena se daría vuelta de golpe. Si bajás la altura de la sección,
  el segundo tramo pasa demasiado rápido y parece un salto.
- **El umbral.** Cuenta de 1910 (se inauguró la plaza) a 2021 (reabrió) y
  después se abren dos hojas. Se saltea si entrás con ancla o con la página ya
  scrolleada. Tiene dos redes: una animación CSS que lo saca a los 3,4 s si el
  JS nunca corre, y un `setTimeout` de 2,6 s si el JS corre pero se traba
  (pasa, por ejemplo, si la pestaña carga en segundo plano: sin `rAF` la
  timeline de GSAP no avanza).
- **El polvo.** Motas alrededor del volumen 3D, en `redondel.js`. Se emiten
  **por distancia recorrida** del puntero, no por tiempo: por tiempo, un
  barrido rápido deja huecos y una mano quieta amontona puntos. Pila fija de
  480 recicladas en anillo, la edad se calcula en el vertex shader. Hay además
  una emisión ambiente lenta para que el polvo exista sin puntero (dedo,
  teclado o quieto). En celular no se crea: sería `rAF` continuo por batería.
- **La luz de sala.** Un `radial-gradient` en `#luz` que sigue al puntero.
  Solo con `(hover:hover) and (pointer:fine)`.
- **El encendido palabra por palabra** (`encender()` en `main.js`) es el mismo
  mecanismo en `.manifiesto` y en las declaraciones de `.lugar`: cada palabra se
  envuelve en un `.pl` que arranca en opacidad baja y sube con el scroll. Se
  envuelve **recorriendo nodos de texto**, no con `innerHTML`, para no romper
  las cursivas ni los enlaces que haya adentro.
- **El foco del índice.** Una ficha encendida por vez, las demás en 0,42; una
  vez leída queda en 0,62 (`.visto`), así se distingue lo que ya pasaste de lo
  que falta. Se resuelve con una clase por fila y no leyendo posiciones en cada
  cuadro: son diez filas quietas y no vale gastar el bucle en eso.
- **La regla del rótulo.** Cada sección abre con un filete que se dibuja de
  izquierda a derecha (`[data-regla]`, `scaleX` de 0 a 1). Reemplaza al
  `border-top` que separaba las secciones: es la misma línea, pero llega
  dibujándose.
- **El índice de escena** en la barra usa cola, no candado: si pasás varias
  secciones de un saque tiene que terminar en la última. El mismo helper
  (`hacerVolteador`) mueve el cartel del recorrido, y ahí la cola importa más:
  el scrub puede pasar seis obras en un segundo.

### Las fotos se ven de una sola forma: caminando

**Decisión de Mathias, y es estructural.** Antes las muestras se presentaban dos
veces: un riel horizontal de paneles con foto, y después el recorrido 3D. Eran
dos lenguajes para lo mismo. El riel se eliminó: **las fotos de las exposiciones
se ven únicamente adentro del pasillo.** Si en algún momento aparece la
tentación de poner una galería, una grilla o un carrusel de obras en otra
sección, no: rompe la idea.

Lo que quedó en `.muestras` es el **índice del archivo** — diez fichas de texto,
sin una sola imagen, con fecha, artista y descripción cuando la hay. Las que
tienen registro llevan un punto lleno y la marca «En la sala»; las que no,
«Solo ficha» con el punto vacío. Del índice se cae directo al pasillo.

Antes del índice está el bloque que **dibuja diez paneles vacíos** —que es lo
que son las muestras antes de montarse— con sus rueditas, igual que el isotipo.
Los contornos usan `pathLength="1"` en el SVG, así el trazo mide 1 sea cual sea
el tamaño en pantalla y `strokeDashoffset` va de 1 a 0 con el scroll.

### El lugar: una columna de relato y una marca plantada

`.lugar` es una grilla de dos columnas de punta a punta:

- **Izquierda** (`.lugar-cuerpo`): todo el relato, apilado — rótulo, titular,
  la primera declaración, la foto de la sala y el remate.
- **Derecha**: **la marca de la Plaza, plantada y girando**.
- Debajo, las cifras a todo el ancho.

Antes eran dos bandas apiladas y la marca vivía en la de arriba, lo que la
hacía scrollear y desaparecer a mitad de sección. La foto y el remate estaban
lado a lado; ahora van uno debajo del otro dentro de la columna izquierda,
porque la derecha es toda de la marca. Si alguna vez se vuelve a la
composición de dos bandas, la marca vuelve a moverse: son la misma decisión.

La única foto de la sección es esa, y es del salón de exposiciones real. La
sección **no vuelve a llevar la foto del predio que tenía antes**: el bloque de
arriba es texto puro a propósito.

La foto **se abre en el visor**, la misma ventana que usan las obras del
pasillo: todas las fotos del sitio se agrandan igual. Por eso `abrirVisor`
quedó como variable del módulo y no atada al callback del 3D, y `armarVisor()`
corre siempre, haya o no WebGL. El disparador es un `<button>` de verdad, no un
div con `onclick`: se abre con Enter y un lector de pantalla dice qué hace.
Adentro del marco la foto se corre unos milímetros con el puntero — ese
desfasaje entre la imagen y su ventana es de dónde sale la sensación de capas.

### La marca de la Plaza en volumen (`js/ruedo.js`)

El isotipo de la Plaza de Toros es la planta del edificio: seis arcos
concéntricos —cortados abajo— y ocho tendidos macizos en el sector superior
derecho.

**Los números salen de medir el archivo, no de mirarlo.** El original está en
`assets/logo-plaza-toros.webp`. Se decodificó el PNG a mano (sin PIL, con
`zlib`) y se recorrió en coordenadas polares: un barrido radial da los radios y
el espesor de los anillos, y un barrido angular a cada radio da los tramos
exactos, con sus cortes. Todo eso está volcado tal cual en `CUNAS` y `ANILLOS`,
arriba del módulo: para retocar la marca se tocan esos números y nada más.

Vale la pena decir cómo era la primera versión, estimada a ojo, porque el
error es instructivo: ponía **12 cuñas donde hay 8**, con un span de 120° en
vez de 114,3°, los anillos un 25 % más finos, y los cortes repartidos parejos
cuando en realidad cada anillo lleva un arco largo de 120° arriba y dos
guiones sueltos abajo, en posiciones distintas en cada uno. Se veía "parecido"
y estaba mal en todo. **Si hay que replicar una marca, medila.**

Dos detalles del volumen que no son del logo sino de la lectura en 3D:

- **Las cuñas van apenas más gruesas que los anillos** (0,09 contra 0,05).
  La primera versión las hacía subir en escalera —"son las gradas"— y de
  frente rompía la marca. Después las dejó parejas pero muy gruesas, y el
  canto agarraba tanta luz que el abanico salía **gris**, justo al revés que
  en el logo, donde es lo más negro.
- **El especular va flojo y concentrado.** Es lo que deja viajar el reflejo
  sin que las caras grandes se laven.

- Los arcos son anillos extruidos finos; los tendidos son cuñas que **suben de a
  poco**, que es la lectura en 3D de la marca: son las gradas.
- El material es un gris oscuro (`0x22262e`), no negro puro: con negro plano y
  luz pareja **el volumen no se ve**. Poca ambiente y una direccional fuerte es
  lo que separa la cara del canto.
- El canvas es transparente y el encuadre se calcula **por el lado más chico**:
  la marca es redonda y en una caja más alta que ancha se cortaría al costado.
- **Da la vuelta entera, unos 15 s.** El giro completo tenía dos problemas y
  los dos se resolvieron por otro lado, no evitándolo:
  · **De perfil desaparecía.** Ahora la pieza tiene espesor de verdad (0,10
    los anillos, 0,16 las cuñas contra un radio de 1) y el eje va inclinado
    15°, así que a 90° se ve una barra escorzada con su filo iluminado, no
    una raya. De frente no cambia nada: la silueta sigue siendo la del logo.
  · **El dorso mostraba el texto espejado.** El logotipo lleva **dos pilas de
    láminas, una para cada cara**, así se lee bien desde los dos lados.
- **Todo lleva bisel** (`bevelEnabled`, 0,007). Es la diferencia entre una
  pieza cortada y una terminada: cada contorno agarra un filo de luz que
  viaja al girar. Es de lo que más se nota y cuesta unos triángulos.
- **La iluminación la da un mapa de entorno, no una luz.** `ambiente()` arma
  un "estudio" en un canvas —piso oscuro, cielo claro, dos ventanas arriba y
  tres claros sobre el horizonte— y lo pasa por `PMREMGenerator`. Los del
  horizonte son los que importan: las caras grandes miran de costado y si ahí
  solo hay gris parejo, la pieza queda negra y plana pase lo que pase. El
  material es `MeshStandard` metálico (0,52) y liso (roughness 0,21); subiendo
  la roughness vuelve a ser una silueta mate.
- **La llegada.** La primera vez que entra en pantalla hace casi un cuarto de
  vuelta de más y crece un 12 %, en poco más de un segundo, una sola vez. El
  fundido del canvas arranca ahí y no al cargar la página: si no, para cuando
  llegás scrolleando ya pasó.
- **El logotipo va mucho más fino que la marca** (0,045 en 20 láminas contra
  0,16). No es un descuido: la marca es geometría y aguanta el espesor que le
  pongas, pero el texto son láminas apiladas y si se separan mucho, al girar
  se ve el peine entre una y otra y las letras parecen deshilachadas. Lo paga
  de perfil, donde desaparece antes que la marca — dura una fracción de
  segundo y la marca sostiene el momento.
- **El logotipo también está medido del archivo**, con el mismo método: se
  buscaron las bandas de tinta debajo del isotipo y se sacó la caja de cada
  renglón. Está todo en `TXT`, en unidades del radio de la marca. Los tres
  errores de la primera versión, por si vuelven a tentar:
  **los renglones van alineados a la IZQUIERDA**, no centrados; el bloque
  arranca a 0,448 radios por debajo del isotipo, no pegado; y la tipografía
  es **Poppins Bold**, la del logo, no la del sitio. Se pide en el HTML con
  el parámetro `text=` de Google Fonts, así baja solo con las letras que usa.
- **El ancho de cada renglón se ajusta con interletrado, no estirando.** El
  logo lleva los renglones grandes un poco cerrados (−6 %) y los chicos un
  poco abiertos (+6 %). Se resuelve midiendo el texto con dos espaciados y
  despejando, que es lineal. Si el navegador no soporta `letterSpacing` en
  canvas, cae a un estirón horizontal.
- **Las medidas de la tipografía se miden, no se suponen.** La mayúscula de
  Poppins ocupa 0,702 del em, pero el glifo de la ® solo 0,432. Calcularla
  con el ratio de la mayúscula la dibujaba a un 60 % y salía un puntito.
- El texto está dibujado en un canvas 2D y usado como recorte (`alphaMap`,
  que lee el canal **verde**: por eso el canvas se pinta negro con letras
  blancas, y no transparente). Para darle espesor van nueve láminas separadas
  0,034: de frente se ve una, y al girar el apilado se lee macizo. Con más
  láminas o más espesor, el renglón chico se ve doble en los ángulos
  extremos. Es más barato que extruir quince glifos, y de todos modos no se
  puede: `TextGeometry` vive en `examples/`, no en el build UMD.
- **El canvas del texto se dibuja dos veces**: una al arrancar con la
  tipografía que haya, y otra cuando Poppins termina de bajar. Sin la
  segunda queda para siempre el dibujo con la de reemplazo.
- Ojo con el eje al dibujar: el canvas crece hacia abajo y el mundo hacia
  arriba, así que la resta va al revés de como se lee. Con el signo cambiado
  el texto se dibuja fuera del canvas y no aparece nada.
- **El brillo se mueve**: material `MeshPhong` con especular, más una luz
  puntual que orbita más lento que el bamboleo, así el reflejo no cae siempre
  en el mismo lugar. Ojo con subirle la intensidad: pasando de ~0,6 lava las
  caras y la marca deja de leerse negra.
- Gira sola, no la mueve el scroll. **El volumen solo en pantalla ≥900 px y
  sin movimiento reducido**: no vale un tercer contexto WebGL en un teléfono.
  Pero el elemento existe siempre: donde no hay volumen queda el archivo
  original plano (`assets/logo-plaza-toros.webp`), igual que el recorrido cae
  a su grilla. Lo que cambia es cómo se dibuja, no si está.
- **El tamaño es deliberado: la marca acompaña al texto, no compite.** Con la
  caja más grande el logotipo quedaba más alto que el titular y la sección
  pasaba a ser sobre la marca en vez de sobre el lugar. La columna de texto
  es más ancha (1,16fr contra 0,84fr).
- **Va en el flujo normal, y eso es una decisión, no un descuido.** El único
  movimiento que le corresponde es el giro —una *idle animation*, un loop que
  corre solo—: con el scroll no tiene ninguna relación. Ocupa su hueco en la
  columna y se queda ahí.

  **No usar `sticky` ni `fixed`.** Se probaron las dos y las dos se
  descartaron por lo mismo: despegan la marca del documento y la hacen viajar
  con la ventana, así que da la sensación de que te sigue por la página.
  `sticky` además arrastra hasta enganchar y vuelve a arrastrar al soltar.
  Lo correcto es lo aburrido: que scrollee como cualquier otro elemento.
  Verificado — su posición absoluta en el documento es la misma
  scrollees donde scrollees.

### El recorrido (`js/recorrido.js`)

La sala, caminada. No es una galería de fotos: es el montaje. Las obras cuelgan
de la estructura con un tiento, como cuelgan de verdad en la plaza, y el scroll
lleva la cámara por un **arco de radio 55**, no por una recta: adentro del
redondel no hay rectas. La niebla arranca en 6,5 y termina en 30, así que las
piezas se materializan desde el negro a medida que te acercás.

- **Las texturas se piden por cercanía** (a menos de 26 unidades) y **entran en
  fila de a dos**, siempre la más cercana primero. Esto importa: antes se
  pedían las siete que estuvieran en rango y el navegador decodificaba siete
  JPEG de 1280 px en el hilo principal — ese era el tirón que se sentía al
  caminar el pasillo. Si volvés a subir `A_LA_VEZ`, vuelve el tirón. Hasta que
  llega la foto, la obra es un rectángulo `HUECO` con su marco de línea.
- **El final se llena de luz.** En el último 10 % del recorrido la niebla se
  cierra encima tuyo (`far` de 32 a 4,5) y el pasillo se disuelve en el mismo
  blanco que tiene la página, así la salida hacia *Visitar* no es un corte.
- **El suavizado de la cámara es por tiempo, no por cuadro.** Un `0.055` por
  cuadro hace que en una pantalla de 120 Hz la cámara gire al doble de
  velocidad. Va con `1 - Math.pow(0.033, dt)`.
- **El raycast del puntero solo corre si algo cambió** (el puntero se movió o
  avanzaste): 29 planos por cuadro con el mouse quieto no hacen falta.
- **`alCambiar` resetea `estado.actual` a -1.** `init()` ya pintó un cuadro
  antes de que existiera el cartel y dejó anotada la obra 0 como «la actual»;
  sin ese reset el cartel arranca **vacío** y no dice nada hasta la obra 2.
- **La última obra cuelga cruzada en el eje del pasillo y te mira de frente.**
  El camino termina a 3 unidades de ella (`FRENTE`). Si la cámara la pasa, el
  final del recorrido queda en negro: ese fue el primer bug.
- **La niebla es del color del fondo**, así que las obras se materializan desde
  la cal: un cubo blanco sin paredes, que es lo que es una sala de exposición.
- **El cartel nombra la obra a la que te acercás** (`d > -0.5`), no la que
  dejaste atrás. Así se lee la ficha mientras caminás hacia la pieza.
- **Hover**: la obra sale a recibirte 0,34 unidades y se le enciende el marco.
  **Clic**: se abre el visor (`#visor`), que es DOM común — cierra con Esc, con
  el botón o con clic afuera, devuelve el foco y frena Lenis mientras está
  abierto.
- **La linterna (`.luz`) se apaga adentro del recorrido**: estás dentro de la
  escena, no mirándola de afuera. Sobre cal ya no es una luz sino una sombra
  suave (`mix-blend-mode: multiply`): una linterna sobre blanco no se ve.

El scrub va contra un objeto intermedio (`paso`), no contra un ScrollTrigger
pelado: un trigger sin animación **no interpola su propio `progress`**, así que
la cámara saltaría.

### El respaldo del recorrido no es opcional

En el HTML, abajo del canvas, están las **29 obras en grilla** (`.sala-lista`)
con su pie. Eso es lo que se ve sin WebGL, con movimiento reducido y en celular,
y es lo que lee un lector de pantalla siempre. El JS agrega `.hay3d` a la
sección y recién ahí aparece la sala caminable y se esconde la grilla. Si
agregás obras, agregalas **en los dos lados**: el array `OBRAS` de
`recorrido.js` y la grilla del HTML.

### Tokens de movimiento

En CSS hay tres, y hay que usarlos en vez de escribir la curva a mano:

| token | valor | para qué |
|---|---|---|
| `--ease-salida` | `cubic-bezier(.16,1,.3,1)` | la única curva de salida del sitio |
| `--t-toque` | `.16s` | hover y press — arriba de 200 ms se siente lento |
| `--t-suave` | `.55s` | cambios de estado que no responden al dedo |

Había cuatro duraciones distintas para el mismo tipo de gesto (190/200/300/350
ms) y la curva repetida en seis lugares.

En GSAP: `lerp 0.085`, `scrub 0.8–1.4`, eases `power3.out` / `power4.out` /
`expo.out`, revelados de 0,9 a 1,05 s, stagger de líneas 0,11 s, disparo en
`top 84%`.

**La barra no transiciona el color al invertirse, y es a propósito.** El fondo
sale de `--velo`, que es una custom property y no interpola: salta en un cuadro.
Igual el `filter` del logo y el `conic-gradient` del anillo. Si el color tardara
350 ms, el texto quedaría ese rato a mitad de camino sobre un piso ya invertido.
El vuelco es un borde duro: tiene que verse como un corte.

**Trampa de orden con `prefers-reduced-motion`.** Si escondés algo por defecto
(`opacity:0`) y el override de movimiento reducido vive suelto en otra parte del
archivo, gana el que esté más abajo — y con mala suerte el contenido queda
invisible sin un solo error. Pasó con las 29 fotos de `.sala-grilla`. La forma
segura es envolver la regla base en `@media (prefers-reduced-motion:
no-preference)`, que no depende del orden.

## Verificar cambios

**Lenis maneja el scroll.** `window.scrollTo()` mueve el DOM pero no le avisa a
Lenis, así que ScrollTrigger queda desincronizado y las mediciones dan mal. Para
saltar a un punto usá `window.lenis.scrollTo(y, { immediate: true })`.

Para medir una escena, sacá las posiciones del propio ScrollTrigger en vez de
estimarlas:

```js
const t = ScrollTrigger.getAll().find(x => x.pin);
window.lenis.scrollTo(t.start + (t.end - t.start) * 0.6, { immediate: true });
```

### Ver una animación sin poder mirarla

Este es el problema práctico más grande del proyecto: casi todo lo que importa
es movimiento, y un agente que trabaja sin ventana visible no ve ninguno. La
solución que quedó montada:

1. `serve.py` acepta `POST /_captura` con `{nombre, png}` y guarda el PNG en
   `_capturas/` (ignorado por git). Es solo para desarrollo.
2. `Redondel.paso(armar)` y `Ruedo.paso(dt)` fuerzan **un cuadro a mano**. Sin
   esto no alcanza: con la pestaña oculta no hay `requestAnimationFrame`, así
   que ni el bucle 3D ni el reloj de GSAP avanzan, `progreso()` no repinta y se
   lee siempre el mismo buffer.
3. Desde la consola se recorre la animación, se lee el canvas con `toDataURL()`
   **en el mismo tick que el render** (si no, el buffer ya se limpió), se arman
   los cuadros en una grilla con un canvas 2D y se manda esa hoja de contactos
   al servidor. Después se mira el PNG.

Dos trampas que cuestan una hora si no se saben:

- `canvas.toBlob()` **no sirve**: es asíncrono y para cuando llama el callback
  el buffer de WebGL ya no está. `toDataURL()` sincrónico, sí.
- `estado.armado` de `redondel.js` lo levanta un tween de GSAP, que necesita
  `rAF`. Por eso `paso(true)` lo fuerza: si no, se capturan seis cuadros
  idénticos y todos vacíos.

Así se encontraron dos bugs reales que ninguna medición del DOM mostraba: la
cámara de la portada atravesaba el panel del medio, y todo el vuelo terminaba
sobre p≈0,78 dejando un quinto del scroll mirando una pantalla vacía.

**El bucle 3D no corre con la pestaña oculta** (`document.hidden`), que es lo
correcto para la batería pero hace que el pasillo no se pueda verificar desde un
panel de browser cerrado: `requestAnimationFrame` devuelve cero cuadros y el
cartel del recorrido queda como estaba. Para probar el pasillo hace falta la
ventana visible.

Chequeos que ya pasaron y conviene no romper: sin overflow horizontal, la
portada legible con el alambre detrás del título, los tres contextos 3D
descartándose en `pagehide`, cada `[data-escena]` empezando donde empieza su
sección, y **en el arranque solo dos pedidos a `assets/img/sala/`** — si ves
siete, la cola de texturas se rompió.

**Ojo con la caché al verificar.** `serve.py` no manda cabeceras anti-caché, así
que después de editar un `.js` el navegador puede seguir sirviendo el viejo y
parece que el cambio no hizo nada. Recargá con `?v=N` o con `fetch(url,
{cache:'reload'})`. Ya pasó: el módulo del ruedo parecía no arrancar y lo que
corría era un `main.js` de tres ediciones antes.

## Celular

Es la versión simple, a propósito:
- sin pin y sin scrub;
- el índice de muestras se apila solo: no necesita versión aparte;
- el recorrido 3D pasa a la grilla de 29 obras (`.sala-lista`);
- el volumen 3D queda en una pose armada y quieto (`progreso(0.3)`), sin polvo
  y sin bucle continuo;
- sin luz de sala y con todas las fichas encendidas;
- sin la marca de la Plaza (`.lugar-marca` queda en `display:none`).

Quedan el umbral y la cinta: son transformaciones sueltas y no cuestan nada.

El tráfico va a venir del Instagram de la Plaza, o sea celulares. Probá siempre
en un teléfono real, no solo achicando la ventana.

## Movimiento reducido

Con `prefers-reduced-motion: reduce` no se inicia Lenis, no se carga el 3D y
todas las escenas pinneadas pasan a estáticas. La información completa tiene que
poder leerse sin una sola animación.

## Contenido: lo que falta

- **Texto institucional.** El de `.manifiesto` lo redacté a partir de datos
  verificados del predio. Falta el de Laura para reemplazarlo.
- **Foto del salón.** `.lugar-bajo` usa `bianki-sala.jpg`, que es la sala real
  de la Plaza. Si Laura o Mathias mandan una mejor, se cambia el `src` y el
  `srcset` y listo.
- **Fotos.** Hay registro de *Espacio Bianki*, *Sinergia*, *Relatos Dibujados*,
  *El Secreto de Magín*, *Sinfonía de Colores*, *Gente en Obra*, *Interfaz* y
  del *lanzamiento interactivo*: 29 obras en el recorrido. Siguen sin foto
  *Gol en 3 colores* y *The garden of the early delights*, y quedan marcadas
  como «Solo ficha» en el índice. No hay que ilustrar una muestra con fotos de
  otra.
- **«Habitar» es el subtítulo real de *Gente en Obra***: sale del cartel de sala
  fotografiado, no de un invento.
- **El nombre del "lanzamiento interactivo"** es el de la carpeta que pasó
  Mathias, no un título confirmado. Hay que preguntarle a Laura cómo se llamó
  esa noche.
- **Cuánto viaja la cámara de la portada hay que medirlo, no calcularlo.** Los
  paneles se van de cuadro **por los costados** bastante antes de que la
  cámara llegue a su profundidad, porque de cerca el encuadre se angosta. Dos
  veces quedó el vuelo terminando sobre p≈0,85 y el resto de la sección en
  blanco. La constante es el `entra * 7.7` de `pintar()`; para cambiarla, se
  saca una hoja de contactos y se mira dónde queda el último panel.
- **Los pies de las obras del recorrido describen lo que se ve en la foto.** No
  son fichas: no hay autor ni fecha para ninguna de esas piezas todavía.
- **Fechas y fichas de artista** de las cinco muestras del archivo.
- **Horarios** y si Espacio Arte tiene mail y teléfono propios.
- **Licencia web de la tipografía Noah** (Fontfabric). La que hay es de
  escritorio. Antes de publicar hay que comprarla o sustituirla.

Nada de inventar fechas, autores ni textos de muestra para rellenar.
