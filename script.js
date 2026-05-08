/* ==========================================================
   script.js — Dark Distribution Skyline · Stable Floating Bubbles
   ========================================================== */

// ───────── REGRESSION FIT REVEAL ─────────
(function () {
  var phrase = "The best way to predict the future is to create it!";
  var el = document.getElementById("regression-text");
  if (!el) return;

  var spans = [];
  var glyphStates = [];

  // Build spans and randomized initial states (scattered above/below baseline)
  for (var i = 0; i < phrase.length; i++) {
    var s = document.createElement("span");
    s.className = "glyph" + (phrase[i] === " " ? " space" : "");
    s.textContent = phrase[i];
    el.appendChild(s);
    spans.push(s);
    glyphStates.push(makeInitialState());
  }

  function makeInitialState() {
    return {
      // Vertical scatter (above/below final baseline)
      offsetY: (Math.random() - 0.5) * 56,
      // Horizontal jitter
      offsetX: (Math.random() - 0.5) * 14,
      // Some letters start faded
      startOpacity: 0.18 + Math.random() * 0.42
    };
  }

  // Easing — fast initial pull-in, gentle settle (like a model converging)
  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  var fitDuration = 2600;   // ms for letters to converge
  var holdDuration = 4200;  // ms to hold the fitted line before refitting
  var animationStart = null;
  var phase = "fitting";    // "fitting" | "holding"

  function frame(now) {
    if (animationStart === null) animationStart = now;

    if (phase === "fitting") {
      var elapsed = now - animationStart;
      var t = Math.min(elapsed / fitDuration, 1);
      var eased = easeOutQuart(t);
      var residual = 1 - eased;          // shrinking residual noise
      var noiseAmp = 3.2 * residual;     // small jitter that fades

      for (var i = 0; i < spans.length; i++) {
        if (phrase[i] === " ") continue;
        var st = glyphStates[i];

        var y = st.offsetY * residual + (Math.random() - 0.5) * noiseAmp;
        var x = st.offsetX * residual + (Math.random() - 0.5) * noiseAmp * 0.6;
        var opacity = st.startOpacity + (1 - st.startOpacity) * eased;

        spans[i].style.transform = "translate(" + x.toFixed(2) + "px, " + y.toFixed(2) + "px)";
        spans[i].style.opacity = opacity.toFixed(3);
      }

      if (t >= 1) {
        // Snap perfectly into the fitted line
        for (var j = 0; j < spans.length; j++) {
          spans[j].style.transform = "translate(0, 0)";
          spans[j].style.opacity = "1";
        }
        phase = "holding";
        animationStart = now;
      }
    } else if (phase === "holding") {
      if (now - animationStart >= holdDuration) {
        // Re-scatter and start a new fit
        for (var k = 0; k < glyphStates.length; k++) {
          glyphStates[k] = makeInitialState();
        }
        phase = "fitting";
        animationStart = now;
      }
    }

    requestAnimationFrame(frame);
  }

  setTimeout(function () {
    requestAnimationFrame(frame);
  }, 700);
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

  var colors = ["#10261b", "#173624", "#1f5a3b", "#2d7a53", "#38956a"];
  var sideShade = "rgba(3, 10, 8, 0.26)";
  var highlight = "rgba(255, 255, 255, 0.10)";
  var windowLit = "rgba(240, 245, 243, 0.92)";
  var windowDim = "rgba(255, 255, 255, 0.18)";

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

      var c = colors[Math.floor(rand(0, colors.length))];
      var depth = Math.max(4, bw * rand(0.18, 0.28));
      var roof = Math.random() > 0.72 ? "cap" : (Math.random() > 0.84 ? "spire" : "flat");

      var rows = Math.floor(h / rand(16, 20));
      var cols = Math.max(1, Math.floor(bw / rand(9, 13)));
      var windows = [];

      for (var r = 1; r < rows; r++) {
        for (var col = 0; col < cols; col++) {
          if (Math.random() > 0.12) {
            windows.push({
              x: (col + 0.5) * (bw / cols),
              y: r * (h / rows),
              lit: Math.random() > 0.38,
              flicker: Math.random() > 0.965
            });
          }
        }
      }

      buildings.push({
        x: x,
        y: y,
        w: bw,
        h: h,
        color: c,
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

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 6;
    ctx.setLineDash([]);
    ctx.shadowColor = "rgba(255,255,255,0.14)";
    ctx.shadowBlur = 14;
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

    ctx.strokeStyle = "rgba(255,255,255,0.58)";
    ctx.lineWidth = 2.9;
    ctx.setLineDash([4, 6]);
    ctx.shadowBlur = 0;
    ctx.beginPath();

    for (var j = 0; j <= count; j++) {
      var pct2 = j / count;
      var x2 = xStart + pct2 * (xEnd - xStart);
      var z2 = -3.15 + pct2 * 6.3;
      var y2 = baseY - curveLift - (normalPDF(z2) / normalPDF(0)) * curveMax;

      if (j === 0) ctx.moveTo(x2, y2);
      else ctx.lineTo(x2, y2);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawBuilding(b, frame) {
    var x = b.x;
    var y = b.y;
    var w = b.w;
    var h = b.h;
    var d = b.depth;

    ctx.save();

    var facade = ctx.createLinearGradient(x, y, x + w, y + h);
    facade.addColorStop(0, b.color);
    facade.addColorStop(0.55, "#2d7a53");
    facade.addColorStop(1, "#10261b");

    ctx.fillStyle = facade;
    roundedRect(x, y, w, h, Math.min(7, w * 0.2));
    ctx.fill();

    ctx.fillStyle = sideShade;
    ctx.beginPath();
    ctx.moveTo(x + w, y + d * 0.55);
    ctx.lineTo(x + w + d, y + d);
    ctx.lineTo(x + w + d, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + d, y + d);
    ctx.lineTo(x + d, y + d);
    ctx.closePath();
    ctx.fill();

    if (b.roof === "cap") {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x + w * 0.18, y - 5, w * 0.64, 5);
    } else if (b.roof === "spire") {
      ctx.strokeStyle = "rgba(255,255,255,0.42)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y - 18);
      ctx.stroke();
    }

    for (var i = 0; i < b.windows.length; i++) {
      var win = b.windows[i];

      if (win.flicker && frame % 90 === 0 && Math.random() > 0.6) {
        win.lit = !win.lit;
      }

      ctx.fillStyle = win.lit ? windowLit : windowDim;
      ctx.globalAlpha = win.lit ? 0.8 : 0.34;

      var ww = Math.max(2.4, w * 0.11);
      var wh = Math.max(3.8, Math.min(8, h * 0.032));
      ctx.fillRect(x + win.x - ww / 2, y + win.y, ww, wh);
    }

    ctx.globalAlpha = 1;
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
      drawBuilding(buildings[i], frame);
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
