/* ═══════════════════════════════════════════════════════════
   El ruedo — la marca de la Plaza de Toros, en volumen.

   El isotipo de la Plaza es la planta del edificio: un anillo de
   arcos concéntricos con un sector de tendidos macizos. Acá está
   reconstruido con geometría, no calcado de un archivo: los arcos
   son anillos extruidos finos y los tendidos son cuñas que suben,
   como suben las gradas. Gira sobre su propio eje.

   No lleva textura ni color: negro sobre cal, como el resto.

   Expone window.Ruedo = { init, destruir }
   ═══════════════════════════════════════════════════════════ */
window.Ruedo = (function () {
  "use strict";

  /* ── El logo, trazado del archivo original ──────────────────────────
     No está estimado a ojo: se decodificó el PNG de la marca y se midió en
     coordenadas polares, radio por radio y grado por grado. De ahí salen
     estos números, con el radio exterior normalizado a 1 y los ángulos en
     grados (0 = este, antihorario), tal cual salieron de la medición.

     La primera versión los estimaba mirando la imagen y erraba feo: ponía
     12 cuñas donde hay 8, los anillos más finos de lo que son, y los cortes
     repartidos parejos cuando en realidad cada anillo tiene un arco largo
     de 120° arriba y dos guiones sueltos abajo, distintos en cada uno.
     Si hay que retocar algo, se retoca acá y en ningún otro lado. */

  // los ocho tendidos: 10,2° de ancho, 14,75° de paso
  var CUNAS = [
    [331.3, 341.4], [346.0, 356.3], [0.8, 11.0], [15.5, 25.8],
    [30.3, 40.6], [45.1, 55.4], [60.0, 70.4], [75.0, 85.3]
  ];
  var CUNA_R0 = 0.465;             // el ruedo vacío del medio
  var CUNA_R1 = 1.0;
  var GRUESO = 0.042;              // espesor de los anillos, medido
  var TINTA = 0x0d0f13;            // casi negro; lo que se ve es el reflejo
  /* Menos láminas y menos espesor de lo que pedía el ojo: con más, el
     renglón chico ("REAL DE SAN CARLOS") se ve doble en los ángulos
     extremos, porque son doce copias de un trazo finito corridas entre sí. */
  /* Espesores. Son bastante más de lo que pide el logo plano, y es a
     propósito: girando 360° la pieza pasa dos veces de perfil, y con 0,05 de
     canto contra 2 de diámetro ahí no queda nada que ver. Con 0,16 el perfil
     es una barra con su filo iluminado, que además es el mejor momento del
     giro. De frente no cambia nada: la silueta sigue siendo la del logo. */
  /* El logotipo va MUCHO más fino que la marca, y separado en más láminas.
     No es simetría: la marca es geometría de verdad y aguanta el espesor que
     le pongas, pero el texto son láminas apiladas, y si se separan mucho, al
     girar se ve el peine entre una y otra —las letras parecen deshilachadas—.
     0,045 en 20 láminas son 0,0024 de paso: se lee macizo en casi toda la
     vuelta. Lo paga de perfil, donde desaparece antes que la marca. */
  var CAPAS = 20;
  var HONDO = 0.045;               // espesor del logotipo
  var H_ANILLO = 0.10;
  var H_CUNA = 0.16;
  var BISEL = 0.007;               // el filo que agarra la luz en cada contorno

  // seis anillos, cada uno con sus tramos exactos
  var ANILLOS = [
    { r: 0.491, tramos: [[90.1, 210.6], [216.9, 285.5], [306.1, 325.1]] },
    { r: 0.589, tramos: [[90.1, 210.1], [226.2, 249.2], [271.8, 319.2]] },
    { r: 0.688, tramos: [[90.1, 210.2], [217.6, 285.9], [303.0, 324.6]] },
    { r: 0.785, tramos: [[90.1, 209.9], [212.9, 226.2], [245.5, 309.0]] },
    { r: 0.884, tramos: [[90.1, 210.0], [220.9, 272.2], [285.6, 327.9]] },
    { r: 0.979, tramos: [[90.1, 210.2], [217.6, 241.0], [264.1, 318.4]] }
  ];

  var renderer, scene, camera, lienzo, contenedor, ro, io, grupo, chispa;
  var visible = false, pedido = null, ultimo = 0, reloj = 0, encuadre = 1.3;
  var entrada = 0, arranco = false;   // la llegada, la primera vez que se ve
  var descartables = [];

  function haySoporte() {
    if (!window.THREE) return false;
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) { return false; }
  }
  function guardar(x) { descartables.push(x); return x; }

  /* un tramo de anillo: arco de ida por afuera y de vuelta por adentro */
  function arco(r0, r1, a0, a1) {
    var s = new THREE.Shape();
    s.absarc(0, 0, r1, a0, a1, false);
    s.absarc(0, 0, r0, a1, a0, true);
    s.closePath();
    return s;
  }

  /* Con bisel, no a canto vivo. Es la diferencia entre una pieza cortada y
     una pieza terminada: cada contorno agarra un filo de luz que viaja al
     girar. Cuesta unos triángulos más y es de lo que más se nota. */
  function pieza(forma, alto, material) {
    var geo = guardar(new THREE.ExtrudeGeometry(forma, {
      depth: alto, curveSegments: 72,
      bevelEnabled: true, bevelThickness: BISEL, bevelSize: BISEL,
      bevelOffset: 0, bevelSegments: 2
    }));
    // extruye hacia +Z desde 0: centrarla deja la marca simétrica al girar
    geo.translate(0, 0, -alto / 2);
    grupo.add(new THREE.Mesh(geo, material));
  }

  /* ── El logotipo, también medido del archivo ───────────────────────
     Mismo método que la marca: se buscaron las bandas de tinta debajo del
     isotipo y se sacó de cada renglón su caja. Todo va en unidades del radio
     de la marca, con el origen en su centro y la Y hacia arriba.

     Lo que la primera versión hacía mal: centraba los renglones (el original
     los alinea a la IZQUIERDA), los pegaba demasiado al isotipo, y usaba la
     tipografía del sitio. Es Poppins Bold; se pide en el HTML solo con las
     letras que usa. */
  var TXT = {
    izq: -0.694, der: 0.860,           // borde izquierdo común y extremo derecho
    arriba: -1.385, abajo: -2.920,     // alto del bloque (arriba es la ®)
    reg: { der: 0.751, arriba: -1.385, alto: 0.125 },
    lineas: [
      { t: "PLAZA",      base: -1.754, cap: 0.306, ancho: 1.309 },
      { t: "DE",         base: -2.150, cap: 0.306, ancho: 0.516 },
      { t: "TOROS",      base: -2.558, cap: 0.306, ancho: 1.473 },
      { t: "REAL DE",    base: -2.722, cap: 0.085, ancho: 0.510 },
      { t: "SAN CARLOS", base: -2.859, cap: 0.085, ancho: 0.810 }
    ]
  };
  /* Medidos sobre la Poppins ya cargada, no supuestos: la mayúscula ocupa
     0,702 del em, pero el glifo de la ® solo 0,432 y su tope queda 0,713
     sobre la línea de base. Calcularla con el ratio de la mayúscula la
     dibujaba a un 60 % del tamaño: salía un puntito. */
  var CAP_EM = 0.702;
  var REG_EM = 0.432, REG_ASC = 0.713;
  var lienzoTxt = null, texTxt = null, escalaTxt = 1;

  /* El ancho medido del original manda. Se llega a él con INTERLETRADO, no
     estirando: el logo tiene los renglones grandes un poco cerrados y los
     chicos un poco abiertos, que es lo que hace un diseñador, y así las
     letras no se deforman. Se resuelve midiendo con dos espaciados y
     despejando, porque es lineal. Si el navegador no soporta letterSpacing
     en canvas, se cae a un estirón horizontal (queda en ±7 %, no se ve). */
  function ajustar(g, texto, objetivo) {
    if (typeof g.letterSpacing === "string") {
      g.letterSpacing = "0px";
      var a = g.measureText(texto).width;
      g.letterSpacing = "10px";
      var b = g.measureText(texto).width;
      if (b !== a) {
        g.letterSpacing = ((objetivo - a) * 10 / (b - a)).toFixed(2) + "px";
        return 1;
      }
      g.letterSpacing = "0px";
    }
    var m = g.measureText(texto).width;
    return m > 0 ? objetivo / m : 1;
  }

  function dibujarTexto() {
    var g = lienzoTxt.getContext("2d");
    var S = escalaTxt;
    g.fillStyle = "#000";                // el alphaMap lee el canal verde:
    g.fillRect(0, 0, lienzoTxt.width, lienzoTxt.height);
    g.fillStyle = "#fff";                // negro = recortado, blanco = letra
    g.textAlign = "left";
    g.textBaseline = "alphabetic";

    // el borde izquierdo del canvas ES el borde izquierdo del texto
    TXT.lineas.forEach(function (l) {
      var px = l.cap * S / CAP_EM;
      g.font = '700 ' + px.toFixed(1) + 'px Poppins, "Instrument Sans", sans-serif';
      // el canvas crece hacia abajo y el mundo hacia arriba: la resta va
      // al revés de como se lee (arriba es el valor MÁS alto de los dos)
      var y = (TXT.arriba - l.base) * S;
      var k = ajustar(g, l.t, l.ancho * S);
      g.save();
      g.translate(0, y);
      g.scale(k, 1);
      g.fillText(l.t, 0, 0);
      g.restore();
    });

    // la ® del original, arriba a la derecha de PLAZA
    if (typeof g.letterSpacing === "string") g.letterSpacing = "0px";
    var fs = TXT.reg.alto * S / REG_EM;
    g.font = '700 ' + fs.toFixed(1) + 'px Poppins, "Instrument Sans", sans-serif';
    g.textAlign = "right";
    g.fillText("\u00AE", (TXT.reg.der - TXT.izq) * S,
               (TXT.arriba - TXT.reg.arriba) * S + REG_ASC * fs);
  }

  function texturaTexto() {
    var ancho = TXT.der - TXT.izq;
    var alto = TXT.arriba - TXT.abajo;
    escalaTxt = 1200 / ancho;              // px de canvas por unidad de radio
    lienzoTxt = document.createElement("canvas");
    lienzoTxt.width = Math.round(ancho * escalaTxt);
    lienzoTxt.height = Math.round(alto * escalaTxt);
    dibujarTexto();

    texTxt = guardar(new THREE.CanvasTexture(lienzoTxt));
    texTxt.colorSpace = THREE.SRGBColorSpace || texTxt.colorSpace;
    texTxt.anisotropy = renderer.capabilities.getMaxAnisotropy ?
      Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1;

    /* La primera pasada se dibuja con la tipografía que haya. Cuando Poppins
       termina de bajar se vuelve a dibujar el mismo canvas y se avisa a la
       textura: si no, queda para siempre el dibujo con la de reemplazo. */
    if (document.fonts && document.fonts.load) {
      document.fonts.load('700 100px Poppins', "PLAZDETORSCN\u00AE").then(function () {
        if (!renderer) return;
        dibujarTexto();
        texTxt.needsUpdate = true;
        pintar(0);
      })["catch"](function () {});
    }
    return texTxt;
  }

  function construirTexto(mat) {
    var alfa = texturaTexto();
    var an = TXT.der - TXT.izq, al = TXT.arriba - TXT.abajo;
    var caja = guardar(new THREE.PlaneGeometry(an, al));
    var matT = guardar(new THREE.MeshStandardMaterial({
      color: mat.color, metalness: mat.metalness, roughness: mat.roughness,
      envMapIntensity: mat.envMapIntensity,
      alphaMap: alfa, transparent: true, alphaTest: 0.5, side: THREE.FrontSide
    }));

    /* Dos pilas, una mirando a cada lado. Girando 360° la de atrás se ve de
       revés y las letras salen espejadas, que se lee como un error. Con una
       pila propia para el dorso, el logotipo se lee bien desde los dos
       lados —como una pieza impresa por las dos caras. */
    var bloque = new THREE.Group();
    var atras = new THREE.Group();
    atras.rotation.y = Math.PI;
    for (var k = 0; k < CAPAS; k++) {
      var z = -HONDO / 2 + (k / (CAPAS - 1)) * HONDO;
      var frente = new THREE.Mesh(caja, matT);
      frente.position.z = z;
      bloque.add(frente);
      var dorso = new THREE.Mesh(caja, matT);
      dorso.position.z = z;
      atras.add(dorso);
    }
    bloque.add(atras);
    // el plano se apoya donde de verdad va el texto respecto de la marca
    bloque.position.set((TXT.izq + TXT.der) / 2, (TXT.arriba + TXT.abajo) / 2, 0);
    grupo.add(bloque);
  }

  function construir() {
    /* Standard con mapa de entorno: el reflejo lo aporta el estudio, no una
       luz puntual. Metalness alto y roughness baja dan un negro pulido que
       cambia al girar; con roughness alta vuelve a ser una silueta mate. */
    var mat = guardar(new THREE.MeshStandardMaterial({
      color: TINTA, metalness: 0.52, roughness: 0.21, envMapIntensity: 1.35
    }));

    var rad = function (g) { return g * Math.PI / 180; };

    // los anillos, cada uno con sus cortes
    ANILLOS.forEach(function (an) {
      an.tramos.forEach(function (t) {
        pieza(arco(an.r - GRUESO / 2, an.r + GRUESO / 2,
                   rad(t[0]), rad(t[1])), H_ANILLO, mat);
      });
    });

    /* Los tendidos, todos de la misma altura. La primera versión los hacía
       subir en escalera —mi lectura de "son las gradas"— y de frente eso
       rompía la marca: se veía escalonada donde el logo es plano. El relieve
       lo dan el espesor y la luz, no una silueta distinta. */
    /* Apenas más gruesas que los anillos (0,09 contra 0,05). Con 0,2 el
       canto de cada cuña es tan ancho que agarra toda la luz y el abanico
       sale gris, justo al revés que en el logo, donde es lo más negro. */
    CUNAS.forEach(function (t) {
      pieza(arco(CUNA_R0, CUNA_R1, rad(t[0]), rad(t[1])), H_CUNA, mat);
    });

    construirTexto(mat);

    /* Centrar y encuadrar con lo que ocupa de verdad. La marca se construye
       alrededor del origen y el texto cuelga abajo, así que sin recentrar el
       conjunto gira descentrado y el texto se sale de cuadro. */
    var caja = new THREE.Box3().setFromObject(grupo);
    var centro = caja.getCenter(new THREE.Vector3());
    grupo.children.forEach(function (h) { h.position.y -= centro.y; });

    caja = new THREE.Box3().setFromObject(grupo);
    encuadre = Math.max(
      Math.abs(caja.min.x), Math.abs(caja.max.x),
      Math.abs(caja.min.y), Math.abs(caja.max.y)
    ) * 1.08;
  }

  /* Un negro sin nada que reflejar es una silueta plana. Esto arma un
     "estudio" —piso oscuro, cielo claro y una ventana de luz— como mapa de
     entorno. Es lo que hace que la pieza se lea metálica y que el reflejo
     se corra mientras gira, en vez de quedar mate. */
  function ambiente() {
    var cv = document.createElement("canvas");
    cv.width = 512; cv.height = 256;
    var g = cv.getContext("2d");
    var lin = g.createLinearGradient(0, 0, 0, 256);
    lin.addColorStop(0.00, "#ffffff");
    lin.addColorStop(0.34, "#dedcd7");
    lin.addColorStop(0.54, "#8d8b87");
    lin.addColorStop(0.72, "#35363a");
    lin.addColorStop(1.00, "#101216");
    g.fillStyle = lin; g.fillRect(0, 0, 512, 256);

    /* Dos ventanas arriba y tres claros sobre el horizonte. Los del
       horizonte son los que importan: las caras grandes miran de costado y
       si ahí solo hay gris parejo, la pieza queda negra y plana pase lo que
       pase. Con estos, al girar barre luz y sombra. */
    [[140, 54, 104], [368, 40, 66],
     [92, 132, 78], [286, 126, 96], [452, 138, 70]].forEach(function (v) {
      var r = g.createRadialGradient(v[0], v[1], 2, v[0], v[1], v[2]);
      r.addColorStop(0, "rgba(255,255,255,1)");
      r.addColorStop(0.55, "rgba(255,255,255,.34)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, 512, 256);
    });

    var t = new THREE.CanvasTexture(cv);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace || t.colorSpace;
    var pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    var env = pm.fromEquirectangular(t).texture;
    pm.dispose(); t.dispose();
    return guardar(env);
  }

  function medir() {
    if (!contenedor || !renderer) return;
    var an = contenedor.clientWidth, al = contenedor.clientHeight;
    if (!an || !al) return;
    camera.aspect = an / al;
    /* Encuadre por el lado más chico. La marca es redonda: si se encuadra
       solo por la vertical, en una caja más alta que ancha queda cortada
       por los costados. */
    var v = Math.tan(camera.fov * Math.PI / 360);
    camera.position.z = camera.aspect < 1 ?
      encuadre / (v * camera.aspect) : encuadre / v;
    camera.updateProjectionMatrix();
    renderer.setSize(an, al, false);
    pintar(0);
  }

  function pintar(dt) {
    if (!renderer) return;
    reloj += dt;
    /* Vuelta entera, ~15 s. Los dos problemas del giro completo están
       resueltos por otro lado: el canto ya no desaparece porque la pieza
       tiene bisel y reflejo (de perfil se ve un filo de luz, que es el mejor
       momento del giro), y el dorso se lee bien porque el logotipo tiene una
       pila de letras para cada cara.
       El cabeceo va en otro período: si los dos ciclaran igual, el giro se
       vuelve un loop evidente. */
    /* La llegada. La pieza no está: entra. Casi un cuarto de vuelta de más y
       un 12 % de escala, resueltos en poco más de un segundo, una sola vez.
       Es lo que separa "hay un logo girando" de "el logo llegó". */
    if (arranco && entrada < 1) entrada = Math.min(1, entrada + dt / 1.15);
    var e = entrada * entrada * (3 - 2 * entrada);
    grupo.scale.setScalar(0.88 + 0.12 * e);

    grupo.rotation.y = reloj * 0.42 - (1 - e) * 0.9;
    /* La inclinación no es decorativa: con el eje perpendicular a la vista,
       a 90° la pieza se ve como una raya. Inclinada 15° el perfil se ve
       escorzado y se sigue leyendo un objeto. */
    grupo.rotation.x = -0.26 + Math.sin(reloj * 0.23) * 0.05;
    /* una luz que orbita más lento que la marca: el brillo no cae siempre en
       el mismo lugar y el giro no se vuelve repetitivo */
    if (chispa) {
      chispa.position.set(
        Math.cos(reloj * 0.27) * 3.6,
        1.2 + Math.sin(reloj * 0.17) * 1.8,
        3.4 + Math.sin(reloj * 0.27) * 1.2
      );
    }
    renderer.render(scene, camera);
  }

  function bucle(ahora) {
    pedido = null;
    if (!visible || document.hidden) return;
    var dt = ultimo ? Math.min((ahora - ultimo) / 1000, 1 / 30) : 1 / 60;
    ultimo = ahora;
    pintar(dt);
    pedido = requestAnimationFrame(bucle);
  }

  function despertar() {
    if (pedido === null && visible && !document.hidden) {
      ultimo = 0;
      pedido = requestAnimationFrame(bucle);
    }
  }

  /* `opciones` es para la captura de cuadros de desarrollo, nada más:
     preservar mantiene el buffer para poder leerlo con toDataURL, y manual
     apaga el bucle propio para poder avanzar la animación a mano. */
  function init(canvas, opciones) {
    if (!canvas || !haySoporte()) return false;
    var op = opciones || {};
    lienzo = canvas;
    contenedor = canvas.parentElement;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: true,
        preserveDrawingBuffer: !!op.preservar
      });
    } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    // transparente: la marca se apoya sobre el fondo de la página, sin caja
    renderer.setClearAlpha(0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(0, 0, 8);

    /* Poca ambiente y una direccional fuerte: es lo que separa la cara
       del canto. Con negro plano y luz pareja el volumen no se ve. */
    /* Con el mapa de entorno la iluminación ya está: estas dos son para
       marcar los cantos, no para iluminar. */
    var sol = new THREE.DirectionalLight(0xffffff, 0.9);
    sol.position.set(2, 3, 4);
    scene.add(sol);
    chispa = new THREE.PointLight(0xffffff, 0.5, 14, 1.8);
    scene.add(chispa);

    scene.environment = ambiente();

    grupo = new THREE.Group();
    scene.add(grupo);
    construir();

    medir();

    if (window.ResizeObserver) { ro = new ResizeObserver(medir); ro.observe(contenedor); }
    else window.addEventListener("resize", medir);

    if (!op.manual) {
      io = new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting;
        if (visible) despertar();
      }, { threshold: 0 });
      io.observe(contenedor);
      document.addEventListener("visibilitychange", despertar);
    }
    /* Visible desde que está lista, y punto.
       Antes esto colgaba del IntersectionObserver, para que la entrada se
       viera al llegar scrolleando. Mala idea: si el observador no dispara
       —pestaña en segundo plano, la caja todavía sin medir, un navegador que
       lo posterga— el canvas se queda en opacidad 0 y no aparece NADA. La
       visibilidad de algo nunca puede depender de un callback.

       La entrada igual se ve: el bucle solo corre cuando la marca está en
       pantalla, así que el primer cuadro que se dibuja es el que llega
       scrolleando. Si el bucle nunca arranca, al menos se ve el cuadro que
       ya pintó medir(). */
    arranco = true;
    if (op.manual) entrada = 1;
    canvas.classList.add("listo");
    return true;
  }

  function destruir() {
    if (pedido) cancelAnimationFrame(pedido);
    pedido = null;
    if (ro) ro.disconnect();
    if (io) io.disconnect();
    window.removeEventListener("resize", medir);
    document.removeEventListener("visibilitychange", despertar);
    descartables.forEach(function (d) { if (d && d.dispose) d.dispose(); });
    descartables.length = 0;
    if (renderer) { renderer.dispose(); renderer = null; }
  }

  return {
    init: init, destruir: destruir,
    // avanzar y pintar un cuadro a mano (captura de desarrollo)
    paso: function (dt) { arranco = true; entrada = 1; pintar(dt || 1 / 60); }
  };
})();
