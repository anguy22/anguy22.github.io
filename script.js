/* ==========================================================
   script.js — Dark Distribution Skyline · Stable Floating Bubbles
   ========================================================== */

// ───────── REGRESSION FIT REVEAL ─────────
// Letters start as a scattered cloud, then a sequence of candidate
// regressors ("throughlines") is fit through them — sine, parabola,
// high-frequency sine, sloped line, damped wave — each forming a
// smooth curve threaded through every letter. The model finally
// settles on the correct fit: a flat horizontal line.
(function () {
  var phrase = "The best way to predict the future is to create it!";
  var el = document.getElementById("regression-text");
  if (!el) return;

  var N = phrase.length;
  var spans = [];

  for (var i = 0; i < N; i++) {
    var s = document.createElement("span");
    s.className = "glyph" + (phrase[i] === " " ? " space" : "");
    s.textContent = phrase[i];
    el.appendChild(s);
    spans.push(s);
  }

  // Each regressor is a function of normalized x ∈ [0, 1]
  // returning a vertical pixel offset from the final baseline.
  var regressors = [
    function (x) { return 32 * Math.sin(x * Math.PI * 2); },                 // single sine wave
    function (x) { return 70 * Math.pow(x - 0.5, 2) - 22; },                 // parabola
    function (x) { return 22 * Math.sin(x * Math.PI * 5 + 0.7); },           // higher-freq sine
    function (x) { return 24 * (x - 0.5); },                                 // sloped line
    function (x) { return 20 * Math.sin(x * Math.PI * 7) * (1 - x * 0.6); }, // damped wave
    function (x) { return 0; }                                               // final flat fit
  ];

  function makeScatter() {
    var ys = new Array(N);
    var ops = new Array(N);
    for (var i = 0; i < N; i++) {
      ys[i] = (Math.random() - 0.5) * 90;
      ops[i] = 0.18 + Math.random() * 0.42;
    }
    return { ys: ys, ops: ops };
  }

  function makeCurve(fn) {
    var ys = new Array(N);
    var ops = new Array(N);
    for (var i = 0; i < N; i++) {
      var x = N > 1 ? i / (N - 1) : 0;
      ys[i] = phrase[i] === " " ? 0 : fn(x);
      ops[i] = 1;
    }
    return { ys: ys, ops: ops };
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function applyInterp(from, to, progress) {
    var t = easeInOutQuad(progress);
    for (var i = 0; i < N; i++) {
      if (phrase[i] === " ") continue;
      var y = from.ys[i] * (1 - t) + to.ys[i] * t;
      var op = from.ops[i] * (1 - t) + to.ops[i] * t;
      spans[i].style.transform = "translate(0px, " + y.toFixed(2) + "px)";
      spans[i].style.opacity = op.toFixed(3);
    }
  }

  function snapTo(state) {
    for (var i = 0; i < N; i++) {
      if (phrase[i] === " ") continue;
      spans[i].style.transform = "translate(0px, " + state.ys[i].toFixed(2) + "px)";
      spans[i].style.opacity = state.ops[i].toFixed(3);
    }
  }

  // Build the per-cycle queue: scatter → each regressor in order.
  function buildQueue() {
    var q = [makeScatter()];
    for (var r = 0; r < regressors.length; r++) {
      q.push(makeCurve(regressors[r]));
    }
    return q;
  }

  var FIT_MS = 950;     // ms per regressor transition
  var HOLD_MS = 4200;   // hold the final flat fit before refitting

  var queue = buildQueue();
  var fromState = queue[0];
  var toState = queue[1];
  var qIndex = 1;
  var transitionStart = null;
  var holdUntil = null;

  snapTo(fromState);

  function loop(now) {
    if (holdUntil !== null) {
      if (now >= holdUntil) {
        holdUntil = null;
        queue = buildQueue();
        fromState = queue[0];
        snapTo(fromState);
        toState = queue[1];
        qIndex = 1;
        transitionStart = null;
      }
      requestAnimationFrame(loop);
      return;
    }

    if (transitionStart === null) transitionStart = now;
    var t = Math.min((now - transitionStart) / FIT_MS, 1);
    applyInterp(fromState, toState, t);

    if (t >= 1) {
      fromState = toState;
      qIndex++;
      if (qIndex >= queue.length) {
        // All regressors tried — final flat fit reached. Hold, then restart.
        snapTo(queue[queue.length - 1]);
        holdUntil = now + HOLD_MS;
      } else {
        toState = queue[qIndex];
        transitionStart = now;
      }
    }

    requestAnimationFrame(loop);
  }

  setTimeout(function () {
    requestAnimationFrame(loop);
  }, 500);
})();


// ───────── DARK DISTRIBUTION CITYSCAPE CANVAS ─────────
(function () {
  var canvas = document.getElementById("cityscape");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var W = 0;
  var H = 0;
  var dpr = 1;

  var buildings = [];
  var particles = [];
  var treeLine = [];

  // ── Architectural silhouette palette ──
  // Each building is a dark uniform block with a glowing top edge,
  // thin horizontal floor lines, and a vertical accent stripe.
  var BODY_FILL    = "#0a1c14";                // dark silhouette body
  var SIDE_FILL    = "#040d09";                // depth panel (right)
  var TOP_FILL     = "#13301f";                // top depth panel
  var TOP_EDGE     = "rgba(127,204,166,0.85)"; // bright top edge
  var TOP_GLOW     = "rgba(127,204,166,0.18)"; // soft glow under top edge
  var FLOOR_LINE   = "rgba(127,204,166,0.16)"; // horizontal floor stripes
  var ACCENT_LINE  = "rgba(127,204,166,0.55)"; // vertical accent stripe
  var WINDOW_LIT   = "rgba(240,245,243,0.85)";
  var WINDOW_DIM   = "rgba(127,204,166,0.20)";

  function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function roundedRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    W = canvas.offsetWidth;
    H = canvas.offsetHeight;

    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    generate();
  }

  function generate() {
    buildings = [];
    particles = [];
    treeLine = [];

    var skylineW = W * 0.84;
    var startX = (W - skylineW) / 2;
    var baseY = H * 0.84;

    var count = Math.max(38, Math.round(W / 34));
    var gap = Math.max(2, W * 0.0023);
    var bw = (skylineW - gap * (count - 1)) / count;

    var mu = (count - 1) / 2;
    var sigma = count * 0.19;
    var maxH = H * 0.43;

    for (var i = 0; i < count; i++) {
      var z = (i - mu) / sigma;
      var bell = normalPDF(z) / normalPDF(0);

      var edgeLift = rand(10, 24);
      var h = edgeLift + maxH * bell * rand(0.86, 1.12);

      var x = startX + i * (bw + gap);
      var y = baseY - h;

      var depth = Math.max(4, bw * rand(0.18, 0.28));
      var roof = Math.random() > 0.72 ? "cap" : (Math.random() > 0.84 ? "spire" : "flat");

      // Align windows to the same floor spacing the renderer will use.
      var floorSpacing = Math.max(11, Math.min(18, h / 14));
      var rows = Math.max(2, Math.floor(h / floorSpacing));
      var cols = Math.max(1, Math.floor(bw / rand(10, 14)));
      var windows = [];

      for (var r = 1; r < rows; r++) {
        for (var col = 0; col < cols; col++) {
          if (Math.random() > 0.30) {
            windows.push({
              x: (col + 0.5) * (bw / cols),
              y: r * floorSpacing,
              lit: Math.random() > 0.55
            });
          }
        }
      }

      buildings.push({
        x: x,
        y: y,
        w: bw,
        h: h,
        depth: depth,
        roof: roof,
        windows: windows
      });
    }

    for (var p = 0; p < 80; p++) {
      particles.push({
        x: rand(0, W),
        y: rand(0, H * 0.48),
        r: rand(0.35, 1.2),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.005, 0.018)
      });
    }

    var treeCount = Math.max(58, Math.round(W / 18));
    for (var t = 0; t < treeCount; t++) {
      treeLine.push({
        x: startX + (t / (treeCount - 1)) * skylineW + rand(-5, 5),
        y: baseY + rand(-8, 3),
        r: rand(4, 11),
        color: Math.random() > 0.5 ? "#7fcca6" : "#4db07f"
      });
    }
  }

  function drawBackground() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#091012");
    grad.addColorStop(0.48, "#0d1517");
    grad.addColorStop(1, "#071012");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    var glow = ctx.createRadialGradient(W / 2, H * 0.66, 0, W / 2, H * 0.66, W * 0.48);
    glow.addColorStop(0, "rgba(77,176,127,0.12)");
    glow.addColorStop(0.42, "rgba(77,176,127,0.05)");
    glow.addColorStop(1, "rgba(77,176,127,0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  function drawSubtleGrid(baseY) {
    ctx.save();

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.35;
    ctx.setLineDash([5, 8]);

    var left = W * 0.08;
    var right = W * 0.92;
    var top = H * 0.34;

    for (var i = 0; i < 5; i++) {
      var y = top + i * ((baseY - top) / 4);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }

    for (var j = 0; j < 7; j++) {
      var x = left + j * ((right - left) / 6);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, baseY + 8);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBellCurve(baseY) {
    var count = 220;
    var xStart = W * 0.08;
    var xEnd = W * 0.92;
    var curveMax = H * 0.50;
    var curveLift = 18;

    ctx.save();

    // Only the white dotted bell curve — no surrounding glow outline.
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 2.9;
    ctx.setLineDash([4, 6]);
    ctx.shadowBlur = 0;
    ctx.beginPath();

    for (var i = 0; i <= count; i++) {
      var pct = i / count;
      var x = xStart + pct * (xEnd - xStart);
      var z = -3.15 + pct * 6.3;
      var y = baseY - curveLift - (normalPDF(z) / normalPDF(0)) * curveMax;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawBuilding(b) {
    var x = b.x;
    var y = b.y;
    var w = b.w;
    var h = b.h;
    var d = b.depth;

    ctx.save();

    // Right depth panel (drawn first, behind body)
    ctx.fillStyle = SIDE_FILL;
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + d, y + d);
    ctx.lineTo(x + w + d, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();

    // Top depth panel
    ctx.fillStyle = TOP_FILL;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + d, y + d);
    ctx.lineTo(x + d, y + d);
    ctx.closePath();
    ctx.fill();

    // Solid silhouette body — uniform dark fill, no gradient
    ctx.fillStyle = BODY_FILL;
    ctx.fillRect(x, y, w, h);

    // Soft glow band just under the top edge
    var glowGrad = ctx.createLinearGradient(x, y, x, y + Math.min(h * 0.4, 60));
    glowGrad.addColorStop(0, TOP_GLOW);
    glowGrad.addColorStop(1, "rgba(127,204,166,0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(x, y, w, Math.min(h * 0.4, 60));

    // Horizontal floor lines — even spacing, thin and subtle
    var floorSpacing = Math.max(11, Math.min(18, h / 14));
    var floors = Math.floor(h / floorSpacing);
    ctx.strokeStyle = FLOOR_LINE;
    ctx.lineWidth = 0.7;
    ctx.setLineDash([]);
    for (var f = 1; f < floors; f++) {
      var fy = y + f * floorSpacing;
      ctx.beginPath();
      ctx.moveTo(x + 1, fy + 0.5);
      ctx.lineTo(x + w - 1, fy + 0.5);
      ctx.stroke();
    }

    // Vertical accent stripe — single bright line on the left edge
    ctx.fillStyle = ACCENT_LINE;
    ctx.fillRect(x + 0.5, y + 1, 1.2, h - 1);

    // Bright top edge — defines the silhouette's roofline
    ctx.strokeStyle = TOP_EDGE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y + 0.5);
    ctx.lineTo(x + w, y + 0.5);
    ctx.stroke();

    // Tiny window highlights — small bright squares scattered along
    // the floor lines, fixed at generation, never flicker.
    var ww = Math.max(2, w * 0.12);
    var wh = Math.max(2, Math.min(3.5, floorSpacing * 0.22));
    for (var i = 0; i < b.windows.length; i++) {
      var win = b.windows[i];
      ctx.fillStyle = win.lit ? WINDOW_LIT : WINDOW_DIM;
      ctx.globalAlpha = win.lit ? 0.75 : 0.38;
      ctx.fillRect(x + win.x - ww / 2, y + win.y - wh / 2, ww, wh);
    }
    ctx.globalAlpha = 1;

    // Roof caps — minimal, monochrome
    if (b.roof === "spire") {
      ctx.strokeStyle = TOP_EDGE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y - 16);
      ctx.stroke();
    } else if (b.roof === "cap") {
      ctx.fillStyle = BODY_FILL;
      ctx.fillRect(x + w * 0.22, y - 4, w * 0.56, 4);
      ctx.strokeStyle = TOP_EDGE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + w * 0.22, y - 4, w * 0.56, 4);
    }

    ctx.restore();
  }

  function drawTrees() {
    for (var i = 0; i < treeLine.length; i++) {
      var t = treeLine[i];

      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.35, t.y - t.r * 0.35, t.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function drawReflection(baseY) {
    ctx.save();

    var refl = ctx.createLinearGradient(0, baseY, 0, H);
    refl.addColorStop(0, "rgba(255,255,255,0.08)");
    refl.addColorStop(0.4, "rgba(255,255,255,0.03)");
    refl.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = refl;
    ctx.fillRect(W * 0.08, baseY, W * 0.84, H - baseY);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.08, baseY + 4);
    ctx.lineTo(W * 0.92, baseY + 4);
    ctx.stroke();

    ctx.restore();
  }

  var frame = 0;

  function draw() {
    frame++;
    var baseY = H * 0.84;

    drawBackground();
    drawSubtleGrid(baseY);

    for (var p = 0; p < particles.length; p++) {
      var st = particles[p];
      ctx.globalAlpha = 0.03 + 0.08 * Math.sin(frame * st.speed + st.phase);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    drawBellCurve(baseY);

    for (var i = 0; i < buildings.length; i++) {
      drawBuilding(buildings[i]);
    }

    drawTrees();
    drawReflection(baseY);

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
})();


// ───────── FLOATING HERO BUBBLES ─────────
(function () {
  var hero = document.getElementById("hero");
  var bubbles = Array.prototype.slice.call(document.querySelectorAll(".bubble"));

  if (!hero || bubbles.length === 0) return;

  var placements = [
    { x: 0.12, y: 0.18 },
    { x: 0.84, y: 0.17 },
    { x: 0.89, y: 0.44 },
    { x: 0.15, y: 0.55 },
    { x: 0.76, y: 0.74 }
  ];

  var states = bubbles.map(function (el, i) {
    var p = placements[i] || { x: 0.5, y: 0.5 };

    var state = {
      el: el,
      baseX: p.x,
      baseY: p.y,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      scale: el.classList.contains("bubble-profile") ? 1.05 : 1,
      frozen: false
    };

    el.addEventListener("mouseenter", function () {
      state.frozen = true;
      state.vx = 0;
      state.vy = 0;
    });

    el.addEventListener("mouseleave", function () {
      state.frozen = false;
    });

    el.addEventListener("focus", function () {
      state.frozen = true;
      state.vx = 0;
      state.vy = 0;
    });

    el.addEventListener("blur", function () {
      state.frozen = false;
    });

    return state;
  });

  function animate() {
    var rect = hero.getBoundingClientRect();
    var now = Date.now();

    states.forEach(function (b) {
      if (!b.frozen) {
        var bobX = Math.sin(now * 0.00072 + b.phase) * 0.012;
        var bobY = Math.cos(now * 0.00095 + b.phase) * 0.016;

        var targetX = b.baseX + bobX;
        var targetY = b.baseY + bobY;

        b.vx += (targetX - b.x) * 0.018;
        b.vy += (targetY - b.y) * 0.018;

        b.vx *= 0.925;
        b.vy *= 0.925;

        b.x += b.vx;
        b.y += b.vy;

        b.x = Math.max(0.06, Math.min(0.94, b.x));
        b.y = Math.max(0.15, Math.min(0.82, b.y));
      }

      b.el.style.left = (b.x * rect.width) + "px";
      b.el.style.top = (b.y * rect.height) + "px";
      b.el.style.transform = "translate(-50%, -50%) scale(" + b.scale + ")";
    });

    requestAnimationFrame(animate);
  }

  animate();
})();


// ───────── SCROLL / REVEAL / SMOOTH ANCHORS ─────────
(function () {
  var reveals = document.querySelectorAll(".reveal");

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  });

  reveals.forEach(function (el) {
    observer.observe(el);
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var targetSelector = this.getAttribute("href");
      var t = document.querySelector(targetSelector);

      if (t) {
        e.preventDefault();
        t.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
})();
