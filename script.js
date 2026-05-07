document.addEventListener('DOMContentLoaded', () => {
  setupDecryptText();
  setupCityscape();
  setupFloatingBubbles();
  setupNavbar();
  setupActiveLinks();
  setupMobileNav();
  setupRevealAnimations();
  setupSmoothScroll();
});

function setupDecryptText() {
  const target = document.getElementById('decrypt-text');
  if (!target) return;

  const phrases = [
    'industrial engineer',
    'quantitative modeler',
    'semiconductor analyst',
    'decision builder'
  ];
  const scrambleChars = '01<>/=+*$#?ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function renderFrame(phrase, resolvedCount, xShift = 0, fade = 1) {
    target.innerHTML = '';
    target.style.transform = `translateX(${xShift}px)`;

    [...phrase].forEach((char, index) => {
      const span = document.createElement('span');
      span.className = 'char';

      if (char === ' ') {
        span.classList.add('space');
        span.textContent = ' ';
      } else if (index < resolvedCount) {
        span.classList.add('resolved');
        span.textContent = char;
      } else {
        span.classList.add('scrambling');
        span.textContent = scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
      }

      span.style.opacity = String(fade);
      target.appendChild(span);
    });
  }

  async function cyclePhrase(phrase) {
    const totalFrames = Math.max(phrase.length + 10, 24);

    for (let frame = 0; frame <= totalFrames; frame++) {
      const resolved = Math.min(
        phrase.length,
        Math.floor((frame / totalFrames) * (phrase.length + 2))
      );

      const xShift = -90 + (frame / totalFrames) * 180;

      for (let jitter = 0; jitter < 3; jitter++) {
        renderFrame(phrase, resolved, xShift);
        await wait(34);
      }
    }

    await wait(750);

    for (let fadeFrame = 0; fadeFrame < 10; fadeFrame++) {
      const opacity = Math.max(0.12, 1 - fadeFrame * 0.1);
      const xShift = 90 + fadeFrame * 10;

      renderFrame(phrase, phrase.length, xShift, opacity);

      target.querySelectorAll('.char').forEach((char, idx) => {
        char.classList.add('fading');
        char.style.opacity = String(Math.max(0, opacity - idx * 0.01));
      });

      await wait(28);
    }

    target.innerHTML = '';
    await wait(140);
  }

  (async function loop() {
    while (true) {
      for (const phrase of phrases) {
        await cyclePhrase(phrase);
      }
    }
  })();
}

function setupCityscape() {
  const canvas = document.getElementById('cityscape');
  const hero = document.getElementById('hero');
  if (!canvas || !hero) return;

  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const state = {
    width: 0,
    height: 0,
    horizon: 0,
    mouseX: 0,
    mouseY: 0,
    clouds: [],
    stars: [],
    layers: [],
    graphNodes: []
  };

  const colors = {
    skyTop: '#f7fbf9',
    skyBottom: '#deebe3',
    cloud: 'rgba(255,255,255,0.92)',
    glow: 'rgba(150, 216, 176, 0.55)',
    far: '#bfdcca',
    mid: '#91bea6',
    near: '#5f9277',
    roof: '#335643',
    line: 'rgba(23, 55, 41, 0.16)',
    windowsOn: '#f3fff7',
    windowsOff: 'rgba(255,255,255,0.14)',
    street: 'rgba(33, 58, 46, 0.14)',
    accent: '#43a36f'
  };

  function createBuildings(minWidth, maxWidth, minHeight, maxHeight, yBase, color, roofColor, depth) {
    const buildings = [];
    let x = -40;

    while (x < state.width + 40) {
      const w = minWidth + Math.random() * (maxWidth - minWidth);
      const h = minHeight + Math.random() * (maxHeight - minHeight);
      const cols = Math.max(2, Math.floor(w / 18));
      const rows = Math.max(2, Math.floor(h / 18));
      const windows = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (Math.random() > 0.34) {
            windows.push({
              x: 10 + col * ((w - 20) / cols),
              y: 12 + row * ((h - 26) / rows),
              lit: Math.random() > 0.35,
              phase: Math.random() * Math.PI * 2
            });
          }
        }
      }

      buildings.push({
        x,
        y: yBase - h,
        w,
        h,
        depth,
        color,
        roofColor,
        style: ['flat', 'step', 'antenna'][Math.floor(Math.random() * 3)],
        windows
      });

      x += w + 8 + Math.random() * 22;
    }

    return buildings;
  }

  function resize() {
    const rect = hero.getBoundingClientRect();

    state.width = rect.width;
    state.height = rect.height;
    state.horizon = state.height * 0.74;

    canvas.width = Math.floor(rect.width * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    state.clouds = new Array(5).fill(null).map((_, i) => ({
      x: (i / 5) * state.width + Math.random() * 70,
      y: 54 + Math.random() * state.height * 0.18,
      w: 100 + Math.random() * 110,
      h: 28 + Math.random() * 20,
      speed: 0.06 + Math.random() * 0.15
    }));

    state.stars = new Array(26).fill(null).map(() => ({
      x: Math.random() * state.width,
      y: Math.random() * state.horizon * 0.84,
      r: 1 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.03
    }));

    state.layers = [
      createBuildings(40, 80, 58, 135, state.horizon + 26, colors.far, colors.far, 0.14),
      createBuildings(52, 102, 94, 205, state.horizon + 44, colors.mid, '#709c87', 0.32),
      createBuildings(64, 126, 132, 260, state.horizon + 62, colors.near, colors.roof, 0.54)
    ];

    state.graphNodes = [
      { x: state.width * 0.16, y: state.height * 0.28 },
      { x: state.width * 0.22, y: state.height * 0.24 },
      { x: state.width * 0.27, y: state.height * 0.29 },
      { x: state.width * 0.34, y: state.height * 0.2 }
    ];
  }

  function drawSky(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    gradient.addColorStop(0, colors.skyTop);
    gradient.addColorStop(1, colors.skyBottom);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    const sunX = state.width * 0.82;
    const sunY = state.height * 0.18;
    const radius = 44 + Math.sin(time * 0.001) * 5;

    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, radius * 2);
    glow.addColorStop(0, 'rgba(205, 238, 220, 0.95)');
    glow.addColorStop(1, 'rgba(205, 238, 220, 0)');

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, radius * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d8f1e2';
    ctx.beginPath();
    ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCloud(cloud) {
    ctx.fillStyle = colors.cloud;
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.w * 0.28, cloud.h * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x + cloud.w * 0.18, cloud.y - 8, cloud.w * 0.26, cloud.h * 0.92, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x + cloud.w * 0.4, cloud.y, cloud.w * 0.24, cloud.h * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
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

  function drawBuilding(building, time) {
    const parallax = (state.mouseX - state.width / 2) * building.depth * 0.04;
    const x = building.x + parallax;
    const y = building.y;

    ctx.fillStyle = building.color;
    roundRect(x, y, building.w, building.h, 6);
    ctx.fill();

    ctx.fillStyle = building.roofColor;

    if (building.style === 'step') {
      ctx.fillRect(x + building.w * 0.12, y - 10, building.w * 0.44, 10);
      ctx.fillRect(x + building.w * 0.6, y - 16, building.w * 0.18, 16);
    } else if (building.style === 'antenna') {
      ctx.fillRect(x + building.w * 0.4, y - 12, building.w * 0.2, 12);
      ctx.strokeStyle = building.roofColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + building.w * 0.5, y - 12);
      ctx.lineTo(x + building.w * 0.5, y - 28);
      ctx.stroke();
    } else {
      ctx.fillRect(x + building.w * 0.12, y - 8, building.w * 0.76, 8);
    }

    building.windows.forEach((windowDot, index) => {
      const flicker = Math.sin(time * 0.0032 + windowDot.phase + index) > 0.72;
      ctx.fillStyle = windowDot.lit || flicker ? colors.windowsOn : colors.windowsOff;
      ctx.fillRect(x + windowDot.x, y + windowDot.y, 7, 10);
    });
  }

  function drawForeground(time) {
    const hillY = state.horizon + 30;

    ctx.fillStyle = 'rgba(99, 193, 138, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, hillY);

    for (let x = 0; x <= state.width; x += 24) {
      const y = hillY + Math.sin(x * 0.018 + time * 0.0007) * 6;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(state.width, state.height);
    ctx.lineTo(0, state.height);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 10; i++) {
      const x = i * (state.width / 9);
      const baseY = hillY + 10 + (i % 3) * 4;

      ctx.strokeStyle = 'rgba(41, 100, 71, 0.18)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY - 22);
      ctx.stroke();

      ctx.fillStyle = 'rgba(99, 193, 138, 0.45)';
      ctx.beginPath();
      ctx.arc(x, baseY - 28, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStreet(time) {
    const roadY = state.horizon + 102;

    ctx.fillStyle = colors.street;
    ctx.fillRect(0, roadY, state.width, state.height - roadY);

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    ctx.moveTo(0, roadY + 28);
    ctx.lineTo(state.width, roadY + 28);
    ctx.stroke();
    ctx.setLineDash([]);

    const transitX = ((time * 0.08) % (state.width + 180)) - 180;

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRect(transitX, roadY - 30, 118, 26, 12);
    ctx.fill();

    ctx.fillStyle = colors.accent;
    ctx.fillRect(transitX + 10, roadY - 22, 54, 9);

    ctx.fillStyle = 'rgba(51, 86, 67, 0.14)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(transitX + 12 + i * 23, roadY - 17, 13, 7);
    }
  }

  function drawGraphOverlay(time) {
    const pulse = (Math.sin(time * 0.002) + 1) / 2;

    ctx.strokeStyle = 'rgba(67, 163, 111, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    state.graphNodes.forEach((node, index) => {
      if (index === 0) ctx.moveTo(node.x, node.y);
      else ctx.lineTo(node.x, node.y);
    });

    ctx.stroke();

    state.graphNodes.forEach((node, index) => {
      const radius = 4 + (index === 3 ? pulse * 2 : 0);

      ctx.fillStyle = 'rgba(67, 163, 111, 0.32)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4aa978';
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function render(time) {
    ctx.clearRect(0, 0, state.width, state.height);

    drawSky(time);

    state.stars.forEach(dot => {
      const alpha = 0.2 + (Math.sin(time * dot.speed + dot.phase) + 1) * 0.18;
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

    drawGraphOverlay(time);

    state.layers.forEach(layer => {
      layer.forEach(building => drawBuilding(building, time));
    });

    drawForeground(time);
    drawStreet(time);

    requestAnimationFrame(render);
  }

  window.addEventListener('mousemove', event => {
    const rect = hero.getBoundingClientRect();
    state.mouseX = event.clientX - rect.left;
    state.mouseY = event.clientY - rect.top;
  });

  window.addEventListener('resize', resize);

  resize();
  requestAnimationFrame(render);
}

function setupFloatingBubbles() {
  const hero = document.getElementById('hero');
  const bubbles = document.querySelectorAll('.float-bubble');

  if (!hero || !bubbles.length) return;

  hero.addEventListener('mousemove', event => {
    const rect = hero.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - rect.width / 2;
    const mouseY = event.clientY - rect.top - rect.height / 2;

    bubbles.forEach(bubble => {
      const depth = parseFloat(bubble.dataset.depth || '0.25');
      bubble.style.transform = `translate(${mouseX * depth * 0.05}px, ${mouseY * depth * 0.04}px)`;
    });
  });

  hero.addEventListener('mouseleave', () => {
    bubbles.forEach(bubble => {
      bubble.style.transform = 'translate(0, 0)';
    });
  });
}

function setupNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  };

  onScroll();
  window.addEventListener('scroll', onScroll);
}

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
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  }

  updateActiveLink();
  window.addEventListener('scroll', updateActiveLink);
}

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

function setupRevealAnimations() {
  const revealElements = document.querySelectorAll('.reveal');

  if (!revealElements.length) return;

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(element => revealObserver.observe(element));
}

function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (event) {
      event.preventDefault();

      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}
