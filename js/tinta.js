/* ═══════════════════════════════════════════════════════════
   Espacio Arte — la hoja y el polvo
   Un lienzo WebGL fijo a pantalla completa que la página mezcla con
   mix-blend-mode:difference y que se pinta SIEMPRE en blanco: sobre la
   cal oscurece, sobre la tinta aclara, sobre una foto da vuelta. Dibuja
   dos cosas:

   1. LA HOJA: el grano, la sombra de los arcos que recorre la pared y la
      viñeta de los bordes. Un solo cuadrado de pantalla completa.
   2. EL POLVO: motas que la mano levanta al pasar. Se emiten por
      distancia recorrida (no por tiempo: un barrido rápido no deja
      huecos y una mano quieta no amontona), viven en una pila fija de
      puntos en la GPU y vuelan en el vertex shader. Es el mismo polvo
      que flota en el haz de luz de la portada (js/redondel.js): la mano
      lo levanta de la pared.

   El cursor propiamente dicho —la mira: un anillo y un punto— es DOM y
   vive en main.js (armarMira). Solo escritorio con puntero fino y sin
   "reducir movimiento".
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* Los números que mandan */
  var GRANO = 0.045;       // grano de la hoja: 0 lo apaga; arriba de .08 se ve sucio
  var LUZ = 0.05;          // la sombra de los arcos que recorre la cal: 0 la apaga
  var VINETA = 0.045;      // los bordes de la hoja, apenas más oscuros que el centro
  var PASO = 7;            // px de recorrido entre mota y mota
  var TOPE_CUADRO = 14;    // motas como mucho por cuadro: un salto de pestaña no vacía la pila
  var PILA = 420;          // motas vivas a la vez
  var VIDA = 1.3;          // s que dura cada mota
  var TAMANO = [1.1, 2.4]; // radio en px de pantalla, al azar entre estos
  var SUBE = 34;           // px/s que sube el polvo
  var DPR_MAX = 1.5;       // más que esto no se nota y cuesta el doble

  /* ── 1. la hoja ── */
  var VERT_HOJA = [
    "attribute vec2 position;",
    "void main(){ gl_Position = vec4(position, 0.0, 1.0); }"
  ].join("\n");

  var FRAG_HOJA = [
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uT;",       // segundos
    "uniform float uScroll;",  // scrollY en px del lienzo
    "uniform float uGrano;",
    "uniform float uCelda;",   // tamaño del grano en px del lienzo
    "uniform float uSemilla;",
    "uniform float uLuz;",
    "uniform float uVineta;",
    "float azar(vec2 p){",
    "  p = fract(p * vec2(123.34, 456.21));",
    "  p += dot(p, p + 45.32);",
    "  return fract(p.x * p.y);",
    "}",
    /* Una banda diagonal suave, de período `per`, corrida por `fase`.
       Dos de estas cruzadas, muy anchas y muy lentas, son la sombra que
       la estructura de arcos deja sobre la pared encalada cuando el sol
       se mueve. Con el scroll también se corren: la pared pasa. */
    "float haz(vec2 p, float ang, float per, float fase){",
    "  float u = dot(p, vec2(cos(ang), sin(ang))) / per;",
    "  return 0.5 + 0.5 * sin(6.2831 * (u + fase));",
    "}",
    "void main(){",
    "  vec2 p = gl_FragCoord.xy;",
    "  float grano = azar(floor(p / uCelda) + uSemilla) * uGrano;",
    "  float d = uRes.y;",                                   // todo en proporción al alto
    "  vec2 q = vec2(p.x, p.y + uScroll * 0.35);",           // la pared pasa a un tercio del scroll
    "  float luz = haz(q, -0.52, d * 1.15, uT * 0.006)  * 0.55",
    "            + haz(q, -0.31, d * 1.9,  -uT * 0.0037) * 0.45;",
    "  luz = smoothstep(0.42, 1.0, luz) * uLuz;",
    "  vec2 c = p / uRes - 0.5;",
    "  float vineta = smoothstep(0.30, 1.05, length(c * vec2(uRes.x / uRes.y, 1.0)) * 1.25) * uVineta;",
    "  float a = min(1.0, grano + luz + vineta);",
    "  gl_FragColor = vec4(a, a, a, a);", // premultiplicado: blanco con alfa
    "}"
  ].join("\n");

  /* ── 2. el polvo ──
     Cada mota es un punto con origen, velocidad, nacimiento y dos azares.
     La edad se calcula acá, en la GPU: la CPU solo escribe las que nacen. */
  var VERT_POLVO = [
    "attribute vec2 aOrigen;",     // px del lienzo, y hacia arriba
    "attribute vec2 aVel;",        // px/s
    "attribute float aNace;",      // s
    "attribute vec2 aAzar;",       // tamaño, fase
    "uniform vec2 uRes;",
    "uniform float uT;",
    "uniform float uVida;",
    "uniform float uSube;",
    "uniform float uDpr;",
    "varying float vAlfa;",
    "void main(){",
    "  float edad = uT - aNace;",
    "  float u = edad / uVida;",
    "  if (aNace < 0.0 || u < 0.0 || u > 1.0) {",   // muerta: afuera y sin tamaño
    "    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vAlfa = 0.0; return;",
    "  }",
    "  vec2 p = aOrigen + aVel * edad * (1.0 - 0.4 * u)",
    "         + vec2(sin(aAzar.y * 6.283 + edad * 2.4) * 9.0 * u * uDpr, uSube * edad * uDpr);",
    "  vec2 ndc = p / uRes * 2.0 - 1.0;",
    "  gl_Position = vec4(ndc, 0.0, 1.0);",
    "  gl_PointSize = aAzar.x * 2.0 * (1.0 - 0.35 * u) + 2.0;", // +2: borde suave
    "  vAlfa = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.38, 1.0, u));",
    "}"
  ].join("\n");

  var FRAG_POLVO = [
    "precision mediump float;",
    "varying float vAlfa;",
    "void main(){",
    "  float d = length(gl_PointCoord - 0.5) * 2.0;",
    "  float a = (1.0 - smoothstep(0.55, 1.0, d)) * vAlfa * 0.75;",
    "  gl_FragColor = vec4(a, a, a, a);",
    "}"
  ].join("\n");

  function compilar(gl, tipo, fuente) {
    var s = gl.createShader(tipo);
    gl.shaderSource(s, fuente);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }
  function programa(gl, vert, frag) {
    var vs = compilar(gl, gl.VERTEX_SHADER, vert);
    var fs = compilar(gl, gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    return prog;
  }

  function init(lienzo) {
    var gl = lienzo.getContext("webgl", {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: "high-performance"
    });
    if (!gl) return false;

    var hoja = programa(gl, VERT_HOJA, FRAG_HOJA);
    var polvo = programa(gl, VERT_POLVO, FRAG_POLVO);
    if (!hoja || !polvo) return false;

    /* la hoja: un cuadrado de dos triángulos */
    var bufHoja = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufHoja);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(hoja, "position");
    var uH = {};
    ["uRes", "uT", "uScroll", "uGrano", "uCelda", "uSemilla", "uLuz", "uVineta"].forEach(function (n) {
      uH[n] = gl.getUniformLocation(hoja, n);
    });
    gl.useProgram(hoja);
    gl.uniform1f(uH.uGrano, GRANO);
    gl.uniform1f(uH.uLuz, LUZ);
    gl.uniform1f(uH.uVineta, VINETA);

    /* el polvo: una pila fija; se sube entera solo cuando nació alguna */
    var origen = new Float32Array(PILA * 2);
    var vel = new Float32Array(PILA * 2);
    var nace = new Float32Array(PILA);
    var azar = new Float32Array(PILA * 2);
    for (var z = 0; z < PILA; z++) nace[z] = -1;
    var cabeza = 0, sucio = true, vivas = 0;
    function atributo(nombre, datos, n) {
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, datos, gl.DYNAMIC_DRAW);
      return { buf: b, loc: gl.getAttribLocation(polvo, nombre), n: n, datos: datos };
    }
    var atribs = [
      atributo("aOrigen", origen, 2), atributo("aVel", vel, 2),
      atributo("aNace", nace, 1), atributo("aAzar", azar, 2)
    ];
    var uP = {};
    ["uRes", "uT", "uVida", "uSube", "uDpr"].forEach(function (n) { uP[n] = gl.getUniformLocation(polvo, n); });
    gl.useProgram(polvo);
    gl.uniform1f(uP.uVida, VIDA);
    gl.uniform1f(uP.uSube, SUBE);

    gl.clearColor(0, 0, 0, 0);

    var dpr = 1, anchoCss = 0, altoCss = 0;
    function medir() {
      dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
      anchoCss = lienzo.clientWidth;
      altoCss = lienzo.clientHeight;
      var w = Math.max(1, Math.round(anchoCss * dpr));
      var h = Math.max(1, Math.round(altoCss * dpr));
      if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
      gl.viewport(0, 0, w, h);
    }

    /* la mano: de dónde viene y hasta dónde llegó desde el último cuadro */
    var mano = { x: -1, y: -1, previaX: -1, previaY: -1, hay: false };
    window.addEventListener("pointermove", function (e) {
      mano.x = e.clientX; mano.y = e.clientY;
      if (!mano.hay) { mano.previaX = mano.x; mano.previaY = mano.y; mano.hay = true; }
    }, { passive: true });
    // al salir de la ventana se olvida el último punto: si no, al volver a
    // entrar se dibuja un puente diagonal desde donde salió
    document.documentElement.addEventListener("pointerleave", function () { mano.hay = false; });
    window.addEventListener("resize", medir);

    var t = 0;
    function nacer(x, y) {
      var i = cabeza;
      cabeza = (cabeza + 1) % PILA;
      origen[2 * i] = x * dpr;
      origen[2 * i + 1] = (altoCss - y) * dpr;
      var ang = Math.random() * 6.283, rap = (6 + Math.random() * 16) * dpr;
      vel[2 * i] = Math.cos(ang) * rap;
      vel[2 * i + 1] = Math.sin(ang) * rap * 0.6;
      nace[i] = t;
      azar[2 * i] = (TAMANO[0] + Math.random() * (TAMANO[1] - TAMANO[0])) * dpr;
      azar[2 * i + 1] = Math.random();
      sucio = true;
      vivas = Math.min(PILA, vivas + 1);
    }

    var pedido = 0, antes = performance.now();
    function cuadro(ahora) {
      pedido = requestAnimationFrame(cuadro);
      var dt = Math.min(1 / 30, (ahora - antes) / 1000);
      antes = ahora;
      t += dt;
      medir();

      /* emitir por distancia: las motas se reparten a lo largo del tramo
         recorrido desde el cuadro anterior, cada PASO px. En la portada no:
         ahí el polvo ya lo levanta el haz de luz del 3D (redondel.js) y
         dos polvos a la vez eran una nube. */
      var enPortada = (window.scrollY || 0) < altoCss * 0.9;
      if (mano.hay && enPortada) { mano.previaX = mano.x; mano.previaY = mano.y; }
      if (mano.hay && !enPortada) {
        var dx = mano.x - mano.previaX, dy = mano.y - mano.previaY;
        var dist = Math.hypot(dx, dy);
        var n = Math.min(TOPE_CUADRO, Math.floor(dist / PASO));
        for (var k = 1; k <= n; k++) nacer(mano.previaX + dx * k / n, mano.previaY + dy * k / n);
        if (n) { mano.previaX = mano.x; mano.previaY = mano.y; }
      }

      gl.clear(gl.COLOR_BUFFER_BIT);

      // 1. la hoja, sin mezclar: pisa todo el lienzo
      gl.disable(gl.BLEND);
      gl.useProgram(hoja);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufHoja);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uH.uRes, lienzo.width, lienzo.height);
      gl.uniform1f(uH.uT, t);
      gl.uniform1f(uH.uScroll, (window.scrollY || 0) * dpr);
      gl.uniform1f(uH.uCelda, Math.max(1, dpr));
      gl.uniform1f(uH.uSemilla, (ahora % 1000) / 1000 * 97.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // 2. el polvo, encima, mezclado (premultiplicado)
      if (vivas) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(polvo);
        for (var a = 0; a < atribs.length; a++) {
          var at = atribs[a];
          gl.bindBuffer(gl.ARRAY_BUFFER, at.buf);
          if (sucio) gl.bufferSubData(gl.ARRAY_BUFFER, 0, at.datos);
          gl.enableVertexAttribArray(at.loc);
          gl.vertexAttribPointer(at.loc, at.n, gl.FLOAT, false, 0, 0);
        }
        sucio = false;
        gl.uniform2f(uP.uRes, lienzo.width, lienzo.height);
        gl.uniform1f(uP.uT, t);
        gl.uniform1f(uP.uDpr, dpr);
        gl.drawArrays(gl.POINTS, 0, PILA);
        // cuando la última que nació ya murió, no hace falta dibujar la pila
        var ultima = nace[(cabeza + PILA - 1) % PILA];
        if (t - ultima > VIDA) vivas = 0;
      }
    }

    function arrancar() {
      if (pedido) return;
      antes = performance.now();
      pedido = requestAnimationFrame(cuadro);
    }
    function frenar() {
      if (pedido) cancelAnimationFrame(pedido);
      pedido = 0;
    }
    // pestaña escondida: no gastar batería dibujando lo que nadie ve
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) frenar(); else arrancar();
    });
    lienzo.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      frenar();
      lienzo.style.display = "none";
    });

    medir();
    arrancar();
    lienzo.classList.add("lista");
    return true;
  }

  window.Tinta = { init: init };
})();
