// The backpack and the things in it. Every tool is drawn top-down in a
// 100x100 box from the shared metal gradients (m-chrome, m-gloss, m-ball, ...)
// defined in index.html, so the whole chest reads as one material.

const GREEN = "#34a873";
const INK = "#060707";

function spiral() {
  const pts = [];
  for (let t = 0.9; t <= 4.45 * Math.PI; t += 0.12) {
    const r = 3.2 + 2.32 * t;
    pts.push([50 + r * Math.cos(t), 52 + r * Math.sin(t)]);
  }
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const a = pts[pts.length - 1], b = pts[pts.length - 3];
  const ang = (Math.atan2(a[1] - b[1], a[0] - b[0]) * 180) / Math.PI;
  return { d, head: a, ang };
}
const SP = spiral();

const ticks = (cx, cy, r1, r2, n, w = 1) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `<line x1="${(cx + r1 * Math.cos(a)).toFixed(1)}" y1="${(cy + r1 * Math.sin(a)).toFixed(1)}" x2="${(cx + r2 * Math.cos(a)).toFixed(1)}" y2="${(cy + r2 * Math.sin(a)).toFixed(1)}" stroke-width="${w}"/>`;
  }).join("");

export const SHARED_DEFS = `
  <mask id="mk-stencil" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
    <rect x="0" y="0" width="100" height="100" fill="#fff"/>
    <rect x="22" y="52" width="7" height="16" rx="1.5" fill="#000"/><rect x="32" y="44" width="7" height="24" rx="1.5" fill="#000"/><rect x="42" y="56" width="7" height="12" rx="1.5" fill="#000"/>
    <circle cx="68" cy="45" r="9" fill="#000"/>
    <path d="M58 64 L64 59 L70 62 L78 54" stroke="#000" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </mask>
  <mask id="mk-reel" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
    <rect x="0" y="0" width="100" height="100" fill="#fff"/>
    ${[0, 72, 144, 216, 288].map((a) => { const r = (a * Math.PI) / 180; return `<circle cx="${(50 + 20 * Math.cos(r - 1.57)).toFixed(1)}" cy="${(50 + 20 * Math.sin(r - 1.57)).toFixed(1)}" r="8.6" fill="#000"/>`; }).join("")}
    <circle cx="50" cy="50" r="4.2" fill="#000"/>
  </mask>
  <clipPath id="cp-wafer"><path d="M69 82.9 A38 38 0 1 0 31 82.9 Z"/></clipPath>
  <filter id="f-cut" x="-25%" y="-25%" width="150%" height="150%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="2.8" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.6" result="b"/>
    <feFlood flood-color="#03110b"/>
    <feComposite in2="b" operator="in"/>
  </filter>`;

export const TOOLS = {
  python: {
    name: "Python", sub: "pandas · scikit-learn · sqlalchemy",
    use: "the etl behind micron’s tool register.",
    link: { href: "#proj-register", label: "see the tool register" },
    art: `<path d="${SP.d}" fill="none" stroke="url(#m-gloss)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${SP.d}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2.2" stroke-linecap="round" transform="translate(-1.6 -1.8)"/>
      <path d="${SP.d}" fill="none" stroke="${GREEN}" stroke-opacity=".5" stroke-width="1" stroke-dasharray="1.5 5" stroke-linecap="round"/>
      <g transform="translate(${SP.head[0].toFixed(1)} ${SP.head[1].toFixed(1)}) rotate(${SP.ang.toFixed(1)})">
        <ellipse cx="3" cy="0" rx="9" ry="7" fill="url(#m-ball)"/>
        <ellipse cx="1.5" cy="-2.6" rx="5" ry="1.6" fill="#fff" fill-opacity=".25"/>
        <circle cx="6" cy="-3.4" r="1.5" fill="${GREEN}"/><circle cx="6" cy="3.4" r="1.5" fill="${GREEN}"/>
      </g>`,
  },
  sql: {
    name: "SQL", sub: "snowflake · mssql · azure",
    use: "joined 13 datastores into micron’s tool register and its opex forecasts.",
    link: { href: "#proj-register", label: "see the tool register" },
    art: `<rect x="24" y="12" width="58" height="78" rx="3.5" fill="url(#m-gloss)"/>
      <rect x="24" y="12" width="58" height="78" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".14"/>
      <rect x="24" y="72" width="58" height="6" fill="#1c6b47"/>
      ${Array.from({ length: 9 }, (_, i) => `<ellipse cx="24" cy="${18 + i * 8.2}" rx="4.6" ry="2.2" fill="none" stroke="url(#m-chrome)" stroke-width="2"/>`).join("")}
      <text x="55" y="45" text-anchor="middle" font-family="Host Grotesk, sans-serif" font-weight="700" font-size="17" fill="url(#m-chrome)" letter-spacing="1">SQL</text>
      <text x="55" y="55" text-anchor="middle" font-family="Host Grotesk, sans-serif" font-weight="600" font-size="5" fill="#9aa39e" letter-spacing="1.6">FIELD MANUAL</text>`,
  },
  excel: {
    name: "Excel", sub: "parametric modeling",
    use: "six 40-year dcf models for the solar pv study.",
    link: { href: "#proj-solar", label: "see the solar pv model" },
    art: `<rect x="20" y="16" width="62" height="72" rx="3" fill="url(#m-gloss)"/>
      <rect x="20" y="16" width="62" height="72" rx="3" fill="none" stroke="#fff" stroke-opacity=".14"/>
      <g stroke="url(#m-chrome-h)" stroke-width="1.1" opacity=".75">
        <rect x="30" y="30" width="42" height="34" fill="none"/>
        <line x1="30" y1="38.5" x2="72" y2="38.5"/><line x1="30" y1="47" x2="72" y2="47"/><line x1="30" y1="55.5" x2="72" y2="55.5"/>
        <line x1="44" y1="30" x2="44" y2="64"/><line x1="58" y1="30" x2="58" y2="64"/>
      </g>
      <rect x="44" y="47" width="14" height="8.5" fill="${GREEN}" opacity=".8"/>
      <path d="M68 10 h8 v24 l-4 -4 l-4 4 z" fill="#1c6b47"/>
      <text x="51" y="78" text-anchor="middle" font-family="Host Grotesk, sans-serif" font-weight="600" font-size="5" fill="#9aa39e" letter-spacing="1.6">LEDGER</text>`,
  },
  tableau: {
    name: "Tableau", sub: "dashboards · reporting",
    use: "opex forecasting across 6 fiscal years and 25+ scenarios at micron.",
    link: { href: "#experience", label: "see the micron role" },
    art: `<rect x="12" y="30" width="76" height="46" rx="6" fill="url(#m-chrome)" mask="url(#mk-stencil)"/>
      <rect x="12" y="30" width="76" height="46" rx="6" fill="none" stroke="#000" stroke-opacity=".25"/>
      <circle cx="18" cy="36" r="2" fill="#5b625f"/>
      <g stroke="#3f4643" stroke-width=".8">${Array.from({ length: 12 }, (_, i) => `<line x1="${20 + i * 5}" y1="72" x2="${20 + i * 5}" y2="${i % 2 ? 74 : 75.5}"/>`).join("")}</g>`,
  },
  dice: {
    name: "Probability", sub: "distributions · the clt",
    use: "the statistics minor, and every gambit i’ve ever played.",
    art: `<g transform="rotate(-12 38 40)"><rect x="22" y="24" width="32" height="32" rx="6" fill="url(#m-gloss)"/><rect x="22" y="24" width="32" height="32" rx="6" fill="none" stroke="#fff" stroke-opacity=".16"/>
        ${[[30, 32], [46, 32], [38, 40], [30, 48], [46, 48]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.8" fill="url(#m-chrome-ball)"/>`).join("")}</g>
      <g transform="rotate(16 64 64)"><rect x="49" y="49" width="30" height="30" rx="6" fill="url(#m-gloss)"/><rect x="49" y="49" width="30" height="30" rx="6" fill="none" stroke="#fff" stroke-opacity=".16"/>
        ${[[56, 56], [64, 64], [72, 72]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.7" fill="${x === 64 ? GREEN : "url(#m-chrome-ball)"}"/>`).join("")}</g>`,
  },
  doe: {
    name: "JMP & DOE", sub: "factorial designs",
    use: "design of experiments coursework: factorial designs, run in jmp.",
    art: `<g stroke="url(#m-chrome-h)" stroke-width="2.6" stroke-linecap="round" fill="none">
        <rect x="22" y="40" width="38" height="38"/><rect x="40" y="22" width="38" height="38"/>
        <line x1="22" y1="40" x2="40" y2="22"/><line x1="60" y1="40" x2="78" y2="22"/><line x1="22" y1="78" x2="40" y2="60"/><line x1="60" y1="78" x2="78" y2="60"/></g>
      ${[[22, 40], [60, 40], [22, 78], [60, 78], [40, 22], [78, 22], [40, 60], [78, 60]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="5" fill="${i === 1 || i === 6 ? GREEN : "url(#m-chrome-ball)"}"/>`).join("")}`,
  },
  calipers: {
    name: "Six Sigma", sub: "spc · capability",
    use: "quality control and six sigma coursework: measure first.",
    art: `<g fill="url(#m-chrome)">
        <rect x="8" y="42" width="86" height="11" rx="1.5"/>
        <path d="M8 53 H22 V86 L18 86 L8 72 Z"/><path d="M10 42 H20 V30 L15 30 Z"/>
        <rect x="38" y="38" width="22" height="19" rx="2.5"/>
        <path d="M40 57 H52 L47 86 H43 Z"/><path d="M42 38 H50 L47 30 H45 Z"/>
      </g>
      <g stroke="#3f4643" stroke-width=".7">${Array.from({ length: 30 }, (_, i) => `<line x1="${62 + i}" y1="42.5" x2="${62 + i}" y2="${i % 5 ? 46 : 48.5}"/>`).join("")}</g>
      <rect x="41" y="41" width="16" height="7" rx="1" fill="${INK}"/><text x="49" y="46.6" text-anchor="middle" font-family="Host Grotesk, sans-serif" font-size="5.2" font-weight="600" fill="${GREEN}">3.00σ</text>
      <circle cx="56" cy="61" r="3" fill="url(#m-chrome-ball)"/>`,
  },
  eightball: {
    name: "Machine learning", sub: "classification · validation",
    use: "machine learning coursework. outlook: good.",
    link: { href: "#proj-bridge", label: "see the regression project" },
    art: `<circle cx="50" cy="52" r="35" fill="url(#m-ball)"/>
      <circle cx="46" cy="47" r="13" fill="#eef1ee"/>
      <text x="46" y="53.5" text-anchor="middle" font-family="Host Grotesk, sans-serif" font-weight="700" font-size="17" fill="${INK}">8</text>
      <ellipse cx="34" cy="30" rx="10" ry="5" fill="#fff" fill-opacity=".22" transform="rotate(-28 34 30)"/>`,
  },
  stopwatch: {
    name: "Industrial engineering", sub: "manufacturing process · quality",
    use: "the b.s. at purdue: processes, time, and the cost of both.",
    link: { href: "#experience", label: "see education" },
    art: `<rect x="44" y="8" width="12" height="9" rx="2" fill="url(#m-chrome)"/><rect x="47" y="15" width="6" height="7" fill="url(#m-chrome-h)"/>
      <rect x="72" y="20" width="8" height="6" rx="1.5" fill="url(#m-chrome)" transform="rotate(42 76 23)"/>
      <circle cx="50" cy="57" r="34" fill="url(#m-chrome)"/>
      <circle cx="50" cy="57" r="28" fill="${INK}"/>
      <g stroke="#8f9994">${ticks(50, 57, 23, 26.5, 60, 0.6)}</g><g stroke="#eef1ee">${ticks(50, 57, 21.5, 26.5, 12, 1.4)}</g>
      <line x1="50" y1="57" x2="62" y2="40" stroke="${GREEN}" stroke-width="2" stroke-linecap="round"/>
      <line x1="50" y1="57" x2="50" y2="68" stroke="#eef1ee" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="50" cy="57" r="2.6" fill="url(#m-chrome-ball)"/>`,
  },
  wafer: {
    name: "Semiconductor fab", sub: "fabrication · microelectronics",
    use: "two purdue certifications, and a summer in micron’s cleanroom budget.",
    link: { href: "#experience", label: "see the micron role" },
    art: `<path d="M69 82.9 A38 38 0 1 0 31 82.9 Z" fill="url(#m-gloss)"/>
      <g clip-path="url(#cp-wafer)">
        <g stroke="#c7cecb" stroke-opacity=".35" stroke-width=".7">${Array.from({ length: 11 }, (_, i) => `<line x1="${12 + i * 7.6}" y1="10" x2="${12 + i * 7.6}" y2="90"/><line x1="10" y1="${12 + i * 7.6}" x2="90" y2="${12 + i * 7.6}"/>`).join("")}</g>
        ${[[3, 3], [5, 2], [6, 5], [2, 6], [7, 7], [4, 8]].map(([c, r]) => `<rect x="${12.4 + c * 7.6}" y="${12.4 + r * 7.6}" width="6.8" height="6.8" fill="${GREEN}" opacity=".85"/>`).join("")}
        <rect x="-20" y="30" width="140" height="18" fill="#fff" opacity=".07" transform="rotate(-32 50 50)"/>
      </g>
      <path d="M69 82.9 A38 38 0 1 0 31 82.9 Z" fill="none" stroke="url(#m-chrome)" stroke-width="1.4"/>`,
  },
  robot: {
    name: "Agentic coding", sub: "claude code",
    use: "how this site got built. the coke was diet.",
    art: `<line x1="50" y1="24" x2="50" y2="12" stroke="url(#m-chrome-h)" stroke-width="2.4"/><circle cx="50" cy="11" r="4" fill="url(#m-chrome-ball)"/>
      <rect x="20" y="36" width="6" height="14" rx="2" fill="url(#m-chrome)"/><rect x="74" y="36" width="6" height="14" rx="2" fill="url(#m-chrome)"/>
      <rect x="25" y="24" width="50" height="38" rx="10" fill="url(#m-gloss)"/><rect x="25" y="24" width="50" height="38" rx="10" fill="none" stroke="#fff" stroke-opacity=".16"/>
      <circle cx="40" cy="42" r="5.2" fill="${GREEN}"/><circle cx="60" cy="42" r="5.2" fill="${GREEN}"/>
      <circle cx="38.6" cy="40.6" r="1.6" fill="#fff" fill-opacity=".7"/><circle cx="58.6" cy="40.6" r="1.6" fill="#fff" fill-opacity=".7"/>
      <rect x="42" y="52" width="16" height="3" rx="1.5" fill="url(#m-chrome-h)"/>
      <rect x="33" y="65" width="34" height="24" rx="5" fill="url(#m-gloss)"/><rect x="40" y="71" width="20" height="10" rx="2" fill="url(#m-chrome)"/>`,
  },
  clock: {
    name: "Rapid chess", sub: "lichess · an_d22",
    use: "captained purdue in the collegiate chess league as a 2000+ rated player.",
    link: { href: "#chess", label: "see live chess" },
    art: `<rect x="24" y="22" width="14" height="8" rx="2" fill="url(#m-chrome)"/><rect x="62" y="25" width="14" height="5" rx="2" fill="url(#m-chrome)"/>
      <path d="M14 34 H86 L82 82 H18 Z" fill="url(#m-gloss)"/><path d="M14 34 H86 L82 82 H18 Z" fill="none" stroke="#fff" stroke-opacity=".15"/>
      <circle cx="33" cy="57" r="14" fill="${INK}" stroke="url(#m-chrome)" stroke-width="2.2"/><circle cx="67" cy="57" r="14" fill="${INK}" stroke="url(#m-chrome)" stroke-width="2.2"/>
      <g stroke="#8f9994">${ticks(33, 57, 10, 12, 12, 0.8)}${ticks(67, 57, 10, 12, 12, 0.8)}</g>
      <line x1="33" y1="57" x2="39" y2="49" stroke="${GREEN}" stroke-width="1.8" stroke-linecap="round"/><line x1="67" y1="57" x2="67" y2="47" stroke="#eef1ee" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M39 44 l4 -2 v4 z" fill="${GREEN}"/>`,
  },
  whistle: {
    name: "Soccer", sub: "purdue d1 women’s soccer",
    use: "match prep for 18 big ten opponents.",
    link: { href: "#proj-match", label: "see match prep" },
    art: `<circle cx="80" cy="30" r="7" fill="none" stroke="url(#m-chrome)" stroke-width="2.6"/>
      <path d="M14 40 H50 A20 20 0 1 1 46 62 L42 56 H14 Z" fill="url(#m-chrome)"/>
      <circle cx="62" cy="58" r="20" fill="url(#m-chrome-ball)"/>
      <rect x="36" y="40" width="10" height="6" rx="1" fill="${INK}"/>
      <rect x="14" y="40" width="6" height="16" fill="#0b2a1d"/>`,
  },
  compass: {
    name: "Hiking", sub: "off the clock",
    use: "where i go when the laptop doesn’t.",
    art: `<circle cx="50" cy="50" r="36" fill="url(#m-chrome)"/><circle cx="50" cy="50" r="29" fill="${INK}"/>
      <g stroke="#8f9994">${ticks(50, 50, 24, 27, 36, 0.6)}</g>
      <text x="50" y="30" text-anchor="middle" font-family="Host Grotesk, sans-serif" font-size="7" font-weight="700" fill="#eef1ee">N</text>
      <g transform="rotate(32 50 50)"><path d="M50 26 L55 50 L45 50 Z" fill="${GREEN}"/><path d="M50 74 L55 50 L45 50 Z" fill="url(#m-chrome)"/></g>
      <circle cx="50" cy="50" r="3" fill="url(#m-chrome-ball)"/>`,
  },
  reel: {
    name: "Kung fu movies", sub: "current favorite: ip man 3",
    use: "ip man 3 (2015). no further questions.",
    art: `<circle cx="50" cy="50" r="38" fill="url(#m-chrome-h)" mask="url(#mk-reel)"/>
      <circle cx="50" cy="50" r="38" fill="none" stroke="#000" stroke-opacity=".3"/>
      <circle cx="50" cy="50" r="31" fill="none" stroke="#000" stroke-opacity=".18"/>
      <path d="M86 62 C92 72 94 82 90 92" fill="none" stroke="#151817" stroke-width="9"/>
      <path d="M86 62 C92 72 94 82 90 92" fill="none" stroke="#3f4643" stroke-width="9" stroke-dasharray="2 3"/>`,
  },
  can: {
    name: "Coke zero", sub: "never diet",
    use: "diet coke or coke zero? coke zero.",
    art: `<circle cx="50" cy="50" r="36" fill="url(#m-gloss)"/><circle cx="50" cy="50" r="36" fill="none" stroke="#fff" stroke-opacity=".16"/>
      <circle cx="50" cy="50" r="30" fill="url(#m-chrome)"/><circle cx="50" cy="50" r="25.5" fill="none" stroke="#6f7774" stroke-width="1.2"/>
      <path d="M40 30 Q50 25 60 30 Q58 40 50 41 Q42 40 40 30 Z" fill="#3f4643"/>
      <rect x="40" y="40" width="20" height="26" rx="9" fill="url(#m-chrome-h)" stroke="#5b625f" stroke-width=".8"/>
      <rect x="45" y="53" width="10" height="8" rx="4" fill="#4b5250"/><circle cx="50" cy="47" r="2" fill="#5b625f"/>`,
  },
};

// What is in the bag, in the order it spills out (deliberately not grouped).
export const PACK = ["python", "clock", "sql", "dice", "wafer", "whistle", "excel", "eightball",
  "stopwatch", "reel", "tableau", "calipers", "robot", "compass", "doe", "can"];

export function toolSVG(id, { cut = true } = {}) {
  const t = TOOLS[id];
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${cut ? `<g class="cut" filter="url(#f-cut)">${t.art}</g>` : ""}<g class="obj">${t.art}</g></svg>`;
}
