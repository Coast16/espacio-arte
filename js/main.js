/* ═══════════════════════════════════════════════════════════
   Espacio Arte — motor de scroll y movimiento
   Un solo motor de scroll suave (Lenis) + GSAP ScrollTrigger.
   Nunca agregar un segundo motor: se pelean entre ellos.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var punteroFino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var mmChico = window.matchMedia("(max-width: 767px)");
  var esChico = mmChico.matches;
  var hayGsap = !!(window.gsap && window.ScrollTrigger);
  var clamp = function (min, max, v) { return v < min ? min : v > max ? max : v; };

  if (hayGsap) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: "power3.out", duration: 0.85 });
  }

  /* ── el círculo de progreso: la planta del redondel ── */
  var relleno = document.getElementById("ruedoFill");
  function progresoPagina() {
    var alto = document.documentElement.scrollHeight - window.innerHeight;
    var p = alto > 0 ? (window.scrollY / alto) * 100 : 0;
    relleno.style.setProperty("--p", clamp(0, 100, p).toFixed(1));
  }
  /* la barra es fija y cruza tramos claros y oscuros: se da vuelta sola.
     Se resuelve leyendo posiciones, no contando entradas y salidas: dos
     bloques oscuros pegados dejarían un cuadro en blanco entre medio. */
  var barra = document.querySelector(".barra");
  var oscuros = Array.prototype.slice.call(document.querySelectorAll(
    ".invertido:not(.umbral):not(.visor)"));
  function barraSegunFondo() {
    if (!barra) return;
    // se mide contra el pie de la barra, no contra su medio: la barra pinta
    // su propio fondo, así que conviene que se dé vuelta apenas el bloque
    // oscuro le toca el borde de abajo
    var y = 60;
    var dentro = false;
    for (var i = 0; i < oscuros.length; i++) {
      var r = oscuros[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { dentro = true; break; }
    }
    barra.classList.toggle("en-oscuro", dentro);
  }

  window.addEventListener("scroll", function () {
    progresoPagina();
    barraSegunFondo();
  }, { passive: true });
  window.addEventListener("resize", function () { progresoPagina(); barraSegunFondo(); });
  progresoPagina();
  barraSegunFondo();

  /* ── scroll suave ── */
  var lenis = null;
  var Ctor = window.Lenis && (window.Lenis.default || window.Lenis);
  if (!menosMovimiento && hayGsap && typeof Ctor === "function") {
    lenis = new Ctor({ lerp: 0.085, wheelMultiplier: 0.9, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    // Lenis maneja el scroll: window.scrollTo() no le avisa y las escenas
    // quedan desincronizadas. Para saltar a un punto, usá window.lenis.scrollTo().
    window.lenis = lenis;
  }

  /* ── navegación interna (funciona con y sin Lenis) ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var destino = document.querySelector(a.getAttribute("href"));
      if (!destino) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(destino, { offset: -20 });
      else destino.scrollIntoView({ behavior: menosMovimiento ? "auto" : "smooth" });
    });
  });

  /* ═══════ 00 · EL UMBRAL ═══════
     La página entra por una cuenta: 1910, el año que se inauguró la
     plaza, hasta 2021, el año que volvió a abrir. Después las dos
     hojas se abren y adentro el volumen ya está armado.
     Dura 1,85 s. Se saltea si venís con ancla o con la página scrolleada. */
  var umbral = document.getElementById("umbral");

  function abrirUmbral(alTerminar) {
    var saltar = !umbral || !hayGsap || menosMovimiento ||
                 window.scrollY > 12 || (location.hash && location.hash.length > 1);
    if (saltar) {
      if (umbral) umbral.classList.add("fuera");
      alTerminar();
      return;
    }

    var anio = document.getElementById("umbralAnio");
    var rielU = document.getElementById("umbralRiel");
    var caja = { v: 1910 };
    var cerrado = false;

    function cerrar() {
      if (cerrado) return;
      cerrado = true;
      umbral.classList.add("fuera");
      document.documentElement.style.overflow = "";
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
      alTerminar();
    }

    document.documentElement.style.overflow = "hidden";
    if (lenis) lenis.stop();
    // red de seguridad: pase lo que pase, a los 2,6 s la página está libre
    setTimeout(cerrar, 2600);

    gsap.timeline({ onComplete: cerrar })
      .to(rielU, { width: "100%", duration: 0.95, ease: "power2.inOut" }, 0)
      .to(caja, {
        v: 2021, duration: 0.95, ease: "power2.inOut",
        onUpdate: function () { anio.textContent = String(Math.round(caja.v)); }
      }, 0)
      .to(".umbral-centro", { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, 0.95)
      .to(".umbral-arriba", { yPercent: -100, duration: 0.82, ease: "expo.inOut" }, 1.03)
      .to(".umbral-abajo", { yPercent: 100, duration: 0.82, ease: "expo.inOut" }, 1.03);
  }

  /* ═══════ el volumen de la portada ═══════ */
  var lienzo = document.getElementById("lienzo");
  var hay3d = false;

  /* Función y no una sola línea: el módulo puede llegar tarde (ver el evento
     "3d-listo" más abajo) y entonces hay que poder prenderlo de nuevo. */
  function encenderPortada() {
    if (hay3d || !lienzo || !window.Redondel || menosMovimiento) return false;
    hay3d = window.Redondel.init(lienzo);
    return hay3d;
  }
  encenderPortada();

  // el volumen se arma mientras se abren las hojas, no después
  abrirUmbral(function () { if (hay3d) window.Redondel.entrar(); });

  /* ═══════ 02 · la marca de la Plaza, girando al costado ═══════
     Solo en pantalla grande y con movimiento permitido: es una firma, no
     información, y no vale un tercer contexto WebGL en un teléfono.

     Se prende cuando la ventana da el ancho, no solo al cargar. Antes era una
     sola comprobación al arrancar: si la página cargaba en una ventana angosta
     —una pestaña de fondo, una ventana chica que después agrandás— el 3D no se
     creaba nunca y ya no había forma de que apareciera. La portada sí se veía,
     porque no mira el ancho. Ese era exactamente el síntoma: hero sí, marca y
     pasillo no. */
  var lienzoRuedo = document.getElementById("ruedo");
  var hayRuedo = false;
  var anchaParaMarca = window.matchMedia("(min-width: 900px)");

  function encenderMarca() {
    if (hayRuedo || !lienzoRuedo) return;
    if (menosMovimiento || !anchaParaMarca.matches) return;
    /* El módulo puede no estar todavía (ventana que arrancó angosta) o no
       llegar nunca (CDN caída). En los dos casos hay que mostrar el plano:
       de 900 px para arriba el CSS lo esconde esperando al canvas, así que
       sin esto la columna de la marca queda como un hueco vacío. */
    if (!window.Ruedo) { lienzoRuedo.parentNode.classList.add("sin3d"); return; }
    hayRuedo = window.Ruedo.init(lienzoRuedo);
    // sin WebGL vuelve el archivo plano: el CSS lo esconde salvo con .sin3d
    lienzoRuedo.parentNode.classList.toggle("sin3d", !hayRuedo);
  }
  encenderMarca();
  if (anchaParaMarca.addEventListener) {
    anchaParaMarca.addEventListener("change", encenderMarca);
  } else if (anchaParaMarca.addListener) {
    anchaParaMarca.addListener(encenderMarca);   // Safari viejo
  }

  /* ═══════ 05 · la sala caminada ═══════
     Se prende solo en pantalla grande, con WebGL y sin movimiento reducido.
     En cualquier otro caso queda la grilla, que es lo que hay en el HTML.
     El init vive adentro del matchMedia de GSAP (más abajo), que vuelve a
     correr si la ventana cruza el corte. */
  var seccionSala = document.querySelector(".recorrido");
  var lienzoSala = document.getElementById("sala");
  var haySala = false;
  var anchaParaSala = window.matchMedia("(min-width: 768px)");

  var scrubSala = null;

  function encenderSala() {
    if (haySala) return true;
    if (!seccionSala || !lienzoSala || !window.Recorrido) return false;
    if (menosMovimiento || !anchaParaSala.matches) return false;

    haySala = window.Recorrido.init(lienzoSala);
    if (!haySala) return false;

    seccionSala.classList.add("hay3d");
    // el paseo mide según cuántas obras cuelgan: si no, sumar fotos lo acelera
    seccionSala.style.setProperty("--obras", String(window.Recorrido.obras.length));
    armarHud();
    apagarLuzEnSala();
    guiarUnaVez();

    /* 05 · el recorrido — el scroll te camina por la sala.
       Va contra un objeto intermedio para que el scrub suavice de verdad:
       un ScrollTrigger pelado no interpola su propio progress. */
    var paso = { p: 0 };
    scrubSala = gsap.to(paso, {
      p: 1, ease: "none",
      scrollTrigger: {
        trigger: seccionSala, start: "top top", end: "bottom bottom", scrub: 0.7
      },
      onUpdate: function () { window.Recorrido.progreso(paso.p); }
    });
    ScrollTrigger.refresh();
    return true;
  }

  /* El 3D puede llegar tarde. Si la ventana arrancó angosta, Three.js y los
     tres módulos ni se descargaron; cuando se agranda, el bloque de <script>
     del final del HTML los pide y avisa por acá.

     Sin esto, agrandar la ventana dejaba la versión de escritorio sin ninguna
     de sus tres escenas y sin forma de recuperarlas salvo recargando: la
     portada mostraba el póster plano encima del título y el hueco de la marca
     quedaba vacío, porque de 900 px para arriba el respaldo plano está
     escondido esperando al canvas. */
  document.addEventListener("3d-listo", function () {
    if (encenderPortada()) window.Redondel.entrar();
    encenderMarca();
    // el pasillo se arma con una timeline: sin GSAP no hay nada que prender
    if (!hayGsap) return;
    encenderSala();
    engancharRecorrido();
    ScrollTrigger.refresh();
  });

  /* ── la grilla de obras: cada foto entra cuando está lista ──
     Es la vista principal en celular. Va ANTES del corte por GSAP: el CSS
     las arranca en opacidad 0, así que si esto no corriera quedarían las 29
     invisibles para siempre. Si ya está en caché se marca directo, sin
     fundido, para no parpadear al volver a la página. */
  (function suavizarFotos() {
    var fotos = document.querySelectorAll(".sala-obra img");
    Array.prototype.forEach.call(fotos, function (img) {
      if (img.complete && img.naturalWidth) { img.classList.add("cargada"); return; }
      var lista = function () { img.classList.add("cargada"); };
      img.addEventListener("load", lista, { once: true });
      img.addEventListener("error", lista, { once: true });   // rota, pero visible
    });
  })();

  /* Las tres piezas de celular van ANTES del corte por GSAP: ninguna lo
     necesita —el riel scrollea con el navegador y el índice es una clase—
     y si quedaran del otro lado, una caída de la CDN dejaría el botón del
     índice puesto en pantalla pero muerto al tacto. */
  barraQueSeAparta();
  armarIndice();
  armarPasillo();

  /* ── la gota de tinta: el cursor de escritorio (js/tinta.js) ──
     No depende de GSAP, pero sí del puntero: en el teléfono no hay mano
     que seguir y el lienzo ni se prende. Adentro de la sala se encoge,
     por la misma razón por la que se apaga la luz.
     La variable se declara ACÁ y no más abajo: un `var x = false` que
     quede después de la llamada la vuelve a poner en false al pasar. */
  var hayTinta = false;
  function encenderTinta() {
    var lienzoTinta = document.getElementById("tinta");
    if (!lienzoTinta || menosMovimiento || !punteroFino || !window.Tinta) return;
    hayTinta = window.Tinta.init(lienzoTinta);
  }
  encenderTinta();

  /* ═══════ sin GSAP no hay show, pero la página se lee igual ═══════ */
  if (!hayGsap) return;

  /* ── revelado de texto por línea ──
     En escritorio los títulos de sección van ATADOS al scroll: cada palabra
     sube dentro de la máscara de su línea a medida que bajás, y si volvés
     para arriba vuelve a esconderse. La portada queda como estaba (entra
     una vez, con el umbral: todavía no hay scroll) y el celular también. */
  function revelarTitulos() {
    gsap.utils.toArray("[data-lineas]").forEach(function (bloque) {
      var lineas = bloque.querySelectorAll(".ln");
      if (!lineas.length) return;
      if (menosMovimiento) { gsap.set(lineas, { yPercent: 0, autoAlpha: 1 }); return; }

      var atado = !mmChico.matches && !bloque.closest(".portada");
      if (!atado) {
        gsap.from(lineas, {
          yPercent: 108, duration: 1.05, ease: "power4.out", stagger: 0.11,
          scrollTrigger: { trigger: bloque, start: "top 86%", once: true }
        });
        return;
      }
      var palabras = [];
      lineas.forEach(function (ln) { palabras = palabras.concat(envolverPalabras(ln, "lt")); });
      if (!palabras.length) return;
      /* La rotación arranca desde la esquina de abajo a la izquierda: la
         palabra "cae" en su lugar en vez de subir como un ascensor. */
      gsap.fromTo(palabras,
        { yPercent: 112, rotate: 4 },
        {
          yPercent: 0, rotate: 0, ease: "none",
          stagger: { amount: 0.45 },
          scrollTrigger: { trigger: bloque, start: "top 92%", end: "top 46%", scrub: 0.55 }
        });
    });
  }

  /* ── revelados sueltos y en grupo ── */
  function revelarBloques() {
    if (menosMovimiento) return;

    gsap.utils.toArray("[data-revelar]").forEach(function (el) {
      gsap.from(el, {
        y: 30, autoAlpha: 0, duration: 0.95, ease: "power4.out",
        scrollTrigger: { trigger: el, start: "top 84%", once: true }
      });
    });

    gsap.utils.toArray("[data-revelar-grupo]").forEach(function (grupo) {
      if (!grupo.offsetParent) return;   // la grilla de respaldo está oculta
      /* En el teléfono la grilla es el riel del pasillo: su profundidad la
         pinta armarPasillo() cuadro a cuadro. Si además entrara por acá,
         los dos estarían escribiendo el mismo transform. */
      if (mmChico.matches && grupo.classList.contains("sala-grilla")) return;
      gsap.from(grupo.querySelectorAll("[data-revelar-item]"), {
        y: 26, autoAlpha: 0, duration: 0.9, ease: "power4.out", stagger: 0.06,
        scrollTrigger: { trigger: grupo, start: "top 84%", once: true }
      });
    });
  }

  /* ── contadores de cifras ── */
  function contarCifras() {
    gsap.utils.toArray(".num").forEach(function (el) {
      var hasta = parseFloat(el.dataset.hasta);
      var plano = el.dataset.formato === "plano";
      if (menosMovimiento || !isFinite(hasta)) return;

      var caja = { v: 0 };
      /* En escritorio el número va con la mano: subís y cuenta, volvés y
         descuenta. En celular queda la cuenta de una vez. */
      var atada = !mmChico.matches;
      gsap.to(caja, {
        v: hasta,
        duration: 1.5,
        ease: atada ? "none" : "power2.out",
        scrollTrigger: atada
          ? { trigger: el, start: "top 94%", end: "top 56%", scrub: 0.5 }
          : { trigger: el, start: "top 92%", once: true },
        onUpdate: function () {
          var n = Math.round(caja.v);
          el.textContent = plano ? String(n) : n.toLocaleString("es-UY");
        }
      });
    });
  }

  /* ── el manifiesto se enciende palabra por palabra con el scroll ──
     Envolver por nodo de texto (no innerHTML) para no romper la cursiva
     ni los enlaces que aparezcan adentro. */
  function envolverPalabras(raiz, clase) {
    var textos = [], salida = [];
    clase = clase || "pl";
    (function recorrer(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) textos.push(c);
        else if (c.nodeType === 1) recorrer(c);
      }
    })(raiz);

    textos.forEach(function (nodo) {
      var frag = document.createDocumentFragment();
      nodo.nodeValue.split(/(\s+)/).forEach(function (parte) {
        if (!parte) return;
        if (/^\s+$/.test(parte)) { frag.appendChild(document.createTextNode(parte)); return; }
        var s = document.createElement("span");
        s.className = clase;
        s.textContent = parte;
        frag.appendChild(s);
        salida.push(s);
      });
      nodo.parentNode.replaceChild(frag, nodo);
    });
    return salida;
  }

  function encender(el, disparo, desde, hasta, reparto) {
    var palabras = envolverPalabras(el);
    if (!palabras.length) return;
    if (menosMovimiento) { gsap.set(palabras, { opacity: 1 }); return; }

    /* En escritorio cada palabra además sube un tercio de su alto al
       encenderse: el párrafo se asienta sobre la línea a medida que lo
       leés. En celular solo la opacidad, que es lo que ya andaba bien. */
    var sube = !mmChico.matches;
    gsap.fromTo(palabras,
      { opacity: sube ? 0.2 : undefined, y: sube ? "0.34em" : 0 },
      {
        opacity: 1, y: 0, ease: "none", duration: 0.35,
        stagger: { amount: reparto },
        scrollTrigger: { trigger: disparo || el, start: desde, end: hasta, scrub: 0.6 }
      });
  }

  function encenderTextos() {
    var cols = document.querySelector(".manifiesto-cols");
    if (cols) encender(cols, ".manifiesto", "top 62%", "bottom 78%", 1.1);
    // las declaraciones del lugar: cada una se enciende en su propio tramo
    gsap.utils.toArray("[data-encender]").forEach(function (el) {
      /* Termina de encenderse antes: con "bottom 40%" las últimas palabras
         se prendían muy tarde y, si parabas de scrollear a media lectura,
         parte del párrafo quedaba en gris claro. Así, cuando el bloque llega
         al centro de la pantalla ya está entero legible. */
      encender(el, null, "top 92%", "bottom 62%", 0.9);
    });
  }

  /* ── la regla de cada rótulo se dibuja de izquierda a derecha,
        y el rótulo se escribe detrás de ella (escritorio) ── */
  function dibujarReglas() {
    gsap.utils.toArray("[data-regla]").forEach(function (r) {
      if (menosMovimiento) { gsap.set(r, { scaleX: 1 }); return; }
      gsap.to(r, {
        scaleX: 1, ease: "none",
        scrollTrigger: { trigger: r, start: "top 97%", end: "top 64%", scrub: 0.5 }
      });
      var rotulo = r.parentNode && r.parentNode.querySelector(".eyebrow");
      if (!rotulo || mmChico.matches) return;
      gsap.fromTo(rotulo,
        { clipPath: "inset(0 100% 0 0)" },
        {
          clipPath: "inset(0 0% 0 0)", ease: "none",
          scrollTrigger: { trigger: r, start: "top 94%", end: "top 60%", scrub: 0.5 }
        });
    });
  }

  /* ── el índice del archivo: una ficha encendida por vez ──
     Con una clase por fila, no leyendo posiciones cada cuadro: son diez
     filas quietas y no hace falta gastar el bucle en ellas. */
  function enfocarFichas() {
    var fichas = gsap.utils.toArray("[data-ficha]");
    if (!fichas.length) return;
    if (menosMovimiento || esChico) {
      fichas.forEach(function (f) { f.classList.add("foco"); });
      return;
    }
    fichas.forEach(function (f) {
      ScrollTrigger.create({
        trigger: f, start: "top 74%", end: "bottom 44%",
        onEnter: function () { f.classList.add("visto"); },
        onToggle: function (self) { f.classList.toggle("foco", self.isActive); }
      });
    });
  }

  /* ── el archivo: diez paneles de alambre que se dibujan solos ── */
  function dibujarPlanos() {
    var svg = document.querySelector(".planos-svg");
    if (!svg || menosMovimiento) return;
    var trazos = svg.querySelectorAll("rect,circle");
    if (!trazos.length) return;
    // pathLength="1" en el SVG: el contorno mide 1 sea cual sea su tamaño
    gsap.fromTo(trazos,
      { strokeDasharray: 1, strokeDashoffset: 1 },
      {
        strokeDashoffset: 0, ease: "none",
        stagger: { amount: 0.8 },
        scrollTrigger: {
          trigger: ".archivo-planos",
          start: "top 90%", end: "bottom 66%", scrub: 0.6
        }
      });
  }

  /* ── la cinta de nombres: corre sola ──
     Solo se mueve mientras está en pantalla: es lo único que quedó
     escribiendo en cada cuadro y no tiene sentido que corra invisible. */
  var cintaEstado = { pos: 0, ancho: 0, riel: null, viva: false, empuje: 0, medidor: null };
  var BASE_CINTA = 30; // px por segundo
  var EMPUJE_CINTA = 24;  // px/s de cinta por cada px/cuadro de scroll

  function armarCinta() {
    var riel = document.getElementById("cintaRiel");
    if (!riel) return;
    var grupo = riel.firstElementChild;
    if (!grupo) return;
    if (menosMovimiento) return;

    // clonar hasta cubrir dos pantallas: el bucle no puede dejar hueco
    var ancho = grupo.getBoundingClientRect().width;
    if (!ancho) return;
    var copias = Math.max(2, Math.ceil((window.innerWidth * 2) / ancho) + 1);
    for (var i = 1; i < copias; i++) riel.appendChild(grupo.cloneNode(true));

    cintaEstado.riel = riel;
    cintaEstado.ancho = ancho;
    // getVelocity() es de cada trigger, no de la clase: se crea uno que
    // abarca toda la página solo para preguntarle a qué velocidad va el scroll
    cintaEstado.medidor = ScrollTrigger.create({ start: 0, end: "max" });

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) {
        cintaEstado.viva = e[0].isIntersecting;
      }, { threshold: 0 }).observe(riel.parentNode);
    } else {
      cintaEstado.viva = true;
    }
  }

  function tickerContinuo(tiempo, delta) {
    if (!cintaEstado.viva || !cintaEstado.ancho) return;
    var dt = Math.min(delta, 50) / 1000;
    /* La cinta acusa recibo del scroll: cuanto más rápido bajás, más
       rápido corre (y se inclina un poco, como si el aire la empujara).
       El empuje se suaviza para que el frenazo no la clave en seco. */
    // px por cuadro (a 60): ScrollTrigger la mide venga de la rueda, del
    // dedo o de un scrollTo; la de Lenis solo cuenta la rueda
    var vel = cintaEstado.medidor ? cintaEstado.medidor.getVelocity() / 60 : 0;
    cintaEstado.empuje += (vel - cintaEstado.empuje) * Math.min(1, dt * 9);
    var empuje = mmChico.matches ? 0 : cintaEstado.empuje;
    cintaEstado.pos -= (BASE_CINTA + Math.abs(empuje) * EMPUJE_CINTA) * dt;
    while (cintaEstado.pos <= -cintaEstado.ancho) cintaEstado.pos += cintaEstado.ancho;
    var inclina = clamp(-6, 6, -empuje * 0.18);
    cintaEstado.riel.style.transform = "translate3d(" + cintaEstado.pos.toFixed(2) + "px,0,0) skewX(" + inclina.toFixed(2) + "deg)";
  }

  /* ── la luz de sala: sigue al puntero, tenue ── */
  function encenderLuz() {
    var luz = document.getElementById("luz");
    if (!luz || menosMovimiento || !punteroFino) return;

    var dest = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var act = { x: dest.x, y: dest.y };
    var viva = false;

    window.addEventListener("pointermove", function (e) {
      dest.x = e.clientX; dest.y = e.clientY;
      if (!viva) { viva = true; act.x = dest.x; act.y = dest.y; luz.classList.add("viva"); }
    }, { passive: true });

    gsap.ticker.add(function () {
      if (!viva) return;
      act.x += (dest.x - act.x) * 0.1;
      act.y += (dest.y - act.y) * 0.1;
      luz.style.transform = "translate3d(" + act.x.toFixed(1) + "px," + act.y.toFixed(1) + "px,0)";
    });
  }

  /* ── el cartel del recorrido: qué muestra estás mirando ── */
  function armarHud() {
    var nombre = document.getElementById("salaMuestra");
    var nota = document.getElementById("salaNota");
    var num = document.getElementById("salaN");
    var tot = document.getElementById("salaTot");
    if (!nombre) return;
    var ponerNombre = hacerVolteador(nombre, 0.13, 0.3);

    window.Recorrido.alCambiar = function (i, d, total) {
      num.textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
      tot.textContent = String(total);
      ponerNombre(d.m);
      if (nota.textContent !== d.t) {
        nota.textContent = d.t;
        if (!menosMovimiento) {
          gsap.fromTo(nota, { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" });
        }
      }
    };
  }

  /* ── el visor: clic en una obra y se ve en grande ──
     Lo abre cualquiera: las obras del pasillo y la foto de la sala. Por eso
     `abrirVisor` queda afuera, en vez de estar atado al callback del 3D. */
  var abrirVisor = null;

  /* El pasillo 3D avisa por acá cuando tocás una obra. Va en una función
     suelta porque el módulo puede aparecer DESPUÉS del visor: si la ventana
     arrancó angosta, recorrido.js recién llega cuando se agranda. */
  function engancharRecorrido() {
    if (!window.Recorrido || !abrirVisor) return;
    window.Recorrido.alClic = function (d, ruta) {
      abrirVisor(ruta + d.f, d.m, d.t);
    };
    window.Recorrido.alSobre = function (si) { mira.poner(si, "Ver"); };
  }

  function armarVisor() {
    var visor = document.getElementById("visor");
    if (!visor) return;
    var img = document.getElementById("visorImg");
    var muestra = document.getElementById("visorMuestra");
    var nota = document.getElementById("visorNota");
    var cerrar = document.getElementById("visorCerrar");
    var antes = null;

    abrirVisor = function (ruta, titulo, pie, alt) {
      img.src = ruta;
      img.alt = alt || (titulo + " — " + String(pie).toLowerCase() + ".");
      muestra.textContent = titulo;
      nota.textContent = pie;
      visor.hidden = false;
      antes = document.activeElement;
      if (lenis) lenis.stop();
      document.documentElement.style.overflow = "hidden";
      cerrar.focus();
      if (menosMovimiento) return;
      gsap.fromTo(visor, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.26, ease: "power2.out" });
      gsap.fromTo(".visor-marco", { y: 20, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.55, ease: "expo.out" });
    };

    engancharRecorrido();

    function cerrarVisor() {
      if (visor.hidden) return;
      if (lenis) lenis.start();
      document.documentElement.style.overflow = "";
      var fin = function () {
        visor.hidden = true;
        gsap.set(visor, { clearProps: "opacity,visibility" });
        gsap.set(".visor-marco", { clearProps: "all" });
        img.removeAttribute("src");
        if (antes && antes.focus) antes.focus();
      };
      if (menosMovimiento) { fin(); return; }
      // entra subiendo: tiene que salir bajando. Antes entraba con recorrido
      // y se iba solo con opacidad, y el cierre quedaba sin peso.
      gsap.timeline({ onComplete: fin })
        .to(".visor-marco", { y: 12, autoAlpha: 0, duration: 0.22, ease: "power2.in" }, 0)
        .to(visor, { autoAlpha: 0, duration: 0.26, ease: "power2.in" }, 0);
    }

    cerrar.addEventListener("click", cerrarVisor);
    visor.addEventListener("click", function (e) { if (e.target === visor) cerrarVisor(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") cerrarVisor();
    });
  }

  /* ── voltear un texto: sale para arriba, entra desde abajo ──
     Con cola, no con candado: si llegan varios cambios seguidos tiene que
     terminar en el último, no quedarse en el primero que alcanzó a animar. */
  function hacerVolteador(el, salida, entrada) {
    var pendiente = null, giro = null;
    function correr() {
      if (pendiente === null || el.textContent === pendiente) { pendiente = null; return; }
      var n = pendiente;
      pendiente = null;
      giro = gsap.timeline({ onComplete: correr })
        .to(el, {
          yPercent: -110, duration: salida, ease: "power2.in",
          onComplete: function () { el.textContent = n; }
        })
        .fromTo(el, { yPercent: 110 }, { yPercent: 0, duration: entrada, ease: "power3.out" });
    }
    return function (n) {
      if (menosMovimiento) { el.textContent = n; return; }
      pendiente = n;
      if (!giro || !giro.isActive()) correr();
    };
  }

  /* ── la foto de la sala ──
     Dos cosas: se abre en el visor (la misma ventana que las obras del
     pasillo, así todas las fotos del sitio se agrandan igual) y adentro del
     marco se corre un poco con el puntero. Ese desfasaje entre la foto y su
     ventana es de dónde sale la sensación de capas. */
  /* ── ciento once años, contados con el scroll ──
     La foto de la sala se fue de esta sección y el silencio quedó a cargo
     del texto: entre las dos declaraciones, un año enorme corre de 1912
     (la última corrida) a 2021 (la reapertura) a medida que bajás, y una
     línea se dibuja debajo. Son los dos números que ya dice el texto,
     puestos a pasar: el siglo cerrado se ve pasar bajo la mano. */
  function contarAnios() {
    var caja = document.querySelector(".lugar-anios");
    var num = document.getElementById("lugarAnios");
    if (!caja || !num) return;
    var desde = parseInt(num.dataset.desde, 10), hasta = parseInt(num.dataset.hasta, 10);
    if (menosMovimiento || !isFinite(desde) || !isFinite(hasta)) { num.textContent = String(hasta); return; }
    var linea = caja.querySelector(".lugar-anios-linea");
    var est = { v: desde };
    var tl = gsap.timeline({
      scrollTrigger: { trigger: caja, start: "top 88%", end: "bottom 42%", scrub: 0.6 }
    });
    tl.to(est, {
      v: hasta, ease: "none", duration: 1,
      onUpdate: function () { num.textContent = String(Math.round(est.v)); }
    }, 0);
    if (linea) tl.fromTo(linea, { scaleX: 0 }, { scaleX: 1, ease: "none", duration: 1 }, 0);
    // el número entra desde abajo y se asienta: empieza tenue, termina en tinta
    tl.fromTo(num, { yPercent: 18, opacity: 0.25 }, { yPercent: 0, opacity: 1, ease: "none", duration: 1 }, 0);
  }

  /* ── la guía del recorrido se retira sola ── */
  function guiarUnaVez() {
    var guia = document.querySelector(".recorrido-guia");
    var canvas = document.getElementById("sala");
    if (!guia || !canvas) return;
    canvas.addEventListener("pointermove", function () {
      guia.classList.add("ida");
    }, { passive: true, once: true });
  }

  /* ── la linterna se apaga adentro del recorrido ── */
  function apagarLuzEnSala() {
    var luz = document.getElementById("luz");
    var sec = document.querySelector(".recorrido");
    if (!luz || !sec || !haySala) return;
    ScrollTrigger.create({
      trigger: sec, start: "top 65%", end: "bottom 35%",
      onToggle: function (self) { luz.classList.toggle("apagada", self.isActive); }
    });
  }

  /* ── el índice de escena en la barra ── */
  function marcarEscenas() {
    var indice = document.getElementById("indiceNum");
    if (!indice) return;
    var poner = hacerVolteador(indice, 0.16, 0.3);

    gsap.utils.toArray("[data-escena]").forEach(function (sec) {
      var n = sec.dataset.escena;
      ScrollTrigger.create({
        trigger: sec, start: "top 55%", end: "bottom 55%",
        onEnter: function () { poner(n); },
        onEnterBack: function () { poner(n); }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     CELULAR
     Tres piezas, y ninguna toca la versión de escritorio: la barra que se
     aparta, el índice, y el pasillo caminado con el dedo. Las tres miran
     el mismo media query, así que al girar el teléfono a un ancho grande
     se apagan solas.
     ═══════════════════════════════════════════════════════════════ */

  /* ── la barra se aparta al bajar y vuelve al subir ──
     La página mide nueve mil píxeles y la barra le pasaba por encima al
     texto todo el rato. El umbral de 9 px es para que el rebote del scroll
     no la haga titilar. */
  function barraQueSeAparta() {
    if (!barra || menosMovimiento) return;
    var ultimo = window.scrollY;

    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      var dy = y - ultimo;
      if (!mmChico.matches || barra.classList.contains("fija")) {
        barra.classList.remove("escondida");
        ultimo = y;
        return;
      }
      if (Math.abs(dy) < 9) return;
      barra.classList.toggle("escondida", dy > 0 && y > 150);
      ultimo = y;
    }, { passive: true });
  }

  /* ── el índice ── */
  function armarIndice() {
    var boton = document.getElementById("barraMenu");
    var hoja = document.getElementById("indice-hoja");
    if (!boton || !hoja || !barra) return;
    var abierto = false;
    var cierre = null;

    function abrir() {
      if (abierto) return;
      abierto = true;
      clearTimeout(cierre);
      hoja.hidden = false;
      boton.setAttribute("aria-expanded", "true");
      barra.classList.add("fija");
      barra.classList.remove("escondida");
      document.documentElement.style.overflow = "hidden";
      if (lenis) lenis.stop();
      /* Fundido de entrada. El reflow forzado es lo que hace que el
         navegador tome opacidad 0 como estado de partida; con
         requestAnimationFrame también anda, pero si la pestaña está en
         segundo plano el cuadro no llega y la hoja queda a medio abrir. */
      void hoja.offsetHeight;
      hoja.classList.add("abierta");
      // la hoja es un bloque oscuro a pantalla completa: la barra se da vuelta
      barraSegunFondo();
    }

    function cerrar() {
      if (!abierto) return;
      abierto = false;
      hoja.classList.remove("abierta");
      boton.setAttribute("aria-expanded", "false");
      barra.classList.remove("fija");
      document.documentElement.style.overflow = "";
      if (lenis) lenis.start();
      cierre = setTimeout(function () {
        if (abierto) return;
        hoja.hidden = true;
        barraSegunFondo();
      }, 300);
    }

    boton.addEventListener("click", function () {
      if (abierto) { cerrar(); boton.focus(); } else { abrir(); }
    });

    /* En CAPTURA, a propósito. El salto a un ancla lo maneja un listener
       puesto sobre cada <a> allá arriba, y ese correría ANTES que uno
       normal acá: le pediría el salto a Lenis mientras Lenis está parado
       por la hoja abierta, y el salto se pierde. Atajándolo en captura,
       primero se cierra —que es lo que vuelve a soltar el scroll— y recién
       después se pide el viaje. */
    hoja.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a");
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (href.charAt(0) !== "#") { cerrar(); return; }   // Instagram, entradas
      e.preventDefault();
      e.stopPropagation();
      var destino = document.querySelector(href);
      cerrar();
      if (!destino) return;
      requestAnimationFrame(function () {
        if (lenis) lenis.scrollTo(destino, { offset: -8 });
        else destino.scrollIntoView({ behavior: menosMovimiento ? "auto" : "smooth" });
      });
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && abierto) { cerrar(); boton.focus(); }
    });
    if (mmChico.addEventListener) {
      mmChico.addEventListener("change", function (e) { if (!e.matches) cerrar(); });
    }
  }

  /* ── el pasillo, caminado con el dedo ──
     Es la MISMA grilla de obras del HTML: el CSS la vuelve un riel
     horizontal imantado y esto le agrega la cuenta, el avance y la
     profundidad. El scroll lo hace el navegador, así que la inercia es la
     del sistema: no hay nada acá que pueda trabarse ni ir a destiempo. */
  function armarPasillo() {
    var riel = document.querySelector(".sala-grilla");
    var paso = document.querySelector(".sala-paso");
    if (!riel || !paso) return;

    var obras = Array.prototype.slice.call(riel.querySelectorAll(".sala-obra"));
    if (!obras.length) return;
    var numero = document.getElementById("salaPasoN");
    var total = document.getElementById("salaPasoTot");
    var avance = document.getElementById("salaPasoRiel");
    var dos = function (n) { return n < 10 ? "0" + n : String(n); };
    if (total) total.textContent = dos(obras.length);

    var pedido = false;
    var andando = false;
    var ultimoN = -1;
    var cerca = false;   // ¿el pasillo ya está por entrar en pantalla?

    function pintar() {
      pedido = false;
      if (!mmChico.matches) return;

      var caja = riel.getBoundingClientRect();
      var largo = riel.scrollWidth - riel.clientWidth;
      var p = largo > 8 ? riel.scrollLeft / largo : 0;
      if (avance) avance.style.transform = "scaleX(" + p.toFixed(4) + ")";

      // el ancla es el borde por donde imanta, no el centro
      var ancla = caja.left + 20;
      var actual = 0, dCerca = Infinity;

      for (var i = 0; i < obras.length; i++) {
        var o = obras[i];
        var r = o.getBoundingClientRect();
        var d = r.left - ancla;
        if (Math.abs(d) < dCerca) { dCerca = Math.abs(d); actual = i; }
        // lo que está lejos de la ventana no se toca: son 29 fotos
        if (r.right < caja.left - 40 || r.left > caja.right + 40) continue;
        if (menosMovimiento) continue;   // la profundidad es movimiento
        var k = Math.min(Math.abs(d) / (r.width || 1), 1);
        o.style.transform = "scale(" + (1 - k * 0.035).toFixed(4) + ")";
        o.style.opacity = (1 - k * 0.38).toFixed(3);
      }

      if (actual !== ultimoN) {
        ultimoN = actual;
        if (numero) numero.textContent = dos(actual + 1);
        adelantar(actual);
      }
    }

    /* Las 29 fotos van en lazy: bajarlas todas de una son 3,5 MB. Pero en un
       riel el lazy llega tarde —la foto empieza a pedirse recién cuando ya
       la estás mirando— y se camina contra tarjetas en blanco. Esto le saca
       el lazy a las cuatro que vienen: siempre hay cuatro pasos cargados
       adelante y nunca se piden las 29. */
    function adelantar(desde) {
      // hasta que el pasillo no esté cerca, ninguna: son 5.800 px más abajo
      if (!cerca) return;
      for (var j = desde; j < Math.min(desde + 4, obras.length); j++) {
        var im = obras[j].querySelector("img");
        if (im && im.getAttribute("loading") === "lazy") {
          im.setAttribute("loading", "eager");
        }
      }
    }

    function alRodar() {
      // si ya lo estás deslizando, claramente el pasillo está en pantalla:
      // esto es la red por si el observador no llegara a avisar
      cerca = true;
      if (!pedido) { pedido = true; requestAnimationFrame(pintar); }
      if (!andando && riel.scrollLeft > 6) {
        andando = true;
        paso.classList.add("andando");
      }
    }

    riel.addEventListener("scroll", alRodar, { passive: true });
    window.addEventListener("resize", function () {
      if (!mmChico.matches) {
        for (var i = 0; i < obras.length; i++) {
          obras[i].style.transform = "";
          obras[i].style.opacity = "";
        }
        return;
      }
      alRodar();
    });

    /* La obra se toca y se ve grande. La figure no es un botón, así que
       hay que decirle al teclado y al lector de pantalla que se puede. */
    function mirar(fig) {
      if (!abrirVisor) return;
      var img = fig.querySelector("img");
      if (!img) return;
      var b = fig.querySelector("b"), t = fig.querySelector("span");
      abrirVisor(img.currentSrc || img.src,
                 b ? b.textContent : "", t ? t.textContent : "", img.alt);
    }
    obras.forEach(function (fig) {
      var t = fig.querySelector("span");
      fig.setAttribute("role", "button");
      fig.setAttribute("tabindex", "0");
      fig.setAttribute("aria-label", "Ver en grande: " + (t ? t.textContent : "la obra"));
      fig.addEventListener("click", function () {
        if (mmChico.matches) mirar(fig);
      });
      fig.addEventListener("keydown", function (e) {
        if (!mmChico.matches) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); mirar(fig); }
      });
    });

    if ("IntersectionObserver" in window) {
      /* Las fotos se piden recién cuando el pasillo se está acercando. Sin
         esto, la carga inicial se llevaba medio mega en cuatro fotos que
         están a 5.800 px de donde arranca la página. */
      new IntersectionObserver(function (e, obs) {
        if (!e[0].isIntersecting) return;
        obs.disconnect();
        cerca = true;
        adelantar(ultimoN < 0 ? 0 : ultimoN);
      }, { rootMargin: "700px 0px" }).observe(riel);

      /* El primer empujón: al llegar el pasillo a la ventana el riel se
         corre un dedo solo. El imantado lo devuelve a su lugar sin que haya
         que animar nada a mano, y con eso ya se entiende que se desliza. */
      if (!menosMovimiento) {
        var mirando = new IntersectionObserver(function (e, obs) {
          if (!e[0].isIntersecting) return;
          obs.disconnect();
          if (!mmChico.matches || andando) return;
          setTimeout(function () {
            if (andando || !mmChico.matches) return;
            try { riel.scrollTo({ left: 38, behavior: "smooth" }); }
            catch (err) { riel.scrollLeft = 38; }
          }, 420);
        }, { threshold: 0.35 });
        mirando.observe(riel);
      }
    } else {
      cerca = true;
    }

    pintar();
    // las medidas cambian cuando terminan de cargar las fotos
    window.addEventListener("load", function () { requestAnimationFrame(pintar); });
  }

  /* ═══════ escenas que solo existen en pantalla grande ═══════ */
  var mm = gsap.matchMedia();

  mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", function () {

    /* 01 · portada — el scroll arma el volumen (el pin lo hace el CSS sticky) */
    /* El trigger se crea aunque el volumen todavía no esté: el guard va
       adentro del onUpdate. Si se creara solo cuando hay3d ya es true, un
       volumen que llega tarde —ventana que arrancó angosta— se quedaba sin
       nadie que lo moviera con el scroll. */
    var portada = document.querySelector(".portada");
    if (portada) {
      ScrollTrigger.create({
        trigger: portada,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        onUpdate: function (self) {
          if (hay3d) window.Redondel.progreso(self.progress);
        }
      });
    }

    /* 01b · el título se disuelve y deja el volumen solo en pantalla */
    /* el título se va temprano: el segundo tramo de la portada (la cámara
       entrando) tiene que quedar limpio, y ahora la sección mide 320vh */
    var disuelve = gsap.to([".portada-texto", ".sello", ".pista"], {
      yPercent: -9, autoAlpha: 0, scale: 0.95, ease: "none",
      scrollTrigger: { trigger: ".portada", start: "top top", end: "26% top", scrub: 0.8 }
    });

    // al salir de esta rama (por resize) hay que devolver todo a su lugar
    return function () {
      disuelve.scrollTrigger && disuelve.scrollTrigger.kill();
      gsap.set([".portada-texto", ".sello", ".pista"], { clearProps: "all" });
    };
  });


  /* 01 · en celular la portada es la planta del redondel, no el volumen:
     Three.js ni siquiera se descarga (ver el <script> del final del HTML).
     El scroll la agranda y la apaga mientras el título sube. Todo es
     transform y opacidad: nada que obligue al navegador a recalcular. */
  mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", function () {
    var linea = gsap.timeline({
      scrollTrigger: {
        trigger: ".portada", start: "top top", end: "bottom bottom", scrub: 0.6
      }
    });
    /* Orquestado, no todo junto: primero se va el texto y la marca queda
       sola un momento; después se agranda apenas y se apaga. Escalar la
       planta 1,6 la sacaba por el borde de arriba mientras el texto subía,
       y las dos cosas haciendo el mismo gesto a distinta velocidad se leían
       como un revoltijo. */
    linea.to(".pista", { autoAlpha: 0, ease: "none", duration: 0.12 }, 0)
         .to(".portada-texto", { yPercent: -16, autoAlpha: 0, ease: "none",
                                 duration: 0.62 }, 0)
         .to(".planta", { scale: 1.22, opacity: 0, ease: "none",
                          duration: 0.72 }, 0.28);

    return function () {
      linea.scrollTrigger && linea.scrollTrigger.kill();
      linea.kill();
      gsap.set([".portada-texto", ".planta", ".pista"], { clearProps: "all" });
    };
  });

  /* ── la firma del pie ──
     En escritorio, letra por letra y atada al scroll: termina de escribirse
     justo cuando la página llega al final. En celular sube de una vez. */
  function firmarPie() {
    var ln = document.querySelector(".pie-marca .ln");
    if (!ln || menosMovimiento) return;
    if (mmChico.matches) {
      gsap.from(ln, {
        yPercent: 105, duration: 1.25, ease: "expo.out",
        scrollTrigger: { trigger: ".pie", start: "top 94%", once: true }
      });
      return;
    }
    var letras = [];
    var texto = ln.textContent;
    ln.textContent = "";
    texto.split("").forEach(function (ch) {
      if (ch === " ") { ln.appendChild(document.createTextNode(" ")); return; }
      var e = document.createElement("span");
      e.className = "lt";
      e.textContent = ch;
      ln.appendChild(e);
      letras.push(e);
    });
    gsap.fromTo(letras,
      { yPercent: 110 },
      {
        yPercent: 0, ease: "none", stagger: { amount: 0.7 },
        scrollTrigger: { trigger: ".pie", start: "top 96%", end: "bottom bottom", scrub: 0.6 }
      });
  }

  /* ── la mira: el cursor ──
     Un anillo fino y un punto, en blanco por diferencia (tinta sobre cal,
     cal sobre tinta). El punto va pegado a la mano; el anillo llega un
     poco después. Sobre algo que se puede tocar, el anillo se abre y, si
     el elemento trae data-mira, dice qué pasa al tocar ("Ver"). Al
     apretar se cierra un poco. Cuando arranca, esconde la flecha del
     sistema (html.con-mira): dos cursores eran uno de más.
     Es DOM y no canvas porque el rótulo es texto de verdad. */
  var mira = { poner: function () {}, apretar: function () {} };
  function armarMira() {
    var caja = document.getElementById("mira");
    if (!caja || menosMovimiento || !punteroFino) return;
    var anillo = caja.querySelector(".mira-anillo");
    var punto = caja.querySelector(".mira-punto");
    var rotulo = caja.querySelector(".mira-rotulo");
    var moverAnillo = { x: gsap.quickTo(anillo, "x", { duration: 0.3, ease: "power3.out" }),
                        y: gsap.quickTo(anillo, "y", { duration: 0.3, ease: "power3.out" }) };
    var moverPunto = { x: gsap.quickTo(punto, "x", { duration: 0.1, ease: "power2.out" }),
                       y: gsap.quickTo(punto, "y", { duration: 0.1, ease: "power2.out" }) };
    var moverRotulo = { x: gsap.quickTo(rotulo, "x", { duration: 0.3, ease: "power3.out" }),
                        y: gsap.quickTo(rotulo, "y", { duration: 0.3, ease: "power3.out" }) };
    var viva = false;
    window.addEventListener("pointermove", function (e) {
      if (!viva) {
        viva = true;
        gsap.set([anillo, punto, rotulo], { x: e.clientX, y: e.clientY });
        document.documentElement.classList.add("con-mira");
      }
      moverAnillo.x(e.clientX); moverAnillo.y(e.clientY);
      moverPunto.x(e.clientX); moverPunto.y(e.clientY);
      moverRotulo.x(e.clientX); moverRotulo.y(e.clientY);
      caja.classList.add("viva");
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { caja.classList.remove("viva"); });

    var textoRotulo = rotulo.querySelector("i") || rotulo;
    mira.poner = function (activo, texto) {
      caja.classList.toggle("sobre", !!activo);
      if (activo && texto) textoRotulo.textContent = texto; // al soltar, el texto queda hasta que se apaga
      caja.classList.toggle("con-rotulo", !!(activo && texto));
    };
    mira.apretar = function (si) { caja.classList.toggle("apretada", !!si); };

    var TOCABLE = "a, button, [role=button], summary";
    var sobre = null;
    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest ? e.target.closest(TOCABLE) : null;
      if (t === sobre) return;
      sobre = t;
      mira.poner(!!t, t ? t.getAttribute("data-mira") : "");
    }, { passive: true });
    document.addEventListener("pointerdown", function () { mira.apretar(true); }, { passive: true });
    window.addEventListener("pointerup", function () { mira.apretar(false); }, { passive: true });
    window.addEventListener("pointercancel", function () { mira.apretar(false); }, { passive: true });
  }

  /* ── el campo de tinta: lo que está cerca de la mano se humedece ──
     Cada cuadro se mira qué bloques de texto partido (títulos .lt, párrafos
     .pl) están bajo la mano, y a sus palabras se les escribe --cerca de 0 a
     1 según la distancia. La sombra la pone el CSS. Primero se leen todas
     las medidas y después se escriben todos los estilos: mezclarlos obliga
     al navegador a recalcular el layout una vez por palabra. Los bloques se
     miden (8 rectángulos) antes que las palabras (cientos): la mayoría de
     los cuadros no hay ningún bloque cerca y no se toca nada. */
  function campoDeTinta() {
    if (menosMovimiento || !punteroFino || mmChico.matches) return;
    var RADIO = 110; // px alrededor de la mano
    var bloques = gsap.utils.toArray("[data-lineas], [data-encender], .manifiesto-cols, .pie-marca");
    var palabrasDe = bloques.map(function (b) { return Array.prototype.slice.call(b.querySelectorAll(".lt, .pl")); });
    if (!palabrasDe.some(function (l) { return l.length; })) return;
    var mano = { x: -1e4, y: -1e4 };
    window.addEventListener("pointermove", function (e) { mano.x = e.clientX; mano.y = e.clientY; }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { mano.x = mano.y = -1e4; });
    var mojadas = []; // las que tienen --cerca puesto, para secarlas
    gsap.ticker.add(function () {
      var cerca = [];
      for (var i = 0; i < bloques.length; i++) {
        var r = bloques[i].getBoundingClientRect();
        if (r.bottom < -RADIO || r.top > window.innerHeight + RADIO) continue; // fuera de pantalla
        if (mano.x < r.left - RADIO || mano.x > r.right + RADIO || mano.y < r.top - RADIO || mano.y > r.bottom + RADIO) continue;
        var lista = palabrasDe[i];
        for (var j = 0; j < lista.length; j++) {
          var q = lista[j].getBoundingClientRect();
          var dx = mano.x - (q.left + q.width / 2), dy = mano.y - (q.top + q.height / 2);
          var d = Math.hypot(dx, dy);
          if (d < RADIO) cerca.push({ el: lista[j], v: 1 - d / RADIO });
        }
      }
      // secar las que ya no están cerca
      for (var k = 0; k < mojadas.length; k++) {
        var m = mojadas[k], sigue = false;
        for (var n = 0; n < cerca.length; n++) if (cerca[n].el === m) { sigue = true; break; }
        if (!sigue) { m.classList.remove("cerca"); m.style.removeProperty("--cerca"); }
      }
      mojadas = [];
      for (var c = 0; c < cerca.length; c++) {
        var w = cerca[c];
        w.el.classList.add("cerca");
        w.el.style.setProperty("--cerca", (w.v * w.v).toFixed(3)); // al cuadrado: cae rápido lejos de la mano
        mojadas.push(w.el);
      }
    });
  }

  /* ── enlaces imantados ──
     Los enlaces de la barra y los datos se corren unos px hacia la mano
     cuando pasa cerca, y vuelven con un rebote corto al irse. Solo con
     puntero fino: en el dedo no hay "cerca". */
  function imantar() {
    if (menosMovimiento || !punteroFino) return;
    var IMAN = 7; // px de recorrido máximo
    gsap.utils.toArray(".barra-nav a, .barra .indice, .dato a, .visor-cerrar").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        gsap.to(el, { x: clamp(-1, 1, dx) * IMAN, y: clamp(-1, 1, dy) * IMAN * 0.6,
                      duration: 0.35, ease: "power3.out", overwrite: "auto" });
      }, { passive: true });
      el.addEventListener("pointerleave", function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.45)", overwrite: "auto" });
      }, { passive: true });
    });
  }

  /* ── la portada tiene fondo y frente ──
     El título se corre apenas contra la mano, al revés del volumen: dos
     planos a distinta distancia. Nada de esto toca .portada-texto, que ya
     lo maneja el scrub de salida; se mueven sus hijos. */
  function profundidadPortada() {
    if (menosMovimiento || !punteroFino || mmChico.matches) return;
    var capas = gsap.utils.toArray(".portada-texto > *");
    if (!capas.length) return;
    var HONDO = [4, 9, 6]; // px por capa: rótulo, título, bajada
    var meta = { x: 0, y: 0 }, act = { x: 0, y: 0 };
    window.addEventListener("pointermove", function (e) {
      meta.x = (e.clientX / window.innerWidth - 0.5) * -2;
      meta.y = (e.clientY / window.innerHeight - 0.5) * -2;
    }, { passive: true });
    gsap.ticker.add(function () {
      if (window.scrollY > window.innerHeight) return; // la portada ya se fue
      act.x += (meta.x - act.x) * 0.06;
      act.y += (meta.y - act.y) * 0.06;
      for (var i = 0; i < capas.length; i++) {
        var h = HONDO[i] || 5;
        capas[i].style.transform = "translate3d(" + (act.x * h).toFixed(2) + "px," + (act.y * h).toFixed(2) + "px,0)";
      }
    });
  }

  /* ═══════ revelados, índice y cinta ═══════
     Ya no queda ningún pin de GSAP en la página: la portada y el
     recorrido se sostienen con position:sticky del CSS, así que estos
     triggers miden sobre una página que no se va a estirar debajo. */
  armarVisor();
  contarAnios();
  revelarTitulos();
  revelarBloques();
  contarCifras();
  encenderTextos();
  dibujarReglas();
  enfocarFichas();
  encenderLuz();
  marcarEscenas();
  armarCinta();
  dibujarPlanos();
  gsap.ticker.add(tickerContinuo);

  // la marca grande del pie sube desde el borde
  firmarPie();

  // la mira acusa recibo de lo que se puede tocar, y los enlaces la imantan
  armarMira();
  imantar();
  campoDeTinta();
  profundidadPortada();

  /* Las escenas 3D se prenden al cargar Y al agrandar la ventana.
     Van por `resize` y no solo por el evento del media query, porque ese no
     llega en todos los casos (pestaña en segundo plano, ventana sin pintar).
     Las funciones se cortan solas si ya están prendidas, así que llamarlas
     de más no cuesta nada. */
  var reintento = null;
  window.addEventListener("resize", function () {
    if (hayRuedo && haySala) return;
    clearTimeout(reintento);
    reintento = setTimeout(function () { encenderMarca(); encenderSala(); }, 220);
  });
  encenderSala();

  /* las medidas cambian cuando terminan de cargar fuentes e imágenes */
  window.addEventListener("load", function () {
    encenderMarca(); encenderSala(); ScrollTrigger.refresh();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

  /* Al irse de la página se sueltan los tres contextos WebGL. Pero si la
     página va al bfcache (Atrás la trae viva, no la recarga) destruirlos
     deja los tres canvas en blanco al volver: no hay nada que los rearme. */
  window.addEventListener("pagehide", function (e) {
    if (e.persisted) return;
    if (window.Redondel) window.Redondel.destruir();
    if (window.Ruedo) window.Ruedo.destruir();
    if (window.Recorrido) window.Recorrido.destruir();
  });
})();
