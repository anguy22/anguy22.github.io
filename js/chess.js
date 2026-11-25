// Live chess: headline ratings and the overall record from the public Lichess API.

const USER = "an_d22";
const SHOW = [["rapid", "Rapid"], ["bullet", "Bullet"], ["blitz", "Blitz"], ["classical", "Classical"]];
const $ = (s, el = document) => el.querySelector(s);

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
  const [user] = await Promise.allSettled([getJSON(`https://lichess.org/api/user/${USER}`)]);

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
}
