/* ==========================================================
   script.js — Green / Black Distribution Skyline · Stable Floating Bubbles
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

// Engineering-paper portfolio interactions: train stops, education chips, and project cards.
(function () {
  function activateWithin(selector, item) {
    document.querySelectorAll(selector).forEach(function (other) {
      other.classList.toggle('is-active', other === item);
    });
  }

  var expCards = Array.prototype.slice.call(document.querySelectorAll('[data-exp-card]'));
  var expIndex = 0;
  var expHoldUntil = 0;

  function activateExperience(index) {
    if (!expCards.length) return;
    expIndex = (index + expCards.length) % expCards.length;
    expCards.forEach(function (card, i) {
      card.classList.toggle('is-active', i === expIndex);
    });
  }

  if (expCards.length) {
    activateExperience(0);
    setInterval(function () {
      if (Date.now() < expHoldUntil) return;
      activateExperience(expIndex + 1);
    }, 5000);
  }

  expCards.forEach(function (card, index) {
    card.addEventListener('click', function () {
      expHoldUntil = Date.now() + 11000;
      activateExperience(index);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        expHoldUntil = Date.now() + 11000;
        activateExperience(index);
      }
    });
  });

  var paperNote = document.getElementById('paperNoteText');
  document.querySelectorAll('.paper-chip').forEach(function (chip) {
    function activateChip() {
      activateWithin('.paper-chip', chip);
      if (paperNote) paperNote.textContent = chip.getAttribute('data-paper-note') || '';
    }

    chip.addEventListener('click', activateChip);
    chip.addEventListener('mouseenter', activateChip);
  });

  document.querySelectorAll('[data-project-card]').forEach(function (card) {
    card.addEventListener('click', function () {
      document.querySelectorAll('[data-project-card]').forEach(function (other) {
        other.classList.toggle('is-open', other === card ? !card.classList.contains('is-open') : false);
      });
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.click();
      }
    });
  });
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

  // ── Dark purple/blue site palette + motion-state building colors ──
  // Body colors are selected per frame:
  //   rising  -> green
  //   falling -> red
  //   settled -> grey
  var RISE_BODY    = [8, 96, 62];                // green, rising
  var RISE_SIDE    = [3, 45, 32];
  var RISE_TOP     = [32, 186, 121];

  var FALL_BODY    = [122, 28, 38];              // red, falling
  var FALL_SIDE    = [58, 12, 20];
  var FALL_TOP     = [248, 91, 91];

  var SETTLE_BODY  = [58, 63, 73];               // grey, settled
  var SETTLE_SIDE  = [27, 31, 38];
  var SETTLE_TOP   = [107, 114, 128];

  var DETAIL_BODY  = [11, 18, 32];               // blue-black detail shadows
  var TOP_EDGE     = "rgba(236,242,255,0.92)";
  var TOP_GLOW     = "rgba(129,140,248,0.16)";
  var FLOOR_LINE   = "rgba(236,242,255,0.13)";
  var ACCENT_LINE  = "rgba(236,242,255,0.42)";
  var WINDOW_LIT   = "rgba(248,250,252,0.92)";
  var WINDOW_DIM   = "rgba(148,163,184,0.34)";
  var WINDOW_RISE  = "rgba(167,243,208,0.66)";
  var WINDOW_FALL  = "rgba(254,202,202,0.62)";

  function getBuildingPalette(b) {
    if (b.motionState === "rising") {
      return { body: RISE_BODY, side: RISE_SIDE, top: RISE_TOP, window: WINDOW_RISE, glow: "rgba(34,197,94,0.20)" };
    }
    if (b.motionState === "falling") {
      return { body: FALL_BODY, side: FALL_SIDE, top: FALL_TOP, window: WINDOW_FALL, glow: "rgba(239,68,68,0.20)" };
    }
    return { body: SETTLE_BODY, side: SETTLE_SIDE, top: SETTLE_TOP, window: WINDOW_DIM, glow: "rgba(148,163,184,0.16)" };
  }

  var BRIGHTEN_MS = 0; // bright-green finish removed
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
  var SCAFFOLD     = "rgba(226,232,255,0.32)";

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
      b.floorSpacing = Math.max(10, Math.min(17, Math.max(b.startH, nextH) / 15));
      b.windows = createWindowGrid(b.w, Math.max(b.startH, nextH), b.floorSpacing);
      b.motionState = nextH > b.startH + 0.8 ? "rising" : (nextH < b.startH - 0.8 ? "falling" : "settled");
      b.underConstruction = true;
      b.morphing = true;
      b.finishedAt = null;
      b.brightness = 0;
      b.y = baseY - b.h;
    }
  }


  function createWindowGrid(buildingWidth, maxHeight, floorSpacing) {
    var rows = Math.max(3, Math.floor(maxHeight / floorSpacing));
    var cols = Math.max(2, Math.floor(buildingWidth / 8));
    var windows = [];

    for (var r = 1; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        // Slightly denser than before so non-normal distributions do not look blank.
        if (Math.random() > 0.18) {
          windows.push({
            x: (col + 0.5) * (buildingWidth / cols),
            yFromGround: (rows - r) * floorSpacing,
            lit: Math.random() > 0.48,
            pulse: rand(0, Math.PI * 2)
          });
        }
      }
    }

    return windows;
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

    var skylineW = W * 0.88;
    var startX = (W - skylineW) / 2;
    var baseY = H * 0.84;

    var count = Math.max(30, Math.round(W / 46));
    var gap = Math.max(2, W * 0.0018);
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
      var startDelay = rand(0, MORPH_STAGGER_MS);
      var buildDuration = rand(MORPH_MIN_MS, MORPH_MAX_MS);

      var x = startX + i * (bw + gap);

      var depth = Math.max(4, bw * rand(0.18, 0.28));
      var roof = Math.random() > 0.72 ? "cap" : (Math.random() > 0.84 ? "spire" : "flat");
      var antenna = Math.random() > 0.72;
      var inset = rand(0.10, 0.18);

      // Window grid is sized to the tallest height involved in this cycle,
      // not only the first distribution. This keeps windows visible when
      // later distributions morph a short building into a tall one.
      var floorSpacing = Math.max(10, Math.min(17, targetH / 15));
      var windows = createWindowGrid(bw, Math.max(startH, targetH), floorSpacing);

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
        antenna: antenna,
        inset: inset,
        windows: windows,
        motionState: targetH > startH + 0.8 ? "rising" : (targetH < startH - 0.8 ? "falling" : "settled"),
        facadeSeed: Math.random(),
        detailBandEvery: Math.floor(rand(3, 6)),
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
    ctx.fillStyle = "#f7f3e8";
    ctx.fillRect(0, 0, W, H);

    var glow = ctx.createRadialGradient(W / 2, H * 0.66, 0, W / 2, H * 0.66, W * 0.48);
    glow.addColorStop(0, "rgba(16,185,129,0.10)");
    glow.addColorStop(0.42, "rgba(239,68,68,0.06)");
    glow.addColorStop(1, "rgba(16,185,129,0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  function drawSubtleGrid(baseY) {
    ctx.save();

    ctx.strokeStyle = "rgba(17,24,39,0.14)";
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
    ctx.strokeStyle = "rgba(0,0,0," + alpha.toFixed(3) + ")";
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

    var palette = getBuildingPalette(b);
    var bodyColor = lerpRGB(DETAIL_BODY, palette.body, 0.86);
    var sideColor = lerpRGB(DETAIL_BODY, palette.side, 0.92);
    var topColor  = lerpRGB(DETAIL_BODY, palette.top, 0.90);

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
    glowGrad.addColorStop(0, palette.glow);
    glowGrad.addColorStop(1, "rgba(15,23,42,0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(x, y, w, Math.min(h * 0.4, 60));

    // Subtle inset facade panel for wider buildings.
    var inset = b.inset || 0.14;
    var panelX = x + w * inset;
    var panelW = w * (1 - inset * 2);
    ctx.fillStyle = "rgba(255,255,255,0.026)";
    ctx.fillRect(panelX, y + 4, panelW, Math.max(0, h - 4));

    // Center facade bevel and lower equipment band add detail without changing silhouette.
    var bevelW = Math.max(1, w * 0.045);
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    ctx.fillRect(x + w * 0.14, y + 6, bevelW, Math.max(0, h - 10));
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x + w * 0.72, y + 8, Math.max(1, w * 0.08), Math.max(0, h - 12));

    var bandEvery = Math.max(3, b.detailBandEvery || 4);
    ctx.strokeStyle = "rgba(255,255,255,0.075)";
    ctx.lineWidth = 0.75;
    for (var band = floorSpacing * bandEvery; band < h; band += floorSpacing * bandEvery) {
      var by = groundY - band;
      ctx.beginPath();
      ctx.moveTo(x + 1, by + 0.5);
      ctx.lineTo(x + w - 1, by + 0.5);
      ctx.stroke();
    }

    // Vertical mullions make wider buildings feel more architectural.
    ctx.strokeStyle = "rgba(226,232,255,0.12)";
    ctx.lineWidth = 0.65;
    var mullions = Math.max(2, Math.floor(w / 9));
    for (var mv = 1; mv < mullions; mv++) {
      var mx = x + (mv / mullions) * w;
      ctx.beginPath();
      ctx.moveTo(mx, y + 3);
      ctx.lineTo(mx, groundY - 1);
      ctx.stroke();
    }

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
      var wx = x + win.x - ww / 2;
      var wy = groundY - win.yFromGround - wh / 2;
      ctx.fillStyle = "rgba(0,0,0,0.20)";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(wx - 0.6, wy - 0.6, ww + 1.2, wh + 1.2);
      ctx.fillStyle = win.lit ? WINDOW_LIT : palette.window;
      ctx.globalAlpha = win.lit ? 0.82 : 0.48;
      ctx.fillRect(wx, wy, ww, wh);
    }
    // Side-panel windows add depth without brightening the whole skyline.
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = palette.window;
    var sideCols = 1;
    var sideW = Math.max(1.4, d * 0.22);
    for (var sf = floorSpacing * 1.4; sf < h; sf += floorSpacing * 1.65) {
      var sy = groundY - sf;
      for (var sc = 0; sc < sideCols; sc++) {
        ctx.fillRect(x + w + d * 0.42, sy - 1, sideW, 2.2);
      }
    }
    ctx.globalAlpha = 1;

    // Thin roof outline across the depth panel.
    ctx.strokeStyle = "rgba(226,232,255,0.42)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + w, y + 0.5);
    ctx.lineTo(x + w + d, y + d + 0.5);
    ctx.stroke();

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

      if (b.antenna) {
        ctx.strokeStyle = "rgba(226,232,255,0.55)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.72, y);
        ctx.lineTo(x + w * 0.72, y - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + w * 0.72, y - 11, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(226,232,255,0.70)";
        ctx.fill();
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
          b.motionState = b.targetH > b.startH + 0.8 ? "rising" : (b.targetH < b.startH - 0.8 ? "falling" : "settled");
        } else if (local >= b.buildDuration) {
          b.h = b.targetH;
          b.underConstruction = false;
          b.morphing = false;
          b.finishedAt = now;
          b.motionState = "settled";
        } else {
          var t = local / b.buildDuration;
          var eased = smoothstep(t);
          b.h = b.startH + (b.targetH - b.startH) * eased;
          b.motionState = b.targetH > b.startH + 0.8 ? "rising" : (b.targetH < b.startH - 0.8 ? "falling" : "settled");
        }
        b.y = baseY - b.h;
        b.brightness = 0;
      } else {
        b.motionState = "settled";
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
    { x: 0.50, y: 0.38 },
    { x: 0.15, y: 0.55 },
    { x: 0.82, y: 0.70 }
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


// ───────── INTERACTIVE CARD EXPANSION ─────────
// Resume entries and legacy project cards use the same expand/collapse behavior.
(function () {
  var groups = document.querySelectorAll(".projects-grid-quad, .resume-grid");
  if (!groups.length) return;

  groups.forEach(function (group) {
    var cards = group.querySelectorAll(".project-card");
    if (!cards.length) return;

    cards.forEach(function (card) {
      card.addEventListener("click", function () {
        var wasExpanded = card.classList.contains("expanded");

        cards.forEach(function (other) {
          other.classList.remove("expanded");
        });

        if (!wasExpanded) {
          card.classList.add("expanded");
        }
      });
    });
  });
})();

// ───────── RESUME HOVER/CLICK INTERACTIONS v120 ─────────
// Desktop: hover/focus reveals animation. Touch/mobile: tap toggles it.
(function () {
  var entries = Array.prototype.slice.call(document.querySelectorAll('.resume-hover-entry'));
  if (!entries.length) return;

  function closeOthers(active) {
    entries.forEach(function (entry) {
      if (entry !== active) entry.classList.remove('resume-active');
    });
  }

  entries.forEach(function (entry) {
    entry.addEventListener('click', function (e) {
      closeOthers(entry);
      entry.classList.toggle('resume-active');
      e.stopPropagation();
    });

    entry.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeOthers(entry);
        entry.classList.toggle('resume-active');
      }
    });

    entry.addEventListener('mouseenter', function () {
      closeOthers(entry);
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.resume-hover-entry')) {
      entries.forEach(function (entry) {
        entry.classList.remove('resume-active');
      });
    }
  });
})();

// ───────── WHOLE RESUME HOVER / TAP ANIMATION TOGGLE ─────────
(function () {
  var paper = document.querySelector('.resume-story-paper');
  if (!paper) return;

  paper.addEventListener('click', function (event) {
    if (event.target.closest('a')) return;
    paper.classList.toggle('resume-paper-active');
  });

  paper.addEventListener('mouseleave', function () {
    paper.classList.remove('resume-paper-active');
  });
})();


// ───────── RESUME ENTRY EXPANSION v141 ─────────
(function () {
  var entries = Array.prototype.slice.call(document.querySelectorAll('.resume-entry.is-expandable'));
  if (!entries.length) return;

  function closeOthers(active) {
    entries.forEach(function (entry) {
      if (entry !== active) {
        entry.classList.remove('is-open');
        var btn = entry.querySelector('.resume-entry-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  entries.forEach(function (entry) {
    var btn = entry.querySelector('.resume-entry-toggle');

    function toggleEntry(e) {
      if (e) e.preventDefault();
      var willOpen = !entry.classList.contains('is-open');
      closeOthers(entry);
      entry.classList.toggle('is-open', willOpen);
      if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    }

    entry.addEventListener('click', function (e) {
      if (e.target.closest('.resume-entry-toggle') || e.target.closest('.resume-entry-head') || e.target === entry) {
        toggleEntry(e);
      }
    });

    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleEntry(e);
      });
    }

    entry.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        toggleEntry(e);
      }
    });
  });
})();


// ───────── LICHESS LIVE STATS ─────────
(function () {
  var LICHESS_USER = "an_d22";
  var API_URL = "https://lichess.org/api/user/" + LICHESS_USER;

  // Which time controls to display (in order).
  var PERFS = ["bullet", "blitz", "rapid", "classical"];

  function formatNumber(n) {
    if (n == null) return "—";
    return n.toLocaleString();
  }

  function populateRatings(data) {
    var perfs = data.perfs || {};

    PERFS.forEach(function (key) {
      var card = document.querySelector('.lichess-card[data-perf="' + key + '"]');
      if (!card) return;

      var perf = perfs[key];
      if (!perf || !perf.games) {
        card.querySelector(".lichess-card-rating").textContent = "—";
        card.querySelector(".lichess-games").textContent = "0 games";
        return;
      }

      card.querySelector(".lichess-card-rating").textContent = perf.rating;
      card.querySelector(".lichess-games").textContent = formatNumber(perf.games) + " games";

      var progEl = card.querySelector(".lichess-prog");
      if (perf.prog > 0) {
        progEl.className = "lichess-prog up";
        progEl.textContent = perf.prog;
      } else if (perf.prog < 0) {
        progEl.className = "lichess-prog down";
        progEl.textContent = Math.abs(perf.prog);
      } else {
        progEl.className = "lichess-prog flat";
        progEl.textContent = "—";
      }
    });
  }

  function populateSummary(data) {
    var count = data.count || {};
    var total = count.all || 0;
    var wins = count.win || 0;
    var losses = count.loss || 0;
    var draws = count.draw || 0;

    document.getElementById("lichess-total").textContent = formatNumber(total);
    document.getElementById("lichess-wins").textContent = formatNumber(wins);
    document.getElementById("lichess-losses").textContent = formatNumber(losses);
    document.getElementById("lichess-draws").textContent = formatNumber(draws);

    // Win-rate bar
    if (total > 0) {
      document.getElementById("bar-win").style.width = ((wins / total) * 100).toFixed(1) + "%";
      document.getElementById("bar-draw").style.width = ((draws / total) * 100).toFixed(1) + "%";
      document.getElementById("bar-loss").style.width = ((losses / total) * 100).toFixed(1) + "%";
    }
  }

  fetch(API_URL, { headers: { Accept: "application/json" } })
    .then(function (res) {
      if (!res.ok) throw new Error("Lichess API " + res.status);
      return res.json();
    })
    .then(function (data) {
      populateRatings(data);
      populateSummary(data);
    })
    .catch(function (err) {
      console.warn("Lichess stats unavailable:", err);
    });
})();

/* ================================================================
   Opening Board Animations
   ================================================================ */
(function () {
  var PIECE_MAP = {
    K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
  };

  var INITIAL = [
    ["r","n","b","q","k","b","n","r"],
    ["p","p","p","p","p","p","p","p"],
    [" "," "," "," "," "," "," "," "],
    [" "," "," "," "," "," "," "," "],
    [" "," "," "," "," "," "," "," "],
    [" "," "," "," "," "," "," "," "],
    ["P","P","P","P","P","P","P","P"],
    ["R","N","B","Q","K","B","N","R"]
  ];

  // Each move: [[fromRow, fromCol], [toRow, toCol]]
  // Row 0 = rank 8 (black back), Row 7 = rank 1 (white back)
  // Col 0 = a-file, Col 7 = h-file
  var OPENINGS = {
    "goring-gambit": [
      [[6,4],[4,4]],  // 1. e4
      [[1,4],[3,4]],  //    e5
      [[7,6],[5,5]],  // 2. Nf3
      [[0,1],[2,2]],  //    Nc6
      [[6,3],[4,3]],  // 3. d4
      [[3,4],[4,3]],  //    exd4
      [[6,2],[5,2]]   // 4. c3
    ],
    "caro-kann": [
      [[6,4],[4,4]],  // 1. e4
      [[1,2],[2,2]],  //    c6
      [[6,3],[4,3]],  // 2. d4
      [[1,3],[3,3]]   //    d5
    ],
    "italian": [
      [[6,4],[4,4]],  // 1. e4
      [[1,4],[3,4]],  //    e5
      [[7,6],[5,5]],  // 2. Nf3
      [[0,1],[2,2]],  //    Nc6
      [[7,5],[4,2]]   // 3. Bc4
    ],
    "modern": [
      [[6,4],[4,4]],  // 1. e4
      [[1,6],[2,6]],  //    g6
      [[6,3],[4,3]],  // 2. d4
      [[0,5],[1,6]]   //    Bg7
    ],
    "scotch": [
      [[6,4],[4,4]],  // 1. e4
      [[1,4],[3,4]],  //    e5
      [[7,6],[5,5]],  // 2. Nf3
      [[0,1],[2,2]],  //    Nc6
      [[6,3],[4,3]],  // 3. d4
      [[3,4],[4,3]],  //    exd4
      [[5,5],[4,3]]   // 4. Nxd4
    ]
  };

  function cloneBoard(b) {
    return b.map(function (r) { return r.slice(); });
  }

  function applyMove(board, move) {
    var b = cloneBoard(board);
    b[move[1][0]][move[1][1]] = b[move[0][0]][move[0][1]];
    b[move[0][0]][move[0][1]] = " ";
    return b;
  }

  function renderBoard(el, board, lastMove) {
    el.innerHTML = "";
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = document.createElement("div");
        var isLight = (r + c) % 2 === 0;
        sq.className = "lichess-sq " + (isLight ? "light" : "dark");
        if (lastMove) {
          if ((r === lastMove[0][0] && c === lastMove[0][1]) ||
              (r === lastMove[1][0] && c === lastMove[1][1])) {
            sq.classList.add("highlight");
          }
        }
        var piece = board[r][c];
        if (piece && piece !== " ") {
          var span = document.createElement("span");
          span.className = "lichess-piece " + (piece === piece.toUpperCase() ? "white" : "black");
          span.textContent = PIECE_MAP[piece];
          sq.appendChild(span);
        }
        el.appendChild(sq);
      }
    }
  }

  var states = {};

  function initBoard(key) {
    var el = document.getElementById("board-" + key);
    if (!el) return;
    states[key] = {
      el: el,
      moves: OPENINGS[key] || [],
      step: 0,
      board: cloneBoard(INITIAL),
      timer: null
    };
    renderBoard(el, states[key].board, null);
  }

  function stepForward(key) {
    var s = states[key];
    if (!s || s.step >= s.moves.length) return false;
    var move = s.moves[s.step];
    s.board = applyMove(s.board, move);
    s.step++;
    renderBoard(s.el, s.board, move);
    return s.step < s.moves.length;
  }

  function resetBoard(key) {
    var s = states[key];
    if (!s) return;
    stopPlay(key);
    s.board = cloneBoard(INITIAL);
    s.step = 0;
    renderBoard(s.el, s.board, null);
    updatePlayBtn(key, false);
  }

  function stopPlay(key) {
    var s = states[key];
    if (s && s.timer) {
      clearInterval(s.timer);
      s.timer = null;
    }
  }

  function updatePlayBtn(key, playing) {
    var item = document.querySelector('[data-opening="' + key + '"]');
    if (!item) return;
    var icon = item.querySelector(".lichess-play-btn i");
    if (icon) icon.className = playing ? "fas fa-pause" : "fas fa-play";
  }

  function togglePlay(key) {
    var s = states[key];
    if (!s) return;
    if (s.timer) {
      stopPlay(key);
      updatePlayBtn(key, false);
      return;
    }
    if (s.step >= s.moves.length) resetBoard(key);
    updatePlayBtn(key, true);
    stepForward(key);
    s.timer = setInterval(function () {
      if (!stepForward(key)) {
        stopPlay(key);
        updatePlayBtn(key, false);
      }
    }, 800);
  }

  // Wire up expand / collapse
  var items = document.querySelectorAll(".lichess-opening-item");
  items.forEach(function (item) {
    var key = item.getAttribute("data-opening");
    var toggle = item.querySelector(".lichess-opening-toggle");

    toggle.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");

      // Close every other card first
      items.forEach(function (other) {
        var ok = other.getAttribute("data-opening");
        other.classList.remove("is-open");
        other.querySelector(".lichess-opening-toggle").setAttribute("aria-expanded", "false");
        stopPlay(ok);
        updatePlayBtn(ok, false);
      });

      if (!isOpen) {
        item.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
        if (!states[key]) initBoard(key);
        else resetBoard(key);
      }
    });

    // Board control buttons
    item.querySelectorAll(".lichess-ctrl-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var action = btn.getAttribute("data-action");
        if (action === "reset") {
          resetBoard(key);
        } else if (action === "play") {
          togglePlay(key);
        } else if (action === "step") {
          stopPlay(key);
          updatePlayBtn(key, false);
          if (states[key] && states[key].step >= states[key].moves.length) resetBoard(key);
          stepForward(key);
        }
      });
    });
  });
})();

/* ================================================================
   Pitch Analytics – NCAA D1 half-field zone stats
   ================================================================ */
(function () {
  /* ---------- data ---------- */
  var ZONES = {
    "six-yard": {
      label: "6-Yard Box",
      desc: "Close-range finishes, tap-ins, and goal-mouth scrambles",
      heat: "hot",
      men:   { xG: 0.68, xA: 0.04, shotAcc: 72, goalPct: 28 },
      women: { xG: 0.63, xA: 0.05, shotAcc: 69, goalPct: 26 }
    },
    "penalty-area": {
      label: "Penalty Area",
      desc: "Primary shooting zone inside the 18-yard box",
      heat: "hot",
      men:   { xG: 0.28, xA: 0.08, shotAcc: 51, goalPct: 38 },
      women: { xG: 0.25, xA: 0.09, shotAcc: 48, goalPct: 36 }
    },
    "left-wing": {
      label: "Left Wing",
      desc: "Wide channel — crosses, cutbacks, driven balls",
      heat: "cold",
      men:   { xG: 0.06, xA: 0.18, shotAcc: 32, goalPct: 5 },
      women: { xG: 0.05, xA: 0.16, shotAcc: 30, goalPct: 6 }
    },
    "right-wing": {
      label: "Right Wing",
      desc: "Wide channel — crosses, cutbacks, driven balls",
      heat: "cold",
      men:   { xG: 0.07, xA: 0.20, shotAcc: 34, goalPct: 6 },
      women: { xG: 0.06, xA: 0.18, shotAcc: 33, goalPct: 7 }
    },
    "edge-of-box": {
      label: "Edge of Box",
      desc: "The D — set pieces, long-range strikes, through balls",
      heat: "warm",
      men:   { xG: 0.08, xA: 0.14, shotAcc: 38, goalPct: 16 },
      women: { xG: 0.07, xA: 0.13, shotAcc: 36, goalPct: 18 }
    },
    "deep-half": {
      label: "Deep Midfield",
      desc: "Long-range distribution and switches of play",
      heat: "cold",
      men:   { xG: 0.03, xA: 0.10, shotAcc: 24, goalPct: 7 },
      women: { xG: 0.02, xA: 0.09, shotAcc: 22, goalPct: 7 }
    }
  };

  /* ---------- 4-4-2 formation positions per zone ---------- */
  // order: gk, lb, lcb, rcb, rb, lm, lcm, rcm, rm, lst, rst
  var PLAYER_IDS = ["pp-gk","pp-lb","pp-lcb","pp-rcb","pp-rb","pp-lm","pp-lcm","pp-rcm","pp-rm","pp-lst","pp-rst"];

  var FORMATIONS = {
    "default": [
      [250,355],[70,275],[185,285],[315,285],[430,275],
      [70,195],[195,200],[305,200],[430,195],
      [195,100],[305,100]
    ],
    "six-yard": [
      [250,355],[95,215],[190,225],[310,225],[405,215],
      [115,125],[215,110],[285,110],[385,125],
      [225,38],[275,38]
    ],
    "penalty-area": [
      [250,355],[85,230],[190,240],[310,240],[415,230],
      [115,140],[215,125],[285,125],[385,140],
      [215,70],[285,70]
    ],
    "left-wing": [
      [250,355],[42,195],[155,260],[305,285],[415,280],
      [38,115],[160,170],[300,205],[405,215],
      [95,65],[265,90]
    ],
    "right-wing": [
      [250,355],[85,280],[195,285],[345,260],[458,195],
      [95,215],[200,205],[340,170],[462,115],
      [235,90],[405,65]
    ],
    "edge-of-box": [
      [250,355],[75,250],[185,255],[315,255],[425,250],
      [110,160],[210,148],[290,148],[390,160],
      [210,100],[290,100]
    ],
    "deep-half": [
      [250,355],[75,300],[185,310],[315,310],[425,300],
      [80,238],[195,242],[305,242],[420,238],
      [200,175],[300,175]
    ]
  };

  function moveFormation(key) {
    var pos = FORMATIONS[key] || FORMATIONS["default"];
    PLAYER_IDS.forEach(function (id, i) {
      var el = document.getElementById(id);
      if (!el || !pos[i]) return;
      el.setAttribute("cx", pos[i][0]);
      el.setAttribute("cy", pos[i][1]);
    });
  }

  var STAT_META = [
    { key: "xG",      label: "xG per Shot",        fmt: "dec", positive: true  },
    { key: "xA",      label: "xA per Key Pass",     fmt: "dec", positive: true  },
    { key: "shotAcc", label: "Shot Accuracy",        fmt: "pct", positive: true  },
    { key: "goalPct", label: "Share of Total Goals",  fmt: "pct", positive: true  }
  ];

  var gender = "men";
  var activeZone = null;
  var panel = document.getElementById("pitch-stats-panel");
  var zones = document.querySelectorAll(".pitch-zone");

  /* ---------- helpers ---------- */
  function allValues(statKey) {
    var vals = [];
    Object.keys(ZONES).forEach(function (z) { vals.push(ZONES[z][gender][statKey]); });
    return vals;
  }

  function percentile(val, arr) {
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var below = 0;
    sorted.forEach(function (v) { if (v < val) below++; });
    return below / (sorted.length - 1 || 1);
  }

  function statColor(pct) {
    if (pct >= 0.6) return "stat-green";
    if (pct >= 0.3) return "stat-amber";
    return "stat-red";
  }

  function strokeColor(pct) {
    if (pct >= 0.6) return "#16a34a";
    if (pct >= 0.3) return "#d97706";
    return "#dc2626";
  }

  /* ---------- mini distribution SVG ---------- */
  function buildDistSVG(value, statKey) {
    var all = allValues(statKey);
    var min = Math.min.apply(null, all);
    var max = Math.max.apply(null, all);
    var range = max - min || 1;
    var pad = range * 0.18;
    var lo = min - pad;
    var hi = max + pad;
    var span = hi - lo;
    var mean = all.reduce(function (a, b) { return a + b; }, 0) / all.length;
    var variance = all.reduce(function (a, b) { return a + Math.pow(b - mean, 2); }, 0) / all.length;
    var std = Math.sqrt(variance) || span / 5;

    var W = 160, H = 44, base = 40, top = 6;

    function xPos(v) { return ((v - lo) / span) * W; }
    function gauss(x) { return Math.exp(-0.5 * Math.pow((x - mean) / std, 2)); }

    // build curve points
    var pts = [];
    for (var i = 0; i <= W; i += 2) {
      var v = lo + (i / W) * span;
      var y = base - gauss(v) * (base - top);
      pts.push(i + "," + y.toFixed(1));
    }

    var pct = percentile(value, all);
    var col = strokeColor(pct);
    var mx = xPos(value);
    var my = base - gauss(value) * (base - top);

    // zone dots
    var dots = "";
    all.forEach(function (v) {
      var dx = xPos(v);
      dots += '<circle class="pitch-dist-zone-dot" cx="' + dx.toFixed(1) + '" cy="' + base + '" r="2" fill="#d1d5db"/>';
    });

    var svg =
      '<svg class="pitch-dist-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' +
      '<path class="pitch-dist-fill" d="M0,' + base + ' L' + pts.join(" L") + ' L' + W + ',' + base + ' Z"/>' +
      '<polyline class="pitch-dist-stroke" points="' + pts.join(" ") + '"/>' +
      dots +
      '<line class="pitch-dist-marker" x1="' + mx.toFixed(1) + '" y1="' + (my - 2).toFixed(1) +
        '" x2="' + mx.toFixed(1) + '" y2="' + base + '" stroke="' + col + '" stroke-dasharray="3 2"/>' +
      '<circle class="pitch-dist-dot" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="3.5" fill="' + col + '"/>' +
      '</svg>';
    return svg;
  }

  /* ---------- render stats panel ---------- */
  function renderPanel(zoneKey) {
    var z = ZONES[zoneKey];
    var d = z[gender];
    var html = '<h3 class="pitch-zone-title">' + z.label + '</h3>' +
               '<p class="pitch-zone-desc">' + z.desc + '</p>';

    STAT_META.forEach(function (meta) {
      var val = d[meta.key];
      var all = allValues(meta.key);
      var pct = percentile(val, all);
      var display = meta.fmt === "dec" ? val.toFixed(2) : val + "%";
      html += '<div class="pitch-stat-row">' +
        '<div class="pitch-stat-header">' +
          '<span class="pitch-stat-label">' + meta.label + '</span>' +
          '<span class="pitch-stat-value ' + statColor(pct) + '">' + display + '</span>' +
        '</div>' +
        buildDistSVG(val, meta.key) +
        '</div>';
    });

    panel.innerHTML = html;
  }

  /* ---------- zone click ---------- */
  function selectZone(zoneKey) {
    activeZone = zoneKey;
    var z = ZONES[zoneKey];
    zones.forEach(function (el) {
      el.classList.remove("zone-hot", "zone-warm", "zone-cold");
    });
    var clicked = document.querySelector('.pitch-zone[data-zone="' + zoneKey + '"]');
    if (clicked) clicked.classList.add("zone-" + z.heat);
    moveFormation(zoneKey);
    renderPanel(zoneKey);
  }

  zones.forEach(function (el) {
    el.addEventListener("click", function () {
      selectZone(el.getAttribute("data-zone"));
    });
  });

  /* ---------- gender toggle ---------- */
  var toggleBtns = document.querySelectorAll(".pitch-toggle-btn");
  toggleBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      toggleBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      gender = btn.getAttribute("data-gender");
      if (activeZone) renderPanel(activeZone);
    });
  });
})();
