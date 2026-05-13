/* ==========================================================
   script.js  –  Cityscape · Floating Bubbles · Decrypt Text
   ========================================================== */

// ───────── DECRYPT ANIMATION ─────────
(function () {
  var phrase = "How you do anything is how you do everything";
  var el = document.getElementById("decrypt-text");
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
  var tickInterval = 35;
  var lockEvery = 2;
  var tick = 0;

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
        pointer = 0;
        tick = 0;
        for (var j = 0; j < spans.length; j++) {
          resolved[j] = false;
          spans[j].className = "glyph" + (phrase[j] === " " ? " space" : " scramble");
        }
        step();
      }, 4000);
    }
  }
  setTimeout(step, 800);
})();


// ───────── HISTOGRAM CITYSCAPE (Canvas) ─────────
(function () {
  var canvas = document.getElementById("cityscape");
  var ctx = canvas.getContext("2d");
  var W, H;

  var COLORS     = ["#1a3a2a","#1e4d35","#245e40","#2d7a53","#38956a"];
  var WIN_ON     = "#e6f5ed";
  var WIN_OFF    = "#1a3a2a";
  var GROUND_CLR = "#b8e4cc";
  var CURVE_CLR  = "rgba(0, 0, 0, 0.40)";       /* ← black dotted line */
  var AXIS_CLR   = "rgba(17, 17, 17, 0.10)";
  var TICK_CLR   = "rgba(17, 17, 17, 0.15)";

  var bars = [];
  var stars = [];

  function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    generate();
  }

  function generate() {
    bars = [];
    stars = [];
    var numBars   = Math.round(W / 48);
    var gap       = 3;
    var barW      = (W - gap * (numBars - 1)) / numBars;
    var maxH      = H * 0.52;
    var sigma     = numBars * 0.28;
    var mu        = numBars / 2;

    for (var i = 0; i < numBars; i++) {
      var z = (i - mu) / sigma;
      var bell = normalPDF(z) / normalPDF(0);
      var jitter = 0.92 + Math.random() * 0.16;
      var h = maxH * bell * jitter;
      if (h < 20) h = 15 + Math.random() * 15;

      var x = i * (barW + gap);
      var color = COLORS[Math.floor(Math.random() * COLORS.length)];

      var windows = [];
      var cols = Math.max(1, Math.floor(barW / 16));
      var rows = Math.max(1, Math.floor(h / 22));
      for (var r = 1; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          windows.push({
            rx: 4 + c * ((barW - 8) / cols),
            ry: 8 + r * 20,
            lit: Math.random() > 0.4
          });
        }
      }

      var hasAntenna = bell > 0.65 && Math.random() > 0.4;
      bars.push({ x: x, w: barW, h: h, color: color, windows: windows, bell: bell, hasAntenna: hasAntenna });
    }

    for (var s = 0; s < 50; s++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H * 0.4, r: 0.4 + Math.random(), phase: Math.random() * Math.PI * 2 });
    }
  }

  var frame = 0;
  function draw() {
    frame++;
    ctx.clearRect(0, 0, W, H);

    // sky gradient — warm eggshell
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#f7f5ef");
    grad.addColorStop(0.7, "#f0f5f0");
    grad.addColorStop(1, "#e5ede8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // twinkling dots
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      ctx.globalAlpha = 0.10 + 0.16 * Math.sin(frame * 0.025 + st.phase);
      ctx.fillStyle = "#7fcca6";
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var baseY = H - 28;

    // x-axis line
    ctx.strokeStyle = AXIS_CLR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(W, baseY);
    ctx.stroke();

    // tick marks
    var numTicks = Math.round(W / 80);
    for (var t = 0; t <= numTicks; t++) {
      var tx = (t / numTicks) * W;
      ctx.strokeStyle = TICK_CLR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, baseY);
      ctx.lineTo(tx, baseY + 6);
      ctx.stroke();
    }

    // ground fill
    ctx.fillStyle = GROUND_CLR;
    ctx.fillRect(0, baseY, W, H - baseY);

    // buildings
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      ctx.fillStyle = b.color;

      var r = Math.min(4, b.w / 4);
      var bx = b.x, by = baseY - b.h, bw = b.w, bh = b.h;
      ctx.beginPath();
      ctx.moveTo(bx, baseY);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.lineTo(bx + bw - r, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, baseY);
      ctx.closePath();
      ctx.fill();

      // antenna
      if (b.hasAntenna) {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        var ax = bx + bw / 2;
        ctx.beginPath();
        ctx.moveTo(ax, by);
        ctx.lineTo(ax, by - 14);
        ctx.stroke();
        ctx.fillStyle = "#4db07f";
        ctx.beginPath();
        ctx.arc(ax, by - 16, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // windows
      for (var j = 0; j < b.windows.length; j++) {
        var wi = b.windows[j];
        if (Math.random() < 0.003) wi.lit = !wi.lit;
        ctx.fillStyle = wi.lit ? WIN_ON : WIN_OFF;
        ctx.globalAlpha = wi.lit ? 0.85 : 0.25;
        ctx.fillRect(bx + wi.rx, by + wi.ry, 8, 10);
      }
      ctx.globalAlpha = 1;
    }

    // bell curve overlay — black dashed line
    ctx.strokeStyle = CURVE_CLR;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    var numBars = bars.length;
    var sigma = numBars * 0.28;
    var mu = numBars / 2;
    var maxH = H * 0.52;
    for (var px = 0; px <= W; px += 2) {
      var barIdx = (px / W) * numBars;
      var z = (barIdx - mu) / sigma;
      var bell = normalPDF(z) / normalPDF(0);
      var curveY = baseY - maxH * bell - 12;
      if (px === 0) ctx.moveTo(px, curveY);
      else ctx.lineTo(px, curveY);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // axis labels — subtle dark
    ctx.fillStyle = "rgba(17, 17, 17, 0.20)";
    ctx.font = "italic 14px serif";
    ctx.textAlign = "center";
    ctx.fillText("μ", W / 2, baseY + 20);

    var barW = W / numBars;
    ctx.font = "italic 12px serif";
    ctx.fillText("-1σ", W / 2 - sigma * barW, baseY + 20);
    ctx.fillText("+1σ", W / 2 + sigma * barW, baseY + 20);

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
})();


// ───────── FLOATING BUBBLES (physics — no mouse repel) ─────────
(function () {
  var hero = document.getElementById("hero");
  var bubbles = document.querySelectorAll(".bubble");
  var positions = [];

  var placements = [
    { xPct: 0.11, yPct: 0.24 },   // profile — left
    { xPct: 0.86, yPct: 0.22 },   // projects — right
    { xPct: 0.14, yPct: 0.68 },   // contact — bottom left
  ];

  for (var i = 0; i < bubbles.length; i++) {
    var p = placements[i] || { xPct: 0.5, yPct: 0.5 };
    positions.push({
      el: bubbles[i],
      xPct: p.xPct,
      yPct: p.yPct,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.2,
      baseX: p.xPct,
      baseY: p.yPct
    });
  }

  function animate() {
    var rect = hero.getBoundingClientRect();
    for (var i = 0; i < positions.length; i++) {
      var b = positions[i];

      // gentle float
      b.xPct += b.vx * 0.002;
      b.yPct += b.vy * 0.002;

      // spring back toward base
      b.vx += (b.baseX - b.xPct) * 0.02;
      b.vy += (b.baseY - b.yPct) * 0.02;

      // damping
      b.vx *= 0.98;
      b.vy *= 0.98;

      // gentle sine bob
      var bob = Math.sin(Date.now() * 0.001 + i * 1.8) * 0.012;
      var displayY = b.yPct + bob;

      // clamp
      b.xPct = Math.max(0.03, Math.min(0.97, b.xPct));
      b.yPct = Math.max(0.05, Math.min(0.90, b.yPct));

      var px = b.xPct * rect.width;
      var py = displayY * rect.height;
      b.el.style.left = px + "px";
      b.el.style.top  = py + "px";
      b.el.style.transform = "translate(-50%,-50%)";
    }
    requestAnimationFrame(animate);
  }
  animate();
})();


// ───────── NAV / SCROLL / REVEAL ─────────
(function () {
  var navbar = document.getElementById("navbar");
  var sections = document.querySelectorAll(".section, #hero");
  var navLinks = document.querySelectorAll(".nav-links a");

  window.addEventListener("scroll", function () {
    navbar.classList.toggle("scrolled", window.scrollY > 50);
    var current = "";
    sections.forEach(function (s) {
      if (window.scrollY >= s.offsetTop - 120) current = s.id;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + current);
    });
  });

  // mobile toggle
  var toggle = document.querySelector(".nav-toggle");
  var linksList = document.querySelector(".nav-links");
  toggle.addEventListener("click", function () { linksList.classList.toggle("open"); });
  navLinks.forEach(function (a) {
    a.addEventListener("click", function () { linksList.classList.remove("open"); });
  });

  // scroll reveal
  var reveals = document.querySelectorAll(".reveal");
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add("visible"); });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
  reveals.forEach(function (el) { observer.observe(el); });

  // smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var t = document.querySelector(this.getAttribute("href"));
      if (t) t.scrollIntoView({ behavior: "smooth" });
    });
  });
})();
