// A goldfish that lives in a layer fixed to the viewport and keeps the visitor company.
//
// - In the hero it swims a figure-eight through the copy: behind the text on the
//   left loop (the back canvas is dimmed and sits under the page), in front in the
//   open water on the right. Crossing between the two is the weave.
// - Past the hero it cruises a loop on the side of the screen, behind the content,
//   and leans in the direction the visitor scrolls.
// - When the visitor clicks a button, link or backpack item, it darts over, turns to
//   face the thing and noses up to it for a moment. In-page links send it to the
//   section heading they jump to.
//
// Motion is steering, not keyframes: the head turns toward a target at a limited
// rate and eases its speed; the body is a spine that follows the head's own trail.

const TAU = Math.PI * 2;
const N = 14;

/* ---------------- drawing ---------------- */

function widthAt(u, L) { return L * (0.05 + 0.125 * Math.sin(Math.PI * Math.pow(u, 0.58))) * (1 - 0.62 * u * u * u); }

function smooth(ctx, pts) {
  for (let k = 0; k < pts.length - 1; k++) {
    const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
  }
  const e = pts[pts.length - 1]; ctx.lineTo(e[0], e[1]);
}

// Sample N spine points at equal arc length back along the trail, then add the body wave.
function spineFrom(trail, L, phase, wave) {
  const seg = L / (N - 1), pts = [trail[0]];
  let walked = 0, next = seg;
  for (let i = 0; i < trail.length - 1 && pts.length < N; i++) {
    const [ax, ay] = trail[i], [bx, by] = trail[i + 1];
    const d = Math.hypot(bx - ax, by - ay);
    while (d > 0 && walked + d >= next && pts.length < N) {
      const f = (next - walked) / d;
      pts.push([ax + (bx - ax) * f, ay + (by - ay) * f]);
      next += seg;
    }
    walked += d;
  }
  while (pts.length < N) {
    // not enough trail yet: extend straight back from the last direction
    const a = pts[pts.length - 1], b = pts[pts.length - 2] || [a[0] + 1, a[1]];
    const dx = a[0] - b[0], dy = a[1] - b[1], dl = Math.hypot(dx, dy) || 1;
    pts.push([a[0] + (dx / dl) * seg, a[1] + (dy / dl) * seg]);
  }
  return pts.map((p, k) => {
    const q = pts[Math.min(k + 1, N - 1)], r = pts[Math.max(k - 1, 0)];
    const tx = q[0] - r[0], ty = q[1] - r[1], tl = Math.hypot(tx, ty) || 1;
    const u = k / (N - 1), amp = L * 0.085 * wave * Math.pow(u, 1.4);
    const off = amp * Math.sin(phase - u * 4.2);
    return [p[0] - (ty / tl) * off, p[1] + (tx / tl) * off];
  });
}

export function drawFish(ctx, s, L, phase) {
  const nrm = s.map((p, k) => {
    const q = s[Math.min(k + 1, N - 1)], r = s[Math.max(k - 1, 0)];
    const tx = q[0] - r[0], ty = q[1] - r[1], tl = Math.hypot(tx, ty) || 1;
    return [ty / tl, -tx / tl];
  });
  const head = s[0], dirx = s[0][0] - s[1][0], diry = s[0][1] - s[1][1], dl = Math.hypot(dirx, diry) || 1;
  const fx = dirx / dl, fy = diry / dl;
  const flap = Math.sin(phase * 0.9);

  // fantail
  const tb = s[N - 1], tp = s[N - 3];
  let bx = tb[0] - tp[0], by = tb[1] - tp[1]; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
  const lag = Math.sin(phase - 4.6) * 0.42;
  for (const side of [-1, 1]) {
    const ang = Math.atan2(by, bx) + side * (0.42 + 0.12 * Math.sin(phase * 1.1 + side)) + lag;
    const len = L * (0.66 + 0.06 * side * Math.sin(phase));
    const ex = tb[0] + Math.cos(ang) * len, ey = tb[1] + Math.sin(ang) * len;
    const c1x = tb[0] + Math.cos(ang - side * 0.55) * len * 0.55, c1y = tb[1] + Math.sin(ang - side * 0.55) * len * 0.55;
    const c2x = tb[0] + Math.cos(ang + side * 0.5) * len * 0.62, c2y = tb[1] + Math.sin(ang + side * 0.5) * len * 0.62;
    const g = ctx.createLinearGradient(tb[0], tb[1], ex, ey);
    g.addColorStop(0, "rgba(255,150,52,0.9)"); g.addColorStop(0.55, "rgba(255,186,120,0.55)"); g.addColorStop(1, "rgba(255,236,214,0.08)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(tb[0], tb[1]);
    ctx.quadraticCurveTo(c1x, c1y, ex, ey);
    ctx.quadraticCurveTo(c2x, c2y, tb[0] + bx * 2, tb[1] + by * 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,214,170,0.28)"; ctx.lineWidth = 0.8;
    for (let r = 1; r <= 3; r++) {
      const f = r / 4;
      ctx.beginPath(); ctx.moveTo(tb[0], tb[1]);
      ctx.quadraticCurveTo(c1x * (1 - f) + c2x * f, c1y * (1 - f) + c2y * f, ex * 0.85 + tb[0] * 0.15, ey * 0.85 + tb[1] * 0.15);
      ctx.stroke();
    }
  }

  // pectoral fins
  const pi = 3, pp = s[pi], pw = widthAt(pi / (N - 1), L);
  for (const side of [-1, 1]) {
    const ox = pp[0] + nrm[pi][0] * pw * side * 0.9, oy = pp[1] + nrm[pi][1] * pw * side * 0.9;
    const ang = Math.atan2(-fy, -fx) - side * (0.95 + 0.35 * flap * side);
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, L * 0.26, 0);
    g.addColorStop(0, "rgba(255,160,70,0.85)"); g.addColorStop(1, "rgba(255,230,200,0.1)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(L * 0.12, 0, L * 0.13, L * 0.05, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // body with a soft shadow for depth
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = L * 0.18; ctx.shadowOffsetX = L * 0.06; ctx.shadowOffsetY = L * 0.1;
  const left = [], right = [];
  for (let k = 0; k < N; k++) {
    const w = widthAt(k / (N - 1), L);
    left.push([s[k][0] + nrm[k][0] * w, s[k][1] + nrm[k][1] * w]);
    right.push([s[k][0] - nrm[k][0] * w, s[k][1] - nrm[k][1] * w]);
  }
  const mid = s[4], mw = widthAt(4 / (N - 1), L) * 1.1;
  const g = ctx.createLinearGradient(mid[0] + nrm[4][0] * mw, mid[1] + nrm[4][1] * mw, mid[0] - nrm[4][0] * mw, mid[1] - nrm[4][1] * mw);
  g.addColorStop(0, "#c63f12"); g.addColorStop(0.32, "#ff8a1f"); g.addColorStop(0.5, "#ffb347"); g.addColorStop(0.68, "#ff8a1f"); g.addColorStop(1, "#c63f12");
  ctx.fillStyle = g;
  ctx.beginPath();
  const hw = widthAt(0, L) + L * 0.02;
  ctx.moveTo(left[0][0], left[0][1]);
  ctx.quadraticCurveTo(head[0] + fx * hw * 1.9, head[1] + fy * hw * 1.9, right[0][0], right[0][1]);
  smooth(ctx, right);
  smooth(ctx, left.slice().reverse());
  ctx.closePath(); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(96,26,6,0.7)"; ctx.lineWidth = Math.max(0.8, L * 0.009); ctx.stroke();
  ctx.restore();

  // dorsal fin and glossy back highlight
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,226,180,0.42)"; ctx.lineWidth = L * 0.05;
  ctx.beginPath(); ctx.moveTo(s[1][0], s[1][1]); for (let k = 2; k < 9; k++) ctx.lineTo(s[k][0], s[k][1]); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = L * 0.018;
  ctx.beginPath(); ctx.moveTo(s[1][0] + nrm[1][0] * 1.5, s[1][1] + nrm[1][1] * 1.5);
  for (let k = 2; k < 6; k++) ctx.lineTo(s[k][0] + nrm[k][0] * 1.5, s[k][1] + nrm[k][1] * 1.5);
  ctx.stroke();

  // eyes
  const ep = s[1], ew = widthAt(1 / (N - 1), L) * 0.78;
  for (const side of [-1, 1]) {
    const ex = ep[0] + nrm[1][0] * ew * side + fx * L * 0.02, ey = ep[1] + nrm[1][1] * ew * side + fy * L * 0.02;
    ctx.fillStyle = "#1a0c05"; ctx.beginPath(); ctx.arc(ex, ey, L * 0.034, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.arc(ex - fx * L * 0.008 + 0.6, ey - fy * L * 0.008 - 0.6, L * 0.011, 0, TAU); ctx.fill();
  }
}

// A still fish along a gentle curve, for the share card.
export function drawStillFish(ctx, x, y, angle, L, bend = 0.6) {
  const trail = [];
  for (let k = 0; k <= 60; k++) {
    const d = (k / 60) * L * 1.2, a = angle + Math.PI + bend * (d / L) * 0.8;
    const px = x + Math.cos(angle + Math.PI) * d + Math.cos(a + Math.PI / 2) * bend * (d * d) / (L * 6);
    const py = y + Math.sin(angle + Math.PI) * d + Math.sin(a + Math.PI / 2) * bend * (d * d) / (L * 6);
    trail.push([px, py]);
  }
  drawFish(ctx, spineFrom(trail, L, 1.2, 1), L, 1.2);
}

/* ---------------- the companion ---------------- */

export function createFish({ back, front, heroCopy, reduce = false }) {
  const still = reduce;
  const ctxB = back.getContext("2d"), ctxF = front.getContext("2d");
  let VW = 0, VH = 0, dpr = 1, L = 110;
  // state
  let x = 0, y = 0, heading = 0, speed = 0, phase = 0, clock = 0, last = 0;
  let trail = [], mode = "wander", target = null, lookUntil = 0, seekUntil = 0, layer = "back", raf = 0;
  let pending = null, pendingUntil = 0; // a destination heading waiting to scroll into view
  let restTimer = 0;
  let size = 1, sizeGoal = 1; // the fish shrinks to fit the side lane
  let loopT = 0.4, scrollV = 0, lastScroll = scrollY, lastScrollT = performance.now();

  function resize() {
    VW = document.documentElement.clientWidth; VH = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, VW < 720 ? 1.5 : 2);
    for (const cv of [back, front]) { cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr); }
    ctxB.setTransform(dpr, 0, 0, dpr, 0, 0); ctxF.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = Math.max(92, Math.min(176, VW * 0.115)); // a big, readable fish
  }

  // The loop the fish follows when nothing has its attention, in viewport coordinates.
  function loopFrame() {
    const c = heroCopy.getBoundingClientRect();
    const inHero = c.bottom > VH * 0.45;
    const wide = VW - c.right > 260;
    if (inHero) {
      const cx = wide ? c.left + c.width * 0.92 : c.left + c.width * 0.5;
      const A = wide ? Math.min(c.width * 0.78, VW - cx - L * 1.4) : c.width * 0.46;
      return { inHero, cx, cy: c.top + c.height * 0.52, A, B: Math.min(c.height * 0.42, VH * 0.4) / 0.3536, split: wide ? cx + L * 0.2 : Infinity };
    }
    // Past the hero: an upright figure-eight in the empty margin right of the content,
    // drawn in front so it stays visible. When that margin is too narrow (tablets,
    // phones) it swims the same lane behind the page instead.
    const wrap = heroCopy.closest(".wrap");
    const contentRight = wrap.getBoundingClientRect().right - parseFloat(getComputedStyle(wrap).paddingRight);
    const lane = VW - contentRight;
    const open = lane >= L * 0.55;
    return { inHero, upright: true, cx: open ? contentRight + lane / 2 : VW - L * 0.5, cy: VH * 0.55,
      A: open ? Math.max(L * 0.32, lane * 0.4) : L * 0.4, B: VH * 0.3, front: open, split: Infinity };
  }
  const lemni = (f, tt) => {
    const s = Math.sin(tt), c = Math.cos(tt), d = 1 + s * s;
    if (f.upright) return [f.cx + f.A * (s * c / d) / 0.3536, f.cy + f.B * (c / d)];
    return [f.cx + f.A * (c / d), f.cy + f.B * (s * c / d)];
  };

  // Where to wait beside an element: on whichever of its four sides has the most
  // room for the body, far enough out that the snout stays off the control.
  function aimPoint(el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const gap = L * 0.95, clampX = (v) => Math.max(L * 0.6, Math.min(VW - L * 0.6, v)), clampY = (v) => Math.max(L * 0.6, Math.min(VH - L * 0.6, v));
    const sides = [
      { room: VW - r.right, stand: [r.right + gap, cy] },
      { room: r.left, stand: [r.left - gap, cy] },
      { room: (VH - r.bottom) * 1.15, stand: [cx, r.bottom + gap] }, // slight preference for over/under on phones
      { room: r.top * 1.15, stand: [cx, r.top - gap] },
    ].sort((a, b) => b.room - a.room);
    const onScreen = r.bottom > 0 && r.top < VH && r.right > 0 && r.left < VW;
    return { rect: r, onScreen, stand: [clampX(sides[0].stand[0]), clampY(sides[0].stand[1])], look: [cx, cy] };
  }

  function step(dt, now) {
    clock += dt;
    // scroll velocity (px/s), smoothed and decaying
    scrollV *= Math.pow(0.04, dt);

    let tx, ty, maxS, turn, wave = 1;
    if (pending) {
      const r = pending.getBoundingClientRect();
      if (r.bottom > 0 && r.top < VH) { target = pending; pending = null; mode = "seek"; seekUntil = now + 4000; }
      else if (now > pendingUntil) pending = null; // the route never resolved
    }
    if (mode !== "wander" && (!target || !target.isConnected)) mode = "wander";
    if (mode === "seek" || mode === "look") {
      const a = aimPoint(target);
      if (mode === "seek") {
        [tx, ty] = a.stand;
        const d = Math.hypot(tx - x, ty - y);
        maxS = Math.min(L * 9, Math.max(L * 1.2, d * 3));
        turn = 7.5;
        if (d < L * 0.35 && a.onScreen) { mode = "look"; lookUntil = now + 700; }
        if (now > seekUntil) mode = "wander"; // the target never came into view
        sizeGoal = 1;
      } else {
        // turn toward it, then hold: the snout stops just outside the control
        [tx, ty] = a.look;
        const m = L * 0.14, r = a.rect;
        const touching = x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;
        maxS = touching ? 0 : L * 0.35; turn = 6; wave = 0.5;
        if (now > lookUntil || !a.onScreen) mode = "wander";
      }
    } else {
      const f = loopFrame();
      // advance the loop at about the fish's cruising pace, then chase a point just ahead
      const p0 = lemni(f, loopT), p1 = lemni(f, loopT + 0.01);
      const ds = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 0.01 || 1;
      loopT = (loopT + (L * (f.upright ? 0.85 : 1.15) * dt) / ds) % TAU;
      [tx, ty] = lemni(f, loopT + 0.35);
      // lean where the visitor is scrolling
      ty += Math.max(-VH * 0.28, Math.min(VH * 0.28, scrollV * 0.22));
      // slower and tighter in the side lane so the turns stay inside it
      maxS = L * (f.upright ? 0.85 : 1.15 + 0.3 * Math.sin(clock * 0.55)) + Math.min(L * 4, Math.abs(scrollV) * 0.6);
      turn = f.upright ? 3.4 : 2.6;
      const far = Math.hypot(tx - x, ty - y);
      if (far > L * 1.5) { maxS = Math.max(maxS, Math.min(L * 5, far * 1.4)); turn = 4.5; }
      sizeGoal = f.upright ? 0.62 : 1;
    }

    // steer: limited turn rate, eased speed
    const want = Math.atan2(ty - y, tx - x);
    let diff = ((want - heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
    heading += Math.max(-turn * dt, Math.min(turn * dt, diff));
    const dist = Math.hypot(tx - x, ty - y);
    const desired = mode === "look" ? maxS : Math.min(maxS, Math.max(L * 0.4, dist * 2.4));
    if (mode === "look" && maxS === 0) speed *= Math.pow(0.001, dt); // settle, still facing it
    speed += (desired - speed) * Math.min(1, dt * (mode === "seek" ? 5 : 2.2));
    x += Math.cos(heading) * speed * dt;
    y += Math.sin(heading) * speed * dt;

    size += (sizeGoal - size) * Math.min(1, dt * 2.5);
    phase += dt * (3.4 + (speed / L) * 3.2);
    if (!trail.length || Math.hypot(x - trail[0][0], y - trail[0][1]) > 0.6) {
      trail.unshift([x, y]);
      if (trail.length > 600) trail.length = 600;
    }

    // depth: in front when it has something's attention or is in open water beside the copy
    const f = mode === "wander" ? loopFrame() : null;
    layer = mode !== "wander" ? "front" : (f.inHero ? (x > f.split ? "front" : "back") : (f.front ? "front" : "back"));
    return wave;
  }

  function render(wave) {
    ctxB.clearRect(0, 0, VW, VH); ctxF.clearRect(0, 0, VW, VH);
    if (trail.length < 2) return;
    const Ld = L * size;
    drawFish(layer === "front" ? ctxF : ctxB, spineFrom(trail, Ld, phase, wave), Ld, phase);
  }

  function frame(ts) {
    const dt = Math.min((ts - (last || ts)) / 1000, 0.05); last = ts;
    const wave = step(dt, ts);
    render(wave);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (still || raf || document.hidden) return; last = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  // attention: buttons, links and backpack items
  document.addEventListener("click", (e) => {
    const el = e.target.closest("a, button");
    if (!el) return;
    const hash = el.getAttribute("href");
    const now = performance.now();
    pending = null;
    if (hash && hash.startsWith("#") && hash.length > 1) {
      const sec = document.querySelector(hash);
      const heading = sec && (sec.querySelector(".section-title, h2, h3") || sec);
      if (heading && heading !== el) { pending = heading; pendingUntil = now + 4000; }
    }
    target = el; mode = "seek"; seekUntil = now + 4000;
    if (still) { placeBeside(el); clearTimeout(restTimer); restTimer = setTimeout(restPose, 1600); }
  }, true);

  addEventListener("scroll", () => {
    const now = performance.now(), dy = scrollY - lastScroll, dtS = Math.max(16, now - lastScrollT) / 1000;
    scrollV = scrollV * 0.6 + (dy / dtS) * 0.4;
    lastScroll = scrollY; lastScrollT = now;
  }, { passive: true });
  addEventListener("resize", () => { resize(); if (still) restPose(); });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  // A straight-bodied pose at (px, py) heading `ang`, drawn once.
  function pose(px, py, ang, front) {
    x = px; y = py; heading = ang; trail = [];
    for (let k = 0; k < 60; k++) trail.push([x - Math.cos(ang) * k * 4, y - Math.sin(ang) * k * 4]);
    layer = front ? "front" : "back"; size = sizeGoal = 1;
    render(0.4);
  }
  function restPose() {
    const f = loopFrame(), p = lemni(f, 0.15), q = lemni(f, 0.3);
    pose(p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0]), f.inHero ? p[0] > f.split : f.front);
  }
  function placeBeside(el) {
    const a = aimPoint(el);
    pose(a.stand[0], a.stand[1], Math.atan2(a.look[1] - a.stand[1], a.look[0] - a.stand[0]), true);
  }

  resize();
  if (still) {
    // Reduced motion: one resting pose, redrawn only when something changes.
    restPose();
    let t; addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(restPose, 160); }, { passive: true });
    return;
  }
  // start on the open-water side of the hero, heading into the loop
  const f0 = loopFrame();
  [x, y] = lemni(f0, loopT);
  const ahead = lemni(f0, loopT + 0.05);
  heading = Math.atan2(ahead[1] - y, ahead[0] - x);
  for (let k = 0; k < 40; k++) trail.push([x - Math.cos(heading) * k * 4, y - Math.sin(heading) * k * 4]);
  start();
}
