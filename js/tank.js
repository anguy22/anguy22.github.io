import { createDemoPlayer } from "./demos.js?v=18";

// The skills tank: an aquarium where each skill is something living or sunk in it.
// Objects differ in size and depth (a hazy back row, a front row, things floating
// mid-water). Selecting one (in the tank or from the list below) lights it with a
// spotlight, plays a short demo of the skill, and the goldfish swims over to stay beside it.

const ACCENT = "#3b9ae1";
const WARM = "#e0735a";

export const SKILLS = {
  python: { name: "Python", as: "Moray eel", sub: "pandas · scikit-learn · SQLAlchemy", use: "ETL and data pipelines for R&D tool budgeting at Micron.", link: ["#experience", "See the Micron role"] },
  sql: { name: "SQL", as: "Database coral", sub: "Snowflake · MSSQL · Azure", use: "Joined 13 datastores for R&D tool budgeting and OpEx forecasting at Micron.", link: ["#experience", "See the Micron role"] },
  chess: { name: "Chess", as: "An old knight", sub: "Lichess · an_d22", use: "Captained Purdue in the Collegiate Chess League as a 2000+ rated player.", link: ["#chess", "See live chess"] },
  tableau: { name: "Tableau", as: "Kelp bar chart", sub: "Dashboards · reporting", use: "OpEx forecasting across 6 fiscal years and 25+ scenarios at Micron.", link: ["#experience", "See the Micron role"] },
  excel: { name: "Excel", as: "Fishing net", sub: "Parametric modeling", use: "Parametric models for engineering economics, including 40-year DCF and NPV/IRR analysis." },
  doe: { name: "JMP & DOE", as: "Factorial crate", sub: "Factorial designs", use: "Design of experiments coursework, with factorial designs run in JMP." },
  sixsigma: { name: "Six Sigma", as: "Tide gauge with control limits", sub: "SPC · process capability", use: "Quality control and Six Sigma coursework." },
  ml: { name: "Machine learning", as: "Neural jellyfish", sub: "Classification · validation", use: "Machine learning coursework: classification and model validation." },
  fab: { name: "Semiconductor fab", as: "Clam with a wafer pearl", sub: "Fabrication · microelectronics", use: "Two Purdue certifications, and R&D tool budgeting at Micron.", link: ["#experience", "See the Micron role"] },
  agentic: { name: "Agentic coding", as: "Survey drone", sub: "Claude Code", use: "Used to build and iterate on this site." },
};
const ORDER = ["python", "sql", "chess", "tableau", "excel", "doe", "sixsigma", "ml", "fab", "agentic"];

/* ---------------- art: each in local units, origin at its base (or centre when floating) ---------------- */

function kelp() {
  const stalks = [[-60, 110], [-30, 160], [0, 130], [30, 200], [60, 85]];
  return stalks.map(([x, h], i) => `<g class="sway" style="--d:${(i * 0.7).toFixed(1)}s;transform-origin:${x}px 0px">
      <path d="M${x - 6} 0 C${x - 15} ${-h * 0.3} ${x + 5} ${-h * 0.62} ${x - 5} ${-h} L${x + 5} ${-h} C${x + 15} ${-h * 0.62} ${x - 5} ${-h * 0.3} ${x + 6} 0 Z" fill="url(#t-kelp)"/>
      <ellipse cx="${x + 10}" cy="${-h * 0.45}" rx="11" ry="4.5" transform="rotate(-28 ${x + 10} ${-h * 0.45})" fill="#2d8f76" opacity=".85"/>
      <ellipse cx="${x - 10}" cy="${-h * 0.72}" rx="10" ry="4" transform="rotate(26 ${x - 10} ${-h * 0.72})" fill="#2d8f76" opacity=".85"/>
      <circle cx="${x}" cy="${-h - 3}" r="5" fill="#4bb596"/><circle cx="${x - 1.5}" cy="${-h - 4.5}" r="1.6" fill="#fff" opacity=".5"/>
    </g>`).join("") + `<path d="M-74 0 H74" stroke="#000" stroke-opacity=".25" stroke-width="3"/>`;
}

function coral() {
  let h = "";
  const cyl = (y, w, hh) => `<path d="M${-w / 2} ${y} V${y - hh} A${w / 2} ${w * 0.17} 0 0 0 ${w / 2} ${y - hh} V${y} A${w / 2} ${w * 0.17} 0 0 1 ${-w / 2} ${y} Z" fill="url(#t-coral)"/>
    <ellipse cx="0" cy="${y - hh}" rx="${w / 2}" ry="${w * 0.17}" fill="#f6a184"/>
    <path d="M${-w / 2} ${y} A${w / 2} ${w * 0.17} 0 0 0 ${w / 2} ${y}" fill="none" stroke="#8f3b28" stroke-opacity=".55" stroke-width="2"/>`;
  h += cyl(0, 92, 30) + cyl(-34, 92, 30) + cyl(-68, 92, 30);
  // polyps
  let s = 3; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 26; k++) h += `<circle cx="${(r() - 0.5) * 84}" cy="${-r() * 98 - 4}" r="${1.4 + r() * 1.8}" fill="#ffd9cb" opacity=".55"/>`;
  // branches growing from the top
  h += `<g fill="none" stroke="url(#t-coral)" stroke-width="9" stroke-linecap="round">
      <path d="M-22 -110 C-26 -130 -40 -138 -44 -158"/><path d="M-30 -132 C-20 -140 -14 -146 -12 -160"/>
      <path d="M14 -110 C18 -134 34 -140 36 -168"/><path d="M28 -140 C40 -146 48 -150 52 -160"/></g>
    <g fill="#f6a184"><circle cx="-44" cy="-158" r="5"/><circle cx="-12" cy="-160" r="5"/><circle cx="36" cy="-168" r="5"/><circle cx="52" cy="-160" r="5"/></g>`;
  return h;
}

function eel() {
  return `<path d="M-78 0 C-80 -40 -52 -72 -12 -76 C30 -80 70 -54 76 -16 L78 0 Z" fill="url(#t-rock)"/>
    <path d="M-60 -40 C-40 -64 0 -70 30 -60" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="6"/>
    <ellipse cx="-6" cy="-36" rx="24" ry="17" fill="#04080c"/>
    <g class="sway eel" style="--d:0s;transform-origin:-6px -36px">
      <path d="M-6 -36 C14 -70 -30 -108 4 -138 S44 -168 30 -196" fill="none" stroke="url(#t-eel)" stroke-width="17" stroke-linecap="round"/>
      <path d="M-6 -36 C14 -70 -30 -108 4 -138 S44 -168 30 -196" fill="none" stroke="#f2c94c" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round" transform="translate(3 2)" opacity=".85"/>
      <path d="M-2 -48 C18 -78 -24 -110 10 -140 S50 -168 38 -194" fill="none" stroke="#9fd0ff" stroke-opacity=".35" stroke-width="2"/>
      <g transform="translate(30 -198) rotate(-62)">
        <ellipse cx="6" cy="0" rx="17" ry="11" fill="url(#t-eel)"/>
        <path d="M18 3 Q10 6 2 4" stroke="#0b1b2b" stroke-width="1.6" fill="none"/>
        <circle cx="10" cy="-4" r="3.4" fill="#f2c94c"/><circle cx="10.6" cy="-4" r="1.6" fill="#05080c"/>
      </g>
    </g>`;
}

function knight() {
  return `<g transform="rotate(-9)">
      <rect x="-34" y="-18" width="68" height="18" rx="6" fill="url(#t-bronze)"/>
      <rect x="-28" y="-26" width="56" height="10" rx="4" fill="url(#t-bronze)"/>
      <path d="M-22 -26 L-17 -58 C-30 -68 -33 -86 -20 -102 C-7 -118 16 -122 28 -106 L40 -92 C45 -85 40 -78 33 -79 L20 -81 C22 -68 28 -46 26 -26 Z" fill="url(#t-bronze)"/>
      <path d="M-20 -102 L-12 -96 M-24 -92 L-15 -88 M-26 -82 L-17 -79" stroke="#5c4a26" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="16" cy="-98" r="3" fill="#2b2213"/>
      <path d="M2 -60 L8 -48 L3 -40" fill="none" stroke="#3b2f18" stroke-width="1.6"/>
      <g fill="#3f7a5e" opacity=".75"><ellipse cx="-10" cy="-70" rx="9" ry="5"/><ellipse cx="6" cy="-36" rx="12" ry="5"/><ellipse cx="24" cy="-92" rx="5" ry="3"/><ellipse cx="-20" cy="-12" rx="10" ry="4"/></g>
      <path d="M-14 -108 C-4 -114 10 -116 20 -110" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/>
    </g>
    <path d="M-58 2 C-40 -14 -10 -16 6 -10 C24 -16 46 -12 60 2 Z" fill="url(#t-sand)"/>`;
}

function net() {
  let h = `<path d="M-70 0 C-72 -30 -46 -56 -6 -60 C34 -62 66 -38 70 -6 L70 0 Z" fill="url(#t-rock)"/>`;
  // a sagging mesh draped over the rock
  const cols = 7, rows = 4, x0 = -66, x1 = 66;
  const at = (i, j) => { const x = x0 + (x1 - x0) * (i / cols); const top = -56 + Math.abs(x) * 0.36; const y = top + (j / rows) * (-top - 4) + Math.sin(i * 1.3 + j) * 2; return [x, y]; };
  let lines = "";
  for (let j = 0; j <= rows; j++) { lines += `<path d="M${Array.from({ length: cols + 1 }, (_, i) => at(i, j).map((v) => v.toFixed(1)).join(" ")).join(" L")}"/>`; }
  for (let i = 0; i <= cols; i++) { lines += `<path d="M${Array.from({ length: rows + 1 }, (_, j) => at(i, j).map((v) => v.toFixed(1)).join(" ")).join(" L")}"/>`; }
  const [a, b, c, d] = [at(3, 1), at(4, 1), at(4, 2), at(3, 2)];
  h += `<path d="M${a} L${b} L${c} L${d} Z" fill="${ACCENT}" opacity=".55"/>`;
  h += `<g fill="none" stroke="#d8cfbd" stroke-width="1.6" opacity=".8" stroke-linejoin="round">${lines}</g>`;
  // floats along the top rope
  for (let i = 0; i <= cols; i += 2) { const [x, y] = at(i, 0); h += `<ellipse cx="${x}" cy="${y - 4}" rx="7" ry="5" fill="${WARM}"/><ellipse cx="${x - 2}" cy="${y - 6}" rx="2.5" ry="1.4" fill="#fff" opacity=".45"/>`; }
  return h;
}

function crate() {
  const e = 50, o = 22; // edge and isometric offset
  const P = [[-e / 2, 0], [e / 2, 0], [e / 2, -e], [-e / 2, -e]];
  const Q = P.map(([x, y]) => [x + o, y - o]);
  const edges = [[P[0], P[1]], [P[1], P[2]], [P[2], P[3]], [P[3], P[0]], [Q[0], Q[1]], [Q[1], Q[2]], [Q[2], Q[3]], [Q[3], Q[0]], [P[0], Q[0]], [P[1], Q[1]], [P[2], Q[2]], [P[3], Q[3]]];
  const beams = edges.map(([a, b]) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`).join(" ");
  const nodes = [...P, ...Q].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="6" fill="${i === 2 || i === 4 ? ACCENT : "#d8d2c4"}"/><circle cx="${x}" cy="${y}" r="2.2" fill="#3b3326"/>`).join("");
  return `<path d="${beams}" stroke="#5e4529" stroke-width="7" stroke-linecap="round"/><path d="${beams}" stroke="#8c6c45" stroke-width="2.4" stroke-linecap="round"/>${nodes}`;
}

function gauge() {
  let ticks = "";
  for (let y = -8; y > -206; y -= 10) ticks += `<line x1="-7" y1="${y}" x2="${y % 50 === -8 ? 4 : 0}" y2="${y}" stroke="#2b2f33" stroke-width="1.2"/>`;
  const band = (y, c, t) => `<rect x="-17" y="${y - 2.5}" width="34" height="5" rx="2" fill="${c}"/><text x="22" y="${y + 3.5}" class="t-tiny">${t}</text>`;
  return `<rect x="-8" y="-214" width="16" height="214" rx="3" fill="url(#t-post)"/>${ticks}
    ${band(-176, WARM, "UCL")}${band(-110, ACCENT, "CL")}${band(-44, WARM, "LCL")}
    <path d="M-30 -172 L-24 -150 L-34 -128 L-26 -106 L-36 -86 L-27 -66 L-33 -50" fill="none" stroke="${ACCENT}" stroke-width="1.8" opacity=".8"/>
    <rect x="-12" y="-220" width="24" height="8" rx="3" fill="#6e6a63"/>`;
}

function jelly() {
  const tent = [-26, -13, 0, 13, 26];
  let t = "", n = "";
  tent.forEach((x, i) => {
    const pts = [0, 1, 2, 3].map((k) => [x + Math.sin(k * 1.4 + i) * 5, 8 + k * 24]);
    t += `<path d="M${pts.map((p) => p.join(" ")).join(" L")}" />`;
    pts.slice(1).forEach(([px, py]) => { n += `<circle cx="${px.toFixed(1)}" cy="${py}" r="2.8"/>`; });
    if (i < tent.length - 1) [1, 2, 3].forEach((k) => {
      const a = [x + Math.sin(k * 1.4 + i) * 5, 8 + k * 24], b = [tent[i + 1] + Math.sin((k + 1) * 1.4 + i + 1) * 5, 8 + (k + 1 > 3 ? 3 : k + 1) * 24];
      t += `<path d="M${a.join(" ")} L${b.join(" ")}" opacity=".45"/>`;
    });
  });
  return `<g class="bob" style="--d:.6s">
      <g fill="none" stroke="#a9d7ff" stroke-width="1.3" stroke-opacity=".7">${t}</g>
      <g fill="#cfe9ff">${n}</g>
      <path d="M-38 6 C-40 -46 40 -46 38 6 C28 12 14 8 0 12 C-14 8 -28 12 -38 6 Z" fill="url(#t-jelly)" stroke="#cfe9ff" stroke-opacity=".55"/>
      <g fill="#ffffff" opacity=".8"><circle cx="-14" cy="-12" r="3"/><circle cx="0" cy="-20" r="3"/><circle cx="14" cy="-12" r="3"/></g>
      <path d="M-14 -12 L0 -20 L14 -12" stroke="#fff" stroke-opacity=".45" fill="none"/>
      <path d="M-26 -18 C-20 -30 -8 -34 4 -34" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>`;
}

function clam() {
  let ridges = "";
  for (let k = -4; k <= 4; k++) ridges += `<path d="M0 -4 L${k * 11} ${k === 0 ? -2 : 0}" />`;
  return `<path d="M-52 0 C-50 -26 50 -26 52 0 Z" fill="url(#t-shell)"/>
    <g stroke="#7d6c52" stroke-opacity=".5" fill="none">${ridges}</g>
    <ellipse cx="0" cy="-12" rx="42" ry="9" fill="#5b2f3a" opacity=".6"/>
    <g transform="translate(-24 -36) rotate(-24 24 -12)"><path d="M-50 -12 C-46 -60 46 -60 50 -12 C30 -24 -30 -24 -50 -12 Z" fill="url(#t-shell)"/></g>
    <g transform="translate(0 -26)">
      <path d="M8.6 15.4 A18 18 0 1 0 -8.6 15.4 Z" fill="url(#t-wafer)"/>
      <g clip-path="url(#t-wafer-clip)" stroke="#e8eef8" stroke-opacity=".5" stroke-width=".7">
        ${[-12, -6, 0, 6, 12].map((v) => `<line x1="${v}" y1="-20" x2="${v}" y2="20"/><line x1="-20" y1="${v}" x2="20" y2="${v}"/>`).join("")}
      </g>
      <rect x="0.6" y="-5.4" width="5" height="5" fill="${ACCENT}" opacity=".9"/>
      <ellipse cx="-6" cy="-9" rx="6" ry="3" fill="#fff" opacity=".35" transform="rotate(-30 -6 -9)"/>
    </g>`;
}

function drone() {
  return `<g class="bob" style="--d:1.4s">
      <path d="M38 6 L150 66 L150 -18 Z" fill="url(#t-beam)"/>
      <rect x="-40" y="-18" width="78" height="34" rx="12" fill="url(#t-hull)"/>
      <rect x="-40" y="-18" width="78" height="34" rx="12" fill="none" stroke="#cfd5d2" stroke-opacity=".6" stroke-width="1.5"/>
      <rect x="-26" y="-26" width="44" height="10" rx="4" fill="#cfd5d2"/>
      <line x1="-6" y1="-26" x2="-6" y2="-40" stroke="#cfd5d2" stroke-width="2"/><circle cx="-6" cy="-42" r="3" fill="${WARM}"/>
      <circle cx="30" cy="0" r="8" fill="#0b1b2b" stroke="#cfd5d2" stroke-width="2"/><circle cx="30" cy="0" r="4.5" fill="${ACCENT}"/><circle cx="28.5" cy="-1.5" r="1.4" fill="#fff"/>
      <rect x="-58" y="-10" width="18" height="18" rx="4" fill="#2a3540" stroke="#cfd5d2" stroke-opacity=".5"/>
      <ellipse cx="-60" cy="-1" rx="3" ry="11" fill="#cfd5d2" opacity=".55" class="prop"/>
      <text x="-14" y="5" class="t-tiny" fill="#cfe9ff">AI</text>
    </g>`;
}

const ART = { python: eel, sql: coral, chess: knight, tableau: kelp, excel: net, doe: crate, sixsigma: gauge, ml: jelly, fab: clam, agentic: drone };
// rough heights above the base, for placing hover tags
const TOP = { python: 214, sql: 178, chess: 126, tableau: 214, excel: 72, doe: 82, sixsigma: 226, ml: 46, fab: 96, agentic: 52 };

/* ---------------- layouts: x, y (base), scale; depth "back" is hazier ---------------- */

const WIDE = {
  view: [1200, 560], sand: 470,
  items: {
    tableau: [90, 478, 0.95, "back"], sql: [400, 474, 0.85, "back"], sixsigma: [1130, 480, 0.95, "back"],
    python: [230, 532, 1, "front"], chess: [540, 534, 1.05, "front"], doe: [720, 538, 0.95, "front"],
    excel: [900, 534, 1, "front"], fab: [1060, 540, 1, "front"],
    agentic: [560, 150, 1, "float"], ml: [960, 205, 1.05, "float"],
  },
};
const TALL = {
  view: [600, 980], sand: 700,
  items: {
    tableau: [80, 720, 0.9, "back"], sql: [300, 714, 0.8, "back"], sixsigma: [540, 718, 0.85, "back"],
    python: [150, 830, 0.95, "front"], doe: [440, 830, 0.9, "front"],
    chess: [100, 952, 1, "front"], fab: [310, 960, 0.9, "front"], excel: [500, 950, 0.85, "front"],
    agentic: [170, 190, 1.1, "float"], ml: [450, 330, 1.1, "float"],
  },
};

function defs() {
  return `<defs>
    <linearGradient id="t-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#184f65"/><stop offset=".36" stop-color="#10374e"/><stop offset=".72" stop-color="#0b253a"/><stop offset="1" stop-color="#071827"/></linearGradient>
    <radialGradient id="t-scatter" cx=".38" cy=".04" r=".76"><stop offset="0" stop-color="#73d4d2" stop-opacity=".24"/><stop offset=".47" stop-color="#4fa9bc" stop-opacity=".1"/><stop offset="1" stop-color="#2e728c" stop-opacity="0"/></radialGradient>
    <linearGradient id="t-ripple"><stop offset="0" stop-color="#b4e4e9" stop-opacity="0"/><stop offset=".34" stop-color="#b4e4e9" stop-opacity=".15"/><stop offset=".68" stop-color="#d1f0ee" stop-opacity=".35"/><stop offset="1" stop-color="#b4e4e9" stop-opacity="0"/></linearGradient>
    <linearGradient id="t-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b7655"/><stop offset="1" stop-color="#4f4029"/></linearGradient>
    <radialGradient id="t-rock" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#4b5764"/><stop offset="1" stop-color="#1d242b"/></radialGradient>
    <linearGradient id="t-coral" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9503a"/><stop offset=".45" stop-color="#ef8a6b"/><stop offset="1" stop-color="#b9503a"/></linearGradient>
    <linearGradient id="t-kelp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b5f51"/><stop offset=".5" stop-color="#36a083"/><stop offset="1" stop-color="#1b5f51"/></linearGradient>
    <linearGradient id="t-bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c3a565"/><stop offset=".6" stop-color="#8a7140"/><stop offset="1" stop-color="#5f4d2a"/></linearGradient>
    <radialGradient id="t-brass" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#d8b062"/><stop offset=".6" stop-color="#9a7434"/><stop offset="1" stop-color="#5e461c"/></radialGradient>
    <linearGradient id="t-eel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a78ad"/><stop offset="1" stop-color="#16324f"/></linearGradient>
    <radialGradient id="t-jelly" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#d8eeff" stop-opacity=".85"/><stop offset=".6" stop-color="#7cbcf0" stop-opacity=".45"/><stop offset="1" stop-color="#3b7fc0" stop-opacity=".2"/></radialGradient>
    <linearGradient id="t-shell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7dcc6"/><stop offset="1" stop-color="#a08c6c"/></linearGradient>
    <radialGradient id="t-wafer" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#eef3fb"/><stop offset=".45" stop-color="#9fb0c9"/><stop offset=".75" stop-color="#b7a3d6"/><stop offset="1" stop-color="#6d7d97"/></radialGradient>
    <clipPath id="t-wafer-clip"><path d="M8.6 15.4 A18 18 0 1 0 -8.6 15.4 Z"/></clipPath>
    <linearGradient id="t-post" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8f8a80"/><stop offset=".45" stop-color="#e6e1d6"/><stop offset="1" stop-color="#8f8a80"/></linearGradient>
    <linearGradient id="t-hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4753"/><stop offset="1" stop-color="#141b22"/></linearGradient>
    <linearGradient id="t-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9fd0ff" stop-opacity=".35"/><stop offset="1" stop-color="#9fd0ff" stop-opacity="0"/></linearGradient>
    <linearGradient id="t-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4ecec" stop-opacity=".16"/><stop offset=".53" stop-color="#96cce0" stop-opacity=".045"/><stop offset="1" stop-color="#96cce0" stop-opacity="0"/></linearGradient>
    <filter id="t-light-diffusion" x="-.12" y="-.12" width="1.24" height="1.24"><feGaussianBlur stdDeviation="9"/></filter>
    <linearGradient id="t-spot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe9ff" stop-opacity=".02"/><stop offset="1" stop-color="#cfe9ff" stop-opacity=".22"/></linearGradient>
    <filter id="t-haze"><feColorMatrix type="matrix" values=".72 0 0 0 .02  0 .78 0 0 .06  0 0 .9 0 .12  0 0 0 1 0"/></filter>
  </defs>`;
}

function scene(L) {
  const [W, H] = L.view, S = L.sand;
  const rays = [.14, .31, .48, .65, .81].map((f, i) => {
    const x = W * f, drift = W * (.06 + (i % 3) * .035), beam = 13 + (i % 2) * 13;
    return `<path d="M${x - beam} 0 H${x + beam} L${x + drift + 65} ${S} H${x + drift - 85} Z" fill="url(#t-ray)"/>`;
  }).join("");
  const ripples = Array.from({ length: 8 }, (_, i) => {
    const x = (i % 4) * W * .29 - W * .1 + Math.floor(i / 4) * W * .075;
    const y = 8 + Math.floor(i / 4) * 12 + (i % 3) * 3, length = W * (.23 + (i % 3) * .035);
    return `<path d="M${x} ${y} q${length * .22} -10 ${length * .48} -2 t${length * .52} 0"/>`;
  }).join("");
  const motes = Array.from({ length: 39 }, (_, i) => {
    const x = W * ((i * 89 + 31) % 127) / 127, y = 30 + (S - 66) * ((i * 53 + 15) % 113) / 113;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${.65 + (i % 4) * .25}" opacity="${[.13, .31, .19, .38][i % 4]}"/>`;
  }).join("");
  const dunes = `M0 ${S} C${W * 0.2} ${S - 22} ${W * 0.35} ${S + 6} ${W * 0.55} ${S - 12} S${W * 0.85} ${S + 4} ${W} ${S - 16} V${H} H0 Z`;
  const hills = `M0 ${S - 30} C${W * 0.15} ${S - 90} ${W * 0.3} ${S - 40} ${W * 0.45} ${S - 70} S${W * 0.75} ${S - 30} ${W} ${S - 80} V${S + 10} H0 Z`;
  const bubbles = Array.from({ length: 9 }, (_, k) => `<circle class="bubble" style="--d:${(k * 0.9).toFixed(1)}s;--x:${(Math.sin(k) * 8).toFixed(1)}px" cx="${W - 70 + (k % 3) * 6}" cy="${S - 8}" r="${2 + (k % 3)}" fill="none" stroke="#cfe9ff" stroke-opacity=".55"/>`).join("");
  const sandLight = Array.from({ length: 6 }, (_, i) => {
    const x = W * (.05 + i * .16), y = S + 16 + (i % 2) * 17;
    return `<path d="M${x} ${y} q18 -11 42 -3 t47 -3 m-74 11 q17 -6 37 -1 t39 0"/>`;
  }).join("");
  return `<rect width="${W}" height="${H}" fill="url(#t-water)"/>
    <rect width="${W}" height="${S}" fill="url(#t-scatter)"/><g filter="url(#t-light-diffusion)">${rays}</g>
    <g fill="none" stroke="url(#t-ripple)" stroke-width="1.15">${ripples}</g>
    <g fill="#b9e5e6">${motes}</g>
    <path d="${hills}" fill="#0b2034" opacity=".9"/>
    <path d="${dunes}" fill="url(#t-sand)"/>
    <path d="${dunes}" fill="none" stroke="#c2a878" stroke-opacity=".25" stroke-width="2"/>
    <g opacity=".65" stroke="url(#t-ripple)" stroke-width="1.2" fill="none">${sandLight}</g>
    <ellipse cx="${W - 64}" cy="${S - 4}" rx="16" ry="6" fill="#3b4148"/>${bubbles}
    <polygon id="t-spotlight" points="0,0 0,0 0,0 0,0" fill="url(#t-spot)"/>`;
}

export function initTank({ reduce }) {
  const host = document.getElementById("tank"), chips = document.getElementById("skill-chips");
  const demos = createDemoPlayer(document.getElementById("demo"), { reduce });
  if (!host) return;
  let layout = null, selected = "python";

  chips.innerHTML = ORDER.map((id) => `<li><button class="chip" type="button" data-skill="${id}" aria-pressed="${id === selected}">${SKILLS[id].name}</button></li>`).join("");

  function build() {
    const L = matchMedia("(max-width: 720px)").matches ? TALL : WIDE;
    if (L === layout) return;
    layout = L;
    const [W, H] = L.view;
    const items = ORDER.map((id) => {
      const [x, y, s, depth] = L.items[id];
      const tagY = depth === "float" ? -60 : -TOP[id] - 18;
      return `<g class="tank-obj ${depth}" data-skill="${id}" transform="translate(${x} ${y}) scale(${s})">
          <rect class="hit" x="-80" y="${depth === "float" ? -70 : -TOP[id] - 10}" width="160" height="${depth === "float" ? 150 : TOP[id] + 16}" fill="transparent"/>
          <g ${depth === "back" ? 'filter="url(#t-haze)"' : ""}>${ART[id]()}</g>
          <g class="tag" transform="translate(0 ${tagY})"><rect x="-${SKILLS[id].name.length * 4 + 12}" y="-13" width="${SKILLS[id].name.length * 8 + 24}" height="22" rx="11"/><text y="2.5" text-anchor="middle">${SKILLS[id].name}</text></g>
        </g>`;
    });
    // back row first, then front, then floating, so depth reads correctly
    const by = (d) => items.filter((_, i) => L.items[ORDER[i]][3] === d).join("");
    host.innerHTML = `<svg class="tank-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="An aquarium holding one object for each skill">${defs()}${scene(L)}${by("back")}${by("front")}${by("float")}</svg>`;
    host.classList.toggle("reduce", reduce);
    mark(selected, false);
  }

  function spotlight(id) {
    const L = layout, [x, y, s, depth] = L.items[id];
    const top = depth === "float" ? y - 60 : y - TOP[id] * s;
    const half = 70 * s;
    host.querySelector("#t-spotlight").setAttribute("points", `${x - 24},0 ${x + 24},0 ${x + half},${y + 6} ${x - half},${y + 6}`);
    void top;
  }

  function mark(id, fill = true) {
    selected = id;
    host.querySelectorAll(".tank-obj").forEach((g) => g.classList.toggle("on", g.dataset.skill === id));
    chips.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.skill === id)));
    spotlight(id);
    if (!fill) { render(id); return; }
    render(id);
  }

  function render(id) { demos.play(id, SKILLS[id].name); }

  host.addEventListener("click", (e) => { const g = e.target.closest(".tank-obj"); if (g) mark(g.dataset.skill); });
  chips.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) mark(b.dataset.skill); });
  addEventListener("resize", build);
  build();
}
