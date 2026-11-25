// Monoline cursive for "andrew nguyen", authored as single-stroke paths.
// Units: baseline y=0, x-height y=-40, ascender y=-88, descender y=+44.
// Each glyph: entry point (pen-down), body path (absolute within glyph box),
// exit point, advance width. Glyphs are joined by generated connector curves.

const G = {
  a: { in: [29, -31], d: "M29 -31 C23 -42 5 -42 3 -23 C1 -6 18 0 27 -17 C28 -24 29 -32 30 -39 C29 -26 27 -9 30 -3 C32 1 37 0 42 -6", out: [42, -6], w: 42 },
  n: { in: [3, -36], d: "M3 -36 C3 -24 3 -10 2 0 C6 -24 14 -40 24 -40 C33 -40 33 -27 31 -14 C30 -5 33 0 42 -6", out: [42, -6], w: 42 },
  d: { in: [29, -31], d: "M29 -31 C23 -42 5 -42 3 -23 C1 -6 18 0 27 -17 C30 -40 33 -66 36 -88 C33 -60 30 -26 30 -9 C30 0 37 0 44 -6", out: [44, -6], w: 44 },
  r: { in: [2, -35], d: "M2 -35 C3 -23 3 -10 2 0 C5 -22 12 -37 23 -36 C27 -36 29 -34 31 -31", out: [31, -31], w: 31 },
  e: { in: [1, -15], d: "M1 -15 C11 -14 23 -19 23 -30 C23 -41 8 -42 4 -29 C0 -15 6 0 18 -1 C24 -2 28 -5 31 -9", out: [31, -9], w: 31 },
  w: { in: [2, -38], d: "M2 -38 C0 -20 3 0 12 0 C20 0 23 -13 23 -25 C23 -11 27 0 34 0 C44 0 46 -22 44 -39 C43 -33 47 -31 53 -32", out: [53, -32], w: 53 },
  g: { in: [29, -31], d: "M29 -31 C23 -42 5 -42 3 -23 C1 -6 18 0 27 -17 C28 -24 29 -32 30 -39 C30 -12 30 18 25 34 C20 50 1 47 4 33 C7 21 24 11 41 -5", out: [41, -5], w: 41 },
  u: { in: [2, -38], d: "M2 -38 C0 -19 2 0 12 0 C22 0 28 -18 30 -38 C29 -24 28 -10 30 -4 C32 1 37 0 42 -6", out: [42, -6], w: 42 },
  y: { in: [2, -38], d: "M2 -38 C0 -19 2 0 12 0 C22 0 28 -18 30 -38 C30 -10 30 18 25 34 C20 50 1 47 4 33 C7 21 24 11 41 -5", out: [41, -5], w: 41 },
};

// Shift every coordinate pair in a path string by (dx, dy).
function shift(d, dx, dy) {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (m) => {
    const v = parseFloat(m) + (i++ % 2 === 0 ? dx : dy);
    return String(Math.round(v * 100) / 100);
  });
}

const nums = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);
const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

// Exit tangent: from the last control point to the end point.
function exitTangent(g) { const n = nums(g.d); const L = n.length; return unit(n[L - 2] - n[L - 4], n[L - 1] - n[L - 3]); }
// Entry tangent: from the start point toward the first control point.
function entryTangent(g) { const n = nums(g.d); return unit(n[2] - n[0], n[3] - n[1]); }

// One continuous stroke for a word. Connectors are tangent-continuous: the pen
// leaves along the exit direction and arrives along the entry direction. When a
// glyph opens with a downstroke, the pen arrives travelling up and retraces it
// (a cusp), which is how the hand actually joins into n, r, u, w, y.
export function wordPath(word, x0 = 0, gap = 3) {
  let x = x0, d = "", prev = null, prevT = null;
  for (const ch of word) {
    const g = G[ch];
    const inX = x + g.in[0], inY = g.in[1];
    if (prev) {
      const dist = Math.hypot(inX - prev[0], inY - prev[1]);
      let tin = entryTangent(g);
      if (tin[1] > 0.5) tin = unit(0.35, -1); // downstroke entry: arrive going up
      else if (tin[0] < -0.3) tin = unit(0.55, -1); // bowl entry (a, d, g): cusp at the bowl's top
      const k1 = dist * 0.42, k2 = dist * 0.38;
      d += ` C${r(prev[0] + prevT[0] * k1)} ${r(prev[1] + prevT[1] * k1)} ${r(inX - tin[0] * k2)} ${r(inY - tin[1] * k2)} ${r(inX)} ${r(inY)}`;
      d += " " + shift(g.d, x, 0).replace(/^M[^C]*/, "");
    } else {
      d += shift(g.d, x, 0);
    }
    prev = [x + g.out[0], g.out[1]];
    prevT = exitTangent(g);
    x += g.w + gap;
  }
  return { d, width: x - x0 };
}

const r = (v) => Math.round(v * 100) / 100;

export function nameSVG({ words = ["andrew", "nguyen"], space = 22 } = {}) {
  let x = 8; const paths = [];
  for (const w of words) {
    const p = wordPath(w, x);
    paths.push(p.d);
    x += p.width + space;
  }
  return { paths, width: x - space + 8 };
}
