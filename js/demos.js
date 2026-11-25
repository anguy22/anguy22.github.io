// Skill demos: a small animated window per skill that shows the skill at work
// (code running, data moving), not a description of it. Each demo builds its own
// DOM, runs a cancellable timeline, then loops after a pause. Reduced motion shows
// the finished state at once. Demo data is illustrative and is generated, never
// presented as Andrew's results.

const ACCENT = "#3b9ae1", WARM = "#e0735a", INK = "#e6eef5", MUTED = "#8b98a3";
const STOP = Symbol("stop");
const ease = (k) => 1 - Math.pow(1 - k, 3);
const el = (tag, cls, html = "") => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const svgEl = (vb) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", vb); s.setAttribute("aria-hidden", "true"); s.classList.add("demo-svg"); return s; };
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

function runner(reduce) {
  let alive = true; const timers = [];
  const guard = () => { if (!alive) throw STOP; };
  return {
    get alive() { return alive; },
    stop() { alive = false; timers.forEach(clearTimeout); },
    wait(ms) { guard(); return new Promise((res, rej) => { if (reduce) return res(); timers.push(setTimeout(() => (alive ? res() : rej(STOP)), ms)); }); },
    tween(ms, fn) {
      guard();
      if (reduce) { fn(1); return Promise.resolve(); }
      return new Promise((res, rej) => {
        const t0 = performance.now();
        const step = (t) => { if (!alive) return rej(STOP); const k = Math.min(1, (t - t0) / ms); fn(ease(k)); k < 1 ? requestAnimationFrame(step) : res(); };
        requestAnimationFrame(step);
      });
    },
    async type(node, text, cps = 34) {
      if (reduce) { node.textContent += text; return; }
      for (const ch of text) { guard(); node.textContent += ch; await this.wait(1000 / cps); }
    },
  };
}

/* ---------------- the demos ---------------- */

const DEMOS = {
  python: { file: "walk.py", async run(host, r, n) {
    const code = el("pre", "demo-code"), out = el("div", "demo-out");
    host.append(code, out);
    const lines = ["import numpy as np", "import matplotlib.pyplot as plt", "", "walk = np.cumsum(np.random.randn(90))", "plt.plot(walk)"];
    for (const line of lines) { const ln = el("span", "ln"); code.append(ln, "\n"); await r.type(ln, line); await r.wait(120); }
    const run = el("span", "ln prompt"); code.append(run); await r.wait(300); await r.type(run, "$ python walk.py", 28);
    await r.wait(350);
    const rnd = seeded(7 + n * 31), pts = []; let v = 0;
    for (let i = 0; i < 90; i++) { v += gauss(rnd); pts.push(v); }
    const lo = Math.min(...pts), hi = Math.max(...pts);
    const svg = svgEl("0 0 520 120"); out.append(svg);
    svg.innerHTML = `<line x1="0" y1="${(110 - ((0 - lo) / (hi - lo || 1)) * 100).toFixed(1)}" x2="520" y2="${(110 - ((0 - lo) / (hi - lo || 1)) * 100).toFixed(1)}" stroke="${MUTED}" stroke-opacity=".35"/><path fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round"/>`;
    const path = svg.querySelector("path");
    await r.tween(1600, (k) => {
      const m = Math.max(2, Math.round(k * pts.length));
      path.setAttribute("d", pts.slice(0, m).map((p, i) => `${i ? "L" : "M"}${(i / 89 * 520).toFixed(1)} ${(110 - ((p - lo) / (hi - lo || 1)) * 100).toFixed(1)}`).join(""));
    });
  } },

  sql: { file: "query.sql", async run(host, r, n) {
    const code = el("pre", "demo-code one"); host.append(code);
    const svg = svgEl("0 0 520 190"); host.append(svg);
    const silos = [["orders", 30], ["customers", 82], ["regions", 134]];
    svg.innerHTML = silos.map(([name, y]) => `<g transform="translate(14 ${y})">
        <path d="M0 6 V34 A34 8 0 0 0 68 34 V6" fill="#16324f" stroke="${ACCENT}" stroke-opacity=".6"/>
        <ellipse cx="34" cy="6" rx="34" ry="8" fill="#1f4a73" stroke="${ACCENT}" stroke-opacity=".6"/>
        <text x="34" y="30" text-anchor="middle" class="t">${name}</text></g>`).join("")
      + `<g class="tbl" transform="translate(250 22)"><rect width="262" height="160" rx="8" fill="#0b1722" stroke="${MUTED}" stroke-opacity=".3"/>
        <text x="14" y="22" class="th">customer</text><text x="110" y="22" class="th">region</text><text x="200" y="22" class="th">total</text>
        <line x1="10" x2="252" y1="30" y2="30" stroke="${MUTED}" stroke-opacity=".3"/></g><g class="fly"></g>`;
    await r.type(code, "SELECT c.name, r.region, SUM(o.amount) AS total FROM orders o JOIN customers c USING (customer_id) JOIN regions r USING (region_id) GROUP BY 1, 2;", 52);
    await r.wait(250);
    const rnd = seeded(11 + n * 7), tbl = svg.querySelector(".tbl"), fly = svg.querySelector(".fly");
    const names = ["cust_0142", "cust_0388", "cust_0517", "cust_0623", "cust_0790", "cust_0912"], sites = ["North", "South", "West"];
    for (let i = 0; i < 6; i++) {
      const [, sy] = silos[i % 3];
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      dot.setAttribute("width", "26"); dot.setAttribute("height", "8"); dot.setAttribute("rx", "3"); dot.setAttribute("fill", ACCENT);
      fly.append(dot);
      const x0 = 82, y0 = sy + 20, x1 = 262, y1 = 22 + 46 + i * 21;
      await r.tween(520, (k) => { dot.setAttribute("x", (x0 + (x1 - x0) * k).toFixed(1)); dot.setAttribute("y", (y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 26).toFixed(1)); dot.setAttribute("opacity", String(1 - k * 0.7)); });
      dot.remove();
      tbl.insertAdjacentHTML("beforeend", `<text x="14" y="${46 + i * 21}" class="td">${names[i]}</text><text x="110" y="${46 + i * 21}" class="td">${sites[Math.floor(rnd() * 3)]}</text><text x="200" y="${46 + i * 21}" class="td">${(8 + rnd() * 40).toFixed(1)}k</text>`);
    }
  } },

  tableau: { file: "dashboard", async run(host, r, n) {
    const chips = el("div", "demo-chips", `<span class="on">All regions</span><span>West</span>`); host.append(chips);
    const svg = svgEl("0 0 520 170"); host.append(svg);
    const cats = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const A = [62, 88, 40, 71, 33, 52], B = [30, 64, 58, 44, 22, 70];
    svg.innerHTML = cats.map((c, i) => `<g transform="translate(${20 + i * 84} 0)"><rect class="bar" x="14" width="44" rx="4" fill="${ACCENT}" y="140" height="0"/><text x="36" y="160" text-anchor="middle" class="t">${c}</text><text class="v t" x="36" text-anchor="middle" y="134"></text></g>`).join("") + `<line x1="10" x2="510" y1="140" y2="140" stroke="${MUTED}" stroke-opacity=".35"/>`;
    const bars = [...svg.querySelectorAll(".bar")], vals = [...svg.querySelectorAll(".v")];
    const set = (from, to, k) => bars.forEach((b, i) => { const v = from[i] + (to[i] - from[i]) * k, h = v * 1.4; b.setAttribute("y", (140 - h).toFixed(1)); b.setAttribute("height", h.toFixed(1)); vals[i].setAttribute("y", (134 - h).toFixed(1)); vals[i].textContent = Math.round(v); });
    const zero = A.map(() => 0);
    await r.wait(300); await r.tween(1100, (k) => set(zero, A, k)); await r.wait(1200);
    chips.children[0].classList.remove("on"); chips.children[1].classList.add("on");
    await r.tween(900, (k) => set(A, B, k));
  } },

  excel: { file: "model.xlsx", async run(host, r) {
    const bar = el("div", "demo-fx", `<span class="fx">fx</span><span class="f"></span>`);
    const grid = el("table", "demo-grid");
    const flows = [-100, 22, 26, 30, 32, 35];
    grid.innerHTML = `<tr><th></th><th>A</th><th>B</th><th>C</th></tr>` + [["Year", "Cash flow", "Discounted"], ...flows.map((f, i) => [i, "", ""]), ["NPV @ 8%", "", ""]]
      .map((row, i) => `<tr><th>${i + 1}</th>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
    host.append(bar, grid);
    const cell = (row, col) => grid.rows[row + 1].cells[col + 1];
    for (let i = 0; i < flows.length; i++) {
      cell(i + 1, 1).classList.add("live"); await r.wait(140);
      cell(i + 1, 1).textContent = flows[i]; cell(i + 1, 1).classList.remove("live");
      cell(i + 1, 2).textContent = (flows[i] / Math.pow(1.08, i)).toFixed(1); await r.wait(160);
    }
    const npv = flows.reduce((s, f, i) => s + f / Math.pow(1.08, i), 0);
    const target = cell(7, 1); target.classList.add("live");
    await r.type(bar.querySelector(".f"), "=NPV(8%, B3:B7) + B2", 26);
    await r.wait(300);
    target.textContent = npv.toFixed(2); target.classList.remove("live"); target.classList.add("result");
  } },

  doe: { file: "factorial.jmp", async run(host, r, n) {
    const wrap = el("div", "demo-doe"); host.append(wrap);
    const svg = svgEl("0 0 200 180"); const tbl = el("table", "demo-runs");
    tbl.innerHTML = `<tr><th>Run</th><th>A</th><th>B</th><th>C</th><th>Y</th></tr>`;
    wrap.append(svg, tbl);
    const e = 80, o = 36, P = [[40, 140], [120, 140], [120, 60], [40, 60]], Q = P.map(([x, y]) => [x + o, y - o]);
    const corner = (a, b, c) => { const base = c ? Q : P; return base[[0, 1, 2, 3][(a ? 1 : 0) + (b ? (a ? 1 : 3) : 0)]]; };
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0]].flatMap(([i, j]) => [[P[i], P[j]], [Q[i], Q[j]]]).concat(P.map((p, i) => [p, Q[i]]));
    svg.innerHTML = edges.map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${MUTED}" stroke-opacity=".6" stroke-width="2"/>`).join("") + `<g class="pts"></g>`;
    void e;
    const rnd = seeded(5 + n * 13), pts = svg.querySelector(".pts");
    const runs = [];
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) runs.push([a, b, c]);
    runs.sort(() => rnd() - 0.5); // randomized run order
    for (let i = 0; i < runs.length; i++) {
      const [a, b, c] = runs[i], [x, y] = corner(a, b, c);
      const y0 = 50 + 8 * a + 5 * b - 3 * c + 4 * a * b + gauss(rnd) * 1.5;
      pts.insertAdjacentHTML("beforeend", `<circle cx="${x}" cy="${y}" r="8" fill="${ACCENT}" stroke="#0b1722" stroke-width="2"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" class="t dark">${i + 1}</text>`);
      tbl.insertAdjacentHTML("beforeend", `<tr><td>${i + 1}</td><td>${a ? "+" : "−"}</td><td>${b ? "+" : "−"}</td><td>${c ? "+" : "−"}</td><td>${y0.toFixed(1)}</td></tr>`);
      await r.wait(420);
    }
  } },

  sixsigma: { file: "spc_chart", async run(host, r, n) {
    const svg = svgEl("0 0 520 190"); host.append(svg);
    const Y = (v) => 95 - v * 24; // mean 0, sigma 1; limits at ±3
    svg.innerHTML = `<line x1="40" x2="510" y1="${Y(3)}" y2="${Y(3)}" stroke="${WARM}" stroke-opacity=".8"/><line x1="40" x2="510" y1="${Y(0)}" y2="${Y(0)}" stroke="${ACCENT}" stroke-opacity=".8"/><line x1="40" x2="510" y1="${Y(-3)}" y2="${Y(-3)}" stroke="${WARM}" stroke-opacity=".8"/>
      <text x="4" y="${Y(3) + 4}" class="t">UCL</text><text x="4" y="${Y(0) + 4}" class="t">CL</text><text x="4" y="${Y(-3) + 4}" class="t">LCL</text>
      <path class="ln" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="1.5"/><g class="pts"></g><text class="flag t warm" x="0" y="0"></text>`;
    const rnd = seeded(3 + n * 17), vals = [];
    for (let i = 0; i < 24; i++) vals.push(Math.max(-2.7, Math.min(2.7, gauss(rnd) * 0.9)));
    const out = 15 + Math.floor(rnd() * 6); vals[out] = 3.4; // one excursion beyond the upper limit
    const pts = svg.querySelector(".pts"), ln = svg.querySelector(".ln");
    let d = "";
    for (let i = 0; i < vals.length; i++) {
      const x = 48 + i * 19.6, y = Y(vals[i]), bad = i === out;
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; ln.setAttribute("d", d);
      pts.insertAdjacentHTML("beforeend", `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${bad ? 5 : 3.5}" fill="${bad ? WARM : ACCENT}"/>`);
      if (bad) { const f = svg.querySelector(".flag"); f.setAttribute("x", (x + 8).toFixed(1)); f.setAttribute("y", (y - 6).toFixed(1)); f.textContent = "out of control"; }
      await r.wait(bad ? 700 : 160);
    }
  } },

  ml: { file: "classifier.py", async run(host, r, n) {
    const svg = svgEl("0 0 520 190"); host.append(svg);
    const rnd = seeded(19 + n * 3), P = [];
    for (let i = 0; i < 40; i++) { const c = i % 2; P.push({ x: (c ? 1.1 : -1.1) + gauss(rnd) * 0.75, y: (c ? 0.6 : -0.6) + gauss(rnd) * 0.75, c }); }
    const X = (v) => 260 + v * 70, Y = (v) => 95 - v * 32;
    svg.innerHTML = P.map((p) => p.c
      ? `<rect x="${(X(p.x) - 4).toFixed(1)}" y="${(Y(p.y) - 4).toFixed(1)}" width="8" height="8" rx="1.5" fill="${WARM}"/>`
      : `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4.5" fill="${ACCENT}"/>`).join("") + `<line class="b" stroke="${INK}" stroke-width="2"/><text class="acc t" x="512" y="18" text-anchor="end"></text>`;
    let w = [0.2, -1.0], b0 = 0.4; const line = svg.querySelector(".b"), acc = svg.querySelector(".acc");
    const draw = () => {
      // boundary: w0*x + w1*y + b = 0 → y = -(w0*x + b)/w1, drawn across x ∈ [-3.5, 3.5]
      const ys = (xv) => (Math.abs(w[1]) < 1e-3 ? 0 : -(w[0] * xv + b0) / w[1]);
      line.setAttribute("x1", X(-3.5)); line.setAttribute("y1", Y(ys(-3.5))); line.setAttribute("x2", X(3.5)); line.setAttribute("y2", Y(ys(3.5)));
      const right = P.filter((p) => (w[0] * p.x + w[1] * p.y + b0 > 0 ? 1 : 0) === p.c).length;
      acc.textContent = `accuracy ${(right / P.length).toFixed(2)}`;
    };
    draw(); await r.wait(500);
    for (let it = 0; it < 36; it++) { // logistic-regression gradient steps
      let g0 = 0, g1 = 0, gb = 0;
      for (const p of P) { const s = 1 / (1 + Math.exp(-(w[0] * p.x + w[1] * p.y + b0))); g0 += (s - p.c) * p.x; g1 += (s - p.c) * p.y; gb += s - p.c; }
      w = [w[0] - 0.08 * g0 / P.length * 6, w[1] - 0.08 * g1 / P.length * 6]; b0 -= 0.08 * gb / P.length * 6;
      draw(); await r.wait(90);
    }
  } },

  fab: { file: "wafer_scan", async run(host, r, n) {
    const svg = svgEl("0 0 520 190"); host.append(svg);
    const cx = 130, cy = 95, R = 82, s = 13, dies = [];
    for (let y = -R; y < R; y += s) for (let x = -R; x < R; x += s) if (Math.hypot(x + s / 2, y + s / 2) < R - 6) dies.push([x, y]);
    svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#10202d" stroke="${MUTED}" stroke-opacity=".5"/><g class="d"></g><line class="scan" x1="0" x2="0" y1="${cy - R}" y2="${cy + R}" stroke="${ACCENT}" stroke-width="2" opacity=".85"/>
      <text x="300" y="70" class="t">yield</text><text class="y big" x="300" y="112"></text><text class="c t" x="300" y="138"></text>`;
    const g = svg.querySelector(".d"), scan = svg.querySelector(".scan"), yt = svg.querySelector(".y"), ct = svg.querySelector(".c");
    const rnd = seeded(23 + n * 29); let pass = 0, done = 0;
    const fail = new Set(dies.map((_, i) => i).filter(() => rnd() < 0.09));
    const sorted = dies.map((d, i) => [d, i]).sort((a, b) => a[0][0] - b[0][0]);
    await r.tween(2600, (k) => {
      const xs = cx - R + k * 2 * R; scan.setAttribute("x1", xs); scan.setAttribute("x2", xs);
      while (done < sorted.length && cx + sorted[done][0][0] + s / 2 <= xs) {
        const [[x, y], i] = sorted[done++], bad = fail.has(i); if (!bad) pass++;
        g.insertAdjacentHTML("beforeend", `<rect x="${cx + x + 1}" y="${cy + y + 1}" width="${s - 2}" height="${s - 2}" rx="1.5" fill="${bad ? WARM : ACCENT}" opacity="${bad ? 1 : 0.75}"/>`);
      }
      yt.textContent = done ? `${((pass / done) * 100).toFixed(1)}%` : "";
      ct.textContent = `${done} of ${dies.length} dies`;
    });
    scan.setAttribute("opacity", "0");
  } },

  agentic: { file: "claude code", async run(host, r) {
    const term = el("pre", "demo-code term"); host.append(term);
    const line = async (text, cls = "", cps = 60, pause = 260) => { const s = el("span", "ln " + cls); term.append(s, "\n"); await r.type(s, text, cps); await r.wait(pause); };
    await line("> make the goldfish swim to whatever gets clicked", "prompt", 30, 500);
    await line("● Reading js/fish.js", "step");
    await line("● Adding a seek-and-look mode to the steering loop", "step");
    await line("● Choosing a spot beside each target so it never covers it", "step");
    await line("● Checking it at 390px and 1440px … done", "step ok", 60, 400);
    await line("The fish now swims over and looks at what you click.", "", 50);
  } },
};

/* ---------------- player ---------------- */

export function createDemoPlayer(panel, { reduce }) {
  const body = panel.querySelector(".demo-body"), title = panel.querySelector(".demo-title"), file = panel.querySelector(".demo-file");
  let current = null, id = null, visible = true;

  async function loop(key, r) {
    let n = 0;
    try {
      do {
        body.innerHTML = "";
        await DEMOS[key].run(body, r, n++);
        if (reduce) break;
        await r.wait(2800);
      } while (r.alive);
    } catch (e) { if (e !== STOP) throw e; }
  }

  function play(key, name) {
    id = key;
    if (current) current.stop();
    title.textContent = name; file.textContent = DEMOS[key]?.file || "";
    body.dataset.demo = key;
    if (!DEMOS[key]) { body.innerHTML = ""; return; }
    if (visible || reduce) { current = runner(reduce); loop(key, current); }
    else current = null; // starts when the panel scrolls into view
  }

  // pause while off screen; pick up from the start when it returns
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!id) return;
    if (!visible && current) { current.stop(); current = null; }
    else if (visible && !current) { current = runner(reduce); loop(id, current); }
  }).observe(panel);

  return { play };
}
