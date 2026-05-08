/* ==========================================================
   script.js — Dark Distribution Skyline · Stable Floating Bubbles
   ========================================================== */

// ───────── DECRYPT ANIMATION ─────────
// Classic cryptography reveal: each glyph cycles through random
// characters, then locks left-to-right onto the real phrase.
// Held on a single line at any viewport (font-size scales in CSS).
(function () {
  var phrase = "The best way to predict the future is to create it!";
  var el = document.getElementById("decrypt-text");
  if (!el) return;

  var glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!?<>{}[]~^";
  var resolved = [];
  var spans = [];

  for (var i = 0; i < phrase.length; i++) {
    var s = document.createElement("span");
    s.className = "glyph" + (phrase[i] === " " ? " space" : " scramble");
    s.textContent = phrase[i] === " " ? " " : glyphs[Math.floor(Math.random() * glyphs.length)];
    el.appendChild(s);
    spans.push(s);
    resolved.push(false);
  }

  var pointer = 0;
  var tickInterval = 34;
  var lockEvery = 2;
  var tick = 0;

  function reset() {
    pointer = 0;
    tick = 0;
    for (var j = 0; j < spans.length; j++) {
      resolved[j] = false;
      spans[j].className = "glyph" + (phrase[j] === " " ? " space" : " scramble");
    }
  }

  function step() {
    tick++;

    for (var i = pointer; i < phrase.length; i++) {
      if (phrase[i] !== " " && !resolved[i]) {
        spans[i].textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      }
    }

    if (tick % lockEvery === 0 && pointer < phrase.length) {
      spans[pointer].textContent = phrase[pointer] === " " ? " " : phrase[pointer];
      spans[pointer].className = "glyph" + (phrase[pointer] === " " ? " space done" : " done");
      resolved[pointer] = true;
      pointer++;
    }

    if (pointer < phrase.length) {
      setTimeout(step, tickInterval);
    } else {
      setTimeout(function () {
        reset();
        step();
      }, 4200);
    }
  }

  setTimeout(step, 700);
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

  // Tracks when this generation cycle started — drives the construction
  // animation (random height distribution → normal distribution).
  var buildStartedAt = 0;

  // ── Architectural silhouette palette ──
  var BODY_FILL    = "#0a1c14";                // dark silhouette body
  var SIDE_FILL    = "#040d09";                // depth panel (right)
  var TOP_FILL     = "#13301f";                // top depth panel
  var TOP_EDGE     = "rgba(127,204,166,0.85)"; // bright top edge
  var TOP_GLOW     = "rgba(127,204,166,0.18)"; // soft glow under top edge
  var FLOOR_LINE   = "rgba(127,204,166,0.16)"; // horizontal floor stripes
  var ACCENT_LINE  = "rgba(127,204,166,0.55)"; // vertical accent stripe
  var WINDOW_LIT   = "rgba(240,245,243,0.85)";
  var WINDOW_DIM   = "rgba(127,204,166,0.20)";

  // ── Construction palette ──
  var CRANE_COLOR  = "rgba(255,184,92,0.92)";  // construction yellow
  var CRANE_DIM    = "rgba(255,184,92,0.55)";
  var WARN_LIGHT   = "rgba(255,80,80,0.95)";
  var WARN_GLOW    = "rgba(255,80,80,0.22)";
  var SCAFFOLD     = "rgba(255,184,92,0.32)";

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
      // Final (target) height — sits on the normal distribution.
      var targetH = edgeLift + maxH * bell * rand(0.86, 1.12);

      // Initial (random) height — drawn from a uniform distribution
      // unrelated to position, so the skyline starts noisy and then
      // "constructs" itself into the bell curve.
      var startH = rand(edgeLift, maxH * 1.05);

      // Each building's construction is staggered and runs at its own
      // pace, like a real building site.
      var startDelay = rand(0, 2200);
      var buildDuration = rand(5500, 9500);

      var x = startX + i * (bw + gap);

      var depth = Math.max(4, bw * rand(0.18, 0.28));
      var roof = Math.random() > 0.72 ? "cap" : (Math.random() > 0.84 ? "spire" : "flat");

      // Window grid is sized to the FINAL height so the lit pattern
      // doesn't pop in once construction completes. We draw windows
      // only up to the current height during the build.
      var floorSpacing = Math.max(11, Math.min(18, targetH / 14));
      var rows = Math.max(2, Math.floor(targetH / floorSpacing));
      var cols = Math.max(1, Math.floor(bw / rand(10, 14)));
      var windows = [];

      for (var r = 1; r < rows; r++) {
        for (var col = 0; col < cols; col++) {
          if (Math.random() > 0.30) {
            windows.push({
              x: (col + 0.5) * (bw / cols),
              // Height above the ground line — stays fixed as the
              // building grows around it (real floors don't move).
              yFromGround: (rows - r) * floorSpacing,
              lit: Math.random() > 0.55
            });
          }
        }
      }

      buildings.push({
        x: x,
        y: baseY - startH,    // current top y (animated)
        w: bw,
        h: startH,            // current height (animated)
        targetH: targetH,
        startH: startH,
        startDelay: startDelay,
        buildDuration: buildDuration,
        floorSpacing: floorSpacing,
        depth: depth,
        roof: roof,
        windows: windows,
        // Crane: which side the jib points and an animation phase
        craneFacing: Math.random() > 0.5 ? 1 : -1,
        cranePhase: Math.random() * Math.PI * 2,
        underConstruction: true
      });
    }

    buildStartedAt = (typeof performance !== "undefined" && performance.now)
      ? performance.now()
      : Date.now();

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
    var y = b.y;       // current top (animated during construction)
    var w = b.w;
    var h = b.h;       // current height (animated during construction)
    var d = b.depth;
    var groundY = y + h;
    var floorSpacing = b.floorSpacing;

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

    // Horizontal floor lines — anchored to the ground so already-built
    // floors stay put as the building rises around them.
    ctx.strokeStyle = FLOOR_LINE;
    ctx.lineWidth = 0.7;
    ctx.setLineDash([]);
    for (var fh = floorSpacing; fh < h; fh += floorSpacing) {
      var fy = groundY - fh;
      ctx.beginPath();
      ctx.moveTo(x + 1, fy + 0.5);
      ctx.lineTo(x + w - 1, fy + 0.5);
      ctx.stroke();
    }

    // Vertical accent stripe
    ctx.fillStyle = ACCENT_LINE;
    ctx.fillRect(x + 0.5, y + 1, 1.2, h - 1);

    // Bright top edge — defines the current roofline
    ctx.strokeStyle = TOP_EDGE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y + 0.5);
    ctx.lineTo(x + w, y + 0.5);
    ctx.stroke();

    // Windows — only draw those whose floor has actually been built.
    var ww = Math.max(2, w * 0.12);
    var wh = Math.max(2, Math.min(3.5, floorSpacing * 0.22));
    for (var i = 0; i < b.windows.length; i++) {
      var win = b.windows[i];
      if (win.yFromGround > h) continue; // floor not built yet
      ctx.fillStyle = win.lit ? WINDOW_LIT : WINDOW_DIM;
      ctx.globalAlpha = win.lit ? 0.75 : 0.38;
      ctx.fillRect(x + win.x - ww / 2, groundY - win.yFromGround - wh / 2, ww, wh);
    }
    ctx.globalAlpha = 1;

    // Scaffolding cross-pattern across the topmost floor while still
    // under construction — visual cue that this floor is "in progress".
    if (b.underConstruction) {
      var scaffH = Math.min(floorSpacing, h);
      ctx.strokeStyle = SCAFFOLD;
      ctx.lineWidth = 0.55;
      // Vertical poles
      for (var sp = 0; sp <= 3; sp++) {
        var spx = x + (sp / 3) * w;
        ctx.beginPath();
        ctx.moveTo(spx, y);
        ctx.lineTo(spx, y + scaffH);
        ctx.stroke();
      }
      // X bracing
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + scaffH);
      ctx.moveTo(x + w, y);
      ctx.lineTo(x, y + scaffH);
      ctx.stroke();
    }

    // Roof caps — only on finished buildings (mid-construction roofs
    // make no sense visually).
    if (!b.underConstruction) {
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
    }

    ctx.restore();
  }

  // Tower crane drawn on top of any building still under construction:
  // mast, jib + counter-jib with diagonal bracing, swinging hook,
  // operator cab, and a blinking warning light at the mast tip.
  function drawCrane(b, now) {
    var x = b.x;
    var y = b.y;
    var w = b.w;
    var mastX = x + w / 2;
    var mastBottom = y;
    var mastHeight = Math.min(36, Math.max(20, b.targetH * 0.16 + 14));
    var mastTop = y - mastHeight;

    ctx.save();
    ctx.lineCap = "square";

    // Mast — twin chords with diagonal bracing
    ctx.strokeStyle = CRANE_COLOR;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mastX - 2, mastBottom);
    ctx.lineTo(mastX - 2, mastTop);
    ctx.moveTo(mastX + 2, mastBottom);
    ctx.lineTo(mastX + 2, mastTop);
    ctx.stroke();

    ctx.lineWidth = 0.55;
    ctx.strokeStyle = CRANE_DIM;
    var segs = Math.max(2, Math.floor(mastHeight / 7));
    for (var s = 0; s < segs; s++) {
      var sy1 = mastBottom - s * (mastHeight / segs);
      var sy2 = mastBottom - (s + 1) * (mastHeight / segs);
      ctx.beginPath();
      ctx.moveTo(mastX - 2, sy1);
      ctx.lineTo(mastX + 2, sy2);
      ctx.moveTo(mastX + 2, sy1);
      ctx.lineTo(mastX - 2, sy2);
      ctx.stroke();
    }

    // Jib (long arm) + counter-jib (short stub on the other side)
    var dir = b.craneFacing;
    var jibLen = Math.max(20, w * 1.05);
    var counterLen = jibLen * 0.32;
    var jibTop = mastTop;
    var jibBottom = mastTop + 3.5;
    var jibFar = mastX + jibLen * dir;
    var jibNear = mastX - counterLen * dir;

    ctx.strokeStyle = CRANE_COLOR;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(jibNear, jibTop);
    ctx.lineTo(jibFar, jibTop);
    ctx.moveTo(jibNear, jibBottom);
    ctx.lineTo(jibFar, jibBottom);
    ctx.stroke();

    // Diagonal jib lattice
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = CRANE_DIM;
    var jibSegs = Math.max(4, Math.floor((jibLen + counterLen) / 5));
    for (var js = 0; js < jibSegs; js++) {
      var t1 = js / jibSegs;
      var t2 = (js + 1) / jibSegs;
      var px1 = jibNear + (jibFar - jibNear) * t1;
      var px2 = jibNear + (jibFar - jibNear) * t2;
      ctx.beginPath();
      if (js % 2 === 0) {
        ctx.moveTo(px1, jibTop);
        ctx.lineTo(px2, jibBottom);
      } else {
        ctx.moveTo(px1, jibBottom);
        ctx.lineTo(px2, jibTop);
      }
      ctx.stroke();
    }

    // Operator cab — small box where jib meets mast
    ctx.fillStyle = "rgba(255,184,92,0.65)";
    var cabW = 5.5;
    var cabH = 4.5;
    ctx.fillRect(mastX + (dir > 0 ? 1.5 : -cabW - 1.5), jibBottom, cabW, cabH);

    // Swinging hook with cable
    ctx.strokeStyle = CRANE_COLOR;
    ctx.lineWidth = 0.7;
    var swing = Math.sin(now * 0.0011 + b.cranePhase) * 1.6;
    var hookAnchorX = mastX + jibLen * 0.7 * dir;
    var hookHang = 9 + Math.sin(now * 0.0017 + b.cranePhase) * 1.2;
    var hookX = hookAnchorX + swing;
    var hookY = jibBottom + hookHang;
    ctx.beginPath();
    ctx.moveTo(hookAnchorX, jibBottom);
    ctx.lineTo(hookX, hookY);
    ctx.stroke();
    ctx.fillStyle = CRANE_COLOR;
    ctx.fillRect(hookX - 1.6, hookY, 3.2, 2.4);

    // Blinking warning light at the very top of the mast
    var blink = Math.sin(now * 0.005 + b.cranePhase * 5) > 0;
    if (blink) {
      ctx.fillStyle = WARN_GLOW;
      ctx.beginPath();
      ctx.arc(mastX, mastTop - 1, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = WARN_LIGHT;
      ctx.beginPath();
      ctx.arc(mastX, mastTop - 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
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

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function nowMs() {
    return (typeof performance !== "undefined" && performance.now)
      ? performance.now()
      : Date.now();
  }

  function draw() {
    frame++;
    var baseY = H * 0.84;
    var now = nowMs();
    var elapsed = now - buildStartedAt;

    // Advance construction: each building lerps from its random start
    // height toward its bell-curve target height, on its own schedule.
    // Once finished, it stops animating and stays put.
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (!b.underConstruction) continue;

      var local = elapsed - b.startDelay;
      if (local <= 0) {
        b.h = b.startH;
      } else if (local >= b.buildDuration) {
        b.h = b.targetH;
        b.underConstruction = false;
      } else {
        var t = local / b.buildDuration;
        var eased = smoothstep(t);
        b.h = b.startH + (b.targetH - b.startH) * eased;
      }
      b.y = baseY - b.h;
    }

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

    // Cranes drawn last (over the buildings) so the jib doesn't get
    // clipped by neighbors.
    for (var j = 0; j < buildings.length; j++) {
      if (buildings[j].underConstruction) {
        drawCrane(buildings[j], now);
      }
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
