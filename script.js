/* ==============================
   INTERACTIVE FEATURES
   ============================== */

document.addEventListener('DOMContentLoaded', () => {
  setupDecryptText();
  setupCityscape();
  setupNavbar();
  setupActiveLinks();
  setupMobileNav();
  setupRevealAnimations();
  setupSmoothScroll();
});

// ========== HERO DECRYPT EFFECT ==========
function setupDecryptText() {
  const decryptText = document.getElementById('decrypt-text');
  if (!decryptText) return;

  const phrases = [
    'industrial engineer',
    'quantitative modeler',
    'semiconductor analyst',
    'decision builder'
  ];
  const scrambleChars = '01<>/=+*$#?ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function renderFrame(target, revealCount, fade = false) {
    decryptText.innerHTML = '';

    [...target].forEach((char, index) => {
      const span = document.createElement('span');
      span.className = 'char';

      if (char === ' ') {
        span.classList.add('space');
        span.textContent = ' ';
      } else if (index < revealCount) {
        span.classList.add('resolved');
        span.textContent = char;
      } else {
        span.classList.add('scrambling');
        span.textContent =
          scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
      }

      if (fade) span.classList.add('fading');
      decryptText.appendChild(span);
    });
  }

  async function playSequence() {
    while (true) {
      for (const phrase of phrases) {
        for (let reveal = 0; reveal <= phrase.length; reveal++) {
          for (let jitter = 0; jitter < 3; jitter++) {
            renderFrame(phrase, reveal);
            await wait(40);
          }
        }

        await wait(1200);

        for (let fadeStep = 0; fadeStep < 10; fadeStep++) {
          renderFrame(phrase, phrase.length, true);
          const chars = decryptText.querySelectorAll('.char');
          chars.forEach((char, idx) => {
            char.style.opacity = String(
              Math.max(0, 1 - fadeStep * 0.11 - idx * 0.008)
            );
            char.style.transform = `translateY(${fadeStep * 1.7}px)`;
          });
          await wait(35);
        }

        decryptText.innerHTML = '';
        await wait(220);
      }
    }
  }

  playSequence();
}

// ========== CARTOON CITYSCAPE CANVAS ==========
function setupCityscape() {
  const canvas = document.getElementById('cityscape');
  const hero = document.getElementById('hero');
  if (!canvas || !hero) return;

  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const palette = {
    skyTop: '#f7fbf9',
    skyBottom: '#dfeee6',
    sun: '#b8e4cc',
    cloud: 'rgba(255,255,255,0.85)',
    far: '#b8d9c8',
    mid: '#8ebda4',
    near: '#5f9277',
    roof: '#345844',
    windowOn: '#f2fff7',
    windowOff: 'rgba(255,255,255,0.16)',
    line: 'rgba(26, 58, 42, 0.16)',
    accent: '#4db07f'
  };

  const state = {
    width: 0,
    height: 0,
    horizon: 0,
    mouseX: 0,
    mouseY: 0,
    clouds: [],
    sparkle: [],
    layers: []
  };

  function makeBuildings(minWidth, maxWidth, minHeight, maxHeight, yBase, color, roofColor, depth) {
    const buildings = [];
    let x = -40;

    while (x < state.width + 60) {
      const w = minWidth + Math.random() * (maxWidth - minWidth);
      const h = minHeight + Math.random() * (maxHeight - minHeight);
      const windows = [];
      const cols = Math.max(2, Math.floor(w / 18));
      const rows = Math.max(2, Math.floor(h / 18));

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (Math.random() > 0.32) {
            windows.push({
              x: 10 + col * ((w - 20) / cols),
              y: 12 + row * ((h - 24) / rows),
              on: Math.random() > 0.4,
              twinkle: Math.random() * Math.PI * 2
            });
          }
        }
      }

      buildings.push({
        x,
        y: yBase - h,
        w,
        h,
        color,
        roofColor,
        depth,
        style: ['flat', 'step', 'antenna'][Math.floor(Math.random() * 3)],
        windows
      });

      x += w + 8 + Math.random() * 24;
    }

    return buildings;
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    state.horizon = state.height * 0.72;

    canvas.width = Math.floor(rect.width * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    state.clouds = new Array(5).fill(null).map((_, i) => ({
      x: (i / 5) * state.width + Math.random() * 70,
      y: 70 + Math.random() * (state.height * 0.22),
      w: 90 + Math.random() * 90,
      h: 26 + Math.random() * 22,
      speed: 0.08 + Math.random() * 0.18
    }));

    state.sparkle = new Array(28).fill(null).map(() => ({
      x: Math.random() * state.width,
      y: Math.random() * state.horizon,
      r: 1 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.008 + Math.random() * 0.02
    }));

    state.layers = [
      makeBuildings(42, 84, 70, 150, state.horizon + 32, palette.far, palette.far, 0.18),
      makeBuildings(56, 110, 110, 220, state.horizon + 48, palette.mid, '#6aa286', 0.4),
      makeBuildings(70, 130, 150, 280, state.horizon + 70, palette.near, palette.roof, 0.72)
    ];
  }

  function roundRect(x, y, w, h, r = 6) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCloud(cloud) {
    ctx.fillStyle = palette.cloud;
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.w * 0.28, cloud.h * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x + cloud.w * 0.18, cloud.y - 8, cloud.w * 0.26, cloud.h * 0.9, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x + cloud.w * 0.4, cloud.y, cloud.w * 0.23, cloud.h * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSun(time) {
    const x = state.width * 0.82;
    const y = state.height * 0.2;
    const pulse = Math.sin(time * 0.0011) * 6;
    const radius = 54 + pulse;

    const glow = ctx.createRadialGradient(x, y, 10, x, y, radius * 1.8);
    glow.addColorStop(0, 'rgba(184, 228, 204, 0.75)');
    glow.addColorStop(1, 'rgba(184, 228, 204, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBuilding(building, time) {
    const parallaxX = (state.mouseX - state.width / 2) * building.depth * 0.05;
    const bx = building.x + parallaxX;
    const by = building.y;

    ctx.fillStyle = building.color;
    roundRect(bx, by, building.w, building.h, 6);
    ctx.fill();

    ctx.fillStyle = building.roofColor;
    if (building.style === 'step') {
      ctx.fillRect(bx + building.w * 0.1, by - 10, building.w * 0.45, 10);
      ctx.fillRect(bx + building.w * 0.58, by - 16, building.w * 0.18, 16);
    } else if (building.style === 'antenna') {
      ctx.fillRect(bx + building.w * 0.42, by - 12, building.w * 0.18, 12);
      ctx.strokeStyle = building.roofColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx + building.w * 0.51, by - 12);
      ctx.lineTo(bx + building.w * 0.51, by - 28);
      ctx.stroke();
    } else {
      ctx.fillRect(bx + building.w * 0.1, by - 8, building.w * 0.8, 8);
    }

    building.windows.forEach((win, idx) => {
      const flicker = Math.sin(time * 0.003 + win.twinkle + idx) > 0.75;
      ctx.fillStyle = win.on || flicker ? palette.windowOn : palette.windowOff;
      ctx.fillRect(bx + win.x, by + win.y, 7, 10);
    });
  }

  function drawStreet(time) {
    const roadY = state.horizon + 115;
    ctx.fillStyle = 'rgba(52, 88, 68, 0.14)';
    ctx.fillRect(0, roadY, state.width, state.height - roadY);

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(0, roadY + 34);
    ctx.lineTo(state.width, roadY + 34);
    ctx.stroke();
    ctx.setLineDash([]);

    const transitX = ((time * 0.08) % (state.width + 180)) - 180;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    roundRect(transitX, roadY - 32, 120, 28, 12);
    ctx.fill();

    ctx.fillStyle = palette.accent;
    ctx.fillRect(transitX + 10, roadY - 24, 56, 10);

    ctx.fillStyle = 'rgba(52,88,68,0.18)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(transitX + 12 + i * 24, roadY - 18, 14, 8);
    }

    ctx.fillStyle = '#fff8c4';
    ctx.beginPath();
    ctx.arc(transitX + 114, roadY - 18, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawForeground(time) {
    const hillY = state.horizon + 40;

    ctx.fillStyle = 'rgba(77, 176, 127, 0.17)';
    ctx.beginPath();
    ctx.moveTo(0, hillY);
    for (let x = 0; x <= state.width; x += 24) {
      const y = hillY + Math.sin(x * 0.018 + time * 0.0008) * 7;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(state.width, state.height);
    ctx.lineTo(0, state.height);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 14; i++) {
      const x = i * (state.width / 13) + Math.sin(time * 0.001 + i) * 6;
      const baseY = hillY + 10 + (i % 3) * 4;

      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY - 28);
      ctx.stroke();

      ctx.fillStyle = 'rgba(77, 176, 127, 0.55)';
      ctx.beginPath();
      ctx.arc(x, baseY - 36, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(time) {
    ctx.clearRect(0, 0, state.width, state.height);

    const sky = ctx.createLinearGradient(0, 0, 0, state.height);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, state.width, state.height);

    drawSun(time);

    state.sparkle.forEach(dot => {
      const alpha = 0.25 + (Math.sin(time * dot.speed + dot.phase) + 1) * 0.18;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fill();
    });

    state.clouds.forEach(cloud => {
      cloud.x += cloud.speed;
      if (cloud.x - cloud.w > state.width + 60) cloud.x = -cloud.w;
      drawCloud(cloud);
    });

    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, state.horizon + 8);
    ctx.lineTo(state.width, state.horizon + 8);
    ctx.stroke();

    state.layers.forEach(layer => layer.forEach(building => drawBuilding(building, time)));
    drawForeground(time);
    drawStreet(time);

    requestAnimationFrame(render);
  }

  window.addEventListener('mousemove', (event) => {
    const rect = hero.getBoundingClientRect();
    state.mouseX = event.clientX - rect.left;
    state.mouseY = event.clientY - rect.top;
  });

  window.addEventListener('resize', resize);

  resize();
  requestAnimationFrame(render);
}

// ========== NAVBAR SCROLL EFFECT ==========
function setupNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  };

  onScroll();
  window.addEventListener('scroll', onScroll);
}

// ========== ACTIVE NAV LINK HIGHLIGHTING ==========
function setupActiveLinks() {
  const sections = document.querySelectorAll('.section, #hero');
  const navLinks = document.querySelectorAll('.nav-links a');
  if (!sections.length || !navLinks.length) return;

  function updateActiveLink() {
    let current = 'hero';

    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      if (window.scrollY >= sectionTop) current = section.getAttribute('id');
    });

    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  }

  updateActiveLink();
  window.addEventListener('scroll', updateActiveLink);
}

// ========== MOBILE NAV TOGGLE ==========
function setupMobileNav() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinksList = document.querySelector('.nav-links');
  const navLinks = document.querySelectorAll('.nav-links a');
  if (!navToggle || !navLinksList) return;

  navToggle.addEventListener('click', () => {
    navLinksList.classList.toggle('open');
    navToggle.classList.toggle('active');
  });

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navLinksList.classList.remove('open');
      navToggle.classList.remove('active');
    });
  });
}

// ========== SCROLL REVEAL ANIMATIONS ==========
function setupRevealAnimations() {
  const revealElements = document.querySelectorAll('.reveal');
  if (!revealElements.length) return;

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));
}

// ========== SMOOTH SCROLL FOR INTERNAL LINKS ==========
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}
