// Hero figure: a Galton board in chrome. Balls fall through an invisible peg
// field, pile into bins, and a green normal curve fits the pile. The readout
// reports the sample's own mean and standard deviation, not the textbook ones.

const canvas = document.getElementById("galton");
if (canvas) init(canvas);

function init(cv) {
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nEl = document.getElementById("g-n"), sEl = document.getElementById("g-stats");
  const ROWS = 12, BINS = ROWS + 1, N = 230;
  let W, H, dpr, pegTop, pegGap, rowGap, binW, d, floorY, sprite;
  let balls = [], landed = [], counts, spawned = 0, curveT = 0, fade = 1, phase = "fill", hold = 0, last = 0, acc = 0;
  let running = false, visible = true;

  function layout() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    binW = W / (BINS + 1);
    d = binW / 3.15;
    pegGap = binW;
    pegTop = H * 0.07;
    rowGap = (H * 0.44) / ROWS;
    floorY = H - 34;
    sprite = makeSprite(Math.ceil(d * dpr) + 2);
  }

  function makeSprite(px) {
    const c = document.createElement("canvas"); c.width = c.height = px;
    const g = c.getContext("2d"), r = px / 2;
    const grad = g.createRadialGradient(r * 0.7, r * 0.6, r * 0.05, r, r, r);
    grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.28, "#d9dedb");
    grad.addColorStop(0.7, "#6b7370"); grad.addColorStop(1, "#141716");
    g.fillStyle = grad; g.beginPath(); g.arc(r, r, r - 0.5, 0, Math.PI * 2); g.fill();
    return c;
  }

  const pegX = (row, k) => W / 2 + (k - row / 2) * pegGap;
  const binX = (b) => W / 2 + (b - ROWS / 2) * pegGap;

  function newBall() {
    const path = []; let k = 0;
    for (let r = 0; r < ROWS; r++) { path.push(k); if (Math.random() < 0.5) k++; }
    return { path, bin: k, t: 0, speed: 0.9 + Math.random() * 0.25 };
  }

  function stackPos(bin, i) {
    const perRow = 3, col = i % perRow, row = Math.floor(i / perRow);
    return [binX(bin) + (col - 1) * d * 1.02 + (row % 2 ? d * 0.18 : 0), floorY - d / 2 - row * d * 0.9];
  }

  function reset() {
    balls = []; landed = []; counts = new Array(BINS).fill(0); spawned = 0; curveT = 0; fade = 1; phase = "fill"; hold = 0;
  }

  function step(dt) {
    if (phase === "fill") {
      acc += dt;
      while (acc > 34 && spawned < N) { acc -= 34; balls.push(newBall()); spawned++; }
      for (const b of balls) b.t += (dt / 1000) * b.speed * 9.5;
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if (b.t >= ROWS + 2.2) {
          landed.push({ bin: b.bin, i: counts[b.bin]++ });
          balls.splice(i, 1);
        }
      }
      if (spawned >= N && balls.length === 0) phase = "fit";
    } else if (phase === "fit") {
      curveT = Math.min(1, curveT + dt / 1100);
      if (curveT >= 1) phase = "hold";
    } else if (phase === "hold") {
      hold += dt; if (hold > 4200) phase = "fade";
    } else if (phase === "fade") {
      fade = Math.max(0, fade - dt / 900);
      if (fade <= 0) { reset(); if (once) { once = false; settleNow(); } }
    }
  }

  function ballXY(b) {
    const t = b.t;
    if (t < 1) return [W / 2, pegTop - rowGap * (1 - t) * 1.2];
    const r = Math.min(Math.floor(t - 1), ROWS - 1), f = Math.min(t - 1 - r, 1);
    if (t - 1 < ROWS) {
      const from = pegX(r, b.path[r]);
      const to = r + 1 < ROWS ? pegX(r + 1, b.path[r + 1]) : binX(b.bin);
      const e = f * f * (3 - 2 * f);
      const bounce = Math.sin(f * Math.PI) * rowGap * 0.28;
      return [from + (to - from) * e, pegTop + rowGap * (r + f) - bounce];
    }
    const [sx, sy] = stackPos(b.bin, counts[b.bin]);
    const g = Math.min((t - 1 - ROWS) / 1.2, 1);
    const y0 = pegTop + rowGap * ROWS;
    return [sx, y0 + (sy - y0) * g * g];
  }

  function stats() {
    const n = landed.length; if (!n) return null;
    let m = 0; for (const l of landed) m += l.bin; m /= n;
    let v = 0; for (const l of landed) v += (l.bin - m) ** 2; v /= Math.max(n - 1, 1);
    return { n, m, s: Math.sqrt(v) };
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    // pegs
    ctx.fillStyle = "rgba(233,240,236,0.13)";
    for (let r = 0; r < ROWS; r++) for (let k = 0; k <= r; k++) {
      ctx.beginPath(); ctx.arc(pegX(r, k), pegTop + rowGap * r + d * 0.9, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    // bin rails and floor
    ctx.strokeStyle = "rgba(233,240,236,0.08)"; ctx.lineWidth = 1;
    for (let b = 0; b <= BINS; b++) { const x = binX(b) - pegGap / 2; ctx.beginPath(); ctx.moveTo(x, floorY - H * 0.36); ctx.lineTo(x, floorY); ctx.stroke(); }
    ctx.strokeStyle = "rgba(233,240,236,0.22)"; ctx.beginPath(); ctx.moveTo(binX(0) - pegGap / 2, floorY + 0.5); ctx.lineTo(binX(ROWS) + pegGap / 2, floorY + 0.5); ctx.stroke();

    ctx.globalAlpha = fade;
    const s = sprite, sz = d;
    for (const l of landed) { const [x, y] = stackPos(l.bin, l.i); ctx.drawImage(s, x - sz / 2, y - sz / 2, sz, sz); }
    for (const b of balls) { const [x, y] = ballXY(b); ctx.drawImage(s, x - sz / 2, y - sz / 2, sz, sz); }

    // fitted normal curve, scaled to the pile's geometry
    const st = stats();
    if (st && curveT > 0) {
      const rowsPer = 1 / 3, hPerBall = d * 0.9 * rowsPer;
      ctx.save();
      ctx.strokeStyle = "#34a873"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.shadowColor = "rgba(52,168,115,0.35)"; ctx.shadowBlur = 0;
      ctx.beginPath();
      const x0 = -0.6, x1 = ROWS + 0.6, end = x0 + (x1 - x0) * curveT;
      for (let x = x0; x <= end; x += 0.05) {
        const pdf = Math.exp(-0.5 * ((x - st.m) / st.s) ** 2) / (st.s * Math.sqrt(2 * Math.PI));
        const px = binX(x), py = floorY - pdf * st.n * hPerBall - d * 0.5;
        x === x0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (nEl) nEl.textContent = `n = ${landed.length}`;
    if (sEl) sEl.textContent = st && phase !== "fill" ? `x̄ = ${st.m.toFixed(2)} · s = ${st.s.toFixed(2)}` : "";
  }

  // Playback: the visitor can pause, resume, or (under reduced motion) replay one run.
  const btn = document.getElementById("g-ctrl");
  let paused = false, once = false, settled = false;
  function setBtn(state) {
    if (!btn) return;
    btn.dataset.state = state;
    btn.setAttribute("aria-label", state === "playing" ? "Pause the animation" : state === "paused" ? "Play the animation" : "Replay the animation");
  }
  function settleNow() {
    reset();
    for (let i = 0; i < N; i++) { const b = newBall(); landed.push({ bin: b.bin, i: counts[b.bin]++ }); }
    curveT = 1; phase = "hold"; hold = -Infinity; settled = true; stop(); render(); setBtn("settled");
  }
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(ts - (last || ts), 50); last = ts;
    step(dt); render();
    if (once && phase === "hold" && hold > 2500) { once = false; settled = true; stop(); setBtn("settled"); return; }
    requestAnimationFrame(frame);
  }
  function start() { if (running || paused || settled) return; running = true; last = 0; requestAnimationFrame(frame); }
  function stop() { running = false; }

  btn?.addEventListener("click", () => {
    if (btn.dataset.state === "settled") {
      settled = false; paused = false; once = reduce; reset(); setBtn("playing"); start();
    } else if (paused) { paused = false; setBtn("playing"); start(); }
    else { paused = true; stop(); setBtn("paused"); }
  });

  layout(); reset();
  if (reduce) {
    settleNow(); // settle the whole sample at once and show the fitted curve
  } else {
    setBtn("playing");
    setTimeout(start, 900);
  }

  new ResizeObserver(() => { layout(); render(); }).observe(cv);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(cv);
  document.addEventListener("visibilitychange", () => (document.hidden || !visible ? stop() : start()));
}
