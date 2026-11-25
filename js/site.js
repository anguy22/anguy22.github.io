import { nameSVG, wordPath } from "./script-name.js";
import { TOOLS, DRAWERS, SHARED_DEFS, toolSVG } from "./tools.js";

const EMAIL = "nguy1051@purdue.edu";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- Handwritten name ---------- */
const CHROME = `<linearGradient id="g-ink" x1="0" y1="-92" x2="0" y2="48" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#ffffff"/><stop offset=".42" stop-color="#dde2df"/><stop offset=".5" stop-color="#7d8581"/>
  <stop offset=".58" stop-color="#f4f6f5"/><stop offset="1" stop-color="#a3aaa7"/></linearGradient>`;

function paint(svg, paths, { width = 5, id = "g-ink" } = {}) {
  // The outer group's bbox includes the inner skew, so the viewBox hugs the slanted ink.
  svg.innerHTML = `<defs>${CHROME.replace('id="g-ink"', `id="${id}"`)}</defs><g class="ink"><g transform="skewX(-12)">${paths
    .map((d) => `<path d="${d}" stroke="url(#${id})" stroke-width="${width}"/>`).join("")}</g></g>`;
  const box = svg.querySelector("g.ink").getBBox();
  const pad = width / 2 + 3;
  svg.setAttribute("viewBox", `${(box.x - pad).toFixed(1)} ${(box.y - pad).toFixed(1)} ${(box.width + pad * 2).toFixed(1)} ${(box.height + pad * 2).toFixed(1)}`);
  return $$("path", svg);
}

function draw(paths, { total = 3600, gap = 140, delay = 0 } = {}) {
  const lens = paths.map((p) => p.getTotalLength());
  const sum = lens.reduce((a, b) => a + b, 0);
  let t = delay;
  paths.forEach((p, i) => {
    const L = lens[i];
    p.style.strokeDasharray = `${L} ${L}`;
    p.style.strokeDashoffset = reduce ? "0" : String(L);
    if (reduce) return;
    const dur = (total - gap * (paths.length - 1)) * (L / sum);
    p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: dur, delay: t, easing: "cubic-bezier(.42,.08,.36,1)", fill: "forwards" });
    t += dur + gap;
  });
  return t;
}

const nameSvg = $("#name-svg");
if (nameSvg) {
  const { paths } = nameSVG();
  const els = paint(nameSvg, paths, { width: 5 });
  draw(els, { total: 3800, delay: 250 });
}
const rise = () => $$("[data-rise], .hero-figure").forEach((el) => el.classList.add("risen"));
// The greeting arrives while the name is still being written.
reduce ? rise() : setTimeout(rise, 700);

// Contact signature: "andrew", written when it scrolls into view.
const sign = $("#sign-svg");
if (sign) {
  const els = paint(sign, [wordPath("andrew", 8).d], { width: 5.5, id: "g-sign" });
  els.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = reduce ? 0 : L; });
  if (!reduce) {
    new IntersectionObserver((entries, io) => {
      if (entries.some((e) => e.isIntersecting)) { draw(els, { total: 1700 }); io.disconnect(); }
    }, { threshold: 0.8 }).observe(sign);
  }
}

/* ---------- Footnotes ---------- */
// One note open at a time. Opening moves focus into the note so Tab continues
// inside it; every close path (×, Escape, the trigger again) can hand focus back.
let openFn = null;
const cardFor = (b) => document.getElementById(b.getAttribute("aria-controls"));
function closeFn(restoreFocus) {
  if (!openFn) return;
  const b = openFn; openFn = null;
  b.setAttribute("aria-expanded", "false");
  cardFor(b).hidden = true;
  if (restoreFocus) b.focus();
}
function openFnNote(b) {
  closeFn(false);
  openFn = b;
  b.setAttribute("aria-expanded", "true");
  const card = cardFor(b);
  card.hidden = false;
  card.focus({ preventScroll: true });
  const r = card.getBoundingClientRect();
  if (r.bottom > innerHeight - 16) card.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
}
$$(".fn").forEach((b) => b.addEventListener("click", () => (openFn === b ? closeFn(true) : openFnNote(b))));
$$(".fn-close").forEach((x) => x.addEventListener("click", () => closeFn(true)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openFn) { e.preventDefault(); closeFn(true); } });

/* ---------- Copy email ---------- */
$$("[data-copy-email]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(EMAIL); btn.textContent = "copied"; }
    catch { btn.textContent = EMAIL; }
    btn.classList.add("copied");
    setTimeout(() => { btn.textContent = "copy email"; btn.classList.remove("copied"); }, 1800);
  });
});

/* ---------- Nav ---------- */
const toggle = $(".nav-toggle"), links = $("#nav-links");
toggle?.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  links.classList.toggle("open", open);
  document.body.classList.toggle("menu-open", open);
});
$$("#nav-links a").forEach((a) => a.addEventListener("click", () => {
  toggle?.setAttribute("aria-expanded", "false"); links.classList.remove("open"); document.body.classList.remove("menu-open");
}));
// Active link: the last section whose top has passed 40% of the viewport.
const navMap = new Map($$("#nav-links a").map((a) => [a.getAttribute("href").slice(1), a]));
const sections = $$("main > section[id]");
let navTick = false, current = null;
function markNav() {
  navTick = false;
  const line = innerHeight * 0.4;
  let id = null;
  for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.id;
  if (id === current) return;
  current = id;
  navMap.forEach((a, key) => (key === id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
}
addEventListener("scroll", () => { if (!navTick) { navTick = true; requestAnimationFrame(markNav); } }, { passive: true });
addEventListener("resize", markNav);
markNav();

/* ---------- Experience: show more ---------- */
const xpBtn = $("#xp-more"), xpList = $("#xp-list");
xpBtn?.addEventListener("click", () => {
  const open = !xpList.classList.contains("expanded");
  xpList.classList.toggle("expanded", open);
  xpBtn.setAttribute("aria-expanded", String(open));
  xpBtn.textContent = open ? "Show less" : "Show 4 more";
});

/* ---------- Project figure: tool register ---------- */
// Many records on the left; the five flagged ones run to the review list on the right.
const reg = $("#fig-register"), regLinks = $("#fig-register-links");
if (reg) {
  let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const flagged = new Set(["1,3", "3,9", "5,5", "7,12", "9,2"]);
  let h = "", links = "", k = 0;
  for (let r = 0; r < 11; r++) for (let c = 0; c < 14; c++) {
    const x = 26 + c * 21, y = 36 + r * 21, flag = flagged.has(`${r},${c}`);
    h += `<rect x="${x}" y="${y}" width="14" height="14" rx="3" fill="${flag ? "var(--green-500)" : "var(--chrome-line)"}" opacity="${flag ? 0.95 : 0.12 + rnd() * 0.16}"/>`;
    if (flag) {
      const ty = 92 + 18 + k++ * 20, sx = x + 14, sy = y + 7;
      links += `<path d="M${sx} ${sy} C${sx + 60} ${sy} ${372 - 50} ${ty} 382 ${ty}"/>`;
    }
  }
  reg.innerHTML = h;
  regLinks.innerHTML = links;
}

/* ---------- Toolbox ---------- */
const defsHost = document.querySelector("svg[aria-hidden] defs");
defsHost?.insertAdjacentHTML("beforeend", SHARED_DEFS);

const chest = $("#chest");
if (chest) {
  const list = document.createElement("div");
  list.className = "drawers";
  list.innerHTML = DRAWERS.map((d, i) => `
    <div class="drawer${i === 0 ? " open" : ""}" data-drawer="${d.id}">
      <button class="drawer-front" type="button" aria-expanded="${i === 0}" aria-controls="tray-${d.id}">
        <span class="drawer-label">${d.label}</span>
        <span class="drawer-handle" aria-hidden="true"></span>
        <span class="drawer-count">${d.tools.length} tools<span class="drawer-led" aria-hidden="true"></span></span>
      </button>
      <div class="tray-wrap"><div class="tray-clip">
        <div class="tray" id="tray-${d.id}" role="group" aria-label="${d.label} tools" data-count="${d.tools.length}">
          ${d.tools.map((t) => `<button class="tool" type="button" data-tool="${t}" aria-pressed="${t === "python"}">${toolSVG(t)}<span class="tool-name">${TOOLS[t].name}</span></button>`).join("")}
        </div>
        <div class="tray-note" aria-live="polite"></div>
      </div></div>
    </div>`).join("");
  chest.insertBefore(list, $(".chest-base", chest));

  const setTrayFocus = () => $$(".drawer", list).forEach((d) => {
    const open = d.classList.contains("open");
    $$(".tool", d).forEach((b) => (b.tabIndex = open ? 0 : -1));
    $(".tray-wrap", d).inert = !open;
  });
  setTrayFocus();

  list.addEventListener("click", (e) => {
    const front = e.target.closest(".drawer-front");
    if (front) {
      const drawer = front.parentElement;
      const willOpen = !drawer.classList.contains("open");
      $$(".drawer", list).forEach((d) => { d.classList.remove("open"); $(".drawer-front", d).setAttribute("aria-expanded", "false"); });
      if (willOpen) {
        drawer.classList.add("open"); front.setAttribute("aria-expanded", "true");
        // keep the detail in step with the open drawer
        if (!$(`.tool[data-tool="${selected}"]`, drawer)) select($(".tool", drawer).dataset.tool);
      }
      setTrayFocus();
      return;
    }
    const tool = e.target.closest(".tool");
    if (tool) select(tool.dataset.tool);
  });

  const plate = { fig: $("#plate-fig"), name: $("#plate-name"), sub: $("#plate-sub"), use: $("#plate-use"), link: $("#plate-link") };
  let selected = null;
  const linkHTML = (t, cls) => (t.link ? `<a class="${cls}" href="${t.link.href}">${t.link.label}</a>` : "");
  function select(id, { animate = true } = {}) {
    const t = TOOLS[id];
    selected = id;
    $$(".tool", list).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === id)));
    // desktop plate
    plate.fig.classList.remove("swap"); if (animate) void plate.fig.offsetWidth;
    plate.fig.innerHTML = toolSVG(id, { cut: false });
    if (animate) plate.fig.classList.add("swap");
    plate.name.textContent = t.name; plate.sub.textContent = t.sub; plate.use.textContent = t.use;
    if (t.link) { plate.link.href = t.link.href; plate.link.textContent = t.link.label; plate.link.hidden = false; }
    else plate.link.hidden = true;
    // touch: the note inside the drawer that holds this tool
    const drawer = $(`.tool[data-tool="${id}"]`, list).closest(".drawer");
    $$(".tray-note", list).forEach((n) => (n.innerHTML = ""));
    $(".tray-note", drawer).innerHTML = `<p class="note-name">${t.name}</p><p class="note-sub">${t.sub}</p><p class="note-use">${t.use}</p>${linkHTML(t, "note-link")}`;
  }
  select("python", { animate: false });
}

/* ---------- Lichess (live) ---------- */
const FORMATS = [["bullet", "Bullet"], ["blitz", "Blitz"], ["rapid", "Rapid"], ["classical", "Classical"]];
async function lichess() {
  const note = $("#c-note");
  try {
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("https://lichess.org/api/user/an_d22", { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(res.status);
    const u = await res.json();
    const p = u.perfs || {};
    $("#c-perfs").innerHTML = FORMATS.map(([k, label]) => {
      const r = p[k];
      const played = r && r.games > 0;
      return `<tr class="${k === "rapid" ? "top" : ""}"><td>${label}</td><td class="num">${played ? r.rating + (r.prov ? "?" : "") : "—"}</td><td class="num">${played ? r.games.toLocaleString() : "—"}</td></tr>`;
    }).join("");
    const rapid = p.rapid?.rating;
    if (rapid) {
      $("#c-rapid").textContent = rapid;
      $("#c-live").textContent = "rapid on lichess, live";
      $("#hero-rating").textContent = `rapid ${rapid} on lichess, live`;
      $$(".status").forEach((s) => s.classList.add("is-live"));
    }
    const c = u.count;
    if (c && c.all) {
      const w = c.win, d = c.draw, l = c.loss, all = w + d + l || 1;
      $("#c-w").textContent = w.toLocaleString(); $("#c-d").textContent = d.toLocaleString(); $("#c-l").textContent = l.toLocaleString();
      $("#c-record").hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        $("#rb-w").style.width = `${(w / all) * 100}%`; $("#rb-d").style.width = `${(d / all) * 100}%`; $("#rb-l").style.width = `${(l / all) * 100}%`;
      }));
    }
    note.textContent = `${(c?.all ?? 0).toLocaleString()} games on lichess.org, pulled when this page loaded.`;
  } catch {
    note.innerHTML = `lichess didn&rsquo;t answer just now. the <a href="https://lichess.org/@/an_d22" target="_blank" rel="noopener">profile</a> has the live numbers.`;
  }
}
lichess();
