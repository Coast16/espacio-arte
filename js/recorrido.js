/* ═══════════════════════════════════════════════════════════
   El recorrido — la sala, caminada.

   No es una galería de fotos: es el montaje. Las obras cuelgan
   de la estructura, como cuelgan de verdad en la plaza, y el
   scroll te lleva por la curva del redondel. Por eso el camino
   es un arco y no una recta: adentro de la plaza no hay rectas.

   Las piezas aparecen desde el negro (niebla) a medida que te
   acercás, igual que entrando a una sala oscura.

   Expone window.Recorrido = { init, progreso, destruir, alClic, alCambiar }
   ═══════════════════════════════════════════════════════════ */
window.Recorrido = (function () {
  "use strict";

  var RADIO = 55;        // radio del arco que camina la cámara
  /* Las obras estaban lejos, chicas y desteñidas: se veían como fotitos
     flotando en niebla, no como una sala que estás caminando. Los números de
     acá abajo son los que arreglan eso — se ajustan mirando una hoja de
     contactos del pasillo, nunca a ojo. */
  var SEP = 3.3;         // arco entre obra y obra
  var ENTRADA = 6;       // tramo oscuro antes de la primera obra
  var FRENTE = 3.0;      // a esta distancia queda la última obra al terminar
  var TECHO = 3.9;       // de acá cuelgan: la estructura
  var PISO = -1.9;
  var TINTA = 0x101216;   // tientos, marcos y guías
  var FONDO = 0xf4f2ed;   // la sala encalada: fondo y niebla
  var HUECO = 0xe7e4de;   // el panel todavía sin foto
  var CERCA = 26;        // a esta distancia se pide la textura

  /* Muestra por muestra, en el orden en que se camina.
     Los pies describen lo que se ve en la foto: no hay fichas
     de artista ni fechas para estas muestras todavía. */
  var OBRAS = [
    { f: "sinergia-01.jpg",    w: 1280, h: 853,  m: "Sinergia",                t: "Pieza gráfica en rojo, negro y blanco" },
    { f: "sinergia-02.jpg",    w: 1280, h: 853,  m: "Sinergia",                t: "Pintura de flores sobre fondo oscuro" },
    { f: "sinergia-03.jpg",    w: 1280, h: 849,  m: "Sinergia",                t: "Escultura sobre pedestal, con obra colgada detrás" },

    { f: "relatos-01.jpg",     w: 1280, h: 853,  m: "Relatos Dibujados",       t: "Público recorriendo la muestra bajo la estructura" },
    { f: "relatos-02.jpg",     w: 1280, h: 858,  m: "Relatos Dibujados",       t: "Serie de dibujos enmarcados" },
    { f: "relatos-03.jpg",     w: 1280, h: 853,  m: "Relatos Dibujados",       t: "Los paneles y las barricas en el pasillo" },

    { f: "magin-01.jpg",       w: 853,  h: 1280, m: "El Secreto de Magín",     t: "Escultura ensamblada en la sala principal" },
    { f: "magin-02.jpg",       w: 1280, h: 853,  m: "El Secreto de Magín",     t: "Dos piezas colgadas sobre tela rayada" },
    { f: "magin-03.jpg",       w: 1280, h: 853,  m: "El Secreto de Magín",     t: "Pinturas sobre el muro blanco" },
    { f: "magin-04.jpg",       w: 1280, h: 853,  m: "El Secreto de Magín",     t: "Pieza montada en vitrina" },

    { f: "sinfonia-05.jpg",    w: 853,  h: 1280, m: "Sinfonía de Colores",     t: "Escultura de gran porte en el centro de la sala" },
    { f: "sinfonia-02.jpg",    w: 853,  h: 1280, m: "Sinfonía de Colores",     t: "Telas azules y rosadas montadas sobre caballetes" },
    { f: "sinfonia-03.jpg",    w: 1280, h: 1061, m: "Sinfonía de Colores",     t: "Intervención con vestuario frente a los paneles" },
    { f: "sinfonia-04.jpg",    w: 1280, h: 853,  m: "Sinfonía de Colores",     t: "La sala montada con caballetes y pinturas" },
    { f: "sinfonia-01.jpg",    w: 853,  h: 1280, m: "Sinfonía de Colores",     t: "Cerámicas y pinturas en penumbra" },

    { f: "../bianki-torre.jpg",   w: 1066, h: 1600, m: "Espacio Bianki",       t: "Torre de paños pintados colgando del techo" },
    { f: "../obra-figuras.jpg",   w: 1600, h: 1066, m: "Espacio Bianki",       t: "Detalle de una pieza textil" },

    { f: "obra-01.jpg",        w: 1280, h: 836,  m: "Gente en Obra",            t: "Cartel de sala de la muestra, subtitulada Habitar" },
    { f: "obra-02.jpg",        w: 1280, h: 876,  m: "Gente en Obra",            t: "Muro de retratos pequeños, uno al lado del otro" },
    { f: "obra-03.jpg",        w: 1280, h: 888,  m: "Gente en Obra",            t: "Pieza azul y blanca sobre estructura de red" },
    { f: "obra-04.jpg",        w: 1280, h: 876,  m: "Gente en Obra",            t: "La nave con una pieza orgánica corriendo por el muro" },

    { f: "interfaz-01.jpg",    w: 1280, h: 841,  m: "Interfaz",                 t: "Escultura de cables frente al cartel de Espacio Arte" },
    { f: "interfaz-02.jpg",    w: 1280, h: 861,  m: "Interfaz",                 t: "Maraña de cordones de color, de cerca" },
    { f: "interfaz-03.jpg",    w: 1280, h: 831,  m: "Interfaz",                 t: "Pieza roja sobre pedestal blanco" },
    { f: "interfaz-04.jpg",    w: 1280, h: 828,  m: "Interfaz",                 t: "La sala blanca con las piezas sobre pedestales" },

    { f: "lanzamiento-01.jpg", w: 1280, h: 853,  m: "Lanzamiento interactivo", t: "Proyección de color sobre las columnas de hierro" },
    { f: "lanzamiento-02.jpg", w: 853,  h: 1280, m: "Lanzamiento interactivo", t: "Los arcos iluminados, con público" },
    { f: "lanzamiento-03.jpg", w: 1280, h: 853,  m: "Lanzamiento interactivo", t: "Set de música en vivo entre pantallas" },
    { f: "lanzamiento-04.jpg", w: 853,  h: 1280, m: "Lanzamiento interactivo", t: "Intervención de danza en la galería" }
  ];

  var RUTA = "assets/img/sala/";
  // el camino termina justo enfrente de la última obra, que cuelga en el eje
  // del pasillo mirándote: si la cámara la pasa, el final queda en negro
  var LARGO = ENTRADA + (OBRAS.length - 1) * SEP - FRENTE;

  var A_LA_VEZ = 2;      // texturas pidiéndose al mismo tiempo
  /* La niebla es del color del fondo, así que TODO lo que agarra se va a
     blanco. Con 7/32 las obras perdían color a los pocos metros y el pasillo
     entero quedaba lavado. Abriéndola, la obra se lee entera hasta que la
     pasás y recién ahí se disuelve. */
  var NIEBLA = [11, 44];

  var renderer, scene, camera, lienzo, contenedor, ro, io, cargador;
  var obras = [], rayo, ndc, tocables = [];
  var cola = [], cargando = 0, punteroSucio = false, ultimoS = -1;
  var visible = false, pedido = null, ultimo = 0;
  var estado = { s: 0, ratonX: 0, ratonY: 0, objX: 0, objY: 0, sobre: -1, actual: -1 };
  var descartables = [];
  var api = { alClic: null, alCambiar: null };

  function haySoporte() {
    if (!window.THREE) return false;
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) { return false; }
  }
  function guardar(x) { descartables.push(x); return x; }
  function clamp(a, b, v) { return v < a ? a : v > b ? b : v; }

  /* el camino: un arco, no una recta */
  function enArco(s, salida) {
    var th = s / RADIO;
    salida.set(-RADIO + RADIO * Math.cos(th), 0, -RADIO * Math.sin(th));
    return th;
  }

  function crearObra(datos, i) {
    var s = ENTRADA + i * SEP;
    var th = s / RADIO;
    var lado = i % 2 === 0 ? 1 : -1;

    // apaisadas más anchas, verticales más altas: el alto manda
    var ultima = i === OBRAS.length - 1;
    var vertical = datos.h > datos.w;
    // más grandes: a esta distancia una obra de 1,95 no llena el cuadro y
    // el centro de la pantalla queda siempre vacío
    var alto = ultima ? 3.3 : (vertical ? 2.95 : 2.3);
    var ancho = alto * (datos.w / datos.h);

    var nodo = new THREE.Group();
    var pos = new THREE.Vector3();
    enArco(s, pos);
    /* Más cerca del camino. Las obras miran al pasillo, así que su ancho
       corre a lo largo y no de costado: acá el número es la distancia real a
       la que le pasás por delante. A 1,75 te rozan; a 2,45 quedaban en el
       borde del cuadro y el medio siempre vacío. */
    var separacion = ultima ? 0 : 1.75 + (vertical ? 0.12 : 0) + (i % 3) * 0.18;
    var y = ultima ? 0.35 : (i % 4) * 0.17 - 0.18;
    nodo.position.set(
      pos.x + Math.cos(th) * lado * separacion,
      y,
      pos.z - Math.sin(th) * lado * separacion
    );
    // mira hacia el pasillo, con una torcedura mínima: están colgadas a mano.
    // la última cuelga cruzada en el eje y te mira de frente.
    nodo.rotation.y = ultima ? th + Math.PI : th - lado * Math.PI / 2 + (i % 5 - 2) * 0.014;

    var plano = guardar(new THREE.PlaneGeometry(ancho, alto));
    var mat = guardar(new THREE.MeshBasicMaterial({
      color: HUECO, transparent: true, opacity: 1, side: THREE.DoubleSide
    }));
    var tela = new THREE.Mesh(plano, mat);
    nodo.add(tela);

    var marco = new THREE.LineSegments(
      guardar(new THREE.EdgesGeometry(plano)),
      guardar(new THREE.LineBasicMaterial({ color: TINTA, transparent: true, opacity: 0.32 }))
    );
    marco.position.z = 0.004;
    nodo.add(marco);

    // el tiento del que cuelga, hasta la estructura
    var hilo = guardar(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, alto / 2, 0),
      new THREE.Vector3(0, TECHO - y, 0)
    ]));
    nodo.add(new THREE.LineSegments(
      hilo,
      guardar(new THREE.LineBasicMaterial({ color: TINTA, transparent: true, opacity: 0.2 }))
    ));

    nodo.userData = {
      i: i, s: s, datos: datos, tela: tela, mat: mat, marco: marco.material,
      avance: 0, objetivo: 0, pedida: false, entrada: 0
    };
    tela.userData.obra = nodo;
    tocables.push(tela);
    scene.add(nodo);
    return nodo;
  }

  /* dos líneas siguiendo el arco: el piso y la estructura de donde cuelga todo */
  function crearGuias() {
    [PISO, TECHO].forEach(function (y, k) {
      var pts = [], v = new THREE.Vector3();
      for (var s = 0; s <= LARGO; s += 1.5) {
        enArco(s, v);
        pts.push(new THREE.Vector3(v.x, y, v.z));
      }
      var g = guardar(new THREE.BufferGeometry().setFromPoints(pts));
      scene.add(new THREE.Line(g, guardar(new THREE.LineBasicMaterial({
        color: TINTA, transparent: true, opacity: k ? 0.24 : 0.34
      }))));
    });
  }

  /* Las fotos entran en fila, no todas juntas.
     Antes se pedían las siete que estuvieran a menos de CERCA y el
     navegador decodificaba siete JPEG de 1280 px en el hilo principal:
     eso era el tirón que se sentía al caminar el pasillo. Ahora se
     encolan y se atienden de a dos, siempre la más cercana primero. */
  function pedirTextura(nodo) {
    var u = nodo.userData;
    if (u.pedida) return;
    u.pedida = true;
    cola.push(nodo);
  }

  function atenderCola() {
    while (cargando < A_LA_VEZ && cola.length) {
      var mejor = 0;
      for (var i = 1; i < cola.length; i++) {
        if (Math.abs(cola[i].userData.s - estado.s) <
            Math.abs(cola[mejor].userData.s - estado.s)) mejor = i;
      }
      cargando++;
      cargar(cola.splice(mejor, 1)[0]);
    }
  }

  function cargar(nodo) {
    var u = nodo.userData;
    cargador.load(RUTA + u.datos.f, function (tex) {
      cargando--;
      if (!renderer) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      guardar(tex);
      u.mat.map = tex;
      u.mat.color.setHex(0xffffff);
      u.mat.needsUpdate = true;
      u.entrada = 0.001;               // arranca el fundido de entrada
    }, undefined, function () {
      cargando--;                      // si falla, la fila tiene que seguir
    });
  }

  function medir() {
    if (!contenedor || !renderer) return;
    var an = contenedor.clientWidth || window.innerWidth;
    var al = contenedor.clientHeight || window.innerHeight;
    if (!an || !al) return;
    camera.aspect = an / al;
    camera.fov = an < 900 ? 66 : 56;
    camera.updateProjectionMatrix();
    renderer.setSize(an, al, false);
    pintar(0);
  }

  var _p = new THREE.Vector3 ? new THREE.Vector3() : null;
  var _q = null;

  function pintar(dt) {
    if (!renderer) return;
    var s = estado.s;

    // cámara sobre el arco, mirando hacia adelante
    var th = enArco(s, _p);
    camera.position.set(_p.x, 0.25, _p.z);
    enArco(s + 3, _q);
    camera.lookAt(_q.x, 0.18, _q.z);
    // el mouse deja mirar un poco alrededor, sin perder el eje
    camera.rotateY(estado.objX);
    camera.rotateX(estado.objY);

    var cambio = -1, mejor = 1e9;

    for (var i = 0; i < obras.length; i++) {
      var u = obras[i].userData;
      var d = u.s - s;

      if (Math.abs(d) < CERCA) pedirTextura(obras[i]);

      if (u.entrada > 0 && u.entrada < 1) {
        u.entrada = Math.min(1, u.entrada + dt * 1.6);
      }

      // acercarse cuando el puntero está encima: la obra sale a recibirte
      u.objetivo = estado.sobre === i ? 1 : 0;
      u.avance += (u.objetivo - u.avance) * Math.min(1, dt * 9);
      if (Math.abs(u.avance - u.objetivo) < 0.002) u.avance = u.objetivo;
      u.tela.position.z = u.avance * 0.34;
      u.marco.opacity = 0.3 + u.avance * 0.55;
      u.mat.opacity = u.mat.map ? (0.14 + u.entrada * 0.86) : 1;

      // el cartel nombra la obra a la que te estás acercando, no la que dejaste
      if (d > -0.5 && d < mejor) { mejor = d; cambio = i; }
    }

    if (cambio !== -1 && cambio !== estado.actual) {
      estado.actual = cambio;
      if (api.alCambiar) api.alCambiar(cambio, obras[cambio].userData.datos, OBRAS.length);
    }

    /* el último tramo se llena de cal: la niebla se cierra encima tuyo y
       el pasillo se disuelve en el mismo blanco que tiene la página, así
       la salida hacia la sección siguiente no es un corte */
    // el cierre arranca más tarde: antes la última obra se lavaba entera y
    // el recorrido terminaba en una foto blanqueada, que parece un error
    var salida = s > LARGO * 0.95 ? clamp(0, 1, (s / LARGO - 0.95) / 0.05) : 0;
    /* El cierre es una neblina, no un blanqueo. Cerrando hasta 0,4/4,5 la
       última obra —que te queda enfrente— se iba a blanco y el recorrido
       terminaba en una mancha: parecía un error de render, no un final. */
    scene.fog.near = NIEBLA[0] - salida * (NIEBLA[0] - 4.5);
    scene.fog.far = NIEBLA[1] - salida * (NIEBLA[1] - 17);

    atenderCola();
    renderer.render(scene, camera);
  }

  function revisarPuntero() {
    if (!rayo || estado.s <= 0) return;
    rayo.setFromCamera(ndc, camera);
    var hit = rayo.intersectObjects(tocables, false);
    var nuevo = hit.length ? hit[0].object.userData.obra.userData.i : -1;
    if (nuevo !== estado.sobre) {
      estado.sobre = nuevo;
      lienzo.style.cursor = nuevo === -1 ? "" : "pointer";
    }
  }

  function bucle(ahora) {
    pedido = null;
    if (!visible || document.hidden) return;
    var dt = ultimo ? Math.min((ahora - ultimo) / 1000, 1 / 30) : 1 / 60;
    ultimo = ahora;

    // suavizado por tiempo, no por cuadro: en una pantalla de 120 Hz un
    // 0,055 por cuadro hace que la cámara gire al doble de velocidad
    var k = 1 - Math.pow(0.033, dt);
    estado.objX += (estado.ratonX - estado.objX) * k;
    estado.objY += (estado.ratonY - estado.objY) * k;

    // 29 planos por cuadro no hacen falta si ni el puntero ni vos se movieron
    if (punteroSucio || estado.s !== ultimoS) {
      punteroSucio = false;
      ultimoS = estado.s;
      revisarPuntero();
    }
    pintar(dt);
    pedido = requestAnimationFrame(bucle);
  }

  function despertar() {
    if (pedido === null && visible && !document.hidden) {
      ultimo = 0;
      pedido = requestAnimationFrame(bucle);
    }
  }

  function alMover(e) {
    if (!visible) return;
    var r = lienzo.getBoundingClientRect();
    estado.ratonX = -((e.clientX - r.left) / r.width - 0.5) * 0.30;
    estado.ratonY = -((e.clientY - r.top) / r.height - 0.5) * 0.16;
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    punteroSucio = true;
    despertar();
  }

  function alClic() {
    if (estado.sobre === -1 || !api.alClic) return;
    api.alClic(obras[estado.sobre].userData.datos, RUTA);
  }

  function init(canvas) {
    if (!canvas || !haySoporte()) return false;
    lienzo = canvas;
    contenedor = canvas.parentElement;

    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (e) { return false; }
    // 1,6 en vez de 1,9: sobre foto no se nota y son un 30 % menos de
    // píxeles por cuadro, que es lo que cuesta una pantalla llena de niebla
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(FONDO, 1);

    scene = new THREE.Scene();
    // las obras se materializan desde la cal a medida que te acercás:
    // un cubo blanco sin paredes, que es lo que es una sala de exposición
    scene.fog = new THREE.Fog(FONDO, NIEBLA[0], NIEBLA[1]);
    camera = new THREE.PerspectiveCamera(56, 1, 0.1, 90);

    cargador = new THREE.TextureLoader();
    _p = new THREE.Vector3();
    _q = new THREE.Vector3();
    rayo = new THREE.Raycaster();
    ndc = new THREE.Vector2(2, 2);   // fuera de pantalla hasta que se mueva

    crearGuias();
    OBRAS.forEach(function (d, i) { obras.push(crearObra(d, i)); });

    medir();

    if (window.ResizeObserver) { ro = new ResizeObserver(medir); ro.observe(contenedor); }
    else window.addEventListener("resize", medir);

    io = new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      if (visible) despertar(); else estado.sobre = -1;
    }, { threshold: 0 });
    io.observe(contenedor);

    document.addEventListener("visibilitychange", despertar);
    if (!window.matchMedia("(pointer: coarse)").matches) {
      canvas.addEventListener("pointermove", alMover, { passive: true });
      canvas.addEventListener("click", alClic);
    }

    canvas.classList.add("listo");
    return true;
  }

  function progreso(p) {
    if (!renderer) return;
    estado.s = clamp(0, 1, p) * LARGO;
    despertar();
  }

  /* Fuerza un cuadro. Igual que en redondel.js y ruedo.js: es para la captura
     de desarrollo, porque con la pestaña oculta no hay rAF y el bucle no
     avanza. `esperar` da tiempo a que entren las texturas de la cola. */
  function paso() { if (renderer) { atenderCola(); pintar(1 / 60); } }

  function destruir() {
    if (pedido) cancelAnimationFrame(pedido);
    pedido = null;
    if (ro) ro.disconnect();
    if (io) io.disconnect();
    if (lienzo) {
      lienzo.removeEventListener("pointermove", alMover);
      lienzo.removeEventListener("click", alClic);
    }
    window.removeEventListener("resize", medir);
    document.removeEventListener("visibilitychange", despertar);
    descartables.forEach(function (d) { if (d && d.dispose) d.dispose(); });
    descartables.length = 0;
    if (renderer) { renderer.dispose(); renderer = null; }
    obras.length = 0; tocables.length = 0; cola.length = 0; cargando = 0;
  }

  return {
    init: init, progreso: progreso, paso: paso, destruir: destruir,
    obras: OBRAS, ruta: RUTA,
    set alClic(f) { api.alClic = f; },
    /* init() ya pintó un cuadro antes de que el cartel existiera y dejó
       anotada la obra 0 como "la actual": sin este reset el cartel arranca
       vacío y no dice nada hasta que llegás a la segunda obra */
    set alCambiar(f) { api.alCambiar = f; estado.actual = -1; }
  };
})();
