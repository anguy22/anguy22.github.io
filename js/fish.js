// A goldfish that lives in a layer fixed to the viewport and keeps the visitor company.
//
// - In the hero it swims a figure-eight through the copy: behind the text on the
//   left loop (the back canvas is dimmed and sits under the page), in front in the
//   open water on the right. Crossing between the two is the weave.
// - Past the hero it cruises a loop on the side of the screen, behind the content,
//   and leans in the direction the visitor scrolls.
// - When the visitor clicks a button, link or skill, it darts over, turns to
//   face the thing and noses up to it for a moment. In-page links send it to the
//   section heading they jump to.
//
// Motion is steering, not keyframes: the head turns toward a target at a limited
// rate and eases its speed; the body is a spine that follows the head's own trail.

const TAU = Math.PI * 2;
const N = 14;

/* ---------------- drawing ---------------- */

function widthAt(u, L) {
  return L * (.066 + .154 * Math.sin(Math.PI * Math.pow(u, .64))) * (1 - .64 * u * u);
}

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

// Each frame carries a tangent and its perpendicular along the curved body.
function fishFrame(spine, u) {
  const index = u * (N - 1), k = Math.floor(index), t = index - k;
  const a = spine[k], b = spine[Math.min(k + 1, N - 1)];
  const forward = spine[Math.max(0, k - 1)], aft = spine[Math.min(N - 1, k + 2)];
  const dx = forward[0] - aft[0], dy = forward[1] - aft[1], d = Math.hypot(dx, dy) || 1;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, fx: dx / d, fy: dy / d };
}

function at(f, along, across) {
  return [f.x + f.fx * along - f.fy * across, f.y + f.fy * along + f.fx * across];
}

function fin(ctx, root, angle, scaleX, scaleY, { length, lift, breadth, tint = 1, rays = 5 }) {
  ctx.save();
  ctx.translate(...root);
  ctx.rotate(angle);
  ctx.scale(scaleX, scaleY);
  ctx.globalAlpha *= tint;
  const edge = ctx.createLinearGradient(0, 0, length, lift * 0.8);
  edge.addColorStop(0, "rgba(130,47,22,.95)");
  edge.addColorStop(.28, "rgba(225,101,36,.88)");
  edge.addColorStop(.72, "rgba(248,163,95,.64)");
  edge.addColorStop(1, "rgba(218,220,191,.26)");
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.moveTo(0, -breadth * .1);
  ctx.bezierCurveTo(length * .26, -breadth * .28, length * .68, lift - breadth * .92, length, lift - breadth * .5);
  ctx.quadraticCurveTo(length * 1.02, lift + breadth * .06, length * .76, lift + breadth * .52);
  ctx.bezierCurveTo(length * .48, lift + breadth * .62, length * .24, breadth * .39, 0, breadth * .12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,199,143,.34)";
  ctx.lineWidth = .005;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  for (let r = 0; r < rays; r++) {
    const t = (r + .5) / rays;
    ctx.moveTo(0, (t - .5) * breadth * .14);
    ctx.quadraticCurveTo(length * .42, lift * .22 + (t - .5) * breadth * .84,
      length * (1.03 - .26 * t), lift + (t - .5) * breadth * 1.02);
  }
  ctx.strokeStyle = "rgba(106,49,32,.46)";
  ctx.lineWidth = .006;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function scales(ctx, frames, L) {
  const rows = 5;
  ctx.beginPath();
  for (let k = 0; k < 11; k++) {
    for (let row = 0; row < rows; row++) {
      const u = .26 + k * .055 + (row % 2) * .022;
      const f = frames(u);
      const w = widthAt(u, L);
      const across = (row - (rows - 1) / 2) * w * .36;
      const r = w * .18;
      ctx.moveTo(...at(f, 0, across - r));
      ctx.quadraticCurveTo(...at(f, -r * 1.85, across), ...at(f, 0, across + r));
    }
  }
  ctx.lineWidth = Math.max(.42, L * .0045);
  ctx.strokeStyle = "rgba(88,33,20,.28)";
  ctx.stroke();
}

function eye(ctx, x, y, r, far) {
  ctx.fillStyle = far ? "#a75a32" : "#d87e3c";
  ctx.beginPath();
  ctx.arc(x, y, r * 1.16, 0, TAU);
  ctx.fill();
  const iris = ctx.createRadialGradient(x - r * .25, y - r * .31, 0, x, y, r);
  iris.addColorStop(0, "#695464");
  iris.addColorStop(.53, "#211719");
  iris.addColorStop(.84, "#111216");
  iris.addColorStop(1, "#6f3b2b");
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = far ? "rgba(247,239,213,.65)" : "#fff5d8";
  ctx.beginPath();
  ctx.arc(x - r * .27, y - r * .34, r * .27, 0, TAU);
  ctx.fill();
}

function pectoral(ctx, shoulder, angle, L, side, paddle, tint) {
  if (tint < .04) return;
  fin(ctx, at(shoulder, -L * .028, side * L * .103), angle + Math.PI + side * (.65 + paddle * .28),
    L, -side * L * (.76 + paddle * .19), { length: .32, lift: .054, breadth: .16, tint, rays: 5 });
}

// bank: its sign is which flank faces the viewer (chosen so the back stays up), its size how
// side-on the fish is (1 = profile, 0 = face-on, both eyes showing).
export function drawFish(ctx, spine, L, phase, bankIn) {
  const frame = (u) => fishFrame(spine, u);
  const head = frame(0), shoulder = frame(.25), tail = frame(1);
  const angle = Math.atan2(head.fy, head.fx);
  // The near flank changes as the fish turns. The tail folds before the body banks.
  const bank = typeof bankIn === "number" ? Math.max(-1, Math.min(1, bankIn)) : (head.fx >= 0 ? .9 : -.9);
  const roll = Math.abs(bank);
  const beat = Math.sin(phase - 3.8);
  const tailAngle = Math.atan2(-tail.fy, -tail.fx) + beat * .27;
  const fan = L * (.8 + .2 * Math.cos(phase - 3.8));

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  fin(ctx, at(tail, L * .02, 0), tailAngle - .17, L, -fan,
    { length: .66, lift: .22, breadth: .34, tint: .8, rays: 7 });
  fin(ctx, at(tail, L * .02, 0), tailAngle + .17, L * (.97 + .05 * beat), fan,
    { length: .69, lift: .21, breadth: .38, rays: 8 });

  const paddle = Math.sin(phase * 1.25);
  for (const side of [-1, 1]) pectoral(ctx, shoulder, angle, L, side, paddle, .62 * (1 - side * bank) / 2);
  const dorsal = frame(.3);
  if (roll > .02) {
    fin(ctx, at(dorsal, L * .045, -bank * widthAt(.3, L) * .85), angle + Math.PI + bank * .46, L, bank * L,
      { length: .43, lift: .12, breadth: .23, tint: .92, rays: 7 });
  }

  const left = [], right = [];
  for (let k = 0; k < N; k++) {
    const u = k / (N - 1), f = frame(u), width = widthAt(u, L) * (.87 + .13 * roll);
    const belly = bank * L * .041 * Math.sin(Math.PI * u);
    left.push(at(f, 0, belly + width));
    right.push(at(f, 0, belly - width));
  }

  ctx.beginPath();
  ctx.moveTo(...left[0]);
  ctx.quadraticCurveTo(...at(head, L * .135, bank * L * .025), ...right[0]);
  smooth(ctx, right);
  smooth(ctx, left.reverse());
  ctx.closePath();
  const mid = frame(.37);
  const light = ctx.createLinearGradient(...at(mid, 0, -L * .24), ...at(mid, 0, L * .24));
  light.addColorStop(0, "#65301f");
  light.addColorStop(.23, "#be4c22");
  light.addColorStop(.5, "#f69a37");
  light.addColorStop(.77, "#be4c22");
  light.addColorStop(1, "#65301f");
  ctx.fillStyle = light;
  ctx.fill();
  ctx.strokeStyle = "rgba(79,32,23,.8)";
  ctx.lineWidth = Math.max(.7, L * .006);
  ctx.stroke();

  ctx.save();
  ctx.clip();
  // The broad key and cool backscatter stay in water space as the fish turns.
  const key = ctx.createRadialGradient(shoulder.x - L * .09, shoulder.y - L * .13, L * .012, shoulder.x, shoulder.y - L * .01, L * .48);
  key.addColorStop(0, "rgba(255,231,155,.9)");
  key.addColorStop(.24, "rgba(255,191,99,.6)");
  key.addColorStop(.66, "rgba(255,139,53,.15)");
  key.addColorStop(1, "rgba(255,128,42,0)");
  ctx.fillStyle = key;
  ctx.fillRect(shoulder.x - L, shoulder.y - L, L * 2, L * 2);
  const bounce = ctx.createRadialGradient(mid.x + L * .11, mid.y + L * .26, L * .04, mid.x, mid.y + L * .19, L * .52);
  bounce.addColorStop(0, "rgba(165,202,202,.46)");
  bounce.addColorStop(.42, "rgba(112,146,162,.22)");
  bounce.addColorStop(1, "rgba(79,114,139,0)");
  ctx.fillStyle = bounce;
  ctx.fillRect(mid.x - L, mid.y - L, L * 2, L * 2);
  scales(ctx, frame, L);
  ctx.restore();

  const gill = frame(.206), gillSide = bank < 0 ? -1 : 1;
  const gillBeat = Math.sin(phase * .72) * L * .009;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, roll * 2.3);
  ctx.beginPath();
  ctx.moveTo(...at(gill, L * .01, -gillSide * L * .084));
  ctx.quadraticCurveTo(...at(gill, -L * .085 + gillBeat, gillSide * L * .042), ...at(gill, -L * .008, gillSide * L * .139));
  ctx.strokeStyle = "rgba(111,42,23,.67)";
  ctx.lineWidth = Math.max(.65, L * .011);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(...at(gill, -L * .009, -gillSide * L * .078));
  ctx.quadraticCurveTo(...at(gill, -L * .091 + gillBeat, gillSide * L * .047), ...at(gill, -L * .024, gillSide * L * .127));
  ctx.strokeStyle = "rgba(255,219,133,.48)";
  ctx.lineWidth = L * .007;
  ctx.stroke();
  ctx.restore();

  for (const side of [-1, 1]) pectoral(ctx, shoulder, angle, L, side, paddle, .91 * Math.max(0, side * bank));

  const ep = frame(.064);
  if (roll < .47) {
    ctx.save();
    ctx.globalAlpha *= 1 - roll / .47;
    eye(ctx, ...at(ep, L * .005, gillSide * L * .067), L * (.035 - roll * .015), true);
    ctx.restore();
  }
  eye(ctx, ...at(ep, L * .007, -gillSide * L * (.067 - roll * .04)), L * .035, false);

  const lip = bank * L * .048;
  ctx.beginPath();
  ctx.moveTo(...at(head, L * .069, lip - L * .016));
  ctx.quadraticCurveTo(...at(head, L * .044, lip), ...at(head, L * .066, lip + L * .014));
  ctx.lineWidth = Math.max(.65, L * .008);
  ctx.strokeStyle = "rgba(107,46,29,.76)";
  ctx.stroke();
  ctx.restore();
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
  let turnBank = 0, lastCanvas = null;
  // depth: z 0 (far, behind the page) .. 1 (near); bankS rolls smoothly between flanks
  let z = 0.5, vz = 0, bankSign = 1, bankS = 0.9, sideAmt = 1;
  let trail = [], mode = "wander", target = null, lookUntil = 0, seekUntil = 0, layer = "back", raf = 0;
  let pending = null, pendingUntil = 0; // a destination heading waiting to scroll into view
  let restTimer = 0;
  let reside = false; // stay beside a selected tank object until something else is picked
  const tank = document.getElementById("tank");
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
      const A = wide ? Math.min(c.width * 0.78, VW - cx - L * 1.4) : Math.min(c.width * 0.46, VW * .5 - L * .74);
      return { inHero, cx, cy: c.top + c.height * 0.52, A, B: Math.min(c.height * 0.42, VH * 0.4) / 0.3536, split: wide ? cx + L * 0.2 : Infinity };
    }
    // The skills tank: when it fills the middle of the screen, swim inside it.
    const tk = tank && tank.getBoundingClientRect();
    if (tk && tk.top < VH * 0.6 && tk.bottom > VH * 0.4) {
      const clearance = Math.max(tk.width * .12, tk.width * .5 - L * .76);
      return { inHero, inTank: true, cx: tk.left + tk.width / 2, cy: tk.top + tk.height * 0.34, A: Math.min(tk.width * .36, clearance), B: (tk.height * 0.2) / 0.3536, front: true, split: Infinity };
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
    const inTank = tank && tank.contains(el);
    // inside the tank the fish is smaller and keeps to the water around the object
    const B = inTank ? tank.getBoundingClientRect() : { left: 0, top: 0, right: VW, bottom: VH };
    const Ls = L * (inTank ? 0.62 : 1), gap = Ls * 0.95, pad = Ls * 0.6;
    const clampX = (v) => Math.max(B.left + pad, Math.min(B.right - pad, v)), clampY = (v) => Math.max(B.top + pad, Math.min(B.bottom - pad, v));
    const sides = [
      { room: B.right - r.right, stand: [r.right + gap, cy] },
      { room: r.left - B.left, stand: [r.left - gap, cy] },
      { room: (B.bottom - r.bottom) * (inTank ? 0.5 : 1.15), stand: [cx, r.bottom + gap] }, // not into the sand
      { room: (r.top - B.top) * (inTank ? 0.9 : 1.15), stand: [cx, r.top - gap] },
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
    if (mode === "reside") {
      // Stay with the selected object: face it for a moment, then hover beside it.
      const a = aimPoint(target), Ls = L * size;
      if (!a.onScreen) { mode = "wander"; reside = false; }
      if (now % 5200 < 1600) {
        [tx, ty] = a.look;
        const m = Ls * 0.3, r = a.rect;
        const touching = x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;
        maxS = touching ? 0 : Ls * 0.3; turn = 5; wave = 0.5;
      } else {
        const g = clock * 0.8;
        tx = a.stand[0] + Math.cos(g) * Ls * 0.35; ty = a.stand[1] + Math.sin(g * 1.3) * Ls * 0.18;
        maxS = Ls * 0.6; turn = 3; wave = 0.7;
      }
      sizeGoal = 0.62;
    } else if (mode === "seek" || mode === "look") {
      const a = aimPoint(target);
      if (mode === "seek") {
        [tx, ty] = a.stand;
        const d = Math.hypot(tx - x, ty - y);
        maxS = Math.min(L * (reside ? 9 : 4.5), Math.max(L * 1.2, d * 3)); // a quick dart for skills, unhurried elsewhere
        turn = 7.5;
        if (d < L * 0.35 && a.onScreen) { mode = reside ? "reside" : "look"; lookUntil = now + 700; }
        if (now > seekUntil) { mode = "wander"; reside = false; } // the target never came into view
        sizeGoal = tank && tank.contains(target) ? 0.62 : 1;
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
      // Slow swells: it eases down to about a third of its pace now and then, so the
      // dart toward a selected skill is the moment that stands out.
      const calm = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(clock * 0.28 + 0.6)), 0.6);
      loopT = (loopT + (L * (f.upright || f.inTank ? 0.55 : 0.7) * calm * dt) / ds) % TAU;
      [tx, ty] = lemni(f, loopT + 0.35);
      // lean where the visitor is scrolling
      ty += Math.max(-VH * 0.28, Math.min(VH * 0.28, scrollV * 0.22));
      // slower and tighter in the side lane so the turns stay inside it
      maxS = L * (f.upright ? 0.6 : 0.72) * calm + Math.min(L * 3, Math.abs(scrollV) * 0.4);
      turn = f.upright ? 3 : 2.1;
      const far = Math.hypot(tx - x, ty - y);
      if (far > L * 1.5) { maxS = Math.max(maxS, Math.min(L * 5, far * 1.4)); turn = 4.5; }
      sizeGoal = f.upright || f.inTank ? 0.62 : 1;
    }

    // steer: limited turn rate, eased speed
    const want = Math.atan2(ty - y, tx - x);
    let diff = ((want - heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
    heading += Math.max(-turn * dt, Math.min(turn * dt, diff));
    turnBank += (Math.max(-1, Math.min(1, diff)) - turnBank) * Math.min(1, dt * 4);
    const dist = Math.hypot(tx - x, ty - y);
    const holding = mode === "look" || mode === "reside";
    const desired = holding ? maxS : Math.min(maxS, Math.max(L * 0.4, dist * 2.4));
    if (holding && maxS === 0) speed *= Math.pow(0.001, dt); // settle, still facing it
    speed += (desired - speed) * Math.min(1, dt * (mode === "seek" ? 5 : 2.2));
    x += Math.cos(heading) * speed * dt;
    y += Math.sin(heading) * speed * dt;

    size += (sizeGoal - size) * Math.min(1, dt * 2.5);
    phase += dt * (3.4 + (speed / L) * 3.2);
    if (!trail.length || Math.hypot(x - trail[0][0], y - trail[0][1]) > 0.6) {
      trail.unshift([x, y]);
      if (trail.length > 600) trail.length = 600;
    }

    // Depth (z): it comes close when it has something's attention, weaves behind the copy
    // and out in front of it in the hero, and drifts nearer and farther elsewhere.
    const f = mode === "wander" ? loopFrame() : null;
    const zGoal = mode !== "wander" ? 0.85
      : f.inHero ? (x > f.split ? 0.92 : 0.2)
      : f.inTank ? 0.5 + 0.38 * Math.sin(clock * 0.33)
      : f.front ? 0.55 + 0.3 * Math.sin(clock * 0.37) : 0.3;
    vz += (Math.max(-0.5, Math.min(0.5, (zGoal - z) * 1.6)) - vz) * Math.min(1, dt * 3);
    z = Math.max(0, Math.min(1, z + vz * dt));
    // Swimming toward or away from the viewer turns it face-on; otherwise it is in profile.
    const pitch = Math.atan2(Math.abs(vz) * L * 3.2, Math.max(speed, L * 0.3));
    sideAmt = 1 - Math.min(0.85, pitch / 1.1);
    const cx = Math.cos(heading);
    if (Math.abs(cx) > 0.2) bankSign = cx >= 0 ? 1 : -1; // hysteresis: no flip-flop when swimming vertically
    bankS += (bankSign * sideAmt - bankS) * Math.min(1, dt * 3.5); // rolls through when it reverses
    layer = mode !== "wander" ? "front" : f.inHero ? (z > 0.55 ? "front" : "back") : (f.front ? "front" : "back");
    return wave;
  }

  function render(wave) {
    const canvas = layer === "front" ? ctxF : ctxB;
    if (lastCanvas && lastCanvas !== canvas) lastCanvas.clearRect(0, 0, VW, VH);
    canvas.clearRect(0, 0, VW, VH);
    lastCanvas = canvas;
    if (trail.length < 2) return;
    const Ld = L * size * (0.7 + 0.42 * z);       // nearer is bigger
    const Ls = Ld * (0.6 + 0.4 * sideAmt);        // head-on shortens the body
    drawFish(canvas, spineFrom(trail, Ls, phase, wave), Ld, phase, bankS);
  }

  function frame(ts) {
    const dt = Math.min((ts - (last || ts)) / 1000, 0.05); last = ts;
    const wave = step(dt, ts);
    render(wave);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (still || raf || document.hidden) return; last = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  // attention: buttons, links and skills
  document.addEventListener("click", (e) => {
    const sk = e.target.closest("[data-skill]");
    const obj = sk && document.querySelector(`.tank-obj[data-skill="${sk.dataset.skill}"]`);
    if (obj) {
      target = obj; mode = "seek"; reside = true; pending = null; seekUntil = performance.now() + 4000;
      if (still) placeBeside(obj);
      return;
    }
    const el = e.target.closest("a, button");
    if (!el) return;
    reside = false;
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
  function pose(px, py, ang, front, scale = 1) {
    x = px; y = py; heading = ang; turnBank = 0; trail = [];
    for (let k = 0; k < 60; k++) trail.push([x - Math.cos(ang) * k * 4, y - Math.sin(ang) * k * 4]);
    layer = front ? "front" : "back"; size = sizeGoal = scale;
    render(0.4);
  }
  function restPose() {
    const f = loopFrame(), t = f.inHero && f.split === Infinity ? .99 : .15;
    const p = lemni(f, t), q = lemni(f, t + .15);
    pose(p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0]), f.inHero ? p[0] > f.split : f.front, f.inTank || f.upright ? .62 : 1);
  }
  function placeBeside(el) {
    const a = aimPoint(el);
    pose(a.stand[0], a.stand[1], Math.atan2(a.look[1] - a.stand[1], a.look[0] - a.stand[0]), true, tank?.contains(el) ? .62 : 1);
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
