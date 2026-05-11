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

  // Tracks when this generation cycle started — drives the construction
  // animation (random heights → selected target distribution).
  var buildStartedAt = 0;

  // ── Black / white / violet architectural palette ──
  // Buildings stay in the dark violet construction palette.
  // The former bright-purple finished state has been removed.
  var BODY_DARK    = [14, 10, 28];               // #0e0a1c (near-black violet)
  var BODY_BRIGHT  = BODY_DARK;
  var SIDE_DARK    = [6, 4, 16];                 // very dark violet/black
  var SIDE_BRIGHT  = SIDE_DARK;
  var TOP_DARK     = [30, 22, 58];               // dark violet
  var TOP_BRIGHT   = TOP_DARK;
  var TOP_EDGE     = "rgba(220,210,245,0.92)";   // near-white violet edge
  var TOP_GLOW     = "rgba(188,174,226,0.20)";   // soft violet glow
  var FLOOR_LINE   = "rgba(220,210,245,0.18)";   // pale violet floor stripes
  var ACCENT_LINE  = "rgba(220,210,245,0.60)";   // pale violet accent
  var WINDOW_LIT   = "rgba(245,242,255,0.88)";   // near-white window
  var WINDOW_DIM   = "rgba(188,174,226,0.22)";   // dim violet window

  var BRIGHTEN_MS = 0; // bright-purple finish removed
  // 40% faster than before: 3200/5200 → 1920/3120 morph window,
  // 420 → 250 stagger between buildings.
  var MORPH_MIN_MS = 1920;
  var MORPH_MAX_MS = 3120;
  var MORPH_STAGGER_MS = 250;

  function lerpRGB(a, b, t) {
    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  // ── Construction palette (light/white instead of yellow) ──
  var SCAFFOLD     = "rgba(245,240,255,0.30)";

  // ── Distribution definitions ────────────────────────────
  // Each distribution exposes fn(t) where t ∈ [0, 1] returns a height
  // multiplier in [0, 1]. The same fn powers BOTH the target building
  // heights AND the theoretical curve drawn above the skyline.
  var distributions = {
    normal: function (t) {
      var z = -3 + t * 6;
      return Math.exp(-0.5 * z * z); // peak = 1 at t = 0.5
    },
    triangular: function (t) {
      // Sharp linear peak in the middle — visual cousin of normal.
      return Math.max(0, 1 - 2 * Math.abs(t - 0.5));
    },
    bimodal: function (t) {
      // Two narrow gaussian peaks at t = 0.25 and t = 0.75 (valley in middle).
      var sigma = 0.12;
      var z1 = (t - 0.25) / sigma;
      var z2 = (t - 0.75) / sigma;
      return Math.max(Math.exp(-0.5 * z1 * z1), Math.exp(-0.5 * z2 * z2));
    },
    uniform: function (t) {
      // Roughly flat skyline (mid-height) — small dip at the edges so it
      // doesn't look like a perfect rectangle.
      var edgeFalloff = 1 - 0.18 * Math.pow(2 * t - 1, 4);
      return 0.62 * edgeFalloff;
    },
    exponential: function (t) {
      var rate = 3.2;
      return Math.exp(-rate * t);    // peak = 1 at t = 0
    },
    geometric: function (t) {
      // Discrete-feel decay — buildings cluster in stepped bins so
      // the silhouette looks like a staircase rather than a smooth curve.
      var bins = 7;
      var bin = Math.min(bins - 1, Math.floor(t * bins));
      return Math.pow(0.6, bin);
    },
    lognormal: function (t) {
      var x = 0.1 + t * 3.5;
      var mu = 0;
      var sigma = 0.5;
      var pdf = (1 / (x * sigma * Math.sqrt(2 * Math.PI))) *
                Math.exp(-Math.pow(Math.log(x) - mu, 2) / (2 * sigma * sigma));
      // Normalize by peak (peak at x = exp(mu - sigma^2)).
      var peakX = Math.exp(mu - sigma * sigma);
      var peakPdf = (1 / (peakX * sigma * Math.sqrt(2 * Math.PI))) *
                    Math.exp(-Math.pow(Math.log(peakX) - mu, 2) / (2 * sigma * sigma));
      return pdf / peakPdf;
    }
  };

  var currentDistribution = "normal";

  // ── Auto-cycle ─────────────────────────────────────────
  // After every building finishes resizing into the active distribution,
  // hold briefly and advance to the next distribution. Manual clicks reset this.
  // Order is chosen so consecutive shapes are visually related — peak
  // sharpens, splits, flattens, tilts, becomes stepped, then skews back:
  //   bell → sharp peak → two peaks → flat → left-tall → stepped → skewed → bell
  var CYCLE_ORDER = [
    "normal",
    "triangular",
    "bimodal",
    "uniform",
    "exponential",
    "geometric",
    "lognormal"
  ];
  var HOLD_AT_END_MS = 330;
  var cycleSettleAt = null; // ms timestamp when skyline first reached its end state

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


  function getTargetHeightForIndex(i, count, maxH, distName, building) {
    var distFn = distributions[distName] || distributions.normal;
    var t = count > 1 ? i / (count - 1) : 0;
    var shape = distFn(t);
    var edgeLift = building && building.edgeLift != null ? building.edgeLift : rand(10, 24);
    var shapeNoise = building && building.shapeNoise != null ? building.shapeNoise : rand(0.90, 1.08);
    return edgeLift + maxH * shape * shapeNoise;
  }

  function markHeroMorphing(active) {
    if (canvas && canvas.parentElement) {
      canvas.parentElement.classList.toggle("hero-morphing", !!active);
    }
  }

  function morphToDistribution(name) {
    if (!buildings.length) {
      generate();
      return;
    }

    var baseY = H * 0.84;
    var maxH = H * 0.43;
    var now = nowMs();
    buildStartedAt = now;
    cycleSettleAt = null;
    markHeroMorphing(true);

    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      var nextH = getTargetHeightForIndex(i, buildings.length, maxH, name, b);
      b.startH = b.h;
      b.targetH = nextH;
      b.previousBrightness = 0;
      b.startDelay = rand(0, MORPH_STAGGER_MS);
      b.buildDuration = rand(MORPH_MIN_MS, MORPH_MAX_MS);
      b.floorSpacing = Math.max(11, Math.min(18, nextH / 14));
      b.underConstruction = true;
      b.morphing = true;
      b.finishedAt = null;
      b.brightness = 0;
      b.y = baseY - b.h;
    }
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

    var skylineW = W * 0.84;
    var startX = (W - skylineW) / 2;
    var baseY = H * 0.84;

    var count = Math.max(38, Math.round(W / 34));
    var gap = Math.max(2, W * 0.0023);
    var bw = (skylineW - gap * (count - 1)) / count;

    var maxH = H * 0.43;
    var distFn = distributions[currentDistribution] || distributions.normal;

    for (var i = 0; i < count; i++) {
      // Normalized position along the skyline, fed into the chosen
      // distribution function to pick this building's target height.
      var t = count > 1 ? i / (count - 1) : 0;
      var shape = distFn(t);

      var edgeLift = rand(10, 24);
      var shapeNoise = rand(0.90, 1.08);
      // Final (target) height — sits on the chosen distribution.
      var targetH = edgeLift + maxH * shape * shapeNoise;

      // Initial (random) height — drawn from a uniform distribution
      // unrelated to position, so the skyline starts noisy and then
      // "constructs" itself into the chosen distribution.
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
        edgeLift: edgeLift,
        shapeNoise: shapeNoise,
        startDelay: startDelay,
        buildDuration: buildDuration,
        floorSpacing: floorSpacing,
        depth: depth,
        roof: roof,
        windows: windows,
          underConstruction: true
      });
    }

    buildStartedAt = (typeof performance !== "undefined" && performance.now)
      ? performance.now()
      : Date.now();
    cycleSettleAt = null;
    markHeroMorphing(true);

    for (var p = 0; p < 80; p++) {
      particles.push({
        x: rand(0, W),
        y: rand(0, H * 0.48),
        r: rand(0.35, 1.2),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.005, 0.018)
      });
    }
  }

  function drawBackground() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#07050f");
    grad.addColorStop(0.48, "#0a0814");
    grad.addColorStop(1, "#050308");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    var glow = ctx.createRadialGradient(W / 2, H * 0.66, 0, W / 2, H * 0.66, W * 0.48);
    glow.addColorStop(0, "rgba(149,128,199,0.14)");
    glow.addColorStop(0.42, "rgba(149,128,199,0.05)");
    glow.addColorStop(1, "rgba(149,128,199,0)");

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

  // Returns 0..1: average per-building construction progress (eased
  // with smoothstep so the curve fade matches building easing).
  // Also stays at 1 once construction has finished.
  function buildProgress() {
    if (buildings.length === 0) return 0;
    var now = nowMs();
    var elapsed = now - buildStartedAt;
    var sum = 0;
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      var local = elapsed - b.startDelay;
      var raw = local / b.buildDuration;
      if (raw <= 0) raw = 0;
      else if (raw >= 1) raw = 1;
      sum += smoothstep(raw);
    }
    return sum / buildings.length;
  }

  // The curve at progress=0 traces the smoothed (random) building tops;
  // at progress=1 it ALWAYS resolves to the theoretical ideal shape for
  // the active distribution — independent of any noise in the actual
  // building heights. In between it lerps between the two so you watch
  // the data settle into its true distribution.
  function drawBellCurve(baseY, progress) {
    if (buildings.length < 2) return;

    var alpha = Math.min(0.85, progress * 5.5);
    if (alpha <= 0.01) return;

    var lift = 22;
    var smoothWindow = 3;

    var maxH = H * 0.43;
    var distFn = distributions[currentDistribution] || distributions.normal;

    // Compute curve points: blend smoothed traced y with ideal y.
    var pts = [];
    var n = buildings.length;
    for (var i = 0; i < n; i++) {
      var sumH = 0, cnt = 0;
      for (var j = -smoothWindow; j <= smoothWindow; j++) {
        var k = i + j;
        if (k >= 0 && k < n) {
          sumH += buildings[k].h;
          cnt++;
        }
      }
      var tracedY = baseY - (sumH / cnt) - lift;

      // Theoretical ideal y for THIS distribution at this x position
      // (no per-building noise, no rand multipliers).
      var t = n > 1 ? i / (n - 1) : 0;
      var idealH = maxH * distFn(t);
      var idealY = baseY - idealH - lift;

      // progress = 0 → trace random heights; progress = 1 → ideal curve.
      var blendedY = tracedY * (1 - progress) + idealY * progress;

      pts.push({
        x: buildings[i].x + buildings[i].w / 2,
        y: blendedY
      });
    }

    ctx.save();
    ctx.strokeStyle = "rgba(245,242,255," + alpha.toFixed(3) + ")";
    ctx.lineWidth = 2.9;
    ctx.setLineDash([4, 6]);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    // Quadratic Bezier through midpoints — smooth curve regardless of
    // whether it's tracing noisy buildings or the ideal distribution.
    for (var i = 1; i < pts.length - 1; i++) {
      var midX = (pts[i].x + pts[i + 1].x) / 2;
      var midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
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

    // Brightness 0 → 1 after construction. Body / side / top all
    // warm up together so the silhouette gains depth as it matures.
    var bright = b.brightness || 0;
    var bodyColor = lerpRGB(BODY_DARK, BODY_BRIGHT, bright);
    var sideColor = lerpRGB(SIDE_DARK, SIDE_BRIGHT, bright);
    var topColor  = lerpRGB(TOP_DARK,  TOP_BRIGHT,  bright);

    ctx.save();

    // Right depth panel (drawn first, behind body)
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + d, y + d);
    ctx.lineTo(x + w + d, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();

    // Top depth panel
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + d, y + d);
    ctx.lineTo(x + d, y + d);
    ctx.closePath();
    ctx.fill();

    // Solid silhouette body — uniform fill, brightens after construction
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x, y, w, h);

    // Soft glow band just under the top edge
    var glowGrad = ctx.createLinearGradient(x, y, x, y + Math.min(h * 0.4, 60));
    glowGrad.addColorStop(0, TOP_GLOW);
    glowGrad.addColorStop(1, "rgba(188,174,226,0)");
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
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x + w * 0.22, y - 4, w * 0.56, 4);
        ctx.strokeStyle = TOP_EDGE;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + w * 0.22, y - 4, w * 0.56, 4);
      }
    }

    ctx.restore();
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

  // True when every building has finished resizing into the active distribution.
  function skylineSettled() {
    if (buildings.length === 0) return false;
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (b.underConstruction) return false;
    }
    return true;
  }

  // Drives the auto-cycle: once the skyline settles, wait briefly and advance.
  function tickAutoCycle(now) {
    if (skylineSettled()) {
      markHeroMorphing(false);
      if (cycleSettleAt === null) {
        cycleSettleAt = now;
      } else if (now - cycleSettleAt >= HOLD_AT_END_MS) {
        var idx = CYCLE_ORDER.indexOf(currentDistribution);
        if (idx < 0) idx = 0;
        var next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
        setDistribution(next);
      }
    } else {
      cycleSettleAt = null;
    }
  }

  // Switches the active distribution, updates the dot UI, and kicks
  // off a fresh construction cycle.
  function setDistribution(name) {
    if (!distributions[name]) return;
    currentDistribution = name;
    var dots = document.querySelectorAll(".hero-dot");
    for (var k = 0; k < dots.length; k++) {
      var isActive = dots[k].getAttribute("data-dist") === name;
      dots[k].classList.toggle("active", isActive);
    }
    cycleSettleAt = null;
    morphToDistribution(name);
  }

  function draw() {
    frame++;
    var baseY = H * 0.84;
    var now = nowMs();
    var elapsed = now - buildStartedAt;

    // Advance construction: each building lerps from its random start
    // height toward its bell-curve target height, on its own schedule.
    // Once finished, it stops animating until the next distribution cycle.
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];

      if (b.underConstruction) {
        var local = elapsed - b.startDelay;
        if (local <= 0) {
          b.h = b.startH;
        } else if (local >= b.buildDuration) {
          b.h = b.targetH;
          b.underConstruction = false;
          b.morphing = false;
          b.finishedAt = now;
        } else {
          var t = local / b.buildDuration;
          var eased = smoothstep(t);
          b.h = b.startH + (b.targetH - b.startH) * eased;
        }
        b.y = baseY - b.h;
        b.brightness = 0;
      } else {
        b.brightness = 0;
      }
    }

    // Advance through distributions automatically once the skyline settles.
    tickAutoCycle(now);

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

    drawBellCurve(baseY, buildProgress());

    for (var i = 0; i < buildings.length; i++) {
      drawBuilding(buildings[i]);
    }


    drawReflection(baseY);

    requestAnimationFrame(draw);
  }

  // ── Controls: replay button + distribution selector dots ──
  // Manual interaction also resets the auto-cycle timer (via
  // setDistribution / by clearing cycleSettleAt) so we don't immediately
  // jump to the next distribution right after the user picks one.
  var replayBtn = document.getElementById("hero-replay");
  if (replayBtn) {
    replayBtn.addEventListener("click", function () {
      cycleSettleAt = null;
      generate();
    });
  }

  var dots = document.querySelectorAll(".hero-dot");
  for (var di = 0; di < dots.length; di++) {
    (function (dot) {
      dot.addEventListener("click", function () {
        var name = dot.getAttribute("data-dist");
        if (name) setDistribution(name);
      });
    })(dots[di]);
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



// ───────── ABOUT FAB WORKFLOW BACKGROUND ─────────
// This section is CSS-driven: lots, wafers, stations, scanners, and robot arms animate in style.css.

