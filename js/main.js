/* ═══════════════════════════════════════════════════════════
   Espacio Arte — motor de scroll y movimiento
   Un solo motor de scroll suave (Lenis) + GSAP ScrollTrigger.
   Nunca agregar un segundo motor: se pelean entre ellos.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var punteroFino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var esChico = window.matchMedia("(max-width: 767px)").matches;
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
  if (lienzo && window.Redondel && !menosMovimiento) {
    hay3d = window.Redondel.init(lienzo);
  }

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
    if (hayRuedo || !lienzoRuedo || !window.Ruedo) return;
    if (menosMovimiento || !anchaParaMarca.matches) return;
    hayRuedo = window.Ruedo.init(lienzoRuedo);
    // sin WebGL vuelve el archivo plano: el CSS lo esconde salvo con .sin3d
    if (!hayRuedo) lienzoRuedo.parentNode.classList.add("sin3d");
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

  /* ═══════ sin GSAP no hay show, pero la página se lee igual ═══════ */
  if (!hayGsap) return;

  /* ── revelado de texto por línea ── */
  function revelarTitulos() {
    gsap.utils.toArray("[data-lineas]").forEach(function (bloque) {
      var lineas = bloque.querySelectorAll(".ln");
      if (!lineas.length) return;
      if (menosMovimiento) { gsap.set(lineas, { yPercent: 0, autoAlpha: 1 }); return; }
      gsap.from(lineas, {
        yPercent: 108,
        duration: 1.05,
        ease: "power4.out",
        stagger: 0.11,
        scrollTrigger: { trigger: bloque, start: "top 86%", once: true }
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
      gsap.to(caja, {
        v: hasta,
        duration: 1.5,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
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
  function envolverPalabras(raiz) {
    var textos = [], salida = [];
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
        s.className = "pl";
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

    gsap.to(palabras, {
      opacity: 1, ease: "none", duration: 0.35,
      stagger: { amount: reparto },
      scrollTrigger: { trigger: disparo || el, start: desde, end: hasta, scrub: 0.6 }
    });
  }

  function encenderTextos() {
    var cols = document.querySelector(".manifiesto-cols");
    if (cols) encender(cols, ".manifiesto", "top 62%", "bottom 78%", 1.1);
    // las declaraciones del lugar: cada una se enciende en su propio tramo
    gsap.utils.toArray("[data-encender]").forEach(function (el) {
      encender(el, null, "top 90%", "bottom 40%", 0.9);
    });
  }

  /* ── la regla de cada rótulo se dibuja de izquierda a derecha ── */
  function dibujarReglas() {
    gsap.utils.toArray("[data-regla]").forEach(function (r) {
      if (menosMovimiento) { gsap.set(r, { scaleX: 1 }); return; }
      gsap.to(r, {
        scaleX: 1, ease: "none",
        scrollTrigger: { trigger: r, start: "top 97%", end: "top 64%", scrub: 0.5 }
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
  var cintaEstado = { pos: 0, ancho: 0, riel: null, viva: false };
  var BASE_CINTA = 30; // px por segundo

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
    cintaEstado.pos -= BASE_CINTA * dt;
    if (cintaEstado.pos <= -cintaEstado.ancho) cintaEstado.pos += cintaEstado.ancho;
    cintaEstado.riel.style.transform = "translate3d(" + cintaEstado.pos.toFixed(2) + "px,0,0)";
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

    if (window.Recorrido) {
      window.Recorrido.alClic = function (d, ruta) {
        abrirVisor(ruta + d.f, d.m, d.t);
      };
    }

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
  function mirarLaSala() {
    var boton = document.querySelector(".lugar-foto-abrir");
    if (!boton) return;
    var img = boton.querySelector("img");
    var marco = boton.querySelector(".lugar-foto-marco");
    var pie = document.querySelector(".lugar-foto figcaption");

    boton.addEventListener("click", function () {
      if (!abrirVisor) return;
      abrirVisor(img.currentSrc || img.src, "La sala",
        pie ? pie.textContent.trim() : "", img.alt);
    });

    if (menosMovimiento || !punteroFino) return;
    marco.addEventListener("pointermove", function (e) {
      var r = marco.getBoundingClientRect();
      // 2,4 % de recorrido: la foto entra con scale(1.06), así que nunca
      // se despega del borde por más que la lleves a la esquina
      img.style.setProperty("--dx", (((e.clientX - r.left) / r.width - 0.5) * -2.4).toFixed(2) + "%");
      img.style.setProperty("--dy", (((e.clientY - r.top) / r.height - 0.5) * -2.4).toFixed(2) + "%");
    }, { passive: true });
    marco.addEventListener("pointerleave", function () {
      img.style.setProperty("--dx", "0%");
      img.style.setProperty("--dy", "0%");
    }, { passive: true });
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

  /* ═══════ escenas que solo existen en pantalla grande ═══════ */
  var mm = gsap.matchMedia();

  mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", function () {

    /* 01 · portada — el scroll arma el volumen (el pin lo hace el CSS sticky) */
    var portada = document.querySelector(".portada");
    if (portada && hay3d) {
      ScrollTrigger.create({
        trigger: portada,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        onUpdate: function (self) { window.Redondel.progreso(self.progress); }
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


  /* en celular no hay scrub: el volumen se deja en una pose armada y quieto */
  mm.add("(max-width: 767px)", function () {
    if (hay3d) window.Redondel.progreso(0.3);
    return function () { if (hay3d) window.Redondel.progreso(0); };
  });

  /* ═══════ revelados, índice y cinta ═══════
     Ya no queda ningún pin de GSAP en la página: la portada y el
     recorrido se sostienen con position:sticky del CSS, así que estos
     triggers miden sobre una página que no se va a estirar debajo. */
  armarVisor();
  mirarLaSala();
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
  if (!menosMovimiento) {
    gsap.from(".pie-marca .ln", {
      yPercent: 105, duration: 1.25, ease: "expo.out",
      scrollTrigger: { trigger: ".pie", start: "top 94%", once: true }
    });
  }

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
