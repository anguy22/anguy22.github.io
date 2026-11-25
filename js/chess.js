// Live chess: headline ratings, the overall record, and a bullet-rating line chart,
// all from the public Lichess API. Chart follows the dataviz procedure: one series,
// 2px line with a 10% wash, solid hairline grid, value labelled at the line's end,
// a crosshair tooltip, and a screen-reader summary plus table so hover is never the
// only way to read it.

const USER = "an_d22";
const SHOW = [["rapid", "Rapid"], ["bullet", "Bullet"], ["blitz", "Blitz"], ["classical", "Classical"]];
const $ = (s, el = document) => el.querySelector(s);
const fmtDate = (d, opts = { month: "short", day: "numeric", year: "numeric" }) => d.toLocaleDateString("en-US", opts);

async function getJSON(url) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

export async function initChess() {
  const stats = $("#c-stats"), note = $("#c-note");
  if (!stats) return;
  const [user, history] = await Promise.allSettled([getJSON(`https://lichess.org/api/user/${USER}`), getJSON(`https://lichess.org/api/user/${USER}/rating-history`)]);

  if (user.status === "fulfilled") {
    const u = user.value, p = u.perfs || {};
    const shown = SHOW.filter(([k]) => p[k] && p[k].games > 0);
    stats.innerHTML = shown.map(([k, label]) => `<div class="stat${k === "rapid" ? " lead" : ""}">
        <p class="stat-label">${label}</p>
        <p class="stat-value">${p[k].rating}${p[k].prov ? "?" : ""}</p>
        <p class="stat-sub">${p[k].games.toLocaleString()} games</p></div>`).join("");
    const c = u.count;
    if (c && c.all) {
      const w = c.win, d = c.draw, l = c.loss, all = w + d + l || 1;
      stats.insertAdjacentHTML("beforeend", `<div class="stat record">
        <p class="stat-label">Record</p>
        <div class="record-bar" aria-hidden="true"><span class="rb-w"></span><span class="rb-d"></span><span class="rb-l"></span></div>
        <p class="record-key"><span><i class="k-w"></i>${w.toLocaleString()} W</span><span><i class="k-d"></i>${d.toLocaleString()} D</span><span><i class="k-l"></i>${l.toLocaleString()} L</span></p>
        <p class="stat-sub">${Math.round((w / all) * 100)}% wins across ${c.all.toLocaleString()} games</p></div>`);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        $(".rb-w", stats).style.width = `${(w / all) * 100}%`; $(".rb-d", stats).style.width = `${(d / all) * 100}%`; $(".rb-l", stats).style.width = `${(l / all) * 100}%`;
      }));
    }
    const rapid = p.rapid && p.rapid.games > 0 ? p.rapid.rating + (p.rapid.prov ? "?" : "") : null;
    if (rapid) {
      document.querySelectorAll(".status").forEach((s) => s.classList.add("is-live"));
    }
  } else {
    stats.innerHTML = "";
    note.innerHTML = `Lichess didn&rsquo;t respond. The <a href="https://lichess.org/@/${USER}" target="_blank" rel="noopener">profile</a> has the live numbers.`;
  }

  // A dated line when Lichess shares the full history; otherwise the all-time range
  // (low, now, peak), which Lichess does publish. No points are ever interpolated.
  const series = history.status === "fulfilled" && Array.isArray(history.value) ? (history.value.find((h) => h.name === "Bullet")?.points || []) : [];
  const pts = series.map(([y, m, d, r]) => ({ t: new Date(y, m, d), r }));
  if (pts.length > 1) { drawChart(pts); return; }
  try {
    const perf = await getJSON(`https://lichess.org/api/user/${USER}/perf/bullet`);
    const now = user.status === "fulfilled" ? user.value.perfs?.bullet?.rating : Math.round(perf.perf?.glicko?.rating);
    if (perf.stat?.highest && perf.stat?.lowest && now) drawRange({ now, hi: perf.stat.highest, lo: perf.stat.lowest, pct: perf.percentile, games: perf.perf?.nb });
    else throw new Error("no range");
  } catch {
    $("#bc-plot").innerHTML = `<p class="chart-empty">The bullet rating chart isn&rsquo;t available right now.</p>`;
  }
}

function drawRange({ now, hi, lo, pct, games }) {
  const plot = $("#bc-plot"), tip = document.createElement("div");
  tip.className = "chart-tip"; tip.setAttribute("aria-hidden", "true");
  const hiD = new Date(hi.at), loD = new Date(lo.at);
  $("#bc-note").textContent = "All-time range on Lichess";
  $("#bc-summary").innerHTML = `<p>Bullet rating now ${now}. All-time high ${hi.int} on ${fmtDate(hiD)}; low ${lo.int} on ${fmtDate(loD)}.${pct ? ` Better than ${pct}% of Lichess bullet players.` : ""}</p>`;

  function render() {
    const W = plot.clientWidth, narrow = W < 560, H = narrow ? 150 : 140;
    const m = { l: 22, r: 22, t: 58, b: 34 };
    const step = 50;
    const a = Math.floor((lo.int - 30) / step) * step, b = Math.ceil((hi.int + 30) / step) * step;
    const X = (v) => m.l + ((v - a) / (b - a)) * (W - m.l - m.r);
    const yTrack = m.t + 10;
    let ticks = "";
    for (let v = a; v <= b; v += step) {
      ticks += `<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${m.t - 14}" y2="${yTrack + 22}"/>`;
      if (!narrow || (v - a) % 100 === 0) ticks += `<text x="${X(v).toFixed(1)}" y="${H - 8}" text-anchor="middle">${v}</text>`;
    }
    const lx = X(lo.int), hx = X(hi.int), nx = X(now);
    const nearEnd = (x) => Math.max(40, Math.min(W - 40, x));
    plot.innerHTML = `<svg class="chart-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <g class="grid">${ticks.replace(/<text[^>]*>[^<]*<\/text>/g, "")}</g>
        <g class="axis">${(ticks.match(/<text[^>]*>[^<]*<\/text>/g) || []).join("")}</g>
        <rect class="area" x="${lx.toFixed(1)}" y="${yTrack - 5}" width="${(hx - lx).toFixed(1)}" height="10" rx="5" style="opacity:.22"/>
        <circle class="mark dim" cx="${lx.toFixed(1)}" cy="${yTrack}" r="5" data-tip="Low ${lo.int}|${fmtDate(loD)}"/>
        <circle class="mark dim" cx="${hx.toFixed(1)}" cy="${yTrack}" r="5" data-tip="Peak ${hi.int}|${fmtDate(hiD)}"/>
        <circle class="mark" cx="${nx.toFixed(1)}" cy="${yTrack}" r="8" data-tip="Now ${now}|live"/>
        <text class="label muted" x="${nearEnd(lx).toFixed(1)}" y="${yTrack + 28}" text-anchor="middle">Low ${lo.int}</text>
        <text class="label muted" x="${nearEnd(hx).toFixed(1)}" y="${yTrack + 28}" text-anchor="middle">Peak ${hi.int}</text>
        <text class="label" x="${nearEnd(nx).toFixed(1)}" y="${yTrack - 20}" text-anchor="middle">Now ${now}</text>
      </svg>`;
    plot.appendChild(tip);
    plot.querySelectorAll("[data-tip]").forEach((c) => {
      const show = () => {
        const [v, d] = c.dataset.tip.split("|");
        tip.innerHTML = `<strong>${v}</strong><span>${d}</span>`; tip.style.opacity = "1";
        const x = +c.getAttribute("cx"), tw = tip.offsetWidth;
        tip.style.transform = `translate(${Math.max(0, Math.min(W - tw, x - tw / 2))}px, ${yTrack + 34}px)`;
      };
      c.addEventListener("pointerenter", show); c.addEventListener("pointerdown", show);
      c.addEventListener("pointerleave", () => (tip.style.opacity = "0"));
    });
  }
  render();
  const foot = document.createElement("p");
  foot.className = "chart-foot";
  foot.textContent = `${pct ? `Better than ${pct}% of Lichess bullet players` : ""}${pct && games ? " · " : ""}${games ? `${games.toLocaleString()} rated games` : ""}`;
  if (foot.textContent) plot.after(foot);
  let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(render, 80); }).observe(plot);
}

function drawChart(pts) {
  const plot = $("#bc-plot"), tip = document.createElement("div");
  tip.className = "chart-tip"; tip.setAttribute("aria-hidden", "true");
  const first = pts[0], last = pts[pts.length - 1];
  const peak = pts.reduce((a, b) => (b.r > a.r ? b : a));

  // screen-reader summary and a monthly table
  const months = new Map();
  pts.forEach((p) => months.set(`${p.t.getFullYear()}-${p.t.getMonth()}`, p));
  $("#bc-summary").innerHTML = `<p>Bullet rating on Lichess from ${fmtDate(first.t)} (${first.r}) to ${fmtDate(last.t)} (${last.r}), peaking at ${peak.r} on ${fmtDate(peak.t)}.</p>
    <table><caption>Bullet rating at the end of each month</caption><thead><tr><th scope="col">Month</th><th scope="col">Rating</th></tr></thead><tbody>${[...months.values()].map((p) => `<tr><td>${fmtDate(p.t, { month: "long", year: "numeric" })}</td><td>${p.r}</td></tr>`).join("")}</tbody></table>`;
  $("#bc-note").textContent = `${fmtDate(first.t, { month: "short", year: "numeric" })} to now`;

  function render() {
    const W = plot.clientWidth, H = W < 560 ? 200 : 260;
    const m = { l: 46, r: 64, t: 18, b: 30 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const t0 = +first.t, t1 = +last.t || t0 + 1;
    let lo = Math.min(...pts.map((p) => p.r)), hi = Math.max(...pts.map((p) => p.r));
    const step = hi - lo > 400 ? 100 : 50;
    lo = Math.floor((lo - 10) / step) * step; hi = Math.ceil((hi + 10) / step) * step;
    const X = (t) => m.l + ((t - t0) / (t1 - t0)) * iw, Y = (r) => m.t + (1 - (r - lo) / (hi - lo)) * ih;

    let grid = "", ylab = "";
    for (let v = lo; v <= hi; v += step) {
      grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`;
      ylab += `<text x="${m.l - 10}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
    }
    // x ticks: years, or quarters for a short history
    const spanYears = (t1 - t0) / 3.156e10;
    let xlab = "";
    const start = new Date(first.t.getFullYear(), spanYears > 2.5 ? 0 : Math.floor(first.t.getMonth() / 3) * 3 + 3, 1);
    for (let d = new Date(start); +d <= t1; d.setMonth(d.getMonth() + (spanYears > 2.5 ? 12 : 3))) {
      if (+d < t0) continue;
      const x = X(+d);
      if (x > W - m.r - 30) break;
      xlab += `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle">${spanYears > 2.5 ? d.getFullYear() : fmtDate(d, { month: "short", year: "2-digit" }).replace(" ", " ’")}</text>`;
    }
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(+p.t).toFixed(1)} ${Y(p.r).toFixed(1)}`).join(" ");
    const area = `${line} L${X(t1).toFixed(1)} ${(m.t + ih).toFixed(1)} L${X(t0).toFixed(1)} ${(m.t + ih).toFixed(1)} Z`;
    const ex = X(t1), ey = Y(last.r), px = X(+peak.t), py = Y(peak.r);
    const showPeak = peak !== last && Math.abs(px - ex) > 70;

    plot.innerHTML = `<svg class="chart-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <g class="grid">${grid}</g>
        <g class="axis">${ylab}${xlab}</g>
        <path class="area" d="${area}"/>
        <path class="line" d="${line}"/>
        ${showPeak ? `<circle class="mark" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4"/><text class="label muted" x="${px.toFixed(1)}" y="${(py - 12).toFixed(1)}" text-anchor="middle">Peak ${peak.r}</text>` : ""}
        <circle class="mark" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="5"/>
        <text class="label" x="${(ex + 12).toFixed(1)}" y="${(ey + 5).toFixed(1)}">${last.r}</text>
        <g class="hover" opacity="0"><line class="cross" y1="${m.t}" y2="${m.t + ih}"/><circle class="mark" r="5"/></g>
        <rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>
      </svg>`;
    plot.appendChild(tip);

    const hover = $(".hover", plot), cross = $(".cross", plot), dot = $(".hover .mark", plot);
    const hit = $(".hit", plot);
    const move = (clientX) => {
      const rect = plot.getBoundingClientRect(), mx = clientX - rect.left;
      const t = t0 + ((mx - m.l) / iw) * (t1 - t0);
      let lo2 = 0, hi2 = pts.length - 1;
      while (hi2 - lo2 > 1) { const mid = (lo2 + hi2) >> 1; (+pts[mid].t < t ? (lo2 = mid) : (hi2 = mid)); }
      const p = Math.abs(+pts[lo2].t - t) < Math.abs(+pts[hi2].t - t) ? pts[lo2] : pts[hi2];
      const x = X(+p.t), y = Y(p.r);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); dot.setAttribute("cx", x); dot.setAttribute("cy", y);
      hover.setAttribute("opacity", "1");
      tip.innerHTML = `<strong>${p.r}</strong><span>${fmtDate(p.t)}</span>`;
      tip.style.opacity = "1";
      const tw = tip.offsetWidth;
      tip.style.transform = `translate(${Math.max(0, Math.min(W - tw, x - tw / 2))}px, ${Math.max(0, y - 58)}px)`;
    };
    const leave = () => { hover.setAttribute("opacity", "0"); tip.style.opacity = "0"; };
    hit.addEventListener("pointermove", (e) => move(e.clientX));
    hit.addEventListener("pointerdown", (e) => move(e.clientX));
    hit.addEventListener("pointerleave", leave);
  }
  render();
  let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(render, 80); }).observe(plot);
}
