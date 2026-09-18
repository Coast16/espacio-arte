/* ═══════════════════════════════════════════════════════════
   Espacio Arte — la gota de tinta (el cursor)
   Tres gotas que se funden entre sí siguen al puntero, cada una un
   poco más lenta que la anterior, y cuando la mano va rápido la cola
   suelta gotitas que caen y se apagan. Se dibuja en un lienzo WebGL a
   pantalla completa que la hoja mezcla con mix-blend-mode:difference,
   y se pinta SIEMPRE en blanco: sobre la cal se ve tinta, sobre la
   tinta se ve cal, y sobre una foto la da vuelta como un negativo.
   Así no hay que preguntarle al fondo de qué color es.

   Solo escritorio: puntero fino y sin "reducir movimiento". main.js
   decide si se prende y cuándo se encoge (adentro de la sala).
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* Los números que mandan (en px de pantalla, sin el zoom del display) */
  var CABEZA = 30, MEDIO = 21, COLA = 13;   // radios en reposo
  var VEL_CABEZA = 14, VEL_MEDIO = 10, VEL_COLA = 8; // cuánto crecen con la velocidad
  var SIGUE_CABEZA = 0.32, SIGUE_MEDIO = 0.17, SIGUE_COLA = 0.11; // qué tan pegadas van
  var ENCOGIDA = 0.3;      // escala adentro de la sala: una gota chica que no tapa obras
  var MAX_GOTAS = 10;      // gotitas sueltas a la vez (16 formas en total en el shader)
  var GRANO = 0.045;       // grano de la hoja: 0 lo apaga; arriba de .08 se ve sucio
  var LUZ = 0.05;          // la sombra de los arcos que recorre la cal: 0 la apaga
  var VINETA = 0.045;      // los bordes de la hoja, apenas más oscuros que el centro
  var SOBRE = 0.5;         // cuánto crece la gota sobre un enlace (+50 %)
  var APRETADA = 0.72;     // a cuánto baja al hacer clic
  var DPR_MAX = 1.5;       // más que esto no se nota y cuesta el doble

  var VERT = [
    "attribute vec2 position;",
    "void main(){ gl_Position = vec4(position, 0.0, 1.0); }"
  ].join("\n");

  /* Campo de metaballs clásico: cada gota suma r²/d² y donde la suma
     pasa el umbral hay tinta. El smoothstep es el borde suave.
     El grano va en el mismo lienzo: como todo se mezcla por diferencia,
     un poco de blanco al azar oscurece apenas la cal y aclara apenas la
     tinta — el mismo grano sirve para los dos fondos y no hace falta
     otra capa encima de la página. Cambia en cada cuadro, como el grano
     de una película; quieto parecía una pantalla sucia. */
  var FRAG = [
    "precision highp float;",
    "uniform vec2 uPos[16];",
    "uniform float uRad[16];",
    "uniform int uCount;",
    "uniform float uGrano;",
    "uniform float uCelda;",   // tamaño del grano en px del lienzo
    "uniform float uSemilla;",
    "uniform vec2 uRes;",
    "uniform float uT;",       // segundos
    "uniform float uScroll;",  // scrollY en px del lienzo
    "uniform float uLuz;",
    "uniform float uVineta;",
    /* Una banda diagonal suave, de período `per`, corrida por `fase`.
       Dos de estas cruzadas, muy anchas y muy lentas, son la sombra que
       la estructura de arcos deja sobre la pared encalada cuando el sol
       se mueve. Con el scroll también se corren: la pared pasa. */
    "float haz(vec2 p, float ang, float per, float fase){",
    "  float u = dot(p, vec2(cos(ang), sin(ang))) / per;",
    "  return 0.5 + 0.5 * sin(6.2831 * (u + fase));",
    "}",
    "float azar(vec2 p){",
    "  p = fract(p * vec2(123.34, 456.21));",
    "  p += dot(p, p + 45.32);",
    "  return fract(p.x * p.y);",
    "}",
    "void main(){",
    "  vec2 p = gl_FragCoord.xy;",
    "  float f = 0.0;",
    "  for (int i = 0; i < 16; i++) {",
    "    if (i >= uCount) break;",
    "    vec2 d = p - uPos[i];",
    "    float r = uRad[i];",
    "    f += (r * r) / (dot(d, d) + 1.0);",
    "  }",
    "  float gota = smoothstep(0.82, 1.06, f);",
    "  float grano = azar(floor(p / uCelda) + uSemilla) * uGrano;",
    "  float d = uRes.y;",                                   // todo en proporción al alto
    "  vec2 q = vec2(p.x, p.y + uScroll * 0.35);",           // la pared pasa a un tercio del scroll
    "  float luz = haz(q, -0.52, d * 1.15, uT * 0.006)  * 0.55",
    "            + haz(q, -0.31, d * 1.9,  -uT * 0.0037) * 0.45;",
    "  luz = smoothstep(0.42, 1.0, luz) * uLuz;",
    "  vec2 c = p / uRes - 0.5;",
    "  float vineta = smoothstep(0.30, 1.05, length(c * vec2(uRes.x / uRes.y, 1.0)) * 1.25) * uVineta;",
    "  float a = min(1.0, gota + grano + luz + vineta);",
    "  gl_FragColor = vec4(a, a, a, a);", // premultiplicado: blanco con alfa
    "}"
  ].join("\n");

  function compilar(gl, tipo, fuente) {
    var s = gl.createShader(tipo);
    gl.shaderSource(s, fuente);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function init(lienzo) {
    var gl = lienzo.getContext("webgl", {
      alpha: true, antialias: false, depth: false, stencil: false,
      powerPreference: "high-performance"
    });
    if (!gl) return false;

    var vs = compilar(gl, gl.VERTEX_SHADER, VERT);
    var fs = compilar(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);

    var uPos = gl.getUniformLocation(prog, "uPos");
    var uRad = gl.getUniformLocation(prog, "uRad");
    var uCount = gl.getUniformLocation(prog, "uCount");
    var uGrano = gl.getUniformLocation(prog, "uGrano");
    var uCelda = gl.getUniformLocation(prog, "uCelda");
    var uSemilla = gl.getUniformLocation(prog, "uSemilla");
    var uRes = gl.getUniformLocation(prog, "uRes");
    var uT = gl.getUniformLocation(prog, "uT");
    var uScroll = gl.getUniformLocation(prog, "uScroll");
    var uLuz = gl.getUniformLocation(prog, "uLuz");
    var uVineta = gl.getUniformLocation(prog, "uVineta");
    gl.uniform1f(uGrano, GRANO);
    gl.uniform1f(uLuz, LUZ);
    gl.uniform1f(uVineta, VINETA);

    var dpr = 1, anchoCss = 0, altoCss = 0;
    function medir() {
      dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
      anchoCss = lienzo.clientWidth;
      altoCss = lienzo.clientHeight;
      var w = Math.max(1, Math.round(anchoCss * dpr));
      var h = Math.max(1, Math.round(altoCss * dpr));
      if (lienzo.width !== w || lienzo.height !== h) {
        lienzo.width = w; lienzo.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform1f(uCelda, Math.max(1, dpr)); // un grano ≈ un px de pantalla
      gl.uniform2f(uRes, w, h);
    }

    /* estado: a dónde apunta la mano y dónde están las tres gotas */
    var lejos = -400;
    var est = {
      tx: lejos, ty: lejos,
      cabeza: { x: lejos, y: lejos }, medio: { x: lejos, y: lejos }, cola: { x: lejos, y: lejos },
      previa: { x: lejos, y: lejos },
      ultimoMov: 0, adentro: false, gotas: [], t: 0,
      escala: 1, escalaMeta: 1,
      sobre: 0, sobreMeta: 0,        // 1 = encima de algo que se puede tocar
      apretada: 1, apretadaMeta: 1   // < 1 mientras el botón está abajo
    };
    var pos = new Float32Array(32);
    var rad = new Float32Array(16);

    window.addEventListener("pointermove", function (e) {
      est.tx = e.clientX; est.ty = e.clientY;
      est.adentro = true;
      est.ultimoMov = performance.now();
    }, { passive: true });
    // cuando la mano sale de la ventana la gota se va por abajo, no se corta
    document.documentElement.addEventListener("pointerleave", function () {
      est.adentro = false;
      est.ty = window.innerHeight + 260;
    });
    window.addEventListener("resize", medir);

    var pedido = 0, antes = performance.now();
    function cuadro(ahora) {
      pedido = requestAnimationFrame(cuadro);
      var dt = Math.min(0.05, (ahora - antes) / 1000);
      antes = ahora;
      // p = "cuántos cuadros de 60 fps pasaron": los factores de seguimiento
      // están pensados a 60 y así se sienten igual a 120 o con un tirón
      var p = Math.max(0.05, Math.min(1, 60 * dt));
      est.t += dt;

      medir();
      var c = est.cabeza, m = est.medio, k = est.cola;
      c.x += (est.tx - c.x) * SIGUE_CABEZA * p;
      c.y += (est.ty - c.y) * SIGUE_CABEZA * p;
      var pega = 1 + 1.6 * est.sobre; // sobre un enlace, la cola alcanza a la cabeza
      m.x += (c.x - m.x) * Math.min(1, SIGUE_MEDIO * pega) * p;
      m.y += (c.y - m.y) * Math.min(1, SIGUE_MEDIO * pega) * p;
      k.x += (m.x - k.x) * Math.min(1, SIGUE_COLA * pega) * p;
      k.y += (m.y - k.y) * Math.min(1, SIGUE_COLA * pega) * p;

      var vel = Math.hypot(c.x - est.previa.x, c.y - est.previa.y) / p;
      est.previa.x = c.x; est.previa.y = c.y;

      est.escala += (est.escalaMeta - est.escala) * 0.08 * p;
      est.sobre += (est.sobreMeta - est.sobre) * 0.16 * p;
      est.apretada += (est.apretadaMeta - est.apretada) * 0.3 * p;
      var esc = est.escala * est.apretada;
      var quieta = ahora - est.ultimoMov > 1200 ? 3 * Math.sin(2.2 * est.t) : 0; // respira si la mano se queda
      /* sobre un enlace la tinta se junta: la cabeza crece y la cola se
         mete adentro (en vez de arrastrarse) — una gota lista para caer */
      var rc = (CABEZA + Math.min(VEL_CABEZA, 0.35 * vel) + quieta) * esc * (1 + SOBRE * est.sobre);
      var rm = (MEDIO + Math.min(VEL_MEDIO, 0.25 * vel)) * esc;
      var rk = (COLA + Math.min(VEL_COLA, 0.2 * vel)) * esc * (1 - 0.5 * est.sobre);

      // gotitas: solo cuando va rápido, a veces, y ni encogida ni sobre algo
      if (est.adentro && esc > 0.6 && est.sobre < 0.3 && vel > 18 && Math.random() < 0.28 && est.gotas.length < MAX_GOTAS) {
        var dx = k.x - c.x, dy = k.y - c.y, len = Math.hypot(dx, dy) || 1;
        est.gotas.push({
          x: k.x + dx / len * 6, y: k.y + dy / len * 6,
          vx: dx / len * 2.2 + (Math.random() - 0.5) * 1.5,
          vy: dy / len * 2.2 - 1.5,
          r: 5 + 7 * Math.random(), vida: 1
        });
      }
      for (var i = 0; i < est.gotas.length; i++) {
        var g = est.gotas[i];
        g.vy += 0.42 * p;           // caen
        g.vx *= 0.985;
        g.x += g.vx * p; g.y += g.vy * p;
        g.r *= 1 - 0.012 * p;       // se achican
        g.vida -= dt / 1.3;         // y se apagan
      }
      est.gotas = est.gotas.filter(function (g) { return g.vida > 0 && g.r > 1.2 && g.y < altoCss + 60; });

      function poner(i, x, y, r) {
        pos[2 * i] = x * dpr;
        pos[2 * i + 1] = (altoCss - y) * dpr; // WebGL cuenta desde abajo
        rad[i] = r * dpr;
      }
      poner(0, c.x, c.y, rc);
      poner(1, m.x, m.y, rm);
      poner(2, k.x, k.y, rk);
      var n = 3;
      for (var j = 0; j < est.gotas.length && n < 16; j++) {
        var q = est.gotas[j];
        poner(n++, q.x, q.y, q.r * (0.4 + 0.6 * q.vida) * esc);
      }

      gl.uniform2fv(uPos, pos);
      gl.uniform1fv(uRad, rad);
      gl.uniform1i(uCount, n);
      gl.uniform1f(uSemilla, (ahora % 1000) / 1000 * 97.0);
      gl.uniform1f(uT, est.t);
      gl.uniform1f(uScroll, (window.scrollY || 0) * dpr);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
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
    window.Tinta.encoger = function (si) { est.escalaMeta = si ? ENCOGIDA : 1; };
    window.Tinta.sobre = function (si) { est.sobreMeta = si ? 1 : 0; };
    window.Tinta.apretar = function (si) { est.apretadaMeta = si ? APRETADA : 1; };
    return true;
  }

  window.Tinta = { init: init, encoger: function () {}, sobre: function () {}, apretar: function () {} };
})();
