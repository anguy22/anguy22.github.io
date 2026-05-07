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

  // build spans
  for (var i = 0; i < phrase.length; i++) {
    var s = document.createElement("span");
    s.className = "glyph" + (phrase[i] === " " ? " space" : " scramble");
    s.textContent = phrase[i] === " " ? " " : glyphs[Math.floor(Math.random() * glyphs.length)];
    el.appendChild(s);
    spans.push(s);
    resolved.push(false);
  }

  var pointer = 0;          // next char to lock
  var tickInterval = 35;    // ms per scramble tick
  var lockEvery = 2;        // lock one char every N ticks
  var tick = 0;

  function step() {
    tick++;
    // scramble all unresolved non-space chars
    for (var i = pointer; i < phrase.length; i++) {
      if (phrase[i] !== " " && !resolved[i]) {
        spans[i].textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      }
    }
    // lock next char
    if (tick % lockEvery === 0 && pointer < phrase.length) {
      spans[pointer].textContent = phrase[pointer] === " " ? " " : phrase[pointer];
      spans[pointer].className = "glyph" + (phrase[pointer] === " " ? " space done" : " done");
      resolved[pointer] = true;
      pointer++;
    }
    if (pointer < phrase.length) {
      setTimeout(step, tickInterval);
    } else {
      // pause then restart
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


// ───────── CARTOON CITYSCAPE (Canvas) ─────────
(function () {
  var canvas = document.getElementById("cityscape");
  var ctx = canvas.getContext("2d");
  var W, H;

  // palette (green / grey theme)
  var SKY_TOP    = "#f7f7f7";
  var SKY_BOT    = "#e6f5ed";
  var BLDG_DARK  = "#1e4d35";
  var BLDG_MID   = "#245e40";
  var BLDG_LIGHT = "#2d7a53";
  var BLDG_PALE  = "#7fcca6";
  var WIN_ON     = "#e6f5ed";
  var WIN_OFF    = "#1a3a2a";
  var GROUND     = "#b8e4cc";

  var buildings = [];
  var stars = [];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    generateCity();
  }

  function generateCity() {
    buildings = [];
    stars = [];
    var x = -20;
    while (x < W + 40) {
      var w = 30 + Math.random() * 70;
      var h = 60 + Math.random() * (H * 0.38);
      var color = [BLDG_DARK, BLDG_MID, BLDG_LIGHT, BLDG_PALE][Math.floor(Math.random() * 4)];
      var windows = [];
      var cols = Math.floor(w / 16);
      var rows = Math.floor(h / 22);
      for (var r = 1; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          windows.push({
            rx: 6 + c * (w / cols),
            ry: 10 + r * 20,
            lit: Math.random() > 0.45,
            blink: Math.random()
          });
        }
      }
      buildings.push({ x: x, w: w, h: h, color: color, windows: windows });
      x += w + 2 + Math.random() * 12;
    }
    // decorative "stars" (small dots in upper portion)
    for (var i = 0; i < 40; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H * 0.35, r: 0.5 + Math.random() * 1.2, phase: Math.random() * Math.PI * 2 });
    }
  }

  var frame = 0;
  function draw() {
    frame++;
    ctx.clearRect(0, 0, W, H);

    // sky gradient
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(1, SKY_BOT);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // stars twinkle
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      var alpha = 0.25 + 0.25 * Math.sin(frame * 0.03 + st.phase);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = BLDG_PALE;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ground
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, H - 20, W, 20);

    // buildings
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      var baseY = H - 20;
      // building body
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, baseY - b.h, b.w, b.h);

      // windows
      for (var j = 0; j < b.windows.length; j++) {
        var wi = b.windows[j];
        // random blink
        if (Math.random() < 0.002) wi.lit = !wi.lit;
        ctx.fillStyle = wi.lit ? WIN_ON : WIN_OFF;
        ctx.globalAlpha = wi.lit ? 0.9 : 0.3;
        ctx.fillRect(b.x + wi.rx, baseY - b.h + wi.ry, 8, 10);
      }
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
})();


// ───────── FLOATING BUBBLES (physics) ─────────
(function () {
  var hero = document.getElementById("hero");
  var bubbles = document.querySelectorAll(".bubble");
  var positions = [];

  // initial scattered positions (percentage-based, placed around edges so they don't cover center text)
  var placements = [
    { xPct: 0.12, yPct: 0.22 },  // profile
    { xPct: 0.82, yPct: 0.18 },  // chess
    { xPct: 0.88, yPct: 0.55 },  // trading
    { xPct: 0.08, yPct: 0.60 },  // wafer
    { xPct: 0.78, yPct: 0.78 },  // piano
  ];

  for (var i = 0; i < bubbles.length; i++) {
    var p = placements[i];
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

  // mouse repel
  var mouseX = -9999, mouseY = -9999;
  hero.addEventListener("mousemove", function (e) {
    var rect = hero.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / rect.width;
    mouseY = (e.clientY - rect.top) / rect.height;
  });
  hero.addEventListener("mouseleave", function () {
    mouseX = -9999; mouseY = -9999;
  });

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

      // mouse repel
      var dx = b.xPct - mouseX;
      var dy = displayY - mouseY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.15 && dist > 0.001) {
        var force = (0.15 - dist) * 0.6;
        b.vx += (dx / dist) * force;
        b.vy += (dy / dist) * force;
      }

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
    // active link
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
