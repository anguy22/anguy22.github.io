import { nameSVG, wordPath } from "./script-name.js?v=9";
import { initTank } from "./tank.js?v=9";
import { createFish } from "./fish.js?v=9";
import { initChess } from "./chess.js?v=9";

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
const rise = () => $$("[data-rise]").forEach((el) => el.classList.add("risen"));
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

/* ---------- Goldfish ---------- */
// Decorative companion. Under reduced motion it rests in one pose and moves only
// by repositioning instantly beside whatever is clicked.
const heroCopy = $(".hero-copy");
if (heroCopy && $("#fish-back")) {
  createFish({ back: $("#fish-back"), front: $("#fish-front"), heroCopy, reduce });
}

/* ---------- Copy email ---------- */
$$("[data-copy-email]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(EMAIL); }
    catch { location.href = `mailto:${EMAIL}`; return; }
    btn.style.minWidth = `${btn.offsetWidth}px`; // hold the width while the label changes
    btn.textContent = "Copied"; btn.classList.add("copied");
    setTimeout(() => { btn.textContent = "Copy email"; btn.classList.remove("copied"); }, 1800);
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
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && links?.classList.contains("open")) {
    toggle.setAttribute("aria-expanded", "false"); links.classList.remove("open"); document.body.classList.remove("menu-open"); toggle.focus();
  }
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

/* ---------- Skills tank ---------- */
initTank({ reduce });

/* ---------- Chess (live) ---------- */
initChess();
