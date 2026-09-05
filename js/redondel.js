/* ═══════════════════════════════════════════════════════════
   El volumen — los tres paneles del logo, en 3D real.
   Una sola responsabilidad: la portada. No es fondo decorativo.

   El isotipo de Espacio Arte ya es un dibujo isométrico de tres
   paneles de exposición con rueditas. Acá se arman de verdad:
   primero el alambre, después la superficie.

   Y alrededor hay polvo: el que se ve en el haz de luz de
   cualquier sala vieja. Lo levanta el puntero al pasar.

   Expone window.Redondel = { init, entrar, progreso, destruir }
   ═══════════════════════════════════════════════════════════ */
window.Redondel = (function () {
  "use strict";

  var LADO = 1.20;      // lado del panel
  var FONDO = 0.34;     // profundidad de la caja
  var TINTA = 0x101216;   // el alambre
  /* El relleno tapa lo que hay detrás, pero UN PELO más oscuro que el fondo.
     Siendo exactamente #F4F2ED los paneles no tenían cuerpo: quedaba un
     alambre de un píxel de dispositivo sobre cal, casi invisible, y una vez
     que el título se iba no quedaba nada que mirar. Con este gris apenas
     sucio la cara del panel se lee y el alambre la dibuja. */
  var CAL = 0xe9e6e0;

  /* ── polvo ──────────────────────────────────────────────
     Se emite por distancia recorrida, no por tiempo: un barrido
     rápido dejaría huecos y una mano quieta amontonaría puntos
     en el mismo lugar. La pila es fija y se recicla en anillo. */
  var POZO = 480;       // motas en la pila
  var PASO = 0.055;     // unidades de mundo entre motas
  var TOPE = 14;        // máximo por cuadro (un salto no vacía la pila)
  var OCIO = 0.055;     // s: la mano quieta gotea, no bombea
  var VIDA = 2.3;       // s. Más que el 1,6 s habitual: es polvo suspendido,
                        // no una estela; tiene que flotar, no chispear.

  var renderer, scene, camera, grupo, paneles = [];
  var lienzo, contenedor, ro, io;
  var visible = false, pedido = null, ultimo = 0, reloj = 0;
  var estado = { p: 0, armado: 0, ratonX: 0, ratonY: 0, objX: 0, objY: 0 };
  function clamp(a, b, v) { return v < a ? a : v > b ? b : v; }
  var descartables = [];

  var polvo = null;     // { puntos, geo, mat, origenes, vels, nacim, azar, cabeza, sucio }
  var rayo, plano, ndc, golpe, anterior, entre;
  var hayAnterior = false, ocio = 0, ambiente = 0;

  function haySoporte() {
    if (!window.THREE) return false;
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) {
      return false;
    }
  }

  function guardar(x) { descartables.push(x); return x; }

  /* Un panel = caja de alambre + relleno opaco que tapa lo de atrás + dos rueditas */
  function crearPanel() {
    var nodo = new THREE.Group();

    var caja = guardar(new THREE.BoxGeometry(LADO, LADO, FONDO));

    var relleno = new THREE.Mesh(
      caja,
      guardar(new THREE.MeshBasicMaterial({
        color: CAL, transparent: true, opacity: 0,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
      }))
    );
    nodo.add(relleno);

    var alambre = new THREE.LineSegments(
      guardar(new THREE.EdgesGeometry(caja)),
      guardar(new THREE.LineBasicMaterial({ color: TINTA, transparent: true, opacity: 0 }))
    );
    nodo.add(alambre);

    // rueditas: dos círculos en la base, como en el logo
    var rueda = guardar(new THREE.EdgesGeometry(guardar(new THREE.CircleGeometry(0.075, 14))));
    var matRueda = guardar(new THREE.LineBasicMaterial({ color: TINTA, transparent: true, opacity: 0 }));
    [-1, 1].forEach(function (lado) {
      var r = new THREE.LineSegments(rueda, matRueda);
      r.position.set(lado * LADO * 0.33, -LADO / 2 - 0.075, FONDO / 2);
      nodo.add(r);
    });

    nodo.userData = { relleno: relleno.material, alambre: alambre.material, rueda: matRueda };
    return nodo;
  }

  /* ── la pila de polvo: se sube una vez y vive en el shader ── */
  function crearPolvo(dpr) {
    var geo = new THREE.BufferGeometry();
    var origenes = new Float32Array(POZO * 3);
    var vels = new Float32Array(POZO * 3);
    var nacim = new Float32Array(POZO);
    var azar = new Float32Array(POZO * 2);

    for (var i = 0; i < POZO; i++) nacim[i] = -999; // nace muerta

    geo.setAttribute("position", new THREE.BufferAttribute(origenes, 3));
    geo.setAttribute("aVel", new THREE.BufferAttribute(vels, 3));
    geo.setAttribute("aBirth", new THREE.BufferAttribute(nacim, 1));
    geo.setAttribute("aRnd", new THREE.BufferAttribute(azar, 2));
    ["position", "aVel", "aBirth", "aRnd"].forEach(function (n) {
      geo.attributes[n].setUsage(THREE.DynamicDrawUsage);
    });
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

    var mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      // sobre cal el polvo oscurece, no ilumina: aditivo sobre blanco no se ve
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uLife: { value: VIDA },
        uSize: { value: 44.0 },
        uDpr: { value: dpr }
      },
      vertexShader: [
        "attribute vec3 aVel;",
        "attribute float aBirth;",
        "attribute vec2 aRnd;",
        "uniform float uTime, uLife, uSize, uDpr;",
        "varying float vAlpha;",
        "void main(){",
        "  float age = uTime - aBirth;",
        "  float u = age / uLife;",
        "  if (u < 0.0 || u > 1.0) {",
        "    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vAlpha = 0.0; return;",
        "  }",
        // el arrastre frena la mota; después sube sola y deriva de costado
        "  vec3 p = position + aVel * age * (1.0 - 0.34 * u);",
        "  p.y += 0.15 * age;",
        "  p.x += sin(aRnd.y * 6.283 + age * 2.1) * 0.07 * u;",
        "  vAlpha = smoothstep(0.0, 0.10, u) * (1.0 - smoothstep(0.36, 1.0, u));",
        "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
        "  gl_PointSize = uSize * aRnd.x * uDpr / max(0.001, -mv.z);",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "precision mediump float;",
        "varying float vAlpha;",
        "void main(){",
        // disco suave por fórmula: evita subir una textura de sprite
        "  vec2 c = gl_PointCoord - 0.5;",
        "  float d = dot(c, c);",
        "  if (d > 0.25) discard;",
        "  float a = smoothstep(0.25, 0.02, d);",
        "  gl_FragColor = vec4(0.063, 0.071, 0.086, a * vAlpha * 0.22);",
        "}"
      ].join("\n")
    });
    guardar(geo); guardar(mat);

    var puntos = new THREE.Points(geo, mat);
    puntos.frustumCulled = false;
    scene.add(puntos);

    polvo = {
      puntos: puntos, geo: geo, mat: mat,
      origenes: origenes, vels: vels, nacim: nacim, azar: azar,
      cabeza: 0, sucio: false
    };

    rayo = new THREE.Raycaster();
    // un solo plano de interacción, justo delante del volumen
    plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.6);
    ndc = new THREE.Vector2();
    golpe = new THREE.Vector3();
    anterior = new THREE.Vector3();
    entre = new THREE.Vector3();
  }

  function sembrar(v, fuerza) {
    if (!polvo) return;
    var i = polvo.cabeza;
    polvo.cabeza = (polvo.cabeza + 1) % POZO;
    var f = fuerza || 1;

    polvo.origenes[i * 3]     = v.x + (Math.random() - 0.5) * 0.06;
    polvo.origenes[i * 3 + 1] = v.y + (Math.random() - 0.5) * 0.06;
    polvo.origenes[i * 3 + 2] = v.z + (Math.random() - 0.5) * 0.30;

    polvo.vels[i * 3]     = (Math.random() - 0.5) * 0.10 * f;
    polvo.vels[i * 3 + 1] = (Math.random() - 0.3) * 0.09 * f;
    polvo.vels[i * 3 + 2] = (Math.random() - 0.5) * 0.08 * f;

    polvo.nacim[i] = reloj;
    polvo.azar[i * 2]     = 0.50 + Math.random() * 0.65;
    polvo.azar[i * 2 + 1] = Math.random();
    polvo.sucio = true;
  }

  /* emisión por distancia recorrida sobre el tramo entero */
  function emitirTramo(dt) {
    if (!polvo) return;
    rayo.setFromCamera(ndc, camera);
    if (!rayo.ray.intersectPlane(plano, golpe)) { hayAnterior = false; return; }

    if (!hayAnterior) { anterior.copy(golpe); hayAnterior = true; sembrar(golpe); return; }

    var d = golpe.distanceTo(anterior);

    // un salto (cambio de pestaña, puntero teletransportado) no se interpola:
    // repartir motas a lo largo del salto dibuja una línea punteada de lado a
    // lado de la pantalla, que sobre cal se lee como suciedad
    if (d > PASO * TOPE) { anterior.copy(golpe); sembrar(golpe); ocio = 0; return; }

    var n = Math.min(TOPE, Math.floor(d / PASO));
    if (n > 0) {
      for (var i = 1; i <= n; i++) {
        entre.lerpVectors(anterior, golpe, i / n);
        sembrar(entre);
      }
      anterior.copy(golpe);
      ocio = 0;
    } else if ((ocio += dt) > OCIO) {
      sembrar(golpe);
      ocio = 0;
    }
  }

  /* el polvo existe aunque no haya puntero: con dedo, con teclado o quieto */
  function emitirAmbiente(dt) {
    if (!polvo) return;
    if ((ambiente += dt) < 0.19) return;
    ambiente = 0;
    entre.set((Math.random() - 0.5) * 4.4, (Math.random() - 0.5) * 3.0, (Math.random() - 0.5) * 1.6);
    sembrar(entre, 0.35);
  }

  function medir() {
    if (!contenedor || !renderer) return;
    var an = contenedor.clientWidth || window.innerWidth;
    var al = contenedor.clientHeight || window.innerHeight;
    if (!an || !al) return;
    camera.aspect = an / al;
    // en pantallas angostas el objeto tiene que entrar igual
    camera.fov = an < 700 ? 46 : 38;
    camera.updateProjectionMatrix();
    renderer.setSize(an, al, false);
    pintar();
  }

  function pintar() {
    if (!renderer) return;
    var p = estado.p;
    var armado = estado.armado;              // 0→1 en la entrada

    /* La portada tiene DOS tramos, no uno:
         a) 0 → 0,42   el logo se abre y se endereza: de isométrico a pasillo.
         b) 0,42 → 1   la cámara entra y lo atraviesa.

       El corte está en 0,42 y no más adelante porque el vuelo tiene que
       llegar hasta el final de la sección: el último panel pasa recién
       sobre p≈0,95. Si el tramo b arranca tarde, el vuelo termina antes y
       el resto del scroll queda mirando una pantalla vacía. Ya pasó dos
       veces; se comprueba con una hoja de contactos, no a ojo.
       El segundo tramo es lo que hace que la portada acompañe el scroll un
       rato más sin quedar pisando en el lugar. No es más recorrido para
       rellenar: es información espacial nueva, y además rima con la sección
       05, donde el scroll también te camina por adentro. */
    var a = clamp(0, 1, p / 0.42);
    var b = clamp(0, 1, (p - 0.42) / 0.58);
    /* Acelerando, no suavizado a los dos lados: con smoothstep el grueso
       del viaje pasa en el medio del tramo y los paneles quedan atrás sobre
       p≈0,83, dejando el último quinto del scroll mirando una pantalla
       vacía. Así el cruce cae donde tiene que caer, sobre el final. */
    var entra = b * b;

    var sep = 0.05 + (0.05 + a * 0.85) * armado;

    paneles.forEach(function (nodo, i) {
      var d = i - 1;                          // -1, 0, 1
      // al separarse en profundidad los paneles se enderezan: de logo isométrico
      // a pasillo de sala, que es lo que son en la plaza
      var lateral = 1 - a * 0.62;
      /* En el segundo tramo se abren para dejar pasar la cámara.
         Cada panel se va HACIA SU PROPIO LADO y el del medio, que no tiene
         lado, sube. Antes iban alternados —dos a la izquierda y uno a la
         derecha— y el conjunto se corría de a poco fuera de cuadro: la
         animación terminaba con todo amontonado abajo a la izquierda. */
      /* 1,15 de corrimiento alcanza para que la cámara pase limpia (el panel
         mide 1,2, así que le quedan 0,55 de luz). Con más, se van de cuadro
         mucho antes de que la cámara los alcance y el final queda vacío. */
      var largo = 1 + entra * 1.2;
      /* 0,95 y no 1,5: abriendo tanto, sobre el final los paneles quedaban
         del todo fuera de cuadro y el último tramo del scroll era una
         pantalla vacía. Así rozan los bordes mientras la cámara los pasa. */
      nodo.position.set(
        d * 0.44 * lateral + d * entra * 0.95,
        -d * 0.34 * lateral + (d === 0 ? entra * 0.78 : 0),
        d * sep * 1.5 * largo
      );
      var op = Math.max(0, Math.min(1, (a - 0.1) / 0.4)) * armado;
      nodo.userData.relleno.opacity = op * 0.92 * (1 - entra * 0.5);
      // en reposo el alambre es un fantasma detrás del título; se enciende al bajar
      nodo.userData.alambre.opacity = armado * (0.38 + a * 0.62);
      nodo.userData.rueda.opacity = armado * (0.30 + a * 0.50) * (1 - entra);
    });

    /* El conjunto se iba hundiendo hacia abajo mientras se armaba: el giro
       en X lo inclinaba 23° y, con la perspectiva, todo el grupo se corría
       fuera del centro. Menos inclinación y una subida que la compensa. */
    grupo.position.y = -0.12 + a * 0.26;
    grupo.rotation.y = -0.62 + a * 0.72 - entra * 0.10 + estado.objX;
    grupo.rotation.x = 0.10 + a * 0.14 - entra * 0.20 + estado.objY;

    // primero un travelling corto de acercamiento; después la cámara cruza
    /* Cuánto viaja la cámara define dónde termina el vuelo, y hay que
       medirlo, no calcularlo: de cerca el encuadre se angosta y los paneles
       se van por los costados bastante antes de que la cámara llegue a su
       profundidad. Con 7,7 la cámara los pasaba a todos y el final quedaba
       en una pantalla vacía. Con 6,9 frena entre el panel del medio y el
       último, que queda grande en cuadro mientras el canvas se funde. */
    var cz = 7.4 - a * 1.1 - entra * 6.9;     // 7,4 → 6,3 → -0,6
    camera.position.z = cz;
    /* al entrar deja de mirar el centro y mira hacia adelante: si siguiera
       apuntando al origen, al pasarlo la escena se daría vuelta de golpe */
    camera.lookAt(0, 0, entra * (cz - 4));

    if (polvo) {
      polvo.mat.uniforms.uTime.value = reloj;
      polvo.puntos.visible = armado > 0.02;
      if (polvo.sucio) {
        polvo.geo.attributes.position.needsUpdate = true;
        polvo.geo.attributes.aVel.needsUpdate = true;
        polvo.geo.attributes.aBirth.needsUpdate = true;
        polvo.geo.attributes.aRnd.needsUpdate = true;
        polvo.sucio = false;
      }
    }

    // se apaga sobre el final para no pelear con la sección siguiente
    var salida = p > 0.93 ? 1 - (p - 0.93) / 0.07 : 1;
    lienzo.style.opacity = String(Math.max(0, salida));

    renderer.render(scene, camera);
  }

  function bucle(ahora) {
    pedido = null;
    if (!visible || document.hidden) return;

    var dt = ultimo ? Math.min((ahora - ultimo) / 1000, 1 / 30) : 1 / 60;
    ultimo = ahora;
    reloj += dt;

    // suavizado del paralaje de mouse
    var dx = estado.ratonX - estado.objX;
    var dy = estado.ratonY - estado.objY;
    estado.objX += dx * 0.06;
    estado.objY += dy * 0.06;

    if (polvo) {
      if (hayAnterior || ndc.lengthSq() > 0) emitirTramo(dt);
      emitirAmbiente(dt);
      pintar();
      pedido = requestAnimationFrame(bucle);
      return;
    }

    // sin polvo (celular): se dibuja mientras quede paralaje y después se duerme.
    // Un rAF continuo en el hero de un teléfono se paga en batería.
    pintar();
    if (Math.abs(dx) > 0.0004 || Math.abs(dy) > 0.0004) {
      pedido = requestAnimationFrame(bucle);
    }
  }

  function despertar() {
    if (pedido === null && visible && !document.hidden) {
      ultimo = 0;                            // sin salto de tiempo al volver
      pedido = requestAnimationFrame(bucle);
    }
  }

  function init(canvas) {
    if (!canvas || !haySoporte()) return false;

    lienzo = canvas;
    contenedor = canvas.parentElement;

    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) {
      return false;
    }
    var esChico = window.matchMedia("(max-width: 767px)").matches;
    var dpr = Math.min(window.devicePixelRatio || 1, esChico ? 1.75 : 2);
    renderer.setPixelRatio(dpr);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0, 6.4);

    grupo = new THREE.Group();
    scene.add(grupo);
    for (var i = 0; i < 3; i++) {
      var pnl = crearPanel();
      paneles.push(pnl);
      grupo.add(pnl);
    }

    // en celular la portada queda quieta: nada de rAF continuo por batería
    if (!esChico) crearPolvo(dpr);

    medir();

    if (window.ResizeObserver) {
      ro = new ResizeObserver(medir);
      ro.observe(contenedor);
    } else {
      window.addEventListener("resize", medir);
    }

    io = new IntersectionObserver(function (ents) {
      visible = ents[0].isIntersecting;
      if (visible) despertar();
    }, { threshold: 0 });
    io.observe(contenedor);

    document.addEventListener("visibilitychange", despertar);

    if (!window.matchMedia("(pointer: coarse)").matches) {
      window.addEventListener("pointermove", alMover, { passive: true });
      window.addEventListener("pointerleave", alSalir, { passive: true });
    }

    canvas.classList.add("listo");
    return true;
  }

  function alMover(e) {
    if (!visible) return;
    estado.ratonX = ((e.clientX / window.innerWidth) - 0.5) * 0.20;
    estado.ratonY = ((e.clientY / window.innerHeight) - 0.5) * 0.12;
    if (ndc) {
      ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }
    despertar();
  }

  // al volver a entrar no se dibuja una diagonal desde el punto viejo
  function alSalir() { hayAnterior = false; }

  /* la entrada: primero aparece el alambre, después llega el relleno */
  function entrar() {
    if (!renderer) return;
    despertar();
    if (window.gsap) {
      gsap.to(estado, {
        armado: 1, duration: 1.9, ease: "expo.out", delay: 0.1,
        onUpdate: pintar
      });
    } else {
      estado.armado = 1;
      pintar();
    }
  }

  function progreso(p) {
    if (!renderer) return;
    estado.p = Math.max(0, Math.min(1, p));
    if (pedido === null) pintar();   // en celular no hay bucle: pintar a mano
  }

  /* Fuerza un cuadro. Solo para la captura de desarrollo: con la pestaña
     oculta queda un rAF encolado que nunca corre, así que progreso() no
     repinta y se leería siempre el mismo buffer. Con `armar` en true da
     por terminada la entrada, que si no depende de que GSAP haya corrido. */
  function paso(armar) {
    if (!renderer) return;
    if (armar) estado.armado = 1;
    pintar();
  }

  function destruir() {
    if (pedido) cancelAnimationFrame(pedido);
    pedido = null;
    if (ro) ro.disconnect();
    if (io) io.disconnect();
    window.removeEventListener("pointermove", alMover);
    window.removeEventListener("pointerleave", alSalir);
    window.removeEventListener("resize", medir);
    document.removeEventListener("visibilitychange", despertar);
    descartables.forEach(function (d) { if (d && d.dispose) d.dispose(); });
    descartables.length = 0;
    if (renderer) { renderer.dispose(); renderer = null; }
    paneles.length = 0;
    polvo = null;
  }

  return { init: init, entrar: entrar, progreso: progreso, paso: paso, destruir: destruir };
})();
