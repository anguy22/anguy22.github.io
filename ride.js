/* ============================================================================
   THE PLOT — anguy.app

   An automatic ride along a closed curve plotted across a surface z = f(x,y)
   drawn as engineer's-pad paper. The camera drives itself at a steady pace,
   easing down as it passes each station. Click a station's object to stop the
   ride and expand its content; close it and the ride resumes.

   Coordinate convention
     graph (x, y) -> world (x, z)      the paper plane
     graph  z     -> world  y          height
   ========================================================================= */

import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

// tells the watchdog in index.html that the module resolved
window.__rideBooted = true;

/* ============================================================================
   1 · PALETTE + CONSTANTS
   ========================================================================= */

/* The sheet is drawn the way a plate actually gets inked: the printed grid is
   the palest thing on it, the lettering sits mid-weight, and the plotted line
   is the darkest mark on the page because it is the one thing the draftsman
   went over in ink. Hue carries none of that hierarchy — value does. Keeping
   the whole apparatus on one brown-black ramp is what makes it read as ink on
   papyrus rather than as a chart with a highlight colour. */
const C = {
  paper:      new THREE.Color('#E8DCC0'),
  paperLit:   new THREE.Color('#F2E9D6'),
  gridFine:   new THREE.Color('#C9B896'),
  gridMed:    new THREE.Color('#B8A67E'),
  gridHeavy:  new THREE.Color('#A89468'),
  ink:        new THREE.Color('#2B2622'),
  inkSoft:    new THREE.Color('#5A5048'),
  inkFaint:   new THREE.Color('#8A7D6E'),
  accent:     new THREE.Color('#1E1A17'),   // the inked plot — darkest on the sheet
  accentSoft: new THREE.Color('#6E6155'),   // graphite wash, for haloes and fills
};

const RAIL_H    = 3.2;    // rail floats this far above the surface
const CAM_H     = 5.6;    // camera rides this far above the rail
const LOOKAHEAD = 0.011;  // how far down the curve the camera aims

/* Third-person chase. The camera sits back along the curve itself rather
   than along the tangent — following the same path keeps it inherently
   smooth through bends, where a tangent offset would swing. */
const CHASE_T  = 0.016;   // how far behind the cart, in curve parameter
const CHASE_UP = 12.5;    // and how far above the rail

/* ---- pacing -------------------------------------------------------------
   The ride drives itself. LOOP_SECONDS is the master dial: seconds for one
   full circuit at cruise. Near a station it eases to STATION_SLOW of cruise
   so you have time to see the object and click it.

   The two dials are deliberately coupled: the speed the cart actually passes
   a station at is STATION_SLOW / LOOP_SECONDS, so shortening the loop alone
   scales the crawl and the cruise by the same factor and the ride feels no
   different. STATION_SLOW is scaled down with it to hold the station pass
   steady while the transit between stations gets quicker.

   SLOW_WINDOW is the t-radius of each dip. Chess, Markets and Pitch sit only
   ~0.053 apart in t, so at the old 0.040 their dips overlapped outright and
   the trio read as one unbroken crawl. At 0.030 the speed comes back to ~97%
   of cruise between them, without making the approach to a station abrupt. */
const LOOP_SECONDS = 44;
const STATION_SLOW = 0.255;
const SLOW_WINDOW  = 0.030;   // t-radius over which the easing happens

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================================
   2 · THE SCALAR FIELD   f(x,y) = Σ aᵢ·exp(-r²/2σᵢ²)
   ========================================================================= */

const BUMPS = [
  { x:  60, y: -30, a: -17, s: 24 },   // ABOUT   — basin
  { x: 165, y:  35, a:  32, s: 27 },   // RESUME  — summit
  { x: 265, y:  45, a:  24, s: 32 },   // CHESS   — north flank
  { x: 265, y: -60, a:  24, s: 32 },   // CHESS   — south flank
  { x: 375, y:  30, a: -19, s: 25 },   // SOCCER  — basin
  // scenery, mostly along the return leg
  { x: 105, y:-120, a:  15, s: 34 },
  { x: 300, y: 130, a: -11, s: 38 },
  { x: 445, y: -95, a:  12, s: 30 },
  { x:  10, y:  95, a:   9, s: 32 },
  { x: 250, y:-155, a: -13, s: 40 },
  /* ground the cities sit on. Each is far enough off the rail that its
     Gaussian contributes < 0.15 units to the track — the ride does not
     feel them, but the skylines get real terrain to climb out of. */
  { x: -90, y: 100, a:  15, s: 34 },   // BOISE   — foothills
  { x:  60, y: 105, a:  11, s: 30 },   // SEATTLE — Queen Anne rise
  { x: 225, y: 150, a:  -7, s: 36 },   // CHICAGO — lakefront plain
  { x: 395, y: 140, a:  17, s: 30 },   // SEOUL   — Namsan
  { x: 300, y:-250, a:  13, s: 32 },   // SF      — the hills
  { x: 322, y:   9, a:  12, s: 26 },   // MARKETS — a plateau for the floor
];

function fieldH(x, y) {
  let h = 0;
  for (let i = 0; i < BUMPS.length; i++) {
    const b = BUMPS[i];
    const dx = x - b.x, dy = y - b.y;
    h += b.a * Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s));
  }
  return h;
}

function fieldGrad(x, y) {
  let gx = 0, gy = 0;
  for (let i = 0; i < BUMPS.length; i++) {
    const b = BUMPS[i];
    const dx = x - b.x, dy = y - b.y;
    const e = b.a * Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s));
    gx += e * (-dx / (b.s * b.s));
    gy += e * (-dy / (b.s * b.s));
  }
  return { gx, gy };
}

/* ============================================================================
   3 · STATIONS + PATH
   ========================================================================= */

const STATIONS = [
  { id:'about',   label:'About',           sheet:'02', x:  60, y: -30 },
  { id:'resume',  label:'Resume',          sheet:'03', x: 165, y:  35 },
  { id:'chess',   label:'Chess',           sheet:'04', x: 265, y:  -8 },
  { id:'markets', label:'Markets',         sheet:'05', x: 322, y:   9 },
  { id:'soccer',  label:'Pitch Analytics', sheet:'06', x: 375, y:  30 },
  { id:'contact', label:'Contact',         sheet:'07', x: 470, y:   0 },
];

/* The three patches where the paper changes character. Half extents are
   chosen so the X spans never touch: board 243..287, terminal 294..346,
   turf 348..408. A fragment can only ever be inside one of them. */
const ZONE_CHESS = { x: 265, y:  -8, w: 22,   d: 22   };
const ZONE_MKT   = { x: 320, y:   6, w: 26,   d: 19   };
const ZONE_PITCH = { x: 378, y:  32, w: 30,   d: 19.5 };

/* A closed circuit: out along the stations, home along the south.
   The between-station points sit near the straight line joining their
   neighbours rather than overshooting past them — overshoot is what turns a
   gentle curve into an S-bend, and S-bends are what the rider feels as jerk. */
const PATH_XY = [
  [ -55,    0],
  [  -2,  -14],
  [  60,  -30],   // ABOUT
  [ 112,    2],
  [ 165,   35],   // RESUME
  [ 216,   16],
  [ 265,   -8],   // CHESS
  [ 322,    9],
  [ 375,   30],   // SOCCER
  [ 428,   19],
  [ 470,    0],   // CONTACT
  [ 522,  -38],
  [ 502, -100],
  [ 404, -140],
  [ 280, -150],
  [ 158, -140],
  [  58, -118],
  [ -30,  -80],
  [ -72,  -40],
];

/* ============================================================================
   4 · STATE
   ========================================================================= */

const $ = (s) => document.querySelector(s);

let renderer, scene, camera, clock;
let curve, curveLen;
let paperUniforms;
let chessBars = null;
let cart = null;

const stationGroups = {};

let t = 0;                    // parameter along the closed curve, wraps at 1
let mode = 'idle';            // idle | ride | focusing | focused | releasing
let focusStation = null;
let tween = null;
let hoverStation = null;
let audioBass = 0;
let cruise = 0;               // eased speed multiplier, for the HUD

const pointer = new THREE.Vector2(-2, -2);
const raycaster = new THREE.Raycaster();

const wrapDelta = (a, b) => {
  let d = a - b;
  if (d >  0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
};

/* ============================================================================
   5 · BOOTSTRAP
   ========================================================================= */

function init() {
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
  } catch (err) {
    $('#nowebgl').classList.add('is-live');
    $('#gate').classList.add('is-gone');
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#D8CBAA');
  // matched to the haze ramp in PAPER_FRAG; long enough that the themed
  // zones are picked out from the far end of the sheet
  scene.fog = new THREE.Fog(0xD8CBAA, 190, 560);

  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 1200);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  $('#webgl').appendChild(renderer.domElement);

  clock = new THREE.Clock();

  buildCurve();
  buildPaper();
  buildAxes();
  buildRail();
  buildCart();
  buildStations();
  buildCities();
  buildWaves();
  buildTape();
  buildRailNav();
  lighting();
  bindEvents();
  initExpandableCards();
  initTickerCards();
  initResumeDeck();
  initPitch();
  primeAudio();          // load the file now, so the launch click can just play it
  fetchLichess();

  placeCameraAt(0);
  buildDrift();          // needs the camera already placed, to seed positions
  renderer.setAnimationLoop(frame);
}

/* ============================================================================
   6 · CURVE
   ========================================================================= */

function buildCurve() {
  const pts = PATH_XY.map(([x, y]) => new THREE.Vector3(x, fieldH(x, y) + RAIL_H, y));
  curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  curveLen = curve.getLength();

  const N = 2400;
  const samples = [];
  for (let i = 0; i < N; i++) samples.push(curve.getPoint(i / N));

  STATIONS.forEach((st) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < N; i++) {
      const p = samples[i];
      const d = (p.x - st.x) ** 2 + (p.z - st.y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    st.t = best / N;
    st.h = fieldH(st.x, st.y);
  });
}

const railPoint = (u) => curve.getPoint(((u % 1) + 1) % 1);
const railTangent = (u) => curve.getTangent(((u % 1) + 1) % 1);

/** 1 at cruise, easing to STATION_SLOW right at a station. */
function speedFactor(u) {
  let m = 1;
  for (const st of STATIONS) {
    const d = Math.abs(wrapDelta(u, st.t));
    if (d < SLOW_WINDOW) {
      const k = d / SLOW_WINDOW;                 // 0 at station, 1 at edge
      const eased = k * k * (3 - 2 * k);         // smoothstep
      m = Math.min(m, STATION_SLOW + (1 - STATION_SLOW) * eased);
    }
  }
  return m;
}

/* ============================================================================
   7 · PAPER SURFACE
   ========================================================================= */

const PAPER_VERT = /* glsl */`
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vHeight;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vHeight = position.y;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const PAPER_FRAG = /* glsl */`
  precision highp float;

  uniform vec3  uPaper, uPaperLit, uFine, uMed, uHeavy, uAccent, uInkFaint;
  uniform vec3  uCam;
  uniform float uBass;
  uniform float uTime;

  /* Themed regions of the sheet. xy = centre in world XZ, zw = half extents.
     The rest of the drawing stays plain engineering paper; these are the only
     places it changes character. */
  uniform vec4  uZoneChess;
  uniform vec4  uZoneMkt;
  uniform vec4  uZonePitch;

  varying vec3  vWorld;
  varying vec3  vNormalW;
  varying float vHeight;

  float hash(vec2 p){
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  float grid(vec2 p, float scale, float w){
    vec2 c = p / scale;
    vec2 d = fwidth(c);
    vec2 g = abs(fract(c - 0.5) - 0.5) / max(d, vec2(1e-5));
    return 1.0 - smoothstep(0.0, w, min(g.x, g.y));
  }

  /* ---- zone drawing kit -------------------------------------------------
     Everything below takes an explicit px (world units per screen pixel)
     instead of calling fwidth() itself. The zone work happens inside if()
     blocks, and derivatives taken in non-uniform control flow are undefined
     in GLSL ES — a quad straddling a zone edge would get a garbage width.
     px is measured once up in uniform flow and handed down.               */

  float sdBox(vec2 p, vec2 h){
    vec2 d = abs(p) - h;
    return min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0)));
  }
  float sdRound(vec2 p, vec2 h, float r){ return sdBox(p, h - r) - r; }

  /* A drawn line of half-width w, softened by exactly one pixel. Because it
     widens with px, a marking stays visible when it is a long way off
     instead of dissolving into shimmer. */
  float strip(float sd, float w, float px){
    float aa = max(px, 1e-4);
    return 1.0 - smoothstep(w, w + aa * 1.4, abs(sd));
  }
  float dot2(vec2 p, float r, float px){
    return 1.0 - smoothstep(r, r + max(px, 1e-4) * 1.4, length(p));
  }
  float gridA(vec2 q, float scale, float w, float px){
    vec2 c = q / scale;
    float d = max(px / scale, 1e-5);
    vec2 g = abs(fract(c - 0.5) - 0.5) / d;
    return 1.0 - smoothstep(0.0, w, min(g.x, g.y));
  }
  /* Hard two-tone patterns alias into noise once a cell is near pixel size.
     Collapsing them toward their own average keeps a distant board reading
     as one calm dark patch rather than a field of sparkle. */
  float tame(float v, float cell, float px){
    return mix(0.5, v, 1.0 - smoothstep(0.30, 1.30, px / cell));
  }

  void main(){
    vec2 p = vWorld.xz;
    float dist = length(vWorld - uCam);

    float fiber  = fbm(p * 2.6);
    float mottle = fbm(p * 0.16);
    vec3 base = mix(uPaper, uPaperLit, mottle * 0.55 + fiber * 0.18);

    float fadeFine = 1.0 - smoothstep(45.0, 130.0, dist);
    float fadeMed  = 1.0 - smoothstep(140.0, 340.0, dist);

    float gF = grid(p, 1.0,  1.15) * fadeFine;
    float gM = grid(p, 5.0,  1.25) * fadeMed;
    float gH = grid(p, 10.0, 1.45);

    float bite = 0.80 + 0.20 * fiber;

    vec3 col = base;
    col = mix(col, uFine,  gF * 0.50 * bite);
    col = mix(col, uMed,   gM * 0.58 * bite);
    col = mix(col, uHeavy, gH * 0.70 * bite);

    // principal axes in red pencil
    vec2 ax = abs(p);
    vec2 axd = fwidth(p);
    float axis = clamp(
      (1.0 - smoothstep(0.0, axd.y * 2.2, ax.y)) +
      (1.0 - smoothstep(0.0, axd.x * 2.2, ax.x)), 0.0, 1.0) * fadeMed;
    col = mix(col, uAccent, axis * 0.50);

    /* ---- THEMED ZONES --------------------------------------------------
       Three patches where the sheet stops being plain graph paper. Edges are
       crisp with a ruled border rather than a soft fade, so each one reads as
       a panel taped down onto the drawing. zoneMask is carried to the fog
       step below to keep them legible from clear across the sheet.        */
    float px = max(fwidth(p.x), fwidth(p.y));
    float zoneMask = 0.0;

    // ---- CHESS: a board, 8 squares to a side ----
    {
      vec2 lp = p - uZoneChess.xy;
      float sd = sdBox(lp, uZoneChess.zw);
      float w  = 1.0 - smoothstep(-1.0, 0.6, sd);
      if (w > 0.002) {
        float cell = uZoneChess.z * 0.25;                  // 8 files across
        float sq = mod(floor(lp.x / cell) + floor(lp.y / cell), 2.0);
        sq = tame(sq, cell, px);
        vec3 c = mix(vec3(0.949, 0.918, 0.847), vec3(0.113, 0.101, 0.094), sq);
        c *= 0.90 + 0.20 * fiber;                          // paper tooth survives
        c = mix(c, vec3(0.45, 0.40, 0.36), strip(sd + 1.1, 0.30, px) * 0.85);
        c = mix(c, uAccent, strip(sd + 2.6, 0.34, px) * 0.75);
        col = mix(col, c, w);
        zoneMask = max(zoneMask, w);
      }
    }

    // ---- MARKETS: a terminal panel, green above the line and red below ----
    {
      vec2 lp = p - uZoneMkt.xy;
      float sd = sdBox(lp, uZoneMkt.zw);
      float w  = 1.0 - smoothstep(-1.0, 0.6, sd);
      if (w > 0.002) {
        vec3 c = vec3(0.043, 0.071, 0.063);
        float zl = clamp(lp.y / uZoneMkt.w, -1.0, 1.0);
        c = mix(c, vec3(0.055, 0.129, 0.090), clamp( zl, 0.0, 1.0) * 0.80);
        c = mix(c, vec3(0.141, 0.055, 0.051), clamp(-zl, 0.0, 1.0) * 0.80);

        c = mix(c, vec3(0.106, 0.267, 0.184), gridA(lp, 3.5,  1.2, px) * 0.55);
        c = mix(c, vec3(0.184, 0.427, 0.298), gridA(lp, 17.5, 1.5, px) * 0.80);
        c = mix(c, vec3(0.760, 0.820, 0.730), strip(lp.y, 0.34, px) * 0.60);

        // a scan bar sweeping the panel, so the region reads as live from afar
        float sx = mix(-uZoneMkt.z, uZoneMkt.z, fract(uTime * 0.085));
        c += vec3(0.055, 0.150, 0.098) * (1.0 - smoothstep(0.0, 6.0, abs(lp.x - sx)));

        c = mix(c, vec3(0.239, 0.600, 0.404), strip(sd + 1.6, 0.34, px) * 0.9);
        col = mix(col, c, w);
        zoneMask = max(zoneMask, w);
      }
    }

    // ---- PITCH: mown turf with the markings drawn to FIFA proportions ----
    {
      vec2 lp = p - uZonePitch.xy;
      float sd = sdRound(lp, uZonePitch.zw, 2.5);
      float w  = 1.0 - smoothstep(-1.0, 0.6, sd);
      if (w > 0.002) {
        vec2 hp = uZonePitch.zw - vec2(3.0, 2.0);          // lines inset from the turf
        float band = hp.x * 0.25;
        float stripe = tame(mod(floor(lp.x / band), 2.0), band, px);
        vec3 c = mix(vec3(0.239, 0.427, 0.298), vec3(0.290, 0.502, 0.353), stripe);
        c *= 0.90 + 0.20 * fbm(p * 3.1);                   // turf mottle

        /* 54 x 35 units stands in for 105 x 68 m, so every real dimension
           below is metres * 0.514. */
        float k = hp.x / 52.5;
        float m = strip(sdBox(lp, hp), 0.32, px);                        // touch + goal lines
        m = max(m, strip(lp.x, 0.32, px) * (1.0 - step(hp.y, abs(lp.y)))); // halfway
        m = max(m, strip(length(lp) - 9.15 * k, 0.32, px));               // centre circle
        m = max(m, dot2(lp, 0.45, px));                                   // centre spot

        for (int s = 0; s < 2; s++) {
          float sgn = s == 0 ? 1.0 : -1.0;
          vec2 goal = vec2(sgn * hp.x, 0.0);
          vec2 pen  = goal - vec2(sgn * 11.0 * k, 0.0);
          m = max(m, strip(sdBox(lp - goal + vec2(sgn * 16.5 * k * 0.5, 0.0),
                                 vec2(16.5 * k * 0.5, 20.15 * k)), 0.32, px));
          m = max(m, strip(sdBox(lp - goal + vec2(sgn * 5.5 * k * 0.5, 0.0),
                                 vec2(5.5 * k * 0.5, 9.16 * k)), 0.32, px));
          m = max(m, dot2(lp - pen, 0.45, px));
          // the D, clipped to the part outside the penalty area
          float arc = strip(length(lp - pen) - 9.15 * k, 0.32, px);
          m = max(m, arc * step(abs(lp.x), hp.x - 16.5 * k));
        }
        c = mix(c, vec3(0.945, 0.957, 0.925), clamp(m, 0.0, 1.0) * 0.90);
        c = mix(c, vec3(0.945, 0.957, 0.925), strip(sd + 1.4, 0.28, px) * 0.45);
        col = mix(col, c, w);
        zoneMask = max(zoneMask, w);
      }
    }

    // crease shading from surface orientation
    float slope = 1.0 - clamp(vNormalW.y, 0.0, 1.0);
    col *= 1.0 - slope * 0.32;

    /* Height tinting and topo banding are paper effects — hold them back
       inside a zone or the tan bleeds into the turf and the terminal. */
    float pw = 1.0 - zoneMask * 0.85;
    float hN = clamp(vHeight / 30.0, -1.0, 1.0);
    col = mix(col, col * vec3(0.86, 0.79, 0.66), clamp(-hN, 0.0, 1.0) * 0.40 * pw);
    col = mix(col, mix(col, uPaperLit, 0.35), clamp(hN, 0.0, 1.0) * 0.52 * pw);

    // faint topo banding
    float cband = grid(vec2(vHeight, vHeight), 4.0, 1.1);
    col = mix(col, uInkFaint, cband * 0.05 * fadeMed * pw);

    vec3 L = normalize(vec3(-0.42, 0.82, -0.38));
    float ndl = clamp(dot(normalize(vNormalW), L), 0.0, 1.0);
    float hemi = 0.62 + 0.38 * clamp(vNormalW.y * 0.5 + 0.5, 0.0, 1.0);
    col *= (0.58 + 0.52 * ndl) * hemi;

    col *= 1.0 + uBass * 0.075;

    /* The zones are meant to be landmarks — you should pick out the board,
       the terminal and the pitch from the far end of the sheet and watch
       them resolve as you close. So haze recedes over a longer run than it
       used to, and inside a zone it is pulled back further still. */
    float haze = smoothstep(190.0, 560.0, dist) * (1.0 - zoneMask * 0.55);
    col = mix(col, vec3(0.847, 0.796, 0.667), haze);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function buildPaper() {
  const W = 820, D = 640, SEG = 340;
  const geo = new THREE.PlaneGeometry(W, D, SEG, Math.round(SEG * D / W));
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const OX = 215, OZ = -35;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + OX;
    const z = pos.getZ(i) + OZ;
    pos.setX(i, x);
    pos.setZ(i, z);
    pos.setY(i, fieldH(x, z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  paperUniforms = {
    uPaper:    { value: C.paper },
    uPaperLit: { value: C.paperLit },
    uFine:     { value: C.gridFine },
    uMed:      { value: C.gridMed },
    uHeavy:    { value: C.gridHeavy },
    uAccent:   { value: C.accent },
    uInkFaint: { value: C.inkFaint },
    uCam:      { value: new THREE.Vector3() },
    uBass:     { value: 0 },
    uTime:     { value: 0 },
    /* xy = centre, zw = half extents. Kept apart from one another in X so no
       two zones can overlap and fight over the same fragment. */
    uZoneChess: { value: new THREE.Vector4(ZONE_CHESS.x, ZONE_CHESS.y, ZONE_CHESS.w, ZONE_CHESS.d) },
    uZoneMkt:   { value: new THREE.Vector4(ZONE_MKT.x,   ZONE_MKT.y,   ZONE_MKT.w,   ZONE_MKT.d) },
    uZonePitch: { value: new THREE.Vector4(ZONE_PITCH.x, ZONE_PITCH.y, ZONE_PITCH.w, ZONE_PITCH.d) },
  };

  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: paperUniforms,
    vertexShader: PAPER_VERT,
    fragmentShader: PAPER_FRAG,
  }));
  mesh.frustumCulled = false;
  scene.add(mesh);
}

/* ============================================================================
   7b · THE PRINCIPAL AXES
   Drawn as bold ribbons that lie on the paper and follow its relief, plus a
   true vertical Z staff at the origin. Ribbons rather than lines because
   WebGL caps line width at 1px on most platforms — geometry is the only way
   to get an axis you can actually see from a distance.
   ========================================================================= */

const AXIS_W = 1.15;    // half-width of the ribbon, world units

/** A flat ribbon laid on the surface, running along X or Z. */
function axisRibbon(from, to, fixed, along, color, lift = 0.30) {
  const STEPS = 320;
  const pos = [];
  const idx = [];

  for (let i = 0; i <= STEPS; i++) {
    const u = from + (to - from) * (i / STEPS);
    const x = along === 'x' ? u : fixed;
    const z = along === 'x' ? fixed : u;
    const y = fieldH(x, z) + lift;

    if (along === 'x') {
      pos.push(x, y, z - AXIS_W, x, y, z + AXIS_W);
    } else {
      pos.push(x - AXIS_W, y, z, x + AXIS_W, y, z);
    }
    if (i < STEPS) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, transparent: true, opacity: 0.92,
  }));
}

/** Graduated ticks along an axis, drawn on the paper. */
function axisTicks(from, to, fixed, along, step, color) {
  const pts = [];
  const start = Math.ceil(from / step) * step;
  for (let u = start; u <= to; u += step) {
    if (Math.abs(u) < 1e-6) continue;                 // skip the origin
    const major = Math.abs(u % (step * 5)) < 1e-6;
    const L = major ? 4.2 : 2.2;
    const x = along === 'x' ? u : fixed;
    const z = along === 'x' ? fixed : u;
    const y = fieldH(x, z) + 0.36;
    if (along === 'x') pts.push(new THREE.Vector3(x, y, z - L), new THREE.Vector3(x, y, z + L));
    else               pts.push(new THREE.Vector3(x - L, y, z), new THREE.Vector3(x + L, y, z));
  }
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })
  );
}

/** A big letter sprite: X, Y or Z. */
function axisLabel(letter, color) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(242,233,214,0.92)';
  g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
  g.strokeStyle = color; g.lineWidth = 6;
  g.beginPath(); g.arc(64, 64, 60, 0, 7); g.stroke();
  g.fillStyle = color;
  g.font = '700 78px "Barlow Condensed", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(letter, 64, 68);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(11, 11, 1);
  return spr;
}

function buildAxes() {
  /* Three axes, one ink. They separate by weight rather than hue — X full
     strength, Y and Z stepped back — so the sheet stays monochrome and the
     letterheads at the ends do the actual identifying. */
  const AX = C.accent;                        // X — full-strength ink
  const AY = new THREE.Color('#3B342D');      // Y — one step back
  const AZ = new THREE.Color('#544A40');      // Z — two steps back

  const X0 = -170, X1 = 585;
  const Y0 = -285, Y1 = 205;
  const Z1 = 62;

  // ---- X and Y lie on the sheet ----
  scene.add(axisRibbon(X0, X1, 0, 'x', AX));
  scene.add(axisTicks(X0, X1, 0, 'x', 10, AX));

  scene.add(axisRibbon(Y0, Y1, 0, 'z', AY));
  scene.add(axisTicks(Y0, Y1, 0, 'z', 10, AY));

  // ---- Z stands vertically at the origin ----
  const h0 = fieldH(0, 0);
  const zAxis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, Z1, 10),
    new THREE.MeshBasicMaterial({ color: AZ, transparent: true, opacity: 0.9 })
  );
  zAxis.position.set(0, h0 + Z1 / 2, 0);
  scene.add(zAxis);

  const zTicks = [];
  for (let h = 10; h <= Z1; h += 10) {
    zTicks.push(new THREE.Vector3(-3.4, h0 + h, 0), new THREE.Vector3(3.4, h0 + h, 0));
  }
  scene.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(zTicks),
    new THREE.LineBasicMaterial({ color: AZ, transparent: true, opacity: 0.75 })
  ));

  // ---- arrowheads ----
  const head = (color, pos, rot) => {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 8, 14),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    m.position.copy(pos);
    m.rotation.set(...rot);
    scene.add(m);
  };
  head(AX, new THREE.Vector3(X1, fieldH(X1, 0) + 0.3, 0), [0, 0, -Math.PI / 2]);
  head(AY, new THREE.Vector3(0, fieldH(0, Y1) + 0.3, Y1), [Math.PI / 2, 0, 0]);
  head(AZ, new THREE.Vector3(0, h0 + Z1 + 3, 0), [0, 0, 0]);

  // ---- letters ----
  const lx = axisLabel('X', '#1E1A17');
  lx.position.set(X1 - 16, fieldH(X1, 0) + 12, 0);
  scene.add(lx);

  const ly = axisLabel('Y', '#3B342D');
  ly.position.set(0, fieldH(0, Y1) + 12, Y1 - 16);
  scene.add(ly);

  const lz = axisLabel('Z', '#544A40');
  lz.position.set(0, h0 + Z1 + 12, 0);
  scene.add(lz);

  // ---- a plaque at the origin ----
  const o = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.4, 40),
    new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  o.rotation.x = -Math.PI / 2;
  o.position.set(0, h0 + 0.45, 0);
  scene.add(o);
}

/* ============================================================================
   8 · THE PLOTTED CURVE
   ========================================================================= */

/** The cart: a single point riding the plotted line. */
function buildCart() {
  cart = new THREE.Group();

  const sphere = new THREE.SphereGeometry(1.5, 20, 14);
  cart.add(new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: C.accent })));
  cart.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.SphereGeometry(1.5, 10, 7)),
    new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.55 })
  ));

  // a flat halo so the point still reads against the paper from above
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 2.95, 36),
    new THREE.MeshBasicMaterial({
      color: C.accentSoft, side: THREE.DoubleSide, transparent: true, opacity: 0.6,
    })
  );
  halo.rotation.x = -Math.PI / 2;
  cart.add(halo);
  cart.userData.halo = halo;

  // dropped marker showing where it sits on the sheet below
  const drop = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -RAIL_H, 0),
    ]),
    new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0.5 })
  );
  cart.add(drop);

  scene.add(cart);
}

function buildRail() {
  const N = 1600;
  const railPts = [], shadowPts = [];
  for (let i = 0; i <= N; i++) {
    const p = curve.getPoint((i / N) % 1);
    railPts.push(p.clone());
    shadowPts.push(new THREE.Vector3(p.x, fieldH(p.x, p.z) + 0.18, p.z));
  }

  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(railPts),
    new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0.9 })
  ));

  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(shadowPts),
    new THREE.LineBasicMaterial({ color: C.inkSoft, transparent: true, opacity: 0.34 })
  ));

  // ties, sparse enough to read as drafting rather than noise
  const tie = [];
  for (let i = 0; i <= N; i += 20) {
    const p = railPts[i];
    tie.push(p.clone(), new THREE.Vector3(p.x, fieldH(p.x, p.z), p.z));
  }
  scene.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(tie),
    new THREE.LineBasicMaterial({ color: C.inkFaint, transparent: true, opacity: 0.26 })
  ));
}

/* ============================================================================
   9 · STATION OBJECTS
   ========================================================================= */

function labelSprite(text, sub) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 160;
  const g = cv.getContext('2d');

  g.fillStyle = 'rgba(242,233,214,0.95)';
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#2B2622'; g.lineWidth = 5;
  g.strokeRect(2, 2, 508, 156);

  g.fillStyle = '#2B2622';
  g.font = '600 62px "Barlow Condensed", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(text.toUpperCase(), 26, 58);

  g.fillStyle = '#5A5048';
  g.font = '400 26px "Roboto Mono", monospace';
  g.fillText(sub.toUpperCase(), 26, 118);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(20, 6.25, 1);
  return spr;
}

function stationMarker() {
  const g = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.0, 3.35, 64),
    new THREE.MeshBasicMaterial({ color: C.accent, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);

  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 4.7, 64),
    new THREE.MeshBasicMaterial({ color: C.accentSoft, side: THREE.DoubleSide, transparent: true, opacity: 0.42 })
  );
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.22;
  g.add(ring2);

  g.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(0, 14, 0),
    ]),
    new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0.45 })
  ));

  return g;
}

/** A generous invisible sphere so the object is easy to click. */
function hitProxy() {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(10, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  m.position.y = 10;
  return m;
}

function buildStations() {
  const builders = {
    about: objAbout, resume: objResume, chess: objChess,
    markets: objMarkets, soccer: objSoccer, contact: objContact,
  };

  STATIONS.forEach((st) => {
    const grp = new THREE.Group();
    grp.position.set(st.x, st.h, st.y);

    grp.add(stationMarker());
    grp.add(hitProxy());

    const art = builders[st.id]();
    art.position.y = 10;
    grp.add(art);
    grp.userData.art = art;

    const lab = labelSprite(st.label, `Sheet ${st.sheet}`);
    lab.position.y = 19.5;
    grp.add(lab);
    grp.userData.label = lab;

    grp.userData.station = st;
    st.group = grp;
    scene.add(grp);
    stationGroups[st.id] = grp;
  });
}

/* ---------- ABOUT: the favicon clownfish ---------- */
function objAbout() {
  const g = new THREE.Group();
  const BODY = 'M10 18c0-7.2 7.8-13 18-13 5.5 0 10.5 1.8 13.8 4.7L50 6v24l-8.2-3.8C38.5 29.2 33.5 31 28 31 17.8 31 10 25.2 10 18Z';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${BODY}"/></svg>`;

  try {
    const paths = new SVGLoader().parse(svg).paths;
    const shapes = [];
    paths.forEach((p) => SVGLoader.createShapes(p).forEach((s) => shapes.push(s)));

    const geo = new THREE.ExtrudeGeometry(shapes, { depth: 6, bevelEnabled: false, curveSegments: 14 });
    geo.center();
    geo.scale(0.34, -0.34, 0.34);

    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: C.accentSoft, transparent: true, opacity: 0.30,
    })));
    g.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 24),
      new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.92 })
    ));
  } catch (err) {
    g.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(5, 1)),
      new THREE.LineBasicMaterial({ color: C.ink })
    ));
  }

  g.userData.swim = true;
  return g;
}

/* ---------- RESUME: fanned vellum + orbiting silicon wafer ---------- */
function objResume() {
  const g = new THREE.Group();
  const N = 5;

  for (let i = 0; i < N; i++) {
    const plane = new THREE.PlaneGeometry(7.6, 9.8);
    const sh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
      color: C.paperLit, transparent: true, opacity: 0.34,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    sh.position.set(i * 0.66 - 1.4, i * 0.36 - 0.8, -i * 1.15 + 2.4);
    sh.rotation.z = (i - N / 2) * 0.05;
    g.add(sh);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(plane),
      new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.55 })
    );
    edge.position.copy(sh.position);
    edge.rotation.copy(sh.rotation);
    g.add(edge);
  }

  const wafer = new THREE.Group();
  wafer.add(new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 72),
    new THREE.MeshBasicMaterial({ color: '#8FA3B0', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  ));
  wafer.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      new THREE.EllipseCurve(0, 0, 3.6, 3.6, 0, Math.PI * 2).getPoints(72)
        .map((p) => new THREE.Vector3(p.x, p.y, 0))
    ),
    new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.85 })
  ));

  const die = [];
  for (let i = -4; i <= 4; i++) {
    const q = Math.sqrt(Math.max(0, 3.6 * 3.6 - (i * 0.8) ** 2));
    die.push(new THREE.Vector3(i * 0.8, -q, 0.01), new THREE.Vector3(i * 0.8, q, 0.01));
    die.push(new THREE.Vector3(-q, i * 0.8, 0.01), new THREE.Vector3(q, i * 0.8, 0.01));
  }
  wafer.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(die),
    new THREE.LineBasicMaterial({ color: '#4E6B7C', transparent: true, opacity: 0.6 })
  ));

  wafer.position.set(7.6, 1.4, 0);
  g.add(wafer);
  g.userData.wafer = wafer;
  return g;
}

/* ---------- CHESS: board with ratings extruded as bars ---------- */
function objChess() {
  const g = new THREE.Group();
  const SQ = 1.1;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue;
      const sq = new THREE.Mesh(
        new THREE.PlaneGeometry(SQ, SQ),
        new THREE.MeshBasicMaterial({ color: C.gridHeavy, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      sq.rotation.x = -Math.PI / 2;
      sq.position.set((c - 3.5) * SQ, 0, (r - 3.5) * SQ);
      g.add(sq);
    }
  }
  g.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(SQ * 8, 0.001, SQ * 8)),
    new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.85 })
  ));

  chessBars = new THREE.Group();
  ['bullet', 'blitz', 'rapid', 'classical', 'puzzle'].forEach((fmt, i) => {
    const box = new THREE.BoxGeometry(0.8, 1, 0.8);
    const bar = new THREE.Mesh(box, new THREE.MeshBasicMaterial({
      color: C.accent, transparent: true, opacity: 0.7,
    }));
    bar.position.set((i - 2) * 1.65, 0.5, 0);
    bar.userData.format = fmt;
    bar.userData.target = 2.4;
    bar.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.7 })
    ));
    chessBars.add(bar);
  });
  g.add(chessBars);

  return g;
}

/* ---------- SOCCER: pitch with the zone model extruded in z ---------- */
function objSoccer() {
  const g = new THREE.Group();
  const W = 11.5, D = 8.8;

  const cv = document.createElement('canvas');
  cv.width = 500; cv.height = 380;
  const x = cv.getContext('2d');
  x.fillStyle = 'rgba(242,233,214,0.9)'; x.fillRect(0, 0, 500, 380);
  x.strokeStyle = '#2B2622'; x.lineWidth = 3;
  x.strokeRect(10, 10, 480, 360);
  x.lineWidth = 2;
  x.strokeRect(165, 10, 170, 45);
  x.strokeRect(105, 10, 290, 125);
  x.fillStyle = '#2B2622';
  x.beginPath(); x.arc(250, 100, 3, 0, 7); x.fill();
  x.beginPath(); x.arc(250, 135, 75, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
  x.beginPath(); x.arc(250, 370, 70, Math.PI, 2 * Math.PI); x.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  );
  pitch.rotation.x = -Math.PI / 2;
  g.add(pitch);

  const ZONES = [
    { x:  0.00, z: -0.78, w: 0.92 },
    { x:  0.00, z: -0.42, w: 0.78 },
    { x:  0.00, z:  0.02, w: 0.54 },
    { x: -0.78, z: -0.18, w: 0.41 },
    { x:  0.78, z: -0.18, w: 0.38 },
    { x:  0.00, z:  0.62, w: 0.22 },
  ];

  const surf = new THREE.PlaneGeometry(W, D, 40, 40);
  surf.rotateX(-Math.PI / 2);
  const pos = surf.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) / W, pz = pos.getZ(i) / D;
    let h = 0;
    ZONES.forEach((z) => {
      const dx = px - z.x * 0.5, dz = pz - z.z * 0.5;
      h += z.w * Math.exp(-(dx * dx + dz * dz) / (2 * 0.028));
    });
    pos.setY(i, h * 3.3 + 0.14);
  }
  pos.needsUpdate = true;

  g.add(new THREE.Mesh(surf, new THREE.MeshBasicMaterial({
    color: C.accent, wireframe: true, transparent: true, opacity: 0.5,
  })));

  return g;
}

/* ============================================================================
   MARKETS — the semiconductor tape
   ========================================================================= */

const MKT_UP   = '#3FA36B';
const MKT_DOWN = '#C0433A';
const MKT_DIM  = '#16241E';

/* The names I actually follow, and where each one sits in the chain that
   turns sand into a die. The order is the order of the rows on the floor. */
const TICKERS = [
  { sym:'MU',   role:'Memory — DRAM and NAND' },
  { sym:'INTC', role:'Logic, and a foundry in the making' },
  { sym:'LRCX', role:'Etch — taking material away' },
  { sym:'AMAT', role:'Deposition — putting material down' },
  { sym:'KLAC', role:'Process control — finding the defect' },
  { sym:'ASML', role:'Lithography — the only EUV there is' },
  { sym:'NVDA', role:'Accelerators — where the demand starts' },
];

/* A deterministic walk per ticker. This is a procedural animation, NOT market
   data — no quote is ever shown against it, precisely so nothing on the page
   can be mistaken for a real price. seed/rnd keep it identical every load, so
   the floor looks like a place rather than a fresh shuffle each visit. */
const SERIES_LEN = 128;

function walk(seed) {
  let s = seed, v = 0.5;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out = [];
  for (let i = 0; i < SERIES_LEN; i++) {
    v += (rnd() - 0.5) * 0.22 + (0.5 - v) * 0.06;   // drift back toward the middle
    v = Math.min(0.97, Math.max(0.03, v));
    out.push(v);
  }
  return out;
}

TICKERS.forEach((tk, i) => { tk.series = walk(9781 + i * 613); });

/* ---------- the floor: instanced columns marching along X ---------- */

const TAPE_N     = 21;     // columns visible per row at any moment
const TAPE_SP    = 2.35;   // spacing between them, world units
const TAPE_SPEED = 1.5;    // world units per second — one column every ~1.6s
const ROW_GAP    = 4.9;

let tape = null;

function buildTape() {
  const rows = TICKERS.length;
  const count = rows * TAPE_N;

  const body = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.45, 1, 1.45),
    new THREE.MeshLambertMaterial({ vertexColors: false }),
    count
  );
  const wick = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.2, 1, 0.2),
    new THREE.MeshLambertMaterial({ color: '#7E8F86' }),
    count
  );
  body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  body.frustumCulled = false;
  wick.frustumCulled = false;
  scene.add(body, wick);

  // one plaque per row, hovering over the head of its column of columns
  const plaques = TICKERS.map((tk, r) => {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tickerPlaque(tk.sym, true), transparent: true, depthWrite: false,
    }));
    spr.scale.set(7.4, 2.6, 1);
    spr.userData = {
      up: tickerPlaque(tk.sym, true),
      down: tickerPlaque(tk.sym, false),
      last: null,
      phase: r * 1.37,
    };
    scene.add(spr);
    return spr;
  });

  /* The tape starts just inside the left edge of the panel and ends just
     inside the right, so the run of columns reads as belonging to it. The
     oldest column does slide off the left edge mid-scroll, which is the
     correct look for something running off the end of the paper. */
  tape = { body, wick, plaques, scroll: 0, rows, x0: ZONE_MKT.x - ZONE_MKT.w + 2.5 };
}

/** Two textures per ticker so direction is a map swap, never a per-frame redraw. */
function tickerPlaque(sym, up) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 90;
  const g = cv.getContext('2d');
  const tone = up ? '#4FBE7E' : '#D9564B';

  g.fillStyle = 'rgba(8,16,13,0.90)';
  g.fillRect(0, 0, 256, 90);
  g.strokeStyle = tone; g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 86);

  g.fillStyle = tone;
  g.font = '700 46px "Barlow Condensed", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(sym, 18, 46);

  g.beginPath();                                     // the direction caret
  if (up) { g.moveTo(216, 32); g.lineTo(236, 32); g.lineTo(226, 16); }
  else    { g.moveTo(216, 58); g.lineTo(236, 58); g.lineTo(226, 74); }
  g.closePath(); g.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

const _m4 = new THREE.Matrix4();
const _cUp = new THREE.Color(MKT_UP);
const _cDn = new THREE.Color(MKT_DOWN);
const _cDim = new THREE.Color(MKT_DIM);
const _cTmp = new THREE.Color();   // scratch: setColorAt runs 154x a frame

function updateTape(dt, now) {
  if (!tape) return;

  tape.scroll += dt * TAPE_SPEED;

  /* Scrolling trick: slide every column left by the fractional part of a slot,
     and shift the data index by the whole part. When `off` rolls past 1 the
     positions snap back one slot at the same instant the data steps forward
     one sample, and the two cancel — so the tape runs smoothly instead of
     ticking, without ever reallocating anything. */
  const frac = tape.scroll / TAPE_SP;
  const base = Math.floor(frac);
  const off  = frac - base;

  let i = 0;
  for (let r = 0; r < tape.rows; r++) {
    const tk = TICKERS[r];
    const z = ZONE_MKT.y + (r - (tape.rows - 1) / 2) * ROW_GAP;
    let head = 0.5, headUp = true;

    for (let c = 0; c < TAPE_N; c++, i++) {
      const x = tape.x0 + (c - off) * TAPE_SP;
      const k = (base + c) % SERIES_LEN;
      const v = tk.series[k];
      const prev = tk.series[(k + SERIES_LEN - 1) % SERIES_LEN];
      const up = v >= prev;

      const h = 0.7 + v * 8.2;
      const g = fieldH(x, z);

      _m4.makeScale(1, h, 1);
      _m4.setPosition(x, g + h / 2, z);
      tape.body.setMatrixAt(i, _m4);

      const wh = 0.5 + Math.abs(v - prev) * 9;       // the day's reach past the close
      _m4.makeScale(1, wh, 1);
      _m4.setPosition(x, g + h + wh / 2, z);
      tape.wick.setMatrixAt(i, _m4);

      /* Columns dim toward the back of the tape so the leading edge — the
         part that is actually moving — is what the eye lands on. */
      const fade = 0.35 + 0.65 * (c / (TAPE_N - 1));
      tape.body.setColorAt(i, _cTmp.copy(_cDim).lerp(up ? _cUp : _cDn, fade));

      if (c === TAPE_N - 1) { head = v; headUp = up; }
    }

    // the plaque rides above the leading column, bobbing on its own phase
    const spr = tape.plaques[r];
    const ph = spr.userData.phase;
    const hx = tape.x0 + (TAPE_N - 1 - off) * TAPE_SP + 5.5 + Math.sin(now * 0.5 + ph) * 1.1;
    const hz = z + Math.cos(now * 0.37 + ph) * 1.4;
    spr.position.set(hx, fieldH(hx, hz) + 6.5 + head * 8.2 + Math.sin(now * 0.8 + ph) * 0.7, hz);

    if (spr.userData.last !== headUp) {
      spr.userData.last = headUp;
      spr.material.map = headUp ? spr.userData.up : spr.userData.down;
      spr.material.needsUpdate = true;
    }
  }

  tape.body.instanceMatrix.needsUpdate = true;
  tape.wick.instanceMatrix.needsUpdate = true;
  tape.body.instanceColor.needsUpdate = true;
}

/* ---------- MARKETS: the station marker ---------- */
function objMarkets() {
  const g = new THREE.Group();

  // a dark disc, so the object reads as a screen even before you are close
  g.add(new THREE.Mesh(
    new THREE.CylinderGeometry(6.4, 6.4, 0.5, 48),
    new THREE.MeshLambertMaterial({ color: '#0E1A15' })
  ));
  g.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(6.4, 6.4, 0.5, 48)),
    new THREE.LineBasicMaterial({ color: MKT_UP, transparent: true, opacity: 0.8 })
  ));

  // the zero line across the face
  const zero = new THREE.Mesh(
    new THREE.BoxGeometry(12.4, 0.06, 0.12),
    new THREE.MeshBasicMaterial({ color: '#C8D4C0', transparent: true, opacity: 0.55 })
  );
  zero.position.y = 0.28;
  g.add(zero);

  const bars = [];
  const N = 13;
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 1, 0.62),
      new THREE.MeshLambertMaterial({ color: MKT_UP })
    );
    m.position.set((i - (N - 1) / 2) * 0.92, 0.25, 0);
    m.userData.i = i;
    g.add(m);
    bars.push(m);
  }

  g.userData.bars = bars;
  return g;
}

/** Runs the marker's own little chart, independent of the floor outside. */
function updateMarketsArt(art, now) {
  const bars = art.userData.bars;
  if (!bars) return;
  const N = bars.length;
  const shift = now * 1.1;

  for (let i = 0; i < N; i++) {
    const m = bars[i];
    const k = Math.floor(shift) + i;
    const v = TICKERS[0].series[k % SERIES_LEN];
    const p = TICKERS[0].series[(k + SERIES_LEN - 1) % SERIES_LEN];
    const h = 0.5 + v * 4.6;

    m.scale.y += (h - m.scale.y) * 0.12;
    m.position.x = ((i - (shift % 1)) - (N - 1) / 2) * 0.92;
    m.position.y = 0.25 + m.scale.y / 2;
    m.material.color.set(v >= p ? MKT_UP : MKT_DOWN);
  }
}

/* ---------- CONTACT: a paper plane ---------- */
function objContact() {
  const g = new THREE.Group();
  const v = [
    0, 0, 4.4,   -2.7, -0.1, -3.1,   0, 0.9, -2.0,
    0, 0, 4.4,    0, 0.9, -2.0,      2.7, -0.1, -3.1,
    0, 0, 4.4,    0, 0.9, -2.0,      0, -0.55, -2.5,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();

  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: C.paperLit, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
  })));
  g.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 1),
    new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.9 })
  ));

  g.scale.setScalar(1.5);
  g.userData.glide = true;
  return g;
}

/* ============================================================================
   9b · CITIES ON THE SURFACE
   Places the surface has actually carried me through, drawn as skylines that
   grow out of the paper. Every piece is planted at fieldH() of its own
   footprint rather than on a flat pad, so a block on the uphill side of a
   hill stands taller than its neighbour downhill — the city follows the
   curvature instead of hovering over it.

   Each city is built through the same VB() merger the vehicles use: one
   merged solid + one merged outline, so a forty-piece skyline still costs
   two draw calls.
   ========================================================================= */

const CITY_STONE  = '#E4D8BA';   // limestone / pale concrete
const CITY_SHADE  = '#C2B18C';   // the same, in shadow
const CITY_GLASS  = '#9FB4C0';   // curtain wall
const CITY_DARK   = '#6E6353';   // dark steel, Willis / masts
const CITY_GREEN  = '#5B7F63';   // parkland, evergreens
const CITY_ORANGE = '#C0512E';   // international orange
const CITY_BLUE   = '#2F5D8A';   // the Blue

const TAU = Math.PI * 2;

/** A tapered square prism — 4 radial segments makes a cylinder a box that
    narrows as it rises, which is most of what a skyscraper silhouette is. */
const taper = (rTop, rBot, h) => new THREE.CylinderGeometry(rTop, rBot, h, 4);
const boxG  = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** A thin antenna. High edge angle so the outline pass ignores it. */
function mast(b, g, dx, dz, base, h, r = 0.16, color = CITY_DARK) {
  b.add(new THREE.CylinderGeometry(r * 0.45, r, h, 6), color,
    [dx, g(dx, dz) + base + h / 2, dz], null, null, 70);
}

/** Ordinary blocks, so the landmarks read as the tall ones. */
function skyline(b, g, blocks) {
  blocks.forEach(([dx, dz, w, h, d, tone]) => {
    b.add(boxG(w, h, d), tone || CITY_STONE,
      [dx, g(dx, dz) + h / 2, dz], [0, ((dx * 13 + dz * 7) % 7) * 0.08, 0]);
  });
}

function evergreen(b, g, dx, dz, h = 6) {
  const y = g(dx, dz);
  b.add(new THREE.CylinderGeometry(0.24, 0.3, h * 0.3, 6), CITY_DARK,
    [dx, y + h * 0.15, dz], null, null, 70);
  b.add(new THREE.ConeGeometry(h * 0.3, h * 0.85, 7), CITY_GREEN,
    [dx, y + h * 0.55, dz], null, null, 50);
}

/* ---------- CHICAGO ---------- */
function lmChicago(b, g) {
  // Willis Tower: bundled tubes, dropping away in setbacks
  const y = g(0, 0);
  b.add(boxG(11, 27, 11), CITY_DARK, [0, y + 13.5, 0]);
  b.add(boxG(11, 12, 7.3), CITY_DARK, [0, y + 33, 1.85]);
  b.add(boxG(7.3, 12, 7.3), CITY_DARK, [-1.85, y + 33, -1.85]);
  b.add(boxG(3.7, 14, 3.7), CITY_DARK, [0, y + 46, 0]);
  mast(b, g, -1.0, 0, 53, 11, 0.18);
  mast(b, g, 1.0, 0, 53, 9.5, 0.18);

  // John Hancock: tapered, X-braced, twin masts.
  // The braces have to ride the taper — the tower is a 4-segment cylinder
  // turned 45 degrees, so its face half-width at height fraction f is
  // circumradius(f) * cos(45).
  const hy = g(-17, 9);
  b.add(taper(2.9, 5.0, 33), CITY_GLASS, [-17, hy + 16.5, 9], [0, Math.PI / 4, 0], null, 50);
  for (let i = 0; i < 3; i++) {
    const f = (5.5 + i * 9.5) / 33;
    const yy = hy + 5.5 + i * 9.5;
    const half = (5.0 + (2.9 - 5.0) * f) * Math.SQRT1_2;
    const zf = 9 + half + 0.06;
    b.add(boxG(half * 2, 0.45, 0.45), CITY_DARK, [-17, yy, zf], [0, 0, 0.36], null, 70);
    b.add(boxG(half * 2, 0.45, 0.45), CITY_DARK, [-17, yy, zf], [0, 0, -0.36], null, 70);
  }
  mast(b, g, -18.1, 9, 33, 9, 0.14);
  mast(b, g, -15.9, 9, 33, 9, 0.14);

  // Cloud Gate
  const by = g(15, -13);
  b.add(new THREE.SphereGeometry(3, 18, 12), '#B7C3C9',
    [15, by + 1.5, -13], null, [1.7, 0.8, 1.05], 80);
}

/* ---------- SEATTLE ---------- */
function lmSeattle(b, g) {
  // Space Needle
  const y = g(0, 0);
  b.add(taper(1.2, 3.9, 23), CITY_STONE, [0, y + 11.5, 0], null, null, 50);
  /* The tripod legs lean IN as they rise. Rotating a Y-aligned box by t about
     +Z carries its top toward -X, and by t about +X carries it toward +Z — so
     to pull the top back toward the axis the signs are (-sin a, 0, +cos a). */
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    b.add(boxG(0.7, 22, 0.7), CITY_SHADE,
      [Math.cos(a) * 3.4, y + 11, Math.sin(a) * 3.4],
      [-Math.sin(a) * 0.11, 0, Math.cos(a) * 0.11]);
  }
  b.add(new THREE.ConeGeometry(5.4, 3.4, 20), CITY_STONE,
    [0, y + 22.3, 0], [Math.PI, 0, 0], null, 50);     // under-flare
  b.add(new THREE.CylinderGeometry(5.5, 5.5, 1.9, 20), CITY_GLASS,
    [0, y + 25, 0], null, null, 50);                  // observation deck
  b.add(new THREE.TorusGeometry(5.6, 0.32, 6, 22), CITY_ORANGE,
    [0, y + 25.6, 0], [Math.PI / 2, 0, 0], null, 80); // the halo
  b.add(new THREE.ConeGeometry(4.4, 3.0, 20), CITY_ORANGE,
    [0, y + 27.4, 0], null, null, 50);                // roof
  mast(b, g, 0, 0, 28.8, 9, 0.2);

  // the Great Wheel, out over the water
  const wy = g(16, -11) + 6.5;
  b.add(new THREE.TorusGeometry(5.2, 0.28, 6, 26), CITY_SHADE,
    [16, wy, -11], [0, 0.35, 0], null, 80);
  for (let i = 0; i < 6; i++) {                       // spokes
    const a = (i / 6) * Math.PI;
    b.add(boxG(10.4, 0.16, 0.16), CITY_SHADE, [16, wy, -11], [0, 0.35, a], null, 70);
  }
  for (let i = 0; i < 8; i++) {                       // gondolas
    const a = (i / 8) * TAU;
    b.add(boxG(0.75, 0.75, 0.75), CITY_ORANGE,
      [16 + Math.cos(0.35) * Math.cos(a) * 5.2, wy + Math.sin(a) * 5.2,
       -11 - Math.sin(0.35) * Math.cos(a) * 5.2]);
  }
  b.add(boxG(0.5, 7, 0.5), CITY_SHADE, [16, g(16, -11) + 3.5, -12.4], [0.2, 0, 0]);
  b.add(boxG(0.5, 7, 0.5), CITY_SHADE, [16, g(16, -11) + 3.5, -9.6], [-0.2, 0, 0]);

  evergreen(b, g, -14, -13, 7);
  evergreen(b, g, -18, -8, 5.5);
  evergreen(b, g, 22, 12, 6.5);
}

/* ---------- SEOUL ---------- */
function lmSeoul(b, g) {
  // Namsan, with N Seoul Tower on top of it
  const y = g(0, 0);
  b.add(new THREE.CylinderGeometry(7, 12.5, 5, 24), CITY_GREEN,
    [0, y + 2.5, 0], null, null, 60);
  const t0 = y + 5;
  b.add(taper(1.3, 2.5, 18), CITY_STONE, [0, t0 + 9, 0], null, null, 50);
  b.add(new THREE.ConeGeometry(3.7, 4.4, 16), CITY_STONE,
    [0, t0 + 20, 0], [Math.PI, 0, 0], null, 50);
  b.add(new THREE.CylinderGeometry(3.5, 3.5, 3.6, 16), CITY_GLASS,
    [0, t0 + 24, 0], null, null, 50);
  b.add(new THREE.ConeGeometry(3.6, 2.4, 16), CITY_ORANGE,
    [0, t0 + 27, 0], null, null, 50);
  mast(b, g, 0, 0, 5 + 28, 13, 0.2);

  // Lotte World Tower
  const ly = g(-19, 11);
  b.add(taper(1.0, 4.0, 43), CITY_GLASS, [-19, ly + 21.5, 11], [0, Math.PI / 4, 0], null, 50);
  mast(b, g, -19, 11, 43, 7, 0.15);

  // Gwanghwamun — stone base, two tiers of tiled roof
  const gy = g(15, -15);
  b.add(boxG(13, 4.5, 6), CITY_SHADE, [15, gy + 2.25, -15]);
  b.add(boxG(1.8, 3.2, 1.8), CITY_ORANGE, [10.5, gy + 6.1, -15]);
  b.add(boxG(1.8, 3.2, 1.8), CITY_ORANGE, [19.5, gy + 6.1, -15]);
  b.add(boxG(12, 0.7, 5.4), CITY_ORANGE, [15, gy + 7.9, -15]);
  b.add(new THREE.ConeGeometry(9, 2.8, 4), CITY_DARK,
    [15, gy + 9.6, -15], [0, Math.PI / 4, 0], [1, 1, 0.55], 50);
  b.add(new THREE.ConeGeometry(6.5, 2.4, 4), CITY_DARK,
    [15, gy + 12.3, -15], [0, Math.PI / 4, 0], [1, 1, 0.55], 50);
}

/* ---------- BOISE ---------- */
function lmBoise(b, g) {
  // Idaho State Capitol
  const y = g(0, 0);
  b.add(boxG(23, 7, 9), CITY_STONE, [0, y + 3.5, 0]);          // wings
  b.add(boxG(10, 11, 10), CITY_STONE, [0, y + 5.5, 0]);        // centre mass
  for (let i = 0; i < 4; i++) {                               // portico
    b.add(new THREE.CylinderGeometry(0.42, 0.42, 6.4, 10), CITY_STONE,
      [-3.3 + i * 2.2, y + 3.2, 5.4], null, null, 60);
  }
  b.add(new THREE.CylinderGeometry(3.6, 3.9, 5, 20), CITY_STONE,
    [0, y + 13.5, 0], null, null, 50);                        // drum
  b.add(new THREE.SphereGeometry(3.6, 20, 12, 0, TAU, 0, Math.PI / 2), CITY_STONE,
    [0, y + 16, 0], null, null, 60);                          // dome
  b.add(new THREE.CylinderGeometry(0.95, 1.15, 2.2, 12), CITY_STONE,
    [0, y + 20.6, 0], null, null, 60);                        // lantern
  b.add(new THREE.ConeGeometry(1.15, 2.0, 12), CITY_ORANGE,
    [0, y + 22.7, 0], null, null, 50);
  mast(b, g, 0, 0, 23.7, 3.4, 0.11);

  // the foothills behind town, set back clear of the capitol footprint
  b.add(new THREE.ConeGeometry(17, 10, 5), '#B9A87F',
    [-34, g(-34, 28) + 5, 28], [0, 0.4, 0], [1, 1, 0.7], 60);
  b.add(new THREE.ConeGeometry(13, 7.5, 5), '#B9A87F',
    [22, g(22, 32) + 3.8, 32], [0, 0.9, 0], [1, 1, 0.7], 60);

  // the Blue
  const by = g(19, -15);
  b.add(boxG(17, 0.5, 10.5), CITY_BLUE, [19, by + 0.25, -15]);
  b.add(boxG(0.35, 0.6, 10.5), CITY_STONE, [19, by + 0.3, -15]);
  b.add(boxG(3.5, 3.2, 11), CITY_SHADE, [12, by + 1.6, -15]);   // grandstand
  b.add(boxG(3.5, 2.4, 11), CITY_SHADE, [26, by + 1.2, -15]);

  evergreen(b, g, -14, -12, 5.5);
  evergreen(b, g, -9, -16, 4.5);
}

/* ---------- SAN FRANCISCO ---------- */
function lmSF(b, g) {
  // Transamerica Pyramid
  const y = g(0, 0);
  b.add(new THREE.ConeGeometry(5.2, 38, 4), CITY_STONE,
    [0, y + 19, 0], [0, Math.PI / 4, 0], null, 50);
  b.add(boxG(1.5, 13, 3.0), CITY_STONE, [-2.6, y + 15, 0]);     // the wings
  b.add(boxG(1.5, 13, 3.0), CITY_STONE, [2.6, y + 15, 0]);
  mast(b, g, 0, 0, 38, 7, 0.16);

  // Golden Gate — two towers, a deck, and a real sampled catenary
  const bx = -27;
  const deck = g(bx, 0) + 10;          // a bridge deck is flat; the ground is not
  const topS = g(bx, -16) + 30;        // each tower rises 30 off its OWN footing,
  const topN = g(bx, 16) + 30;         // so the cable has to meet it there

  [-16, 16].forEach((dz) => {
    [-3, 3].forEach((ox) => b.add(boxG(1.5, 30, 1.5), CITY_ORANGE, [bx + ox, g(bx, dz) + 15, dz]));
    for (let i = 0; i < 4; i++) {
      b.add(boxG(7.5, 1.1, 1.1), CITY_ORANGE, [bx, g(bx, dz) + 7 + i * 7, dz]);
    }
  });
  b.add(boxG(3.4, 0.8, 50), CITY_ORANGE, [bx, deck, 0]);

  [-3, 3].forEach((ox) => {
    const cable = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx + ox, deck - 0.5, -30),
      new THREE.Vector3(bx + ox, topS, -16),
      new THREE.Vector3(bx + ox, deck + 3.5, 0),
      new THREE.Vector3(bx + ox, topN, 16),
      new THREE.Vector3(bx + ox, deck - 0.5, 30),
    ], false, 'catmullrom', 0.4);
    b.add(new THREE.TubeGeometry(cable, 44, 0.22, 5, false), CITY_ORANGE,
      null, null, null, 90);

    // hangers, sampled off the cable so they always land on it
    for (let i = 1; i < 14; i++) {
      const p = cable.getPointAt(i / 14);
      if (Math.abs(p.z) > 15.5) continue;             // only in the main span
      const h = p.y - deck;
      if (h < 0.6) continue;
      b.add(boxG(0.14, h, 0.14), CITY_ORANGE, [p.x, deck + h / 2, p.z], null, null, 70);
    }
  });

  // Painted Ladies
  for (let i = 0; i < 4; i++) {
    const dx = 18 + i * 3.2, dz = 15;
    const gy = g(dx, dz);
    const tone = ['#E8D9B4', '#DCC9A2', '#E4D2AE', '#D2BE95'][i];
    b.add(boxG(2.8, 6.5, 4.5), tone, [dx, gy + 3.25, dz]);
    b.add(new THREE.ConeGeometry(2.3, 2.2, 4), CITY_SHADE,
      [dx, gy + 7.6, dz], [0, Math.PI / 4, 0], [1, 1, 0.8], 50);
  }
}

const CITIES = [
  { id:'boise',   name:'Boise',   sub:'43.6N 116.2W',  x: -90, y:  100,
    label: 34, landmark: lmBoise, blocks: [
      [-8, -6, 4, 9, 4], [-13, 2, 3.4, 6, 3.4], [8, 6, 4.5, 11, 4.5, CITY_GLASS],
      [13, -4, 3.6, 7, 3.6], [4, -12, 5, 5.5, 5], [-4, 10, 4, 8, 4, CITY_SHADE],
    ] },
  { id:'seattle', name:'Seattle', sub:'47.6N 122.3W',  x:  60, y:  105,
    label: 42, landmark: lmSeattle, blocks: [
      [-9, 5, 5, 17, 5, CITY_GLASS], [-15, -2, 4.4, 12, 4.4], [7, 9, 5.2, 21, 5.2, CITY_GLASS],
      [12, 3, 4.2, 14, 4.2, CITY_SHADE], [-3, 12, 4.6, 9, 4.6], [3, -7, 4, 11, 4],
      [17, -2, 3.6, 8, 3.6, CITY_GLASS],
    ] },
  { id:'chicago', name:'Chicago', sub:'41.9N 87.6W',   x: 225, y:  150,
    label: 68, landmark: lmChicago, blocks: [
      [-9, -8, 5.5, 20, 5.5, CITY_GLASS], [9, 6, 6, 24, 6, CITY_SHADE],
      [-24, -4, 5, 15, 5], [6, 15, 5.4, 18, 5.4, CITY_GLASS],
      [-10, 16, 4.6, 12, 4.6], [21, -6, 5, 16, 5, CITY_GLASS],
      [17, 12, 4.2, 10, 4.2, CITY_SHADE], [-20, 14, 4.4, 13, 4.4],
    ] },
  { id:'seoul',   name:'Seoul',   sub:'37.6N 127.0E',  x: 395, y:  140,
    label: 50, landmark: lmSeoul, blocks: [
      [-11, -8, 4.6, 14, 4.6, CITY_GLASS], [-26, 4, 5, 18, 5, CITY_GLASS],
      [-13, 20, 4.4, 16, 4.4, CITY_SHADE], [8, 14, 5, 13, 5],
      [22, 4, 4.6, 17, 4.6, CITY_GLASS], [24, 18, 4, 11, 4],
      [-24, -12, 4.2, 10, 4.2, CITY_SHADE], [4, 24, 4.8, 15, 4.8, CITY_GLASS],
    ] },
  { id:'sf',      name:'San Francisco', sub:'37.8N 122.4W', x: 300, y: -250,
    label: 48, landmark: lmSF, blocks: [
      [8, -6, 4.6, 15, 4.6, CITY_GLASS], [13, 4, 5.2, 21, 5.2, CITY_SHADE],
      [-8, 12, 4.4, 12, 4.4], [5, 8, 4, 17, 4, CITY_GLASS],
      [-13, 16, 4.2, 9, 4.2, CITY_SHADE], [20, -2, 4, 13, 4, CITY_GLASS],
    ] },
];

function buildCities() {
  CITIES.forEach((def) => {
    const base = fieldH(def.x, def.y);
    const g = (dx, dz) => fieldH(def.x + dx, def.y + dz) - base;
    const b = VB();

    skyline(b, g, def.blocks);
    def.landmark(b, g);

    const grp = b.build({ city: def.id });
    grp.position.set(def.x, base, def.y);

    const spr = labelSprite(def.name, def.sub);
    spr.scale.set(27, 8.4, 1);
    spr.position.set(0, def.label, 0);
    grp.add(spr);

    scene.add(grp);
  });
}

/* ============================================================================
   9c · THE THREE PLOTS

   The graph apparatus — grid, axes, rail, cart — is all one ink, so colour
   on the sheet itself means what it means on a graphing calculator: which
   plot you are looking at. There are exactly three — Y₁ red, Y₂ green, Y₃
   blue — and they take the sheet one at a time, in order, over and over.

   A plot is not a static curve. It is a wave packet: a Gaussian envelope
   sliding along the band while the carrier oscillates underneath it, so the
   thing you watch is an actual disturbance travelling through the paper. To
   give it volume rather than leaving it a wire, each plot is a band of
   parallel traces swept across a width, with a cosine falloff at the edges —
   near enough to a surface to read as a swell, still plainly drawn.

   Each pass is planted fresh in front of wherever the rider happens to be,
   which is what keeps them arriving as you travel instead of sitting in
   fixed places waiting to be found.
   ========================================================================= */

const WAVE_PENS = ['#C0392B', '#2F7D4F', '#2F5D8A'];   // Y₁ Y₂ Y₃

const WAVE_LINES = 11;     // parallel traces making up one band
const WAVE_SEGS  = 150;    // samples along each trace
const WAVE_SPAN  = 210;    // how far the band runs, world units
const WAVE_WIDTH = 46;     // how wide the band is, across its travel
const WAVE_AMP   = 17;     // crest height — these are meant to be seen
const WAVE_LIFT  = 13;     // how high the band's baseline floats
const WAVE_K     = 3.2;    // carrier cycles inside the packet envelope
const WAVE_SIGMA = 0.15;   // packet width, as a fraction of the span
const WAVE_PASS  = 9.0;    // seconds one plot holds the sheet

let waveBands = [];
let waveTurn  = 0;
let wavePassT = 0;

function buildWaves() {
  waveBands = WAVE_PENS.map((pen) => {
    const group = new THREE.Group();
    const traces = [];

    for (let n = 0; n < WAVE_LINES; n++) {
      const arr = new Float32Array((WAVE_SEGS + 1) * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));

      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(pen), transparent: true, opacity: 0,
      });

      group.add(new THREE.Line(geo, mat));
      traces.push({ arr, geo, mat });
    }

    group.visible = false;
    scene.add(group);

    return {
      group, traces,
      ox: 0, oz: 0,     // band origin
      dx: 1, dz: 0,     // along the band
      nx: 0, nz: 1,     // across it
      phase: 0,
    };
  });

  placeWave(waveBands[0]);
  waveBands[0].group.visible = true;

  /* Seed the buffers before the first render either way — an unfilled band is
     151 points parked at the origin. Under reduced motion the frame loop never
     advances the pass, so start it mid-crossing and let it stand still. */
  if (reduceMotion) wavePassT = WAVE_PASS * 0.5;
  updateWaves(0, 0);
}

/** Plant a band on fresh ground, out in front of wherever the rider is. */
function placeWave(band) {
  const at = cart ? cart.position : new THREE.Vector3();
  const tan = railTangent(t);

  // ahead of the rider, offset to one side, so the pass crosses the view
  const fwd = 70 + Math.random() * 90;
  const side = (Math.random() - 0.5) * 150;

  const cx = at.x + tan.x * fwd - tan.z * side;
  const cz = at.z + tan.z * fwd + tan.x * side;

  // the band runs roughly across the direction of travel, ±35°
  const base = Math.atan2(tan.x, -tan.z);
  const ang = base + (Math.random() - 0.5) * 1.22;

  band.dx = Math.cos(ang);
  band.dz = Math.sin(ang);
  band.nx = -band.dz;
  band.nz = band.dx;

  band.ox = cx - band.dx * WAVE_SPAN * 0.5;
  band.oz = cz - band.dz * WAVE_SPAN * 0.5;
  band.phase = Math.random() * TAU;
}

/* One plot at a time, in order, each for WAVE_PASS seconds. The packet
   crosses the band over the pass; the opacity ramp hides the ends of the
   band so a plot arrives and leaves rather than being switched on. */
function updateWaves(dt, now) {
  wavePassT += dt;

  if (wavePassT >= WAVE_PASS) {
    wavePassT -= WAVE_PASS;
    waveBands[waveTurn].group.visible = false;
    waveTurn = (waveTurn + 1) % waveBands.length;

    const next = waveBands[waveTurn];
    placeWave(next);
    next.group.visible = true;
  }

  const band = waveBands[waveTurn];
  const k = wavePassT / WAVE_PASS;                    // 0..1 through the pass

  // the packet enters one end and leaves the other
  const centre = -0.15 + k * 1.3;

  // fade in over the first eighth, out over the last fifth
  const fade = Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.2);

  for (let n = 0; n < WAVE_LINES; n++) {
    const { arr, geo, mat } = band.traces[n];

    // -1..1 across the band, and a cosine falloff so the edges taper
    const q = WAVE_LINES === 1 ? 0 : (n / (WAVE_LINES - 1)) * 2 - 1;
    const across = q * WAVE_WIDTH * 0.5;
    const taper = Math.cos(q * Math.PI * 0.5);

    for (let i = 0; i <= WAVE_SEGS; i++) {
      const u = i / WAVE_SEGS;
      const d = u * WAVE_SPAN;

      const x = band.ox + band.dx * d + band.nx * across;
      const z = band.oz + band.dz * d + band.nz * across;

      // gaussian packet riding along the band, carrier underneath
      const s = (u - centre) / WAVE_SIGMA;
      const env = Math.exp(-0.5 * s * s);
      const h = env * Math.sin((u - centre) * WAVE_K * TAU + band.phase);

      const j = i * 3;
      arr[j]     = x;
      arr[j + 1] = fieldH(x, z) + WAVE_LIFT + h * WAVE_AMP * taper;
      arr[j + 2] = z;
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeBoundingSphere();
    mat.opacity = fade * (0.34 + 0.5 * taper);
  }
}

/* ============================================================================
   10 · STATION RAIL NAV
   ========================================================================= */

function buildRailNav() {
  const rail = $('#rail');
  STATIONS.forEach((st) => {
    const b = document.createElement('button');
    b.className = 'rail-node';
    b.type = 'button';
    b.style.top = `${st.t * 100}%`;
    b.dataset.id = st.id;
    b.innerHTML = `<span class="rail-label">${st.label}</span>`;
    b.addEventListener('click', () => focusOn(st));
    rail.appendChild(b);
  });
}

/* ============================================================================
   11 · LIGHTING
   ========================================================================= */

function lighting() {
  scene.add(new THREE.HemisphereLight(0xF2E9D6, 0x9C8B6A, 1.05));
  const key = new THREE.DirectionalLight(0xFFF6E2, 0.7);
  key.position.set(-90, 140, -70);
  scene.add(key);
}

/* ============================================================================
   12 · CAMERA
   ========================================================================= */

const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();

function placeCameraAt(u) {
  const p = railPoint(u);
  const behind = railPoint(u - CHASE_T);
  camera.position.set(behind.x, behind.y + CHASE_UP, behind.z);
  if (cart) cart.position.copy(p);

  // open already facing the first station, not a blank stretch of paper
  const first = STATIONS.reduce((best, st) => {
    let d = st.t - u; if (d < 0) d += 1;
    let bd = best.t - u; if (bd < 0) bd += 1;
    return d < bd ? st : best;
  }, STATIONS[0]);

  camera.up.set(0, 1, 0);
  camera.lookAt(
    first.x * 0.58 + p.x * 0.42,
    (first.h + 9.5) * 0.58 + (p.y + 1.5) * 0.42,
    first.y * 0.58 + p.z * 0.42
  );
}

/* IMPORTANT: this probe must be a Camera, not a plain Object3D.
   Object3D.lookAt() aims the object's +Z at the target; Camera.lookAt() aims
   its -Z, because cameras look down negative Z. Copying a plain Object3D's
   quaternion onto a camera therefore points the camera 180 degrees the wrong
   way. Every place we derive an orientation for the camera goes through here. */
const _probe = new THREE.PerspectiveCamera();

/** Orientation for a camera at `from` looking at `at`. */
function lookQuat(from, at, out) {
  _probe.position.copy(from);
  _probe.up.set(0, 1, 0);
  _probe.lookAt(at);
  return out.copy(_probe.quaternion);
}

const _aimSmooth = new THREE.Vector3();
const _qTmp = new THREE.Quaternion();
const _stationAim = new THREE.Vector3();
const _trackAim = new THREE.Vector3();
let aimInit = false;

/** The next station along the curve — never the one we're already on. */
function stationAhead() {
  let best = STATIONS[0], bd = Infinity;
  for (const st of STATIONS) {
    let d = st.t - t;
    if (d < 0) d += 1;
    if (d < 0.02) d += 1;        // standing on it: look through to the next
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}

/* The camera looks at the content, not down the rail. Aiming along the
   tangent framed empty paper most of the time, and averaging points along
   the curve was worse still: the mean of samples on an arc sits inside the
   arc, which on the return sweep put the aim point behind the camera. So
   aim at the object we are travelling toward, with a little of the track
   direction mixed in to keep a sense of motion. */
function updateRideCamera(dt) {
  const p = railPoint(t);

  // --- the cart is a point riding the line ---
  if (cart) cart.position.copy(p);

  // --- position: sit back along the curve, above it, for a chase view ---
  const behind = railPoint(t - CHASE_T);
  camPos.set(behind.x, behind.y + CHASE_UP, behind.z);
  camera.position.x += (camPos.x - camera.position.x) * Math.min(1, dt * 9);
  camera.position.z += (camPos.z - camera.position.z) * Math.min(1, dt * 9);
  camera.position.y += (camPos.y - camera.position.y) * Math.min(1, dt * 3.2);

  // --- heading: the station we're heading for, softened toward the track ---
  const target = stationAhead();
  _stationAim.set(target.x, target.h + 9.5, target.y);

  // aim through the cart, so it stays framed in the foreground
  _trackAim.copy(p).setY(p.y + 1.5);

  camAim.copy(_stationAim).lerp(_trackAim, 0.42);

  if (!aimInit) { _aimSmooth.copy(camAim); aimInit = true; }
  _aimSmooth.lerp(camAim, Math.min(1, dt * 1.4));

  // world up keeps the horizon level, so there is no roll to feel
  lookQuat(camera.position, _aimSmooth, _qTmp);
  camera.quaternion.slerp(_qTmp, Math.min(1, dt * 1.9));

  camera.fov += (60 - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();
}

/* ============================================================================
   13 · FOCUS — stop the ride, frame the object, expand its panel
   ========================================================================= */

/** Camera pose that frames a station's object nicely. */
function focusPoseFor(st) {
  const centre = new THREE.Vector3(st.x, st.h + 10, st.y);
  // approach from where the rail is, so the move feels continuous
  const from = railPoint(st.t);
  const dir = new THREE.Vector3().subVectors(from, centre).setY(0);
  if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
  dir.normalize();

  const pos = centre.clone().addScaledVector(dir, 26).add(new THREE.Vector3(0, 7, 0));
  return { pos, look: centre };
}

function focusOn(st) {
  if (mode === 'focusing' || mode === 'focused') return;
  mode = 'focusing';
  focusStation = st;

  const pose = focusPoseFor(st);
  tween = {
    fromPos: camera.position.clone(),
    fromQuat: camera.quaternion.clone(),
    toPos: pose.pos,
    look: pose.look,
    k: 0,
    dur: reduceMotion ? 0.001 : 1.05,
  };

  document.body.classList.add('is-focused');
  $('#dock-hint').classList.remove('is-live');
  $('#hint').classList.add('is-gone');
}

function release() {
  if (!focusStation) return;
  closePanel();

  mode = 'releasing';
  t = focusStation.t;

  const p = railPoint(t);
  const behind = railPoint(t - CHASE_T);
  const backPos = new THREE.Vector3(behind.x, behind.y + CHASE_UP, behind.z);

  // resume in the chase pose, framed the same way the ride frames itself
  const nxt = stationAhead();
  const backAim = new THREE.Vector3(nxt.x, nxt.h + 9.5, nxt.y)
    .lerp(new THREE.Vector3(p.x, p.y + 1.5, p.z), 0.42);

  tween = {
    fromPos: camera.position.clone(),
    fromQuat: camera.quaternion.clone(),
    toPos: backPos,
    toQuat: lookQuat(backPos, backAim, new THREE.Quaternion()),
    k: 0,
    dur: reduceMotion ? 0.001 : 0.9,
  };

  focusStation = null;
  document.body.classList.remove('is-focused');
}

function updateTween(dt) {
  if (!tween) return;
  tween.k = Math.min(1, tween.k + dt / tween.dur);
  const e = 1 - Math.pow(1 - tween.k, 3);

  camera.position.lerpVectors(tween.fromPos, tween.toPos, e);

  if (tween.look) {
    lookQuat(camera.position, tween.look, _qTmp);
    camera.quaternion.slerpQuaternions(tween.fromQuat, _qTmp, e);
  } else if (tween.toQuat) {
    camera.quaternion.slerpQuaternions(tween.fromQuat, tween.toQuat, e);
  }

  camera.fov += (58 - camera.fov) * Math.min(1, dt * 5);
  camera.updateProjectionMatrix();

  if (tween.k >= 1) {
    tween = null;
    if (mode === 'focusing') {
      mode = 'focused';
      openPanel(focusStation);
    } else {
      mode = 'ride';
    }
  }
}

/* ---------- the screen-space content panel ---------- */

function openPanel(st) {
  const panel = $('#panel');
  const pool = $('#sheet-pool');
  const el = document.getElementById(`sheet-${st.id}`);
  if (!panel || !el) return;

  // move the sheet into the panel stage
  $('#panel-stage').appendChild(el);
  el.classList.add('is-open');
  tallySheetChrome(el);        // figures outside the cards count on arrival

  // the resume runs as a reel and wants the whole window; the rest keep the card
  panel.classList.toggle('is-wide', el.classList.contains('is-deck'));

  const co = el.querySelector('[data-coord]');
  if (co) co.textContent = `X ${st.x.toFixed(0)}  ·  Y ${st.y.toFixed(0)}  ·  Z ${st.h.toFixed(1)}`;

  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  el.querySelector('.sheet-close')?.focus?.();

  if (el.id === 'sheet-resume') startDeck();

  void pool; // pool is only the parking lot; nothing to do with it here
}

function closePanel() {
  const panel = $('#panel');
  if (!panel) return;
  stopDeck();
  panel.classList.remove('is-open');
  panel.classList.remove('is-wide');
  panel.setAttribute('aria-hidden', 'true');

  // park the sheet back in the pool so only one lives on the stage
  const stage = $('#panel-stage');
  const pool = $('#sheet-pool');
  while (stage.firstChild) {
    const el = stage.firstChild;
    if (el.nodeType === 1) { el.classList.remove('is-open'); collapseCards(el); }
    pool.appendChild(el);
  }
}

/* ============================================================================
   14 · INPUT
   ========================================================================= */

function bindEvents() {
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  });

  renderer.domElement.addEventListener('click', () => {
    if (mode === 'ride' && hoverStation) focusOn(hoverStation);
  });

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (closeDive()) return;               // a dive is over the reel; drop that first
    if (mode === 'focused' || mode === 'focusing') release();
  });

  $('#panel-scrim').addEventListener('click', release);
  $('#launch').addEventListener('click', startRide);
  $('#goto-classic').addEventListener('click', () => { location.href = 'classic.html'; });
  $('#audio-toggle').addEventListener('click', toggleAudio);

  // close buttons live on the sheets themselves
  document.querySelectorAll('.sheet-close').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); release(); });
  });
}

function startRide() {
  // first statement in the click handler, before anything can go async
  startAudioNow();

  $('#gate').classList.add('is-gone');
  mode = 'ride';

  setTimeout(() => {
    $('#titleblock').classList.add('is-live');
    $('#rail').classList.add('is-live');
    $('#hint').classList.add('is-live');
    $('#audio-toggle').classList.add('is-live');
  }, 480);

  setTimeout(() => $('#hint').classList.add('is-gone'), 7000);
}

/* ============================================================================
   15 · AUDIO
   ========================================================================= */

const AUDIO_SRC   = 'audio.mp3';
const AUDIO_START = 90;   // begin at 1:30, and loop back to there rather than 0:00
let audioEl, audioCtx, analyser, audioData, audioReady = false, audioOn = false;

let audioPlaced = false;   // has the playhead been put on 1:30 yet?

/** Seek to AUDIO_START, but never past the end of a shorter file. */
function seekToStart() {
  if (!audioEl) return false;
  const d = audioEl.duration;
  if (!Number.isFinite(d) || d <= 0) return false;   // metadata not in yet

  const target = d > AUDIO_START + 1 ? AUDIO_START : 0;
  try {
    audioEl.currentTime = target;
    return Math.abs(audioEl.currentTime - target) < 2;
  } catch (err) {
    return false;                                     // not seekable yet
  }
}

/* Put the playhead on 1:30 at the first opportunity. duration is only known
   once metadata arrives, and a play() can land before that, so this is
   retried from several events until it actually takes. */
function placePlayhead() {
  if (audioPlaced) return;
  if (seekToStart()) audioPlaced = true;
}

/* Load the file at boot, well before anyone clicks. Deliberately NOT probing
   with fetch() first: a HEAD request is one more thing that can fail for
   reasons unrelated to whether the audio works, and a dev server that answers
   HEAD oddly would make us conclude the file is missing when it is not. The
   element's own error event is the authoritative answer. */
function primeAudio() {
  audioEl = $('#ride-audio');
  if (!audioEl) return;

  audioEl.loop = false;      // native loop restarts at 0:00; we want 1:30
  audioEl.volume = 0.6;
  audioEl.preload = 'auto';

  // retry the seek from every event that could be the one where it becomes possible
  ['loadedmetadata', 'durationchange', 'loadeddata', 'canplay'].forEach((ev) => {
    audioEl.addEventListener(ev, placePlayhead);
  });

  audioEl.addEventListener('ended', () => {
    audioPlaced = false;
    placePlayhead();
    audioEl.play().catch(() => {});
  });

  audioEl.addEventListener('error', () => {
    const btn = $('#audio-toggle');
    btn.classList.add('is-muted');
    btn.title = `Could not load ${AUDIO_SRC} — check it sits beside index.html`;
  });

  /* The #t= media fragment asks the browser to begin at 1:30 itself, which is
     both faster and more reliable than seeking after the fact — it can request
     only the bytes it needs instead of buffering from 0:00. placePlayhead()
     stays as the belt-and-braces fallback. */
  audioEl.src = `${AUDIO_SRC}#t=${AUDIO_START}`;
  audioEl.load();
}

/* MUST be invoked synchronously from inside a click handler. Any await before
   play() can cost the user-activation that browsers require, which is exactly
   how this silently failed before. */
function startAudioNow() {
  if (!audioEl || !audioEl.src) return;
  const btn = $('#audio-toggle');

  placePlayhead();

  audioEl.play().then(() => {
    audioReady = true;
    audioOn = true;
    btn.classList.remove('is-muted', 'is-armed');

    // if playback beat the metadata, land it on 1:30 as soon as we can
    if (audioEl.currentTime < AUDIO_START - 2) {
      audioPlaced = false;
      placePlayhead();
      let tries = 0;
      const chase = setInterval(() => {
        placePlayhead();
        if (audioPlaced || ++tries > 20) clearInterval(chase);
      }, 100);
    }
    attachAnalyser();
  }).catch(() => {
    audioOn = false;
    btn.classList.add('is-muted', 'is-armed');
    btn.title = 'Click to start the music';
  });
}

/* Routing the element through an AudioContext is what lets the visuals react
   to the music — but it also MOVES the audio out of the element's own output
   and into the graph. If that context is suspended (which is the default when
   it wasn't created directly inside a user gesture) the result is total
   silence even though the element reports itself as playing. So: only attach
   once playback is live, and resume the context before connecting anything. */
async function attachAnalyser() {
  if (audioCtx) { await audioCtx.resume().catch(() => {}); return; }

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    await ctx.resume().catch(() => {});

    if (ctx.state !== 'running') {
      // couldn't wake it — leave the element playing on its own rather than
      // capturing it into a dead graph
      ctx.close?.();
      return;
    }

    const src = ctx.createMediaElementSource(audioEl);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    audioData = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtx = ctx;
  } catch (err) {
    analyser = null;   // visuals lose the beat, audio keeps playing
  }
}

function toggleAudio() {
  if (!audioEl || !audioEl.src) return;

  /* Drive off the element's real state, not a flag. When autoplay was refused
     the button is armed and paused — the first click has to START it, which
     an unconditional flag flip would get exactly backwards. */
  const btn = $('#audio-toggle');
  btn.classList.remove('is-armed');

  if (audioEl.paused) {
    startAudioNow();                 // stays synchronous inside the gesture
  } else {
    audioEl.pause();
    audioOn = false;
    btn.classList.add('is-muted');
  }
}

function sampleAudio() {
  if (!analyser || !audioReady || !audioOn) { audioBass *= 0.9; return; }
  analyser.getByteFrequencyData(audioData);
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += audioData[i];
  audioBass += ((sum / 8) / 255 - audioBass) * 0.22;
}

/* ============================================================================
   16 · LICHESS
   ========================================================================= */

async function fetchLichess() {
  const tbody = $('#chess-ratings');
  const rec = $('#chess-record');
  if (!tbody) return;

  try {
    const r = await fetch('https://lichess.org/api/user/an_d22');
    if (!r.ok) throw new Error(`lichess ${r.status}`);
    const u = await r.json();
    const perfs = u.perfs || {};

    const rows = [
      ['Bullet', perfs.bullet], ['Blitz', perfs.blitz], ['Rapid', perfs.rapid],
      ['Classical', perfs.classical], ['Puzzles', perfs.puzzle],
    ].filter(([, p]) => p && p.games > 0);

    tbody.innerHTML = rows.length
      ? rows.map(([k, p]) =>
          `<tr><td>${k}</td><td class="num">${p.rating}</td><td class="num">${p.games.toLocaleString()}</td></tr>`
        ).join('')
      : '<tr><td colspan="3" class="loading">no rated games yet</td></tr>';

    const c = u.count || {};
    if (rec) rec.innerHTML = `
      <tr><td>Total games</td><td class="num">${(c.all || 0).toLocaleString()}</td></tr>
      <tr><td>Wins</td><td class="num">${(c.win || 0).toLocaleString()}</td></tr>
      <tr><td>Losses</td><td class="num">${(c.loss || 0).toLocaleString()}</td></tr>
      <tr><td>Draws</td><td class="num">${(c.draw || 0).toLocaleString()}</td></tr>`;

    if (chessBars) {
      chessBars.children.forEach((bar) => {
        const p = perfs[bar.userData.format];
        if (p && p.rating) {
          bar.userData.target = THREE.MathUtils.clamp((p.rating - 800) / 210, 0.6, 10);
        }
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" class="loading">lichess unreachable &mdash; <a href="https://lichess.org/@/an_d22" target="_blank" rel="noreferrer">view profile</a></td></tr>';
    if (rec) rec.innerHTML = '';
  }
}

/* ============================================================================
   17 · HUD
   ========================================================================= */

const hud = {
  station: $('#tb-station'), sheet: $('#tb-sheet'), crit: $('#tb-crit'),
  x: $('#tb-x'), y: $('#tb-y'), z: $('#tb-z'), grade: $('#tb-grade'), vel: $('#tb-vel'),
};

function updateHUD() {
  const p = railPoint(t);
  hud.x.textContent = p.x.toFixed(1);
  hud.y.textContent = p.z.toFixed(1);
  hud.z.textContent = (p.y - RAIL_H).toFixed(1);

  const { gx, gy } = fieldGrad(p.x, p.z);
  const tan = railTangent(t);
  const grade = (gx * tan.x + gy * tan.z) * 100;
  hud.grade.textContent = `${grade >= 0 ? '+' : ''}${grade.toFixed(0)}%`;

  let near = null, nd = Infinity;
  STATIONS.forEach((st) => {
    const d = Math.abs(wrapDelta(t, st.t));
    if (d < nd) { nd = d; near = st; }
  });

  if (nd < 0.05) {
    hud.station.textContent = near.label;
    hud.sheet.textContent = `${near.sheet} / 07`;
    hud.crit.textContent = 'Click the object to open';
  } else {
    hud.station.textContent = 'In Transit';
    hud.sheet.textContent = '— / 07';
    hud.crit.textContent = `${(nd * curveLen).toFixed(0)} u to ${near.label}`;
  }

  hud.vel.style.right = `${(1 - cruise) * 100}%`;
  $('#rail-carriage').style.top = `${(((t % 1) + 1) % 1) * 100}%`;
  document.querySelectorAll('.rail-node').forEach((n) => {
    n.classList.toggle('is-current', n.dataset.id === near?.id && nd < 0.05);
  });

  $('#atmos').style.opacity = String(0.30 + (1 - cruise) * 0.10);
}

/* ============================================================================
   18 · HOVER / PICKING
   ========================================================================= */

function updateHover() {
  if (mode !== 'ride') { hoverStation = null; return; }

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(Object.values(stationGroups), true);

  let found = null;
  if (hits.length) {
    let o = hits[0].object;
    while (o && !o.userData.station) o = o.parent;
    if (o) found = o.userData.station;
  }

  hoverStation = found;
  const dh = $('#dock-hint');
  if (found) {
    dh.textContent = `Open ${found.label}`;
    dh.classList.add('is-live');
    document.body.classList.add('is-pointing');
  } else {
    dh.classList.remove('is-live');
    document.body.classList.remove('is-pointing');
  }
}

/* ============================================================================
   18b · THE DRIFT FIELD
   Objects out of Andrew's life tumbling through the plane: soccer balls,
   chess pieces, wafers, a drone, a Coke Zero can. Motion is layered
   turbulence rather than straight lines, so it reads as pseudo-chaotic
   without ever getting frantic. Items recycle around the camera, so the
   world always feels populated no matter where you are on the curve.
   ========================================================================= */

const DRIFT_COUNT = 44;
const DRIFT_R     = 165;    // recycle once this far from the camera
const driftItems  = [];
let   driftGroup;

// scratch objects, so the per-frame loop allocates nothing
const _v1  = new THREE.Vector3();
const _q1  = new THREE.Quaternion();
const _q2  = new THREE.Quaternion();
const _up  = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(0, 0, 1);

/* Bodies are shaded (Lambert, lit by the scene) with a dark outline over the
   top. Solid form + hard silhouette is what makes a shape readable at a
   glance; pure wireframe reads as visual noise. */
const HULL   = '#F0E6CE';
const HULL_D = '#C4B189';
const STEEL  = '#93A6B2';
const RED    = '#B8442E';

const HALF = Math.PI / 2;

/** Concatenate non-indexed geometries that all carry position/normal/color. */
function mergeParts(list) {
  let total = 0;
  list.forEach((g) => { total += g.attributes.position.count; });

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);

  let o = 0;
  list.forEach((g) => {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  });

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/* A vehicle builder. Parts are baked into one geometry with per-vertex colour
   and one outline geometry, so however many pieces a model has it still costs
   exactly two draw calls. */
function VB() {
  const solids = [];
  const edges = [];

  const api = {
    add(geo, color, pos, rot, scl, edgeAngle = 28) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(...(pos || [0, 0, 0])),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))),
        new THREE.Vector3(...(scl || [1, 1, 1]))
      );

      // outline taken from the original (indexed) form, before flattening
      const eg = new THREE.EdgesGeometry(geo, edgeAngle);
      eg.applyMatrix4(m);
      edges.push(eg.attributes.position.array);

      const g = geo.toNonIndexed();
      ['uv', 'uv1', 'uv2'].forEach((a) => g.deleteAttribute(a));
      g.applyMatrix4(m);
      if (!g.attributes.normal) g.computeVertexNormals();

      const c = new THREE.Color(color);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[3 * i] = c.r; arr[3 * i + 1] = c.g; arr[3 * i + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));

      solids.push(g);
      return api;
    },

    build(userData = {}) {
      const grp = new THREE.Group();

      grp.add(new THREE.Mesh(mergeParts(solids), new THREE.MeshLambertMaterial({
        vertexColors: true, transparent: true, opacity: 0.96, side: THREE.DoubleSide,
      })));

      let total = 0;
      edges.forEach((a) => { total += a.length; });
      const ep = new Float32Array(total);
      let o = 0;
      edges.forEach((a) => { ep.set(a, o); o += a.length; });

      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
      grp.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({
        color: C.ink, transparent: true, opacity: 0.85,
      })));

      Object.assign(grp.userData, userData);
      return grp;
    },
  };
  return api;
}

const INK = C.ink.getStyle();

function protoRocket() {
  const b = VB();
  b.add(new THREE.CylinderGeometry(0.62, 0.62, 3.4, 16), HULL, null, null, null, 40);
  b.add(new THREE.ConeGeometry(0.62, 1.5, 16), RED, [0, 2.45, 0], null, null, 40);
  b.add(new THREE.CylinderGeometry(0.42, 0.62, 0.7, 16), STEEL, [0, -2.05, 0], null, null, 40);
  for (let i = 0; i < 3; i++) {                       // three fins
    const a = (i / 3) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.1, 1.1, 0.95), RED,
      [Math.cos(a) * 0.62, -1.35, Math.sin(a) * 0.62], [0, -a, 0]);
  }
  return b.build({ spin: 0.35, align: 'y' });          // nose leads
}

function protoJet() {
  const b = VB();
  b.add(new THREE.CylinderGeometry(0.34, 0.5, 4.2, 14), HULL, [0, 0, 0], [HALF, 0, 0], null, 40);
  b.add(new THREE.ConeGeometry(0.34, 1.2, 14), HULL, [0, 0, 2.6], [-HALF, 0, 0], null, 40);

  const wing = new THREE.Shape();
  wing.moveTo(0, 0.7); wing.lineTo(2.5, -1.1); wing.lineTo(2.5, -1.55); wing.lineTo(0, -0.55);
  const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.1, bevelEnabled: false });
  b.add(wg, HULL_D, [0, -0.05, 0], [HALF, 0, 0]);
  b.add(wg, HULL_D, [0, -0.05, 0], [HALF, 0, 0], [-1, 1, 1]);   // mirrored wing

  b.add(new THREE.BoxGeometry(0.09, 1.0, 0.85), HULL_D, [0, 0.55, -1.75]);
  return b.build({ spin: 0.18, align: 'z' });
}

function protoAirliner() {
  const b = VB();
  b.add(new THREE.CylinderGeometry(0.45, 0.45, 5.2, 16), HULL, [0, 0, 0], [HALF, 0, 0], null, 40);
  b.add(new THREE.SphereGeometry(0.45, 14, 10), HULL, [0, 0, 2.6], null, null, 40);
  b.add(new THREE.ConeGeometry(0.45, 1.1, 14), HULL, [0, 0.12, -3.05], [HALF, 0, 0], null, 40);
  b.add(new THREE.BoxGeometry(6.6, 0.13, 1.15), HULL_D, [0, -0.1, 0.1]);
  b.add(new THREE.CylinderGeometry(0.26, 0.26, 0.8, 12), STEEL, [-1.7, -0.38, 0.35], [HALF, 0, 0], null, 40);
  b.add(new THREE.CylinderGeometry(0.26, 0.26, 0.8, 12), STEEL, [ 1.7, -0.38, 0.35], [HALF, 0, 0], null, 40);
  b.add(new THREE.BoxGeometry(2.1, 0.1, 0.6), HULL_D, [0, 0.25, -2.5]);
  b.add(new THREE.BoxGeometry(0.1, 1.2, 0.9), RED, [0, 0.75, -2.55]);
  return b.build({ spin: 0.12, align: 'z' });
}

function protoTrain() {
  const b = VB();
  b.add(new THREE.BoxGeometry(1.5, 1.15, 4.6), HULL_D, [0, 0.35, -0.4]);
  b.add(new THREE.CylinderGeometry(0.72, 0.72, 2.9, 16), STEEL, [0, 0.62, 1.3], [HALF, 0, 0], null, 40);
  b.add(new THREE.CylinderGeometry(0.3, 0.22, 0.85, 12), RED, [0, 1.5, 2.1], null, null, 40);
  b.add(new THREE.BoxGeometry(1.5, 1.0, 1.25), HULL, [0, 1.15, -1.5]);
  b.add(new THREE.BoxGeometry(1.9, 0.22, 5.0), INK, [0, -0.3, -0.2]);
  [-1.4, -0.2, 1.0, 2.0].forEach((z) => {
    [-0.82, 0.82].forEach((x) => {
      b.add(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 14), RED, [x, -0.5, z], [0, 0, HALF], null, 40);
    });
  });
  return b.build({ spin: 0.10, align: 'z' });
}

function protoBoat() {
  const b = VB();
  const hull = new THREE.Shape();
  hull.moveTo(0, 2.4); hull.lineTo(0.95, 0.2); hull.lineTo(0.8, -2.1);
  hull.lineTo(-0.8, -2.1); hull.lineTo(-0.95, 0.2); hull.closePath();
  b.add(new THREE.ExtrudeGeometry(hull, { depth: 0.85, bevelEnabled: false }),
        HULL_D, [0, -0.45, 0], [-HALF, 0, 0]);
  b.add(new THREE.BoxGeometry(1.5, 0.55, 1.5), HULL, [0, 0.62, -0.7]);
  b.add(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), INK, [0, 1.9, 0.2], null, null, 40);

  const sail = new THREE.Shape();
  sail.moveTo(0, 1.7); sail.lineTo(1.5, -1.5); sail.lineTo(0, -1.5); sail.closePath();
  b.add(new THREE.ExtrudeGeometry(sail, { depth: 0.06, bevelEnabled: false }),
        HULL, [0.06, 1.95, 0.2], [0, HALF, 0]);
  return b.build({ spin: 0.2, align: 'z' });
}

function protoSubmarine() {
  const b = VB();
  b.add(new THREE.CapsuleGeometry(0.75, 3.2, 6, 16), STEEL, [0, 0, 0], [HALF, 0, 0], null, 45);
  b.add(new THREE.BoxGeometry(0.55, 1.1, 1.35), STEEL, [0, 0.85, 0.15]);
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), INK, [0, 1.75, 0.3], null, null, 40);
  b.add(new THREE.BoxGeometry(2.6, 0.11, 0.55), STEEL, [0, 0.3, 0.5]);
  b.add(new THREE.BoxGeometry(1.5, 0.11, 0.5), STEEL, [0, 0, -2.2]);
  b.add(new THREE.BoxGeometry(0.11, 1.3, 0.5), STEEL, [0, 0, -2.2]);
  b.add(new THREE.ConeGeometry(0.4, 0.7, 10), RED, [0, 0, -2.65], [-HALF, 0, 0], null, 40);
  return b.build({ spin: 0.14, align: 'z' });
}

function protoSoccerBall() {
  return VB()
    .add(new THREE.IcosahedronGeometry(1.15, 1), HULL, null, null, null, 12)
    .build({ spin: 1.2 });
}

function protoChessPawn() {
  const profile = [
    [0.00, 0.0], [0.62, 0.0], [0.60, 0.14], [0.36, 0.24], [0.30, 0.60],
    [0.25, 0.95], [0.46, 1.08], [0.22, 1.20], [0.20, 1.42], [0.40, 1.56],
    [0.30, 1.72], [0.00, 1.98],
  ].map(([x, y]) => new THREE.Vector2(x * 1.35, y * 1.35));
  return VB()
    .add(new THREE.LatheGeometry(profile, 18), HULL, null, null, null, 38)
    .build({ spin: 0.5 });
}

function protoDrone() {
  const b = VB();                                     // the drone years
  b.add(new THREE.BoxGeometry(0.85, 0.4, 0.85), HULL_D);
  [[-1.3, -1.3], [1.3, 1.3], [-1.3, 1.3], [1.3, -1.3]].forEach(([x, z]) => {
    b.add(new THREE.BoxGeometry(0.16, 0.12, 1.9), HULL_D, [x / 2, 0, z / 2], [0, Math.atan2(x, z), 0]);
    b.add(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 16), STEEL, [x, 0.16, z], null, null, 40);
  });
  return b.build({ spin: 0.9 });
}

function protoCan() {
  return VB()                                          // Coke Zero, per About
    .add(new THREE.CylinderGeometry(0.62, 0.62, 1.9, 18), RED, null, null, null, 45)
    .build({ spin: 0.8 });
}

function buildDrift() {
  const protos = [
    protoRocket(), protoJet(), protoAirliner(), protoTrain(),
    protoBoat(), protoSubmarine(), protoSoccerBall(), protoSoccerBall(),
    protoChessPawn(), protoDrone(), protoCan(),
  ];

  driftGroup = new THREE.Group();
  scene.add(driftGroup);

  for (let i = 0; i < DRIFT_COUNT; i++) {
    const src = protos[i % protos.length];
    const obj = src.clone(true);

    // clone materials so each item can fade independently near the edge
    const mats = [];
    obj.traverse((o) => {
      if (o.material) { o.material = o.material.clone(); mats.push(o.material); }
    });

    const scale = 0.6 + Math.random() * 1.1;
    obj.scale.setScalar(scale);

    const it = {
      obj, mats,
      align: src.userData.align,        // 'z' | 'y' | undefined (tumbles)
      baseOpacity: mats.map((m) => m.opacity),

      /* Each item keeps its own orbit around the rider. Because the anchor is
         the camera, they travel with you along the whole curve — always
         circling, never left behind. */
      orbitA: Math.random() * Math.PI * 2,
      orbitR: 22 + Math.random() * 62,
      orbitW: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.22),
      orbitY: -8 + Math.random() * 46,

      // a slow wander layered on top so the orbits never look mechanical
      wobbleR: 6 + Math.random() * 14,
      wobbleS: 0.13 + Math.random() * 0.3,
      phase: Math.random() * 100,

      prev: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 0.9
      ).multiplyScalar(src.userData.spin ?? 0.6),
      roll: (Math.random() - 0.5) * 0.5,
      seeded: false,
    };

    driftItems.push(it);
    driftGroup.add(obj);
  }
}

const _target = new THREE.Vector3();

function updateDrift(dt, now) {
  if (!driftGroup || dt <= 0) return;
  const c = camera.position;

  for (const it of driftItems) {
    const p = it.obj.position;

    it.orbitA += it.orbitW * dt;

    // where this item wants to be, relative to wherever the rider is now
    const ph = it.phase;
    _target.set(
      c.x + Math.cos(it.orbitA) * it.orbitR + Math.sin(now * it.wobbleS + ph) * it.wobbleR,
      c.y + it.orbitY + Math.sin(now * it.wobbleS * 1.7 + ph) * (it.wobbleR * 0.42),
      c.z + Math.sin(it.orbitA) * it.orbitR + Math.cos(now * it.wobbleS * 0.8 + ph) * it.wobbleR
    );

    // never sink into the paper
    const floor = fieldH(_target.x, _target.z) + 6;
    if (_target.y < floor) _target.y = floor;

    if (!it.seeded) { p.copy(_target); it.prev.copy(_target); it.seeded = true; }

    // ease toward it, so motion reads as drifting rather than rigid orbiting
    p.lerp(_target, Math.min(1, dt * 0.9));

    // real velocity, for nose-first alignment
    it.vel.subVectors(p, it.prev).divideScalar(dt);
    it.prev.copy(p);

    if (it.align && it.vel.lengthSq() > 0.4) {
      const dir = _v1.copy(it.vel).normalize();
      const axis = it.align === 'y' ? _up : _fwd;
      _q1.setFromUnitVectors(axis, dir);
      _q2.setFromAxisAngle(axis, now * it.roll);
      _q1.multiply(_q2);
      it.obj.quaternion.slerp(_q1, Math.min(1, dt * 1.6));
    } else {
      it.obj.rotation.x += it.spin.x * dt;
      it.obj.rotation.y += it.spin.y * dt;
      it.obj.rotation.z += it.spin.z * dt;
    }

    // fade at both extremes: nothing pops at range, nothing hits the lens
    const dist = p.distanceTo(c);
    const far  = 1 - THREE.MathUtils.smoothstep(dist, DRIFT_R * 0.7, DRIFT_R);
    const near = THREE.MathUtils.smoothstep(dist, 5, 17);
    const k = far * near;
    for (let i = 0; i < it.mats.length; i++) it.mats[i].opacity = it.baseOpacity[i] * k;
  }
}

/* ============================================================================
   18d · INTERACTIVE PITCH
   Six zones. Selecting one lights its heat blob, plays the runs that feed it,
   highlights the players responsible, and rolls the numbers in.
   ========================================================================= */

const ZONE_DATA = {
  six: {
    name: '6-Yard Box', weight: 0.92, entries: 0.71, conv: 0.38,
    runs: ['r3'], key: ['LST', 'RST'],
    note: 'Highest-signal region in the model. Low volume, but conversion here dominates expected output, so entries are weighted far above possession time.',
    tags: ['Highest weight', 'Low volume', 'Decisive'],
  },
  box: {
    name: 'Penalty Area', weight: 0.78, entries: 0.83, conv: 0.24,
    runs: ['r1', 'r2'], key: ['LST', 'RST', 'LCM', 'RCM'],
    note: 'Entry count and entry angle both matter. The model separates wide entries from central ones — they resolve very differently against a low block.',
    tags: ['Entry angle', 'Wide vs central'],
  },
  edge: {
    name: 'Edge of Box', weight: 0.54, entries: 0.66, conv: 0.11,
    runs: ['r3'], key: ['LCM', 'RCM'],
    note: 'The staging band. Strong predictor of what happens next rather than of outcome itself — most sequences that reach the six-yard box pass through here first.',
    tags: ['Staging', 'Leading indicator'],
  },
  left: {
    name: 'Left Wing', weight: 0.41, entries: 0.58, conv: 0.07,
    runs: ['r1'], key: ['LM', 'LB'],
    note: 'Overlap frequency between the left back and left mid is the feature that carries here. Isolation 1v1s are tracked separately from combination play.',
    tags: ['Overlaps', '1v1 isolation'],
  },
  right: {
    name: 'Right Wing', weight: 0.38, entries: 0.55, conv: 0.06,
    runs: ['r2'], key: ['RM', 'RB'],
    note: 'Mirrors the left, with a lower weight — most benchmarked opponents show a measurable left-side bias in progression.',
    tags: ['Mirror channel', 'Lower bias'],
  },
  deep: {
    name: 'Deep Midfield', weight: 0.22, entries: 0.94, conv: 0.02,
    runs: [], key: ['LCB', 'RCB', 'LCM', 'RCM', 'GK'],
    note: 'Highest volume, lowest weight. Included because build-up shape here predicts where the attack will eventually arrive, not because anything is decided in it.',
    tags: ['Highest volume', 'Shape signal'],
  },
};

let activeZone = null;

function initPitch() {
  const svg = document.querySelector('.pitch');
  if (!svg) return;

  // seed the heat blobs from the same weights the readout uses
  svg.querySelectorAll('[data-heat]').forEach((el) => {
    const z = ZONE_DATA[el.dataset.heat];
    if (z) el.style.setProperty('--w', z.weight);
  });

  svg.querySelectorAll('.zone').forEach((z) => {
    z.setAttribute('tabindex', '0');
    z.setAttribute('role', 'button');
    const label = ZONE_DATA[z.dataset.zone]?.name || z.dataset.zone;
    z.setAttribute('aria-label', label);

    z.addEventListener('click', () => selectZone(z.dataset.zone));
    z.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectZone(z.dataset.zone); }
    });
  });
}

function selectZone(id) {
  const data = ZONE_DATA[id];
  const svg = document.querySelector('.pitch');
  if (!data || !svg) return;

  activeZone = id;

  svg.querySelectorAll('.zone').forEach((z) => z.classList.toggle('is-active', z.dataset.zone === id));
  svg.querySelectorAll('[data-heat]').forEach((h) => h.classList.toggle('is-lit', h.dataset.heat === id));
  svg.querySelectorAll('.pl').forEach((p) => p.classList.toggle('is-key', data.key.includes(p.dataset.pos)));

  // restart the run animations so they replay on every selection
  svg.querySelectorAll('.run').forEach((r) => {
    r.classList.remove('is-live');
    void r.offsetWidth;                       // force reflow
    if (data.runs.some((c) => r.classList.contains(c))) r.classList.add('is-live');
  });

  const readout = $('#pitch-readout');
  readout.classList.remove('is-swapping');
  void readout.offsetWidth;
  readout.classList.add('is-swapping');

  $('#ro-kicker').textContent = `Zone · weight ${data.weight.toFixed(2)}`;
  $('#ro-title').textContent = data.name;
  $('#ro-body').innerHTML =
    `<p>${data.note}</p><div class="ro-tags">${data.tags.map((t) => `<span>${t}</span>`).join('')}</div>`;

  const bars = $('#ro-bars');
  bars.hidden = false;
  const set = (k, v, fmt) => {
    bars.querySelector(`[data-bar="${k}"]`).style.width = `${v * 100}%`;
    bars.querySelector(`[data-val="${k}"]`).textContent = fmt;
  };
  // let the width transition actually run
  requestAnimationFrame(() => {
    set('weight',  data.weight,  data.weight.toFixed(2));
    set('entries', data.entries, `${Math.round(data.entries * 100)}%`);
    set('conv',    data.conv,    `${Math.round(data.conv * 100)}%`);
  });
}

/* ============================================================================
   18c · EXPANDABLE CARDS + COUNTERS
   Shared machinery: a card that opens, and a figure that counts itself up
   on the way in. The coverage sheet uses the cards; the resume deck uses
   the counters.
   ========================================================================= */

/* ---------- counting a figure up ----------

   Figures tick up rather than arriving finished. Only the numeric run inside
   the element is rewritten, so the surrounding text is untouched and
   "~1,500 tools" counts through "~1,203 tools" and lands back on itself —
   no second copy of the string to keep in sync.                           */

const TALLY_MS = 900;

function runTally(el) {
  // the element's own text is the source of truth; cache it before the first
  // frame overwrites it, so a re-open counts to the same place
  const full = el.dataset.tallyText || (el.dataset.tallyText = el.textContent);
  const m = full.match(/\d[\d,]*(?:\.\d+)?/);
  if (!m) return;

  const raw = m[0];
  const target = parseFloat(raw.replace(/,/g, ''));
  if (!isFinite(target)) return;

  const head = full.slice(0, m.index);
  const tail = full.slice(m.index + raw.length);
  const decimals = (raw.split('.')[1] || '').length;
  const grouped = raw.includes(',');

  if (reduceMotion) { el.textContent = full; return; }

  const fmt = (v) => {
    let s = v.toFixed(decimals);
    if (grouped) {
      const [i, d] = s.split('.');
      s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? `.${d}` : '');
    }
    return s;
  };

  // a re-open supersedes any count still in flight on this element
  const gen = (el.__tallyGen = (el.__tallyGen || 0) + 1);
  const t0 = performance.now();

  const step = (now) => {
    if (el.__tallyGen !== gen) return;
    const k = Math.min(1, (now - t0) / TALLY_MS);
    el.textContent = head + fmt(target * (1 - Math.pow(1 - k, 3))) + tail;
    if (k < 1) requestAnimationFrame(step);
    else el.textContent = full;                       // land exactly on the source
  };
  requestAnimationFrame(step);
}

/** Count every figure that is not waiting on something else to reveal it —
    a collapsed card, or a slide the reel has not reached yet. */
function tallySheetChrome(sheetEl) {
  sheetEl.querySelectorAll('[data-tally]').forEach((b) => {
    if (!b.closest('.entry-panel, .slide')) runTally(b);
  });
}

function setCard(entry, open) {
  entry.classList.toggle('is-open', open);
  entry.querySelector('.entry-head')?.setAttribute('aria-expanded', open ? 'true' : 'false');

  const panel = entry.querySelector('.entry-panel');
  if (panel) panel.style.maxHeight = open ? `${panel.scrollHeight}px` : '';

  if (open) entry.querySelectorAll('[data-tally]').forEach(runTally);
}

function initExpandableCards() {
  document.querySelectorAll('[data-entry]').forEach((entry) => {
    const head = entry.querySelector('.entry-head');
    const panel = entry.querySelector('.entry-panel');
    if (!head || !panel) return;

    head.addEventListener('click', (e) => {
      e.stopPropagation();
      setCard(entry, !entry.classList.contains('is-open'));
    });
  });

  document.querySelectorAll('[data-all]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sheet = btn.closest('.sheet');
      if (!sheet) return;

      const entries = [...sheet.querySelectorAll('[data-entry]')];
      const opening = !entries.every((en) => en.classList.contains('is-open'));
      entries.forEach((en) => setCard(en, opening));
      syncAllButton(btn, opening);
    });
  });
}

function syncAllButton(btn, opened) {
  btn.textContent = opened ? 'Close all' : 'Open all';
  btn.setAttribute('aria-expanded', opened ? 'true' : 'false');
}

/* Each coverage card carries the SAME series its row is running outside, so
   the sparkline in the panel and the columns on the floor are one drawing
   seen twice. Nothing here is a quote; see the note on the sheet. */
function initTickerCards() {
  TICKERS.forEach((tk) => {
    const svg = document.querySelector(`.spark[data-spark="${tk.sym}"]`);
    const line = svg?.querySelector('polyline');
    if (!line) return;

    const N = 48;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const v = tk.series[i * 2 % SERIES_LEN];
      pts.push(`${(i / (N - 1) * 120).toFixed(1)},${(28 - v * 26).toFixed(1)}`);
    }
    line.setAttribute('points', pts.join(' '));

    const first = tk.series[0], last = tk.series[(N - 1) * 2 % SERIES_LEN];
    svg.classList.add(last >= first ? 'is-up' : 'is-down');
  });
}

/** Collapse every card in a sheet, so it reopens fresh and re-plays. */
function collapseCards(sheetEl) {
  sheetEl.querySelectorAll('[data-entry]').forEach((entry) => {
    entry.classList.remove('is-open');
    entry.querySelector('.entry-head')?.setAttribute('aria-expanded', 'false');
    const p = entry.querySelector('.entry-panel');
    if (p) p.style.maxHeight = '';
  });
  sheetEl.querySelectorAll('[data-all]').forEach((b) => syncAllButton(b, false));
}
/* ============================================================================
   18d · THE RESUME DECK

   The resume is the one station that is not a page. It runs as a reel of
   landscape plates that advances itself and stops the moment anybody touches
   it. Two kinds of touch, deliberately different:

     a HOLD  — pointing at a tile or a cited figure, or standing in front of
               a deep dive. The clock freezes and starts again on its own
               when you look away.
     a STOP  — pressing a control, a key or dragging. The reel hands over
               and stays handed over until play is pressed.

   Repetitive geometry inside the drawings is stamped here rather than typed
   into the markup: sixty children, eighty fab tools, forty years of cash
   flow. The markup carries the drawing; this carries the fill.
   ========================================================================= */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Terse SVG builder. `text` sets the node's text content, everything else
    is an attribute, and undefined values are skipped so callers can pass
    optional geometry without guarding each one. */
function sv(tag, attrs, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v === undefined || v === null) continue;
    if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  if (parent) parent.appendChild(n);
  return n;
}

/* The dives sample, fit and chart real numbers. Seeding the generator keeps
   them real without making them different every time — the control chart
   alarms on the same point, and the classifier lands on the same accuracy. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller, so a normal in these figures is an actual normal. */
function gauss(r) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0 before `a`, 1 after `b`, smoothly eased between. */
const ramp = (t, a, b) => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const lerp = (a, b, k) => a + (b - a) * k;
const fx = (v, n = 1) => v.toFixed(n);

/* ============================================================================
   18d.1 · STAMPING THE DRAWINGS
   ========================================================================= */

function stampHeroes() {
  stampFab();
  stampPitch();
  stampSift();
  stampWeb();
  stampBoard();
  stampTeach();
  stampDcf();
}

/** Delay a CSS entrance without a stylesheet rule per element. */
const delay = (n, ms) => { n.style.animationDelay = `${ms}ms`; return n; };

/* ---- the fab floor: five bays, eighty tools, seven flagged ---- */
function stampFab() {
  const fig = document.querySelector('.hero-fab');
  if (!fig) return;
  const bays = fig.querySelector('.bays');
  const tools = fig.querySelector('.tools');
  const flags = fig.querySelector('.flags');
  const rows = 5, cols = 16, rowH = 212 / rows;

  for (let i = 1; i < rows; i++) {
    sv('line', { x1: 18, y1: 20 + i * rowH, x2: 422, y2: 20 + i * rowH }, bays);
  }

  // seven cells the review shortlists, spread so no bay reads as untouched
  const flagged = new Set([3, 19, 26, 41, 55, 62, 74]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = r * cols + c;
      const x = 26 + c * 24.5, y = 20 + r * rowH + 11;
      delay(sv('rect', { x, y, width: 18, height: 20 }, tools), n * 7);
      if (flagged.has(n)) {
        delay(sv('rect', { x: x - 2.5, y: y - 2.5, width: 23, height: 25 }, flags),
              900 + (n % 7) * 120);
      }
    }
  }
}

/* ---- the pitch: eighteen programmes, one shape, twelve briefings ---- */
function stampPitch() {
  const fig = document.querySelector('.hero-pitch');
  if (!fig) return;

  const opps = fig.querySelector('.opps');
  const nOpp = +opps.dataset.oppTicks;
  for (let i = 0; i < nOpp; i++) {
    const r = sv('rect', { x: 196 + i * 12.56, y: 6, width: 9, height: 8 }, opps);
    if (i % 3 === 0) r.setAttribute('class', 'lit');
    delay(r, i * 34);
  }

  // a 4-4-2 read off the scouting side, attacking right
  const shape = fig.querySelector('.shape');
  const spots = [
    [44, 136],
    [102, 58], [102, 108], [102, 164], [102, 214],
    [178, 62], [178, 114], [178, 158], [178, 210],
    [258, 98], [258, 174],
  ];
  spots.forEach(([cx, cy], i) => delay(sv('circle', { cx, cy, r: 6 }, shape), 400 + i * 45));

  const wk = fig.querySelector('.weeks');
  const nWk = +wk.dataset.weekTicks;
  for (let i = 0; i < nWk; i++) {
    delay(sv('rect', { x: 132 + i * 14.3, y: 254, width: 9, height: 8 }, wk), i * 130);
  }
}

/* ---- the inbox, the gate, and the fifteen percent ---- */
function stampSift() {
  const fig = document.querySelector('.hero-sift');
  if (!fig) return;

  const inbox = fig.querySelector('.inbox');
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 3; c++) {
      delay(sv('rect', { x: 18 + c * 38, y: 26 + r * 20, width: 30, height: 14, rx: 1 }, inbox),
            ((r * 3 + c) % 21) * 130);
    }
  }

  const drip = fig.querySelector('.drip');
  for (let i = 0; i < 3; i++) {
    delay(sv('circle', { cx: 361, cy: 148, r: 2.6 }, drip), 900 + i * 800);
  }
}

/* ---- the chair, eight members, fourteen alumni ---- */
function stampWeb() {
  const fig = document.querySelector('.hero-web');
  if (!fig) return;
  const CX = 220, CY = 152;
  const spokes = fig.querySelector('.spokes');
  const members = fig.querySelector('.members');
  const alumni = fig.querySelector('.alumni');

  // both rings are offset off vertical so nothing sits under its own label
  const mem = [];
  for (let i = 0; i < 8; i++) {
    const a = (-90 + 22.5 + i * 45) * Math.PI / 180;
    const x = CX + Math.cos(a) * 62, y = CY + Math.sin(a) * 62;
    mem.push([x, y]);
    delay(sv('line', { x1: CX, y1: CY, x2: x, y2: y }, spokes), i * 70);
    delay(sv('circle', { cx: x, cy: y, r: 6 }, members), 400 + i * 60);
  }

  for (let i = 0; i < 14; i++) {
    const a = (-90 + 12.9 + i * (360 / 14)) * Math.PI / 180;
    const x = CX + Math.cos(a) * 112, y = CY + Math.sin(a) * 112;
    const from = mem[Math.round(i * 8 / 14) % 8];
    delay(sv('line', { x1: from[0], y1: from[1], x2: x, y2: y }, spokes), 500 + i * 45);
    delay(sv('circle', { cx: x, cy: y, r: 4.5 }, alumni), 800 + i * 50);
  }
}

/* ---- the board, the route, the ladder, the roster ---- */
function stampBoard() {
  const fig = document.querySelector('.hero-board');
  if (!fig) return;

  const board = fig.querySelector('.board');
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue;
      sv('rect', { x: 18 + c * 27, y: 22 + r * 27, width: 27, height: 27 }, board);
    }
  }

  // the same squares the route path visits, so the stops sit on the line
  const stops = fig.querySelector('.stops');
  const squares = [[1, 7], [2, 5], [4, 6], [5, 4], [3, 3], [4, 1], [6, 2], [7, 0]];
  squares.forEach(([c, r], i) => {
    delay(sv('circle', { cx: 31.5 + c * 27, cy: 35.5 + r * 27, r: 5 }, stops), 500 + i * 260);
  });

  const seats = fig.querySelector('.seats');
  for (let i = 0; i < +seats.dataset.seats; i++) {
    const s = sv('rect', { x: 262 + i * 24, y: 250, width: 18, height: 22 }, seats);
    if (i === 0) s.setAttribute('class', 'lit');   // the captain's board
    delay(s, 900 + i * 90);
  }
}

/* ---- three mentors, sixty children, fourteen weeks ---- */
function stampTeach() {
  const fig = document.querySelector('.hero-teach');
  if (!fig) return;

  const leads = fig.querySelector('.leads');
  const seats = [44, 104, 164];
  seats.forEach((y, i) => delay(sv('circle', { cx: 228, cy: y, r: 6 }, leads), 300 + i * 110));

  const fan = fig.querySelector('.fan');
  seats.forEach((y, i) => {
    [-34, 34].forEach((dy, j) => {
      delay(sv('path', { d: `M234 ${y} C262 ${y}, 272 ${y + dy}, 292 ${y + dy}` }, fan),
            500 + (i * 2 + j) * 70);
    });
  });

  const kids = fig.querySelector('.kids');
  const n = +kids.dataset.dotField;
  for (let i = 0; i < n; i++) {
    const c = i % 10, r = (i / 10) | 0;
    delay(sv('circle', { cx: 298 + c * 13, cy: 34 + r * 23, r: 3.5 }, kids), 700 + i * 14);
  }

  const sess = fig.querySelector('.sessions');
  for (let i = 0; i < +sess.dataset.weekTicks; i++) {
    delay(sv('rect', { x: 260 + i * 11.6, y: 189, width: 8, height: 8 }, sess), i * 110);
  }
}

/* ---- forty years of cash flow, and what actually moves it ----

   The bars are the annual flows, the line is the cumulative discounted
   position, and the payback marker is placed where that line changes sign —
   computed here rather than eyeballed, so the drawing and the arithmetic
   cannot drift apart. */
function stampDcf() {
  const fig = document.querySelector('.hero-dcf');
  if (!fig) return;
  const YRS = 40, X0 = 90, XW = 332, ZERO = 150, RATE = 0.06;
  const step = XW / YRS;

  const cf = [];
  for (let i = 0; i < YRS; i++) {
    cf.push(i === 0 ? -40 : i === 1 ? -12 : 11.2 * Math.pow(0.994, i));
  }

  const cum = [];
  let run = 0;
  cf.forEach((v, i) => { run += v / Math.pow(1 + RATE, i); cum.push(run); });

  const maxAbs = Math.max(...cf.map(Math.abs));
  const barK = 52 / maxAbs;

  const bars = fig.querySelector('.bars');
  cf.forEach((v, i) => {
    const h = Math.max(1.5, Math.abs(v) * barK);
    const up = v >= 0;
    const r = sv('rect', {
      x: X0 + i * step, y: up ? ZERO - h : ZERO,
      width: Math.max(3, step - 2.4), height: h,
      class: up ? 'pos' : 'neg',
    }, bars);
    r.style.setProperty('--o', up ? '100%' : '0%');
    delay(r, 200 + i * 26);
  });

  // the cumulative line gets its own scale; it travels much further than a bar
  const lo = Math.min(...cum), hi = Math.max(...cum);
  const cy = (v) => 202 - ((v - lo) / (hi - lo)) * 150;
  fig.querySelector('.cum').setAttribute(
    'd', cum.map((v, i) => `${i ? 'L' : 'M'}${fx(X0 + i * step + step / 2)} ${fx(cy(v))}`).join(' '));

  const cross = cum.findIndex((v) => v >= 0);
  const px = X0 + cross * step + step / 2;
  const pb = fig.querySelector('.payback');
  pb.querySelector('.pb').setAttribute('x1', fx(px));
  pb.querySelector('.pb').setAttribute('x2', fx(px));
  pb.querySelector('.pbk').setAttribute('x', fx(px));

  /* Sensitivity, ranked. One-at-a-time sweeps: the ordering is the
     deliverable, so the bars are drawn widest-first by construction. */
  const tor = fig.querySelector('.tornado');
  const drivers = [
    ['PPA PRICE', 46, 38], ['CAPEX', 34, 30], ['DISCOUNT RATE', 27, 21],
    ['DEGRADATION', 17, 15], ['O&M', 12, 10], ['ITC', 8, 6],
  ];
  const TCX = 220;
  drivers.forEach(([name, wl, wr], k) => {
    const y = 256 + k * 6.4;
    sv('text', { x: 18, y: y + 5, text: name }, tor);
    const l = sv('rect', { x: TCX - wl, y, width: wl, height: 5 }, tor);
    const r = sv('rect', { x: TCX, y, width: wr, height: 5 }, tor);
    l.style.setProperty('--tx', '100%');
    r.style.setProperty('--tx', '0%');
    delay(l, 400 + k * 90);
    delay(r, 440 + k * 90);
  });
  sv('line', { x1: TCX, y1: 252, x2: TCX, y2: 296 }, tor);
}

/* ---- the thumbnail behind each tile: the dive, at a glance ---- */
const TILE_GLYPHS = {
  sql: '<path d="M8 10a10 4 0 1 0 20 0a10 4 0 1 0-20 0M8 10v8a10 4 0 0 0 20 0v-8M8 18v8a10 4 0 0 0 20 0v-8"/>',
  python: '<path d="M14 8 L6 20 L14 32M26 8 L34 20 L26 32"/><path class="f" d="M17 26h6v3h-6z"/><path d="M17 12h6M17 18h6"/>',
  prob: '<path d="M4 32 C12 32, 12 8, 20 8 C28 8, 28 32, 36 32"/><path class="f" d="M16 20h3v12h-3zM21 15h3v17h-3zM26 22h3v10h-3z"/>',
  tableau: '<path d="M4 6h14v14H4zM22 6h14v9H22zM4 24h14v10H4zM22 19h14v15H22z"/>',
  doe: '<path d="M12 12 L28 12 L28 28 L12 28 Z M6 18 L22 18 L22 34 L6 34 Z M12 12 L6 18 M28 12 L22 18 M28 28 L22 34"/>',
  sigma: '<path d="M4 20h32"/><path d="M4 28 L10 24 L15 30 L20 22 L25 26 L30 6 L36 24"/><circle class="f" cx="30" cy="6" r="3"/>',
  ml: '<path d="M6 34 L34 8"/><path class="f" d="M9 12h3v3H9zM15 8h3v3h-3zM14 17h3v3h-3zM23 26h3v3h-3zM29 22h3v3h-3zM26 32h3v3h-3z"/>',
};

function stampTileGlyphs() {
  document.querySelectorAll('.tile-glyph[data-glyph]').forEach((g) => {
    const d = TILE_GLYPHS[g.dataset.glyph];
    if (d) g.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true">${d}</svg>`;
  });
}

/* ============================================================================
   18d.2 · THE REEL
   ========================================================================= */

const DECK_HOLD = 10500;     // ms a plate holds before the reel moves on
const DRAG_THROW = 60;       // px of drag that counts as a throw

const deck = {
  sheet: null, reel: null, prog: null, slides: [], dots: [],
  i: 0, playing: true, t: 0, last: 0, raf: 0, live: false,
  holds: new Set(),          // named, so an unbalanced pair cannot wedge it
};

function initResumeDeck() {
  const sheet = document.getElementById('sheet-resume');
  if (!sheet) return;

  deck.sheet = sheet;
  deck.reel = sheet.querySelector('#deck-reel');
  deck.prog = sheet.querySelector('#deck-prog');
  deck.slides = [...sheet.querySelectorAll('.slide')];
  if (!deck.slides.length) return;

  stampHeroes();
  stampTileGlyphs();
  buildFilmStrip();
  deck.slides.forEach(wireSlideNotes);

  sheet.querySelector('[data-dk="prev"]').addEventListener('click', () => nudge(-1));
  sheet.querySelector('[data-dk="next"]').addEventListener('click', () => nudge(1));
  sheet.querySelector('[data-dk="play"]').addEventListener('click', togglePlay);

  sheet.querySelectorAll('.tile[data-dive]').forEach((tile) => {
    tile.addEventListener('click', () => openDive(tile.dataset.dive));
    tile.addEventListener('mouseenter', () => holdReel('tile'));
    tile.addEventListener('mouseleave', () => releaseReel('tile'));
    tile.addEventListener('focus', () => holdReel('tile'));
    tile.addEventListener('blur', () => releaseReel('tile'));
  });

  sheet.querySelectorAll('[data-deep-close]').forEach((b) => {
    b.addEventListener('click', closeDive);
  });
  sheet.querySelector('.deep-stage').addEventListener('mouseenter', () => diveHold(true));
  sheet.querySelector('.deep-stage').addEventListener('mouseleave', () => diveHold(false));

  wireDrag(sheet.querySelector('.deck-view'));

  addEventListener('keydown', (e) => {
    if (!deck.live || diveOpen()) return;
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowRight') { nudge(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { nudge(-1); e.preventDefault(); }
    else if (e.key === ' ' && !e.target.closest?.('button')) { togglePlay(); e.preventDefault(); }
  });

  showSlide(0, 'fwd');
}

/** One label per plate, sized to the strip: a film edge, not a row of dots. */
function buildFilmStrip() {
  const strip = deck.sheet.querySelector('#deck-dots');
  deck.slides.forEach((s, n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot';
    b.textContent = s.dataset.slide;
    b.setAttribute('aria-label', `Slide ${n + 1}: ${s.dataset.slide}`);
    b.addEventListener('click', () => { stopReel(); showSlide(n, n > deck.i ? 'fwd' : 'bwd'); });
    strip.appendChild(b);
    deck.dots.push(b);
  });
  deck.sheet.querySelector('#dk-n').textContent = deck.slides.length;
}

function showSlide(n, dir) {
  const N = deck.slides.length;
  const next = ((n % N) + N) % N;
  const cur = deck.slides[deck.i];

  if (cur && next !== deck.i) {
    cur.classList.remove('is-live');
    cur.classList.add('is-leaving');
    // the class has to come off again or the plate never returns to its side
    setTimeout(() => cur.classList.remove('is-leaving'), 700);
  }

  deck.reel.dataset.dir = dir;
  deck.i = next;

  const slide = deck.slides[next];
  slide.classList.remove('is-leaving');
  slide.classList.add('is-live');

  // the figures on a plate count up as it arrives, not when the sheet opened
  slide.querySelectorAll('[data-tally]').forEach(runTally);

  deck.sheet.querySelector('#deck-slug').textContent = slide.dataset.kicker || slide.dataset.slide;
  deck.sheet.querySelector('#dk-i').textContent = next + 1;
  deck.dots.forEach((d, k) => {
    d.classList.toggle('is-on', k === next);
    d.setAttribute('aria-current', k === next ? 'true' : 'false');
  });

  deck.t = 0;
  paintProgress(0);
}

function nudge(step) {
  stopReel();
  showSlide(deck.i + step, step > 0 ? 'fwd' : 'bwd');
}

/* ---- the clock ---- */

function paintProgress(k) {
  if (deck.prog) deck.prog.style.width = `${k * 100}%`;
}

function deckTick(now) {
  deck.raf = requestAnimationFrame(deckTick);
  const dt = now - (deck.last || now);
  deck.last = now;

  if (!deck.playing || deck.holds.size) return;

  deck.t += dt;
  if (deck.t >= DECK_HOLD) showSlide(deck.i + 1, 'fwd');
  else paintProgress(deck.t / DECK_HOLD);
}

function startDeck() {
  deck.live = true;
  deck.playing = !reduceMotion;
  deck.holds.clear();
  syncPlayButton();
  showSlide(0, 'fwd');
  if (!deck.raf) { deck.last = 0; deck.raf = requestAnimationFrame(deckTick); }
}

function stopDeck() {
  deck.live = false;
  closeDive();
  cancelAnimationFrame(deck.raf);
  deck.raf = 0;
}

function stopReel() {
  deck.playing = false;
  syncPlayButton();
}

function togglePlay() {
  deck.playing = !deck.playing;
  if (deck.playing) deck.t = 0;
  syncPlayButton();
}

function syncPlayButton() {
  const b = deck.sheet?.querySelector('[data-dk="play"]');
  if (!b) return;
  b.classList.toggle('is-playing', deck.playing);
  b.setAttribute('aria-pressed', deck.playing ? 'true' : 'false');
  b.setAttribute('aria-label', deck.playing ? 'Pause the reel' : 'Play the reel');
}

/* A hold is temporary and lifts itself; a stop is a handover. Named apart
   from the ride's own release(), which lets the camera go. */
function holdReel(k) { deck.holds.add(k); }
function releaseReel(k) { deck.holds.delete(k); }

/* ---- throwing the reel by hand ---- */

function wireDrag(view) {
  if (!view) return;
  let id = null, x0 = 0;

  view.addEventListener('pointerdown', (e) => {
    if (e.button || e.target.closest('button, a, [data-note]')) return;
    id = e.pointerId; x0 = e.clientX;
    view.setPointerCapture(id);
  });

  const end = (e) => {
    if (id === null || e.pointerId !== id) return;
    const dx = e.clientX - x0;
    view.releasePointerCapture?.(id);
    id = null;
    if (Math.abs(dx) > DRAG_THROW) nudge(dx < 0 ? 1 : -1);
  };

  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
}

/* ---- the note a cited figure writes into ----

   A block at the foot of the plate rather than a floating tooltip: it never
   has to be positioned, it never covers the line being read, and it reads
   like the notes field on a drawing. */
function wireSlideNotes(slide) {
  const cited = slide.querySelectorAll('.beat-t b[data-note]');
  const slot = slide.querySelector('[data-note-slot]');
  if (!cited.length || !slot) return;

  const IDLE = slot.textContent;
  slot.classList.add('is-idle');

  const show = (b) => {
    cited.forEach((o) => o.classList.toggle('is-cited', o === b));
    slot.textContent = b.dataset.note;
    slot.classList.remove('is-idle');
    holdReel('note');
  };
  const reset = () => {
    cited.forEach((o) => o.classList.remove('is-cited'));
    slot.textContent = IDLE;
    slot.classList.add('is-idle');
    releaseReel('note');
  };

  cited.forEach((b) => {
    b.tabIndex = 0;
    b.addEventListener('mouseenter', () => show(b));
    b.addEventListener('mouseleave', reset);
    b.addEventListener('focus', () => show(b));
    b.addEventListener('blur', reset);
  });
}

/* ============================================================================
   18d.3 · DEEP DIVES

   A tile press pushes the reel back and takes the stage. Every figure here
   is computed rather than keyframed — the sampling really samples, the
   classifier really counts its mistakes, the control chart really breaches
   its own limit — because a drawing of statistics that is only a drawing is
   the one thing this page should not be.
   ========================================================================= */

const DV_W = 1000, DV_H = 460;
const DIVE_LINGER = 2800;     // ms the finished figure stands before it leaves

let dive = null;

function diveOpen() { return !!dive; }
function diveHold(on) { if (dive) dive.held = on; }

function openDive(key) {
  const spec = DIVES[key];
  if (!spec || !deck.sheet) return;
  closeDive();

  const wrap = deck.sheet.querySelector('#deep');
  const art = deck.sheet.querySelector('#deep-art');
  const read = deck.sheet.querySelector('#deep-read');

  deck.sheet.querySelector('#deep-k').textContent = spec.k;
  deck.sheet.querySelector('#deep-t').textContent = spec.t;
  deck.sheet.querySelector('#deep-s').textContent = spec.s;

  art.textContent = '';
  read.textContent = '';
  const root = sv('svg', {
    viewBox: `0 0 ${DV_W} ${DV_H}`,
    preserveAspectRatio: 'xMidYMid meet',
    class: `dv dv-${key}`,
  }, art);

  const step = spec.build(root, read) || (() => {});
  holdReel('dive');

  wrap.hidden = false;
  requestAnimationFrame(() => wrap.classList.add('is-on'));

  dive = { step, dur: spec.dur, t: 0, last: 0, raf: 0, held: false, from: document.activeElement };

  if (reduceMotion) { step(spec.dur); return; }   // draw it arrived, and hold
  dive.raf = requestAnimationFrame(diveTick);
}

function diveTick(now) {
  if (!dive) return;
  dive.raf = requestAnimationFrame(diveTick);

  const dt = now - (dive.last || now);
  dive.last = now;
  if (dive.held) return;                          // standing in front of it holds it

  dive.t += dt;
  dive.step(Math.min(dive.t, dive.dur));

  const total = dive.dur + DIVE_LINGER;
  const bar = deck.sheet.querySelector('#deep-timer');
  if (bar) bar.style.transform = `scaleX(${Math.max(0, 1 - dive.t / total)})`;
  if (dive.t >= total) closeDive();
}

/** @returns true if there was a dive to close — Escape uses this to decide
    whether it is closing the figure or the whole sheet. */
function closeDive() {
  if (!dive) return false;
  cancelAnimationFrame(dive.raf);

  const wrap = deck.sheet.querySelector('#deep');
  wrap.classList.remove('is-on');
  setTimeout(() => {
    wrap.hidden = true;
    deck.sheet.querySelector('#deep-art').textContent = '';
  }, 400);

  const back = dive.from;
  dive = null;
  releaseReel('dive');
  back?.focus?.();
  return true;
}

/* ---------------------------------------------------------------------------
   SQL — thirteen stores, one keyed record
   ------------------------------------------------------------------------ */
function dvSql(root, read) {
  const CX = 500, CY = 216;
  const TW = 300, TH = 176, TX = CX - TW / 2, TY = CY - TH / 2;

  const NAMES = ['SNOWFLAKE', 'MSSQL', 'AZURE SQL', 'ERP', 'TOOL MASTER', 'COST CTR',
                 'BAY MAP', 'FAB OPS', 'CAPEX', 'MAINT', 'VENDOR', 'FLOOR PLAN', 'FY PLAN'];
  const N = NAMES.length;

  const gEdge = sv('g', {}, root);
  const gChord = sv('g', {}, root);
  const gNode = sv('g', {}, root);
  const gTok = sv('g', {}, root);

  const nodes = NAMES.map((name, i) => {
    const a = (-90 + i * (360 / N)) * Math.PI / 180;
    const x = CX + Math.cos(a) * 402, y = CY + Math.sin(a) * 192;
    const g = sv('g', {}, gNode);
    g.style.opacity = 0;

    // a store, drawn the way a store is always drawn
    sv('path', { class: 'box', d: `M${x - 22} ${y - 11} v22 a22 6 0 0 0 44 0 v-22 z` }, g);
    sv('ellipse', { class: 'box', cx: x, cy: y - 11, rx: 22, ry: 6 }, g);
    sv('path', { d: `M${x - 22} ${y} a22 6 0 0 0 44 0` }, g);

    const right = Math.cos(a) > -0.15;
    sv('text', {
      class: 'key faint', x: right ? x + 28 : x - 28, y: y + 4,
      'text-anchor': right ? 'start' : 'end', text: name,
    }, g);

    const e = sv('line', { class: 'gl', x1: x, y1: y, x2: CX, y2: CY }, gEdge);
    e.style.opacity = 0;
    const len = Math.hypot(x - CX, y - CY);
    e.setAttribute('stroke-dasharray', len);
    e.setAttribute('stroke-dashoffset', len);

    const tok = sv('rect', { class: 'bar', x: -5, y: -3.5, width: 10, height: 7 }, gTok);
    tok.style.opacity = 0;

    return { x, y, g, e, len, tok };
  });

  // chords around the ring: the sources talk to each other, not just to the join
  const chords = nodes.map((n, i) => {
    const m = nodes[(i + 1) % N];
    const mx = (n.x + m.x) / 2, my = (n.y + m.y) / 2;
    const c = sv('path', {
      class: 'gl',
      d: `M${fx(n.x)} ${fx(n.y)} Q${fx(CX + (mx - CX) * 1.22)} ${fx(CY + (my - CY) * 1.22)} ${fx(m.x)} ${fx(m.y)}`,
    }, gChord);
    c.style.opacity = 0;
    return c;
  });

  // the join result, laid over everything the lines were doing
  const tbl = sv('g', {}, root);
  tbl.style.opacity = 0;
  sv('rect', { class: 'box', x: TX, y: TY, width: TW, height: TH, style: 'fill:var(--paper-lit)' }, tbl);
  sv('line', { class: 'ax', x1: TX, y1: TY + 24, x2: TX + TW, y2: TY + 24 }, tbl);

  const COLS = [['TOOL_ID', 12], ['BAY', 92], ['ATTR', 140], ['COST_CTR', 194], ['FY', 264]];
  const head = sv('g', {}, tbl);
  head.style.opacity = 0;
  COLS.forEach(([c, dx]) => sv('text', { class: 'key hi', x: TX + dx, y: TY + 17, text: c }, head));

  const CELLS = [
    ['TL-0412', 'B3', '22/22', 'CC-8810', 'FY27'],
    ['TL-0517', 'B1', '22/22', 'CC-8810', 'FY27'],
    ['TL-0620', 'B4', '22/22', 'CC-9142', 'FY28'],
    ['TL-0733', 'B2', '22/22', 'CC-9142', 'FY27'],
    ['TL-0861', 'B5', '22/22', 'CC-8810', 'FY29'],
    ['TL-0904', 'B3', '22/22', 'CC-7705', 'FY28'],
  ];
  const rows = CELLS.map((cells, j) => {
    const g = sv('g', {}, tbl);
    g.style.opacity = 0;
    const y = TY + 24 + j * 25;
    if (j) sv('line', { class: 'gl', x1: TX + 8, y1: y, x2: TX + TW - 8, y2: y }, g);
    cells.forEach((v, c) => sv('text', { class: 'key', x: TX + COLS[c][1], y: y + 17, text: v }, g));
    return g;
  });

  const QUERY =
    'SELECT t.tool_id, b.bay, c.cost_ctr, f.fy, t.attrs  ' +
    'FROM tool_master t  JOIN bay_map b USING (tool_id)  ' +
    'JOIN cost_ctr c USING (tool_id)  LEFT JOIN fy_plan f USING (tool_id)';

  return (t) => {
    nodes.forEach((n, i) => {
      n.g.style.opacity = ramp(t, i * 62, i * 62 + 320);
      const k = ramp(t, 620 + i * 52, 1420 + i * 52);
      n.e.style.opacity = k;
      n.e.setAttribute('stroke-dashoffset', fx(n.len * (1 - k)));

      // a key rides each edge into the join, over and over, while it runs
      const start = 1700 + i * 88;
      if (t < start || t > 7400) { n.tok.style.opacity = 0; return; }
      const p = ((t - start) % 1500) / 1500;
      n.tok.style.opacity = p < 0.88 ? 1 : 0;
      n.tok.setAttribute('transform',
        `translate(${fx(lerp(n.x, CX, p))} ${fx(lerp(n.y, CY, p))})`);
    });

    chords.forEach((c, i) => { c.style.opacity = ramp(t, 1400 + i * 55, 1900 + i * 55) * 0.55; });

    tbl.style.opacity = ramp(t, 2000, 2500);
    head.style.opacity = ramp(t, 2300, 2700);
    rows.forEach((r, j) => { r.style.opacity = ramp(t, 2800 + j * 340, 3200 + j * 340); });

    if (t < 6600) {
      const n = Math.max(0, Math.floor((t - 2500) / 10));
      read.textContent = QUERY.slice(0, n) + (n < QUERY.length && (t | 0) % 700 < 350 ? '_' : '');
    } else {
      read.innerHTML =
        'joined on <b>tool_id</b> &middot; <b>13</b> sources &middot; <b>22</b> attributes per tool ' +
        '&middot; <b>~1,500</b> tools &middot; data quality <b>+7%</b>';
    }
  };
}

/* ---------------------------------------------------------------------------
   PROBABILITY — whatever the shape is, the mean goes normal

   An exponential is drawn from on the left. Thirty draws are averaged, the
   average is dropped into the histogram on the right, and that repeats five
   hundred times. Nothing about the right-hand shape is drawn in advance.
   ------------------------------------------------------------------------ */
function dvProb(root, read) {
  const R = rng(731);
  const N = 30, TRIALS = 520, MU = 1, SD = 1;
  const SE = SD / Math.sqrt(N);
  const BASE = 384, TOP = 108;

  /* --- the population, sampled hard enough to show its own shape --- */
  const SBINS = 24, SHI = 4.5, SW = SHI / SBINS;
  const scount = new Array(SBINS).fill(0);
  for (let i = 0; i < 6000; i++) {
    const v = -Math.log(1 - R());
    const b = Math.min(SBINS - 1, (v / SW) | 0);
    scount[b]++;
  }
  const smax = Math.max(...scount);

  const SX = 70, SWID = 230;
  sv('text', { class: 'lb', x: SX, y: 76, text: 'POPULATION — EXPONENTIAL, SKEWED' }, root);
  sv('line', { class: 'ax', x1: SX, y1: BASE, x2: SX + SWID, y2: BASE }, root);
  const sbars = scount.map((c, i) => {
    const h = (c / smax) * (BASE - TOP);
    const r = sv('rect', { class: 'bar dim', x: SX + i * (SWID / SBINS), y: BASE - h,
                           width: SWID / SBINS - 1.5, height: h }, root);
    r.style.opacity = 0;
    return { el: r, h };
  });
  sv('text', { class: 'key faint', x: SX, y: BASE + 20, text: 'x' }, root);
  sv('text', { class: 'key faint end', x: SX + SWID, y: BASE + 20, text: '4.5' }, root);

  /* --- every trial mean, computed once, revealed over time --- */
  const means = [];
  for (let k = 0; k < TRIALS; k++) {
    let s = 0;
    for (let i = 0; i < N; i++) s += -Math.log(1 - R());
    means.push(s / N);
  }

  const MBINS = 30, MLO = MU - 4.2 * SE, MHI = MU + 4.2 * SE, MW = (MHI - MLO) / MBINS;
  const MX = 400, MWID = 550, MBW = MWID / MBINS;
  const peak = (1 / (SE * Math.sqrt(2 * Math.PI))) * TRIALS * MW;
  const yK = (BASE - TOP) / (peak * 1.16);

  sv('text', { class: 'lb', x: MX, y: 76, text: `MEAN OF ${N} DRAWS — REPEATED ${TRIALS}×` }, root);

  const bands = sv('g', {}, root);
  const mkBand = (k) => {
    const b = sv('rect', {
      class: 'fill',
      x: MX + ((MU - k * SE) - MLO) / MW * MBW, y: TOP,
      width: (2 * k * SE) / MW * MBW, height: BASE - TOP,
    }, bands);
    b.style.opacity = 0;
    return b;
  };
  const band2 = mkBand(2), band1 = mkBand(1);

  sv('line', { class: 'ax', x1: MX, y1: BASE, x2: MX + MWID, y2: BASE }, root);
  const mbars = [];
  for (let i = 0; i < MBINS; i++) {
    mbars.push(sv('rect', { class: 'bar', x: MX + i * MBW, y: BASE, width: MBW - 1.8, height: 0 }, root));
  }

  const curve = sv('path', { class: 'ln hi' }, root);
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const x = MLO + (i / 120) * (MHI - MLO);
    const d = Math.exp(-((x - MU) ** 2) / (2 * SE * SE)) / (SE * Math.sqrt(2 * Math.PI));
    pts.push(`${i ? 'L' : 'M'}${fx(MX + ((x - MLO) / MW) * MBW)} ${fx(BASE - d * TRIALS * MW * yK)}`);
  }
  curve.setAttribute('d', pts.join(' '));
  const clen = curve.getTotalLength ? curve.getTotalLength() : 900;
  curve.setAttribute('stroke-dasharray', clen);
  curve.setAttribute('stroke-dashoffset', clen);

  const l1 = sv('text', { class: 'lb hi mid', x: MX + MWID / 2, y: TOP - 12, text: '±1σ ≈ 68%' }, root);
  const l2 = sv('text', { class: 'lb mid', x: MX + MWID / 2 + 200, y: TOP - 12, text: '±2σ ≈ 95%' }, root);
  l1.style.opacity = 0; l2.style.opacity = 0;

  sv('text', { class: 'key faint mid', x: MX + ((MU - MLO) / MW) * MBW, y: BASE + 20, text: 'μ = 1.00' }, root);

  // draws falling out of the population and into the mean
  const gDrop = sv('g', {}, root);
  const drops = [];
  for (let i = 0; i < 7; i++) {
    const d = sv('circle', { class: 'mk hi', cx: 0, cy: 0, r: 3.5 }, gDrop);
    d.style.opacity = 0;
    drops.push({ el: d, x0: SX + 20 + (i * 31) % (SWID - 40), off: i * 210 });
  }

  const T0 = 1200, T1 = 7600;

  return (t) => {
    sbars.forEach((b, i) => { b.el.style.opacity = ramp(t, 200 + i * 26, 560 + i * 26); });

    const done = Math.round(clamp01((t - T0) / (T1 - T0)) * TRIALS);
    const counts = new Array(MBINS).fill(0);
    let sum = 0, sq = 0;
    for (let k = 0; k < done; k++) {
      const v = means[k];
      sum += v; sq += v * v;
      const b = Math.floor((v - MLO) / MW);
      if (b >= 0 && b < MBINS) counts[b]++;
    }
    counts.forEach((c, i) => {
      const h = c * yK;
      mbars[i].setAttribute('y', fx(BASE - h));
      mbars[i].setAttribute('height', fx(h));
    });

    drops.forEach((d) => {
      if (t < T0 || t > T1) { d.el.style.opacity = 0; return; }
      const p = ((t - T0 + d.off) % 1400) / 1400;
      d.el.style.opacity = p < 0.85 ? 1 : 0;
      d.el.setAttribute('cx', fx(lerp(d.x0, MX + MWID / 2, p)));
      d.el.setAttribute('cy', fx(lerp(BASE - 40, BASE - 60, p) - Math.sin(p * Math.PI) * 90));
    });

    curve.setAttribute('stroke-dashoffset', fx(clen * (1 - ramp(t, 6800, 8400))));
    band2.style.opacity = ramp(t, 8500, 9200) * 0.55;
    band1.style.opacity = ramp(t, 9200, 9900);
    l1.style.opacity = ramp(t, 9300, 9900);
    l2.style.opacity = ramp(t, 8700, 9300);

    if (done > 1) {
      const m = sum / done;
      const s = Math.sqrt(Math.max(0, sq / done - m * m));
      read.innerHTML =
        `n = <b>${N}</b> per trial &middot; trials = <b>${done}</b> &middot; ` +
        `mean of means = <b>${fx(m, 3)}</b> &middot; observed sd = <b>${fx(s, 3)}</b> ` +
        `&middot; predicted σ/√n = <b>${fx(SE, 3)}</b>`;
    }
  };
}

/* ---------------------------------------------------------------------------
   PYTHON — read, clean, join, fit, write
   ------------------------------------------------------------------------ */
function dvPython(root, read) {
  const LINES = [
    'df = pd.read_sql(Q, engine)',
    'df = df.dropna(subset=KEYS)',
    'df = df.merge(bays, on="tool_id")',
    'model.fit(df[X], df["removable"])',
    'df.to_sql("tool_register", engine)',
  ];
  const AT = [200, 2600, 4800, 7000, 9200];
  const R = rng(4801);

  sv('rect', { class: 'box ghost', x: 46, y: 52, width: 384, height: 196 }, root);
  const code = LINES.map((_, i) =>
    sv('text', { class: 'key', x: 64, y: 88 + i * 34, text: '' }, root));
  LINES.forEach((_, i) => sv('text', { class: 'key faint', x: 46, y: 88 + i * 34, text: `${i + 1}` }, root));

  /* --- the frame it is all happening to --- */
  const GX = 468, GY = 52, GW = 486, ROWS = 9, RH = 26, CW = 486 / 7;
  sv('rect', { class: 'box', x: GX, y: GY, width: GW, height: 30 + ROWS * RH }, root);
  sv('line', { class: 'ax', x1: GX, y1: GY + 30, x2: GX + GW, y2: GY + 30 }, root);

  const HEAD = ['tool_id', 'bay', 'cost_ctr', 'fy', 'attrs', 'floor', 'vendor'];
  const cols = HEAD.map((h, c) => {
    const g = sv('g', {}, root);
    sv('text', { class: 'key hi', x: GX + 10 + c * CW, y: GY + 20, text: h }, g);
    if (c >= 5) g.style.opacity = 0;
    return g;
  });

  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const g = sv('g', {}, root);
    g.style.opacity = 0;
    const y = GY + 30 + r * RH;
    if (r) sv('line', { class: 'gl', x1: GX + 6, y1: y, x2: GX + GW - 6, y2: y }, root);
    const cells = HEAD.map((_, c) => {
      const v = c === 0 ? `TL-0${400 + r * 57}` :
                c === 1 ? `B${1 + (r % 5)}` :
                c === 2 ? `CC-${7700 + ((r * 311) % 1600)}` :
                c === 3 ? `FY2${7 + (r % 3)}` :
                c === 4 ? `${18 + (r % 5)}/22` :
                c === 5 ? `F${2 + (r % 3)}` : `V-${20 + r}`;
      const el = sv('text', { class: 'key', x: GX + 10 + c * CW, y: y + 18, text: v }, g);
      if (c >= 5) el.style.opacity = 0;
      return el;
    });
    // three rows arrive short of a key and do not survive the dropna
    const nulls = r === 2 || r === 5 || r === 7;
    if (nulls) { cells[2].textContent = 'NaN'; cells[3].textContent = 'NaN'; }
    rows.push({ g, cells, nulls });
  }

  const counter = sv('text', { class: 'lb end', x: GX + GW, y: 40, text: '' }, root);

  /* --- the fit, drawn from points that are actually fitted --- */
  const FX0 = 62, FY0 = 282, FW = 356, FH = 128;
  const fit = sv('g', {}, root);
  fit.style.opacity = 0;
  sv('rect', { class: 'box ghost', x: 46, y: 266, width: 384, height: 160 }, fit);
  sv('line', { class: 'ax', x1: FX0, y1: FY0 + FH, x2: FX0 + FW, y2: FY0 + FH }, fit);
  sv('line', { class: 'ax', x1: FX0, y1: FY0, x2: FX0, y2: FY0 + FH }, fit);

  const xs = [], ys = [];
  const dots = [];
  for (let i = 0; i < 26; i++) {
    const x = i / 25, y = 0.16 + 0.68 * x + gauss(R) * 0.07;
    xs.push(x); ys.push(y);
    const d = sv('circle', { class: 'mk', cx: FX0 + x * FW, cy: FY0 + FH - y * FH, r: 3 }, fit);
    d.style.opacity = 0;
    dots.push(d);
  }
  const mx = xs.reduce((a, b) => a + b) / xs.length;
  const my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  const b1 = sxy / sxx, b0 = my - b1 * mx;
  const line = sv('line', {
    class: 'ln hi',
    x1: FX0, y1: FY0 + FH - b0 * FH,
    x2: FX0 + FW, y2: FY0 + FH - (b0 + b1) * FH,
  }, fit);
  const llen = Math.hypot(FW, b1 * FH);
  line.setAttribute('stroke-dasharray', llen);
  line.setAttribute('stroke-dashoffset', llen);
  sv('text', { class: 'key faint', x: FX0 + 8, y: FY0 + 16, text: 'removable ~ f(age, util, spend)' }, fit);

  /* --- and out the other side --- */
  const tray = sv('g', {}, root);
  tray.style.opacity = 0;
  sv('rect', { class: 'box', x: 468, y: 342, width: 486, height: 76 }, tray);
  sv('path', { class: 'box', d: 'M840 356 v34 a34 9 0 0 0 68 0 v-34 z' }, tray);
  sv('ellipse', { class: 'box', cx: 874, cy: 356, rx: 34, ry: 9 }, tray);
  sv('text', { class: 'key hi', x: 492, y: 375, text: 'tool_register' }, tray);
  sv('text', { class: 'key faint', x: 492, y: 396, text: '1,394 rows written' }, tray);
  const flyers = [];
  for (let i = 0; i < 5; i++) {
    const f = sv('rect', { class: 'bar', x: 0, y: -4, width: 22, height: 8 }, tray);
    f.style.opacity = 0;
    flyers.push(f);
  }

  const type = (el, s, t, at) => {
    const n = Math.max(0, Math.floor((t - at) / 26));
    el.textContent = s.slice(0, n);
  };

  return (t) => {
    LINES.forEach((s, i) => type(code[i], s, t, AT[i]));

    rows.forEach((r, i) => {
      r.g.style.opacity = ramp(t, 700 + i * 90, 1000 + i * 90);
      if (r.nulls) {
        const flash = t > 3000 && t < 3900 && (t | 0) % 400 < 200;
        r.cells[2].setAttribute('class', flash ? 'key hi' : 'key');
        r.cells[3].setAttribute('class', flash ? 'key hi' : 'key');
        if (t > 4000) r.g.style.opacity = 1 - ramp(t, 4000, 4400);
      }
    });

    const wide = ramp(t, 5400, 6100);
    cols.forEach((g, c) => { if (c >= 5) g.style.opacity = wide; });
    rows.forEach((r) => r.cells.forEach((el, c) => { if (c >= 5) el.style.opacity = wide; }));

    const nRows = t < 4000 ? Math.round(ramp(t, 700, 2100) * 1500)
                           : Math.round(lerp(1500, 1394, ramp(t, 4000, 4400)));
    const nCols = Math.round(lerp(20, 22, wide));
    counter.textContent = t > 700 ? `${nRows.toLocaleString()} rows × ${nCols} cols` : '';

    fit.style.opacity = ramp(t, 7200, 7700);
    dots.forEach((d, i) => { d.style.opacity = ramp(t, 7500 + i * 22, 7800 + i * 22); });
    line.setAttribute('stroke-dashoffset', fx(llen * (1 - ramp(t, 8300, 9000))));

    tray.style.opacity = ramp(t, 9400, 9900);
    flyers.forEach((f, i) => {
      const start = 9800 + i * 190;
      if (t < start) { f.style.opacity = 0; return; }
      const p = ((t - start) % 900) / 900;
      f.style.opacity = p < 0.85 ? 1 : 0;
      f.setAttribute('transform', `translate(${fx(lerp(500, 848, p))} ${fx(lerp(372, 372, p))})`);
    });

    if (t > 10200) {
      read.innerHTML = 'pandas &middot; scikit-learn &middot; SQLAlchemy &mdash; ' +
        `<b>1,500</b> rows in, <b>106</b> dropped on a missing key, <b>22</b> attributes out, ` +
        `slope <b>${fx(b1, 2)}</b> back into the register`;
    } else if (t > 700) {
      let phase = 0;
      AT.forEach((a, i) => { if (t >= a) phase = i; });
      read.textContent = ['reading…', 'dropping rows short of a key…', 'joining the bay map…',
                          'fitting…', 'writing back…'][phase];
    }
  };
}

/* ---------------------------------------------------------------------------
   TABLEAU — the same sixty marks, four times over

   Nothing is redrawn between views. The marks that were a scatter are the
   marks that become the bars, the line and then the panes, which is the
   whole point of a shelf.
   ------------------------------------------------------------------------ */
function dvTableau(root, read) {
  const R = rng(9155);
  const M = 60;

  const frames = [];
  const mkFrame = (x, y, w, h, title) => {
    const g = sv('g', {}, root);
    g.style.opacity = 0;
    sv('rect', { class: 'box', x, y, width: w, height: h }, g);
    sv('line', { class: 'ax', x1: x, y1: y + 22, x2: x + w, y2: y + 22 }, g);
    sv('text', { class: 'key hi', x: x + 10, y: y + 15, text: title }, g);
    frames.push(g);
    return g;
  };
  const pA = mkFrame(72, 84, 420, 166, 'REMOVALS BY BAY');
  const pB = mkFrame(516, 84, 412, 166, 'SPEND, FY24–FY29');
  const pC = mkFrame(72, 272, 420, 148, 'UTILISATION');
  const pD = mkFrame(516, 272, 412, 148, 'AGAINST PLAN');
  void pA; void pB; void pC;

  const kpis = [];
  [['TOOLS', '1,500'], ['REVIEWED', '1,500'], ['FLAGGED', '218'], ['ΔOPEX', '−6.4%']]
    .forEach(([k, v], i) => {
      const g = sv('g', {}, pD);
      g.style.opacity = 0;
      const x = 530 + (i % 2) * 200, y = 306 + ((i / 2) | 0) * 58;
      sv('rect', { class: 'box ghost', x, y, width: 184, height: 46 }, g);
      sv('text', { class: 'key faint', x: x + 12, y: y + 17, text: k }, g);
      sv('text', { class: 'lb big ink', x: x + 12, y: y + 38, text: v }, g);
      kpis.push(g);
    });

  const marks = [];
  for (let i = 0; i < M; i++) {
    marks.push(sv('rect', { class: 'bar', x: 0, y: 0, width: 9, height: 9 }, root));
  }

  /* --- four shelves, one set of marks --- */
  const scatter = [], bars = [], line = [], dash = [], filt = [];
  for (let i = 0; i < M; i++) scatter.push([120 + R() * 780, 96 + R() * 300]);

  const HEIGHTS = [11, 9, 8, 7, 7, 6, 6, 6];
  let k = 0;
  HEIGHTS.forEach((h, b) => {
    for (let j = 0; j < h; j++) bars.push([148 + b * 96, 372 - j * 13]);
    k += h;
  });
  void k;

  for (let i = 0; i < M; i++) {
    const x = 120 + (i / (M - 1)) * 780;
    line.push([x, 300 - Math.sin(i / M * Math.PI * 1.5) * 150 - (i / M) * 60]);
  }

  // pane A takes 24 marks as six columns, B takes 16 on a series, C is a 5×4 grid
  const AH = [5, 4, 4, 4, 4, 3];
  AH.forEach((h, b) => { for (let j = 0; j < h; j++) dash.push([104 + b * 66, 236 - j * 15]); });
  for (let i = 0; i < 16; i++) {
    dash.push([534 + i * 25, 226 - Math.sin(i / 15 * Math.PI) * 88 - i * 2]);
  }
  for (let i = 0; i < 20; i++) dash.push([100 + (i % 5) * 82, 312 + ((i / 5) | 0) * 26]);

  const FH = [3, 4, 5, 4, 5, 3];
  FH.forEach((h, b) => { for (let j = 0; j < h; j++) filt.push([104 + b * 66, 236 - j * 15]); });
  for (let i = 0; i < 16; i++) {
    filt.push([534 + i * 25, 226 - Math.cos(i / 15 * Math.PI * 0.9) * 70 - i * 3]);
  }
  for (let i = 0; i < 20; i++) filt.push([100 + (i % 5) * 82, 312 + ((i / 5) | 0) * 26]);

  const chip = sv('g', {}, root);
  chip.style.opacity = 0;
  sv('rect', { class: 'box', x: 72, y: 40, width: 214, height: 28, style: 'fill:var(--paper-lit)' }, chip);
  sv('text', { class: 'key hi', x: 84, y: 59, text: 'fy = FY27   ✕' }, chip);

  const move = (from, to, e) => marks.forEach((m, i) => {
    m.setAttribute('x', fx(lerp(from[i][0], to[i][0], e)));
    m.setAttribute('y', fx(lerp(from[i][1], to[i][1], e)));
  });

  return (t) => {
    marks.forEach((m, i) => { m.style.opacity = ramp(t, i * 16, i * 16 + 300); });

    if (t < 1400) move(scatter, scatter, 0);
    else if (t < 3400) move(scatter, bars, ramp(t, 1500, 3200));
    else if (t < 5200) move(bars, line, ramp(t, 3500, 5000));
    else if (t < 7400) move(line, dash, ramp(t, 5300, 7000));
    else move(dash, filt, ramp(t, 7600, 8900));

    frames.forEach((g, i) => { g.style.opacity = ramp(t, 5500 + i * 130, 6100 + i * 130); });
    kpis.forEach((g, i) => { g.style.opacity = ramp(t, 6500 + i * 120, 7000 + i * 120); });
    chip.style.opacity = ramp(t, 7500, 7900);

    read.textContent =
      t < 1500 ? 'sixty marks, no shelf' :
      t < 3500 ? 'drop bay on columns — the marks stack' :
      t < 5300 ? 'drop fiscal year on columns — the same marks, ordered' :
      t < 7500 ? 'four panes on one sheet, still the same sixty marks' :
                 'one filter, and every pane answers at once';
  };
}

/* ---------------------------------------------------------------------------
   JMP / DOE — eight runs, three factors

   The eight responses come out of a model with a real A×B interaction, and
   the effect estimates on the right are computed from those eight numbers.
   ------------------------------------------------------------------------ */
function dvDoe(root, read) {
  const R = rng(2038);
  const CX = 250, CY = 232;
  const P = (a, b, c) => [CX + (a - b) * 104, CY + (a + b) * 50 - c * 92];

  const runs = [];
  for (let i = 0; i < 8; i++) {
    const A = i & 1 ? 1 : -1, B = i & 2 ? 1 : -1, C = i & 4 ? 1 : -1;
    const y = 52 + 7.5 * A + 3.2 * B - 1.4 * C + 4.6 * A * B + gauss(R) * 0.5;
    runs.push({ A, B, C, y, p: P(A, B, C) });
  }
  const eff = (f) => {
    const hi = runs.filter((r) => f(r) > 0), lo = runs.filter((r) => f(r) < 0);
    return hi.reduce((s, r) => s + r.y, 0) / hi.length - lo.reduce((s, r) => s + r.y, 0) / lo.length;
  };
  const eA = eff((r) => r.A), eB = eff((r) => r.B), eC = eff((r) => r.C), eAB = eff((r) => r.A * r.B);

  sv('text', { class: 'lb', x: 72, y: 62, text: '2³ FULL FACTORIAL — 8 RUNS' }, root);

  const gE = sv('g', {}, root);
  const edges = [];
  for (let i = 0; i < 8; i++) {
    for (const bit of [1, 2, 4]) {
      const j = i ^ bit;
      if (j < i) continue;
      const e = sv('line', {
        class: 'ax', x1: runs[i].p[0], y1: runs[i].p[1], x2: runs[j].p[0], y2: runs[j].p[1],
      }, gE);
      const len = Math.hypot(runs[j].p[0] - runs[i].p[0], runs[j].p[1] - runs[i].p[1]);
      e.setAttribute('stroke-dasharray', len);
      e.setAttribute('stroke-dashoffset', len);
      edges.push({ el: e, len });
    }
  }

  // standard (Yates) order, so the corners light the way the run sheet reads
  const corners = runs.map((r) => {
    const g = sv('g', {}, root);
    g.style.opacity = 0;
    sv('circle', { class: 'mk hi', cx: r.p[0], cy: r.p[1], r: 6 }, g);
    sv('text', {
      class: 'key ink', x: r.p[0] + (r.A > 0 ? 12 : -12), y: r.p[1] - 10,
      'text-anchor': r.A > 0 ? 'start' : 'end', text: fx(r.y),
    }, g);
    return g;
  });

  /* --- main effects, from the eight numbers just plotted --- */
  const gM = sv('g', {}, root);
  gM.style.opacity = 0;
  sv('text', { class: 'lb', x: 540, y: 62, text: 'MAIN EFFECTS' }, gM);
  const big = Math.max(Math.abs(eA), Math.abs(eB), Math.abs(eC));
  const ys = runs.map((r) => r.y);
  const ylo = Math.min(...ys) - 1, yhi = Math.max(...ys) + 1;
  const my = (v, top, h) => top + h - ((v - ylo) / (yhi - ylo)) * h;

  [['A', eA, (r) => r.A], ['B', eB, (r) => r.B], ['C', eC, (r) => r.C]].forEach(([nm, e, f], i) => {
    const x = 540 + i * 140, w = 108, top = 84, h = 120;
    sv('rect', { class: 'box ghost', x, y: top, width: w, height: h }, gM);
    const hi = runs.filter((r) => f(r) > 0), lo = runs.filter((r) => f(r) < 0);
    const yl = lo.reduce((s, r) => s + r.y, 0) / lo.length;
    const yh = hi.reduce((s, r) => s + r.y, 0) / hi.length;
    const cls = Math.abs(e) === big ? 'ln hi' : 'ln';
    sv('line', { class: cls, x1: x + 18, y1: my(yl, top, h), x2: x + w - 18, y2: my(yh, top, h) }, gM);
    sv('circle', { class: 'mk', cx: x + 18, cy: my(yl, top, h), r: 4 }, gM);
    sv('circle', { class: 'mk', cx: x + w - 18, cy: my(yh, top, h), r: 4 }, gM);
    sv('text', { class: 'key faint', x: x + 8, y: top + h + 16, text: '−1' }, gM);
    sv('text', { class: 'key faint end', x: x + w - 8, y: top + h + 16, text: '+1' }, gM);
    sv('text', { class: `key ${Math.abs(e) === big ? 'hi' : ''}`, x: x + 8, y: top - 8,
                 text: `${nm}  ${e > 0 ? '+' : ''}${fx(e)}` }, gM);
  });

  /* --- and the reason the main effects are not the whole story --- */
  const gI = sv('g', {}, root);
  gI.style.opacity = 0;
  sv('text', { class: 'lb hi', x: 540, y: 268, text: `A×B INTERACTION  ${eAB > 0 ? '+' : ''}${fx(eAB)}` }, gI);
  sv('rect', { class: 'box ghost', x: 540, y: 284, width: 388, height: 128 }, gI);
  [-1, 1].forEach((bLevel, i) => {
    const at = (a) => {
      const sel = runs.filter((r) => r.A === a && r.B === bLevel);
      return sel.reduce((s, r) => s + r.y, 0) / sel.length;
    };
    const y1 = 284 + 128 - ((at(-1) - ylo) / (yhi - ylo)) * 108 - 10;
    const y2 = 284 + 128 - ((at(1) - ylo) / (yhi - ylo)) * 108 - 10;
    sv('line', { class: i ? 'ln hi' : 'ln', x1: 576, y1, x2: 892, y2 }, gI);
    sv('circle', { class: 'mk', cx: 576, cy: y1, r: 4 }, gI);
    sv('circle', { class: 'mk', cx: 892, cy: y2, r: 4 }, gI);
    sv('text', { class: 'key faint', x: 900, y: y2 + 4, text: `B=${bLevel > 0 ? '+1' : '−1'}` }, gI);
  });

  return (t) => {
    edges.forEach((e, i) => {
      const k = ramp(t, 100 + i * 60, 700 + i * 60);
      e.el.setAttribute('stroke-dashoffset', fx(e.len * (1 - k)));
    });
    corners.forEach((g, i) => { g.style.opacity = ramp(t, 1200 + i * 260, 1600 + i * 260); });
    gM.style.opacity = ramp(t, 3800, 4400);
    gI.style.opacity = ramp(t, 6400, 7000);

    read.innerHTML =
      t < 3800 ? 'eight runs, every corner of the design space' :
      t < 6400 ? `effect A <b>${eA > 0 ? '+' : ''}${fx(eA)}</b> &middot; B <b>${eB > 0 ? '+' : ''}${fx(eB)}</b> &middot; C <b>${fx(eC)}</b>` :
      `A×B <b>${eAB > 0 ? '+' : ''}${fx(eAB)}</b> &mdash; the lines are not parallel, so A cannot be set without knowing B`;
  };
}

/* ---------------------------------------------------------------------------
   SIX SIGMA — the chart notices before anybody does
   ------------------------------------------------------------------------ */
function dvSigma(root, read) {
  const R = rng(6606);
  const MU = 50, SD0 = 1.6, SD1 = 0.95, USL = 56, LSL = 44;
  const X0 = 96, XW = 840, N = 30;
  const dx = XW / (N - 1);
  const yOf = (v) => 236 - (v - MU) * (150 / (5 * SD0));

  const pts = [];
  for (let i = 0; i < N; i++) {
    let v;
    if (i < 18) v = MU + gauss(R) * SD0;
    else if (i < 24) v = MU + 3.4 + gauss(R) * SD0;    // the shift
    else v = MU + gauss(R) * SD1;                      // after the correction
    pts.push(v);
  }
  pts[21] = MU + 3 * SD0 + 0.9;                        // the point that trips the rule
  const breach = 21;

  sv('text', { class: 'lb', x: X0, y: 62, text: 'X̄ CHART — SUBGROUP MEANS' }, root);
  sv('line', { class: 'ax', x1: X0, y1: yOf(MU), x2: X0 + XW, y2: yOf(MU) }, root);
  sv('text', { class: 'key faint', x: X0 + XW + 8, y: yOf(MU) + 4, text: 'CL' }, root);

  const mkLimit = (v, label) => {
    const g = sv('g', {}, root);
    sv('line', { class: 'gl', x1: X0, y1: yOf(v), x2: X0 + XW, y2: yOf(v) }, g);
    sv('text', { class: 'key faint', x: X0 + XW + 8, y: yOf(v) + 4, text: label }, g);
    return g;
  };
  const ucl0 = mkLimit(MU + 3 * SD0, 'UCL'), lcl0 = mkLimit(MU - 3 * SD0, 'LCL');
  const ucl1 = mkLimit(MU + 3 * SD1, 'UCL'), lcl1 = mkLimit(MU - 3 * SD1, 'LCL');
  ucl1.style.opacity = 0; lcl1.style.opacity = 0;

  const path = sv('path', { class: 'ln' }, root);
  const dots = pts.map((v, i) => {
    const c = sv('circle', { class: 'mk', cx: X0 + i * dx, cy: yOf(v), r: 4.5 }, root);
    c.style.opacity = 0;
    return c;
  });
  const ring = sv('circle', { class: 'mk b', cx: X0 + breach * dx, cy: yOf(pts[breach]), r: 12,
                              style: 'stroke:var(--accent);stroke-width:2.4' }, root);
  ring.style.opacity = 0;

  const alarm = sv('g', {}, root);
  alarm.style.opacity = 0;
  sv('line', { class: 'ln hi', x1: X0 + breach * dx, y1: yOf(pts[breach]) - 18, x2: X0 + breach * dx - 40, y2: 96 }, alarm);
  sv('text', { class: 'lb hi end', x: X0 + breach * dx - 46, y: 92, text: 'RULE 1 — 1 POINT BEYOND 3σ' }, alarm);

  const fixed = sv('g', {}, root);
  fixed.style.opacity = 0;
  sv('line', { class: 'gl', x1: X0 + 23.5 * dx, y1: 96, x2: X0 + 23.5 * dx, y2: 300,
               style: 'stroke:var(--accent)' }, fixed);
  sv('text', { class: 'lb hi', x: X0 + 23.5 * dx + 8, y: 92, text: 'CORRECTED' }, fixed);

  const caps = sv('g', {}, root);
  caps.style.opacity = 0;
  sv('text', { class: 'lb', x: X0, y: 348, text: 'CAPABILITY' }, caps);
  const bar = (label, y, before, after) => {
    sv('text', { class: 'key faint', x: X0, y: y + 4, text: label }, caps);
    sv('rect', { class: 'bar dim', x: X0 + 90, y: y - 8, width: before * 100, height: 12 }, caps);
    const b = sv('rect', { class: 'bar', x: X0 + 90, y: y - 8, width: 0, height: 12 }, caps);
    const v = sv('text', { class: 'key hi', x: X0 + 90 + after * 100 + 10, y: y + 4, text: '' }, caps);
    return { b, v, after };
  };
  const cpB = (USL - LSL) / (6 * SD0), cpA = (USL - LSL) / (6 * SD1);
  const rows = [bar('Cp', 378, cpB, cpA), bar('Cpk', 404, cpB, cpA)];

  return (t) => {
    const shown = Math.floor(clamp01((t - 600) / 4600) * 24) + (t > 7000 ? Math.floor(clamp01((t - 7000) / 1800) * 6) : 0);
    dots.forEach((d, i) => { d.style.opacity = i < shown ? 1 : 0; });
    const n = Math.min(pts.length, shown);
    path.setAttribute('d', pts.slice(0, n)
      .map((v, i) => `${i ? 'L' : 'M'}${fx(X0 + i * dx)} ${fx(yOf(v))}`).join(' '));

    if (t > 4300) {
      ring.style.opacity = (t | 0) % 800 < 400 || t > 6200 ? 1 : 0.25;
      alarm.style.opacity = ramp(t, 4300, 4800);
      dots[breach].setAttribute('class', 'mk hi');
    }
    fixed.style.opacity = ramp(t, 6400, 6900);

    const swap = ramp(t, 7200, 7900);
    ucl1.style.opacity = swap; lcl1.style.opacity = swap;
    ucl0.style.opacity = 1 - swap * 0.75; lcl0.style.opacity = 1 - swap * 0.75;

    caps.style.opacity = ramp(t, 9000, 9500);
    const g = ramp(t, 9300, 10600);
    rows.forEach((r) => {
      r.b.setAttribute('width', fx(lerp(cpB, r.after, g) * 100));
      r.v.textContent = fx(lerp(cpB, r.after, g), 2);
    });

    read.innerHTML =
      t < 4300 ? 'in control — every point inside the limits, no run, no trend' :
      t < 6400 ? 'a point past the upper limit: the chart is asking a question, not answering one' :
      t < 9000 ? 'cause found and removed; the process comes back centred and tighter' :
      `σ <b>${fx(SD0, 2)}</b> → <b>${fx(SD1, 2)}</b> &middot; Cp <b>${fx(cpB, 2)}</b> → <b>${fx(cpA, 2)}</b> ` +
      `&middot; spec ${LSL}–${USL}`;
  };
}

/* ---------------------------------------------------------------------------
   MACHINE LEARNING — fit it, then check it on data it has not seen

   The boundary really is swept, the accuracy at each angle really is
   counted, and the reported test accuracy is the one the chosen boundary
   gets on the held-out points.
   ------------------------------------------------------------------------ */
function dvMl(root, read) {
  const R = rng(15551);
  const PX = 110, PY = 64, PW = 820, PH = 340;
  const sx = (x) => PX + ((x + 4) / 8) * PW;
  const sy = (y) => PY + PH - ((y + 3) / 6) * PH;

  const pt = (cls) => {
    const cx = cls ? 1.15 : -1.15, cy = cls ? 0.62 : -0.62;
    return { x: cx + gauss(R) * 0.92, y: cy + gauss(R) * 0.9, c: cls };
  };
  const train = [], test = [];
  for (let i = 0; i < 90; i++) train.push(pt(i % 2));
  for (let i = 0; i < 60; i++) test.push(pt(i % 2));

  // one sweep of the boundary, scored honestly, and the best angle kept
  const score = (deg, set) => {
    const a = deg * Math.PI / 180, nx = -Math.sin(a), ny = Math.cos(a);
    let ok = 0;
    set.forEach((p) => { if (((p.x * nx + p.y * ny) > 0 ? 1 : 0) === p.c) ok++; });
    return ok;
  };
  let bestDeg = 15, bestOk = -1;
  for (let d = 15; d <= 165; d += 1.5) {
    const ok = score(d, train);
    if (ok > bestOk) { bestOk = ok; bestDeg = d; }
  }
  const testOk = score(bestDeg, test);

  sv('rect', { class: 'box ghost', x: PX, y: PY, width: PW, height: PH }, root);
  sv('text', { class: 'key faint', x: PX + 10, y: PY + 20, text: 'two features, two classes' }, root);

  const trainDots = train.map((p) => {
    const c = sv('circle', { class: p.c ? 'mk hi' : 'mk', cx: sx(p.x), cy: sy(p.y), r: 5 }, root);
    c.style.opacity = 0;
    return c;
  });

  const bound = sv('line', { class: 'ln hi' }, root);
  bound.style.opacity = 0;

  const gTest = sv('g', {}, root);
  const testDots = test.map((p) => {
    const c = sv('circle', { class: 'mk b', cx: sx(p.x), cy: sy(p.y), r: 5.5 }, gTest);
    c.style.opacity = 0;
    return c;
  });
  const misses = test.map((p) => {
    const a = bestDeg * Math.PI / 180, nx = -Math.sin(a), ny = Math.cos(a);
    const wrong = ((p.x * nx + p.y * ny) > 0 ? 1 : 0) !== p.c;
    if (!wrong) return null;
    const c = sv('circle', { class: 'mk b', cx: sx(p.x), cy: sy(p.y), r: 12,
                             style: 'stroke:var(--accent);stroke-width:2.4' }, root);
    c.style.opacity = 0;
    return c;
  });

  const setBound = (deg) => {
    const a = deg * Math.PI / 180;
    const L = 9;
    bound.setAttribute('x1', fx(sx(-Math.cos(a) * L)));
    bound.setAttribute('y1', fx(sy(-Math.sin(a) * L)));
    bound.setAttribute('x2', fx(sx(Math.cos(a) * L)));
    bound.setAttribute('y2', fx(sy(Math.sin(a) * L)));
  };
  setBound(bestDeg);

  return (t) => {
    trainDots.forEach((d, i) => { d.style.opacity = ramp(t, i * 14, i * 14 + 260); });

    let deg = bestDeg, live = bestOk;
    if (t < 5600) {
      bound.style.opacity = ramp(t, 1500, 1800);
      const k = clamp01((t - 1600) / 3200);
      deg = 15 + k * 150;
      if (t > 4900) deg = lerp(deg, bestDeg, ramp(t, 4900, 5600));   // settle on the best
      live = score(deg, train);
      setBound(deg);
    }

    testDots.forEach((d, i) => { d.style.opacity = ramp(t, 5900 + i * 18, 6200 + i * 18); });
    misses.forEach((m) => { if (m) m.style.opacity = ramp(t, 7600, 8100); });

    read.innerHTML =
      t < 1600 ? 'ninety labelled points — the training set' :
      t < 5600 ? `sweeping the boundary &middot; angle <b>${fx(deg, 0)}°</b> &middot; ` +
                 `training accuracy <b>${fx(live / train.length * 100, 1)}%</b>` :
      t < 7600 ? `fitted at <b>${fx(bestDeg, 0)}°</b> &middot; training accuracy ` +
                 `<b>${fx(bestOk / train.length * 100, 1)}%</b> &mdash; now sixty points it has never seen` :
      `held-out accuracy <b>${fx(testOk / test.length * 100, 1)}%</b> ` +
      `(<b>${test.length - testOk}</b> of ${test.length} wrong) &mdash; the number that counts`;
  };
}

const DIVES = {
  sql: {
    k: 'SQL', t: 'Thirteen stores, one record',
    s: 'The register the budgeting team works from is a join. Every source arrives keyed on the tool, and one row per tool comes out the other side.',
    dur: 9500, build: dvSql,
  },
  python: {
    k: 'Python', t: 'Read, clean, join, fit, write',
    s: 'The pipeline behind the register: pull it, drop what is short of a key, widen it against the bay map, fit against it, put it back.',
    dur: 11500, build: dvPython,
  },
  prob: {
    k: 'Probability', t: 'Whatever the shape, the mean goes normal',
    s: 'The population on the left is badly skewed. Average thirty draws from it, five hundred times, and the averages fall into a normal anyway.',
    dur: 11000, build: dvProb,
  },
  tableau: {
    k: 'Tableau', t: 'The same sixty marks, four times over',
    s: 'A view is not a chart type, it is where the marks are asked to stand. Nothing is redrawn between these — the shelves move, the marks follow.',
    dur: 10800, build: dvTableau,
  },
  doe: {
    k: 'JMP · DOE', t: 'Eight runs, three factors',
    s: 'A full factorial visits every corner of the design space. The effects on the right are arithmetic on the eight numbers on the left.',
    dur: 10500, build: dvDoe,
  },
  sigma: {
    k: 'Six Sigma', t: 'The chart notices before anybody does',
    s: 'A process drifts. The control limits were set from its own behaviour, so the drift trips a rule before anyone downstream sees a defect.',
    dur: 11000, build: dvSigma,
  },
  ml: {
    k: 'Machine Learning', t: 'Fit it, then check it on data it has not seen',
    s: 'Sweep a boundary, count the mistakes, keep the best one. Then the only number worth reporting: how it does on points held back from the fit.',
    dur: 11000, build: dvMl,
  },
};


/* ============================================================================
   19 · FRAME
   ========================================================================= */

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = clock.elapsedTime;

  sampleAudio();

  if (mode === 'ride') {
    // the ride drives itself; the rider only chooses where to stop
    const target = speedFactor(t);
    cruise += (target - cruise) * Math.min(1, dt * 2.2);
    t = (t + (dt / LOOP_SECONDS) * cruise) % 1;

    updateRideCamera(dt);
    updateHUD();
    updateHover();
  } else if (tween) {
    updateTween(dt);
  }

  // the plots keep running whether or not the ride is moving; a frozen wave
  // beside a stopped cart would read as a paused video rather than a page
  if (!reduceMotion) updateWaves(dt, now);

  // ---- object animation ----
  Object.values(stationGroups).forEach((grp) => {
    const art = grp.userData.art;
    if (!art) return;

    const st = grp.userData.station;
    const isHot = (hoverStation && hoverStation.id === st.id) ||
                  (focusStation && focusStation.id === st.id);

    art.rotation.y += dt * (isHot ? 0.62 : 0.26);
    art.position.y = 10 + Math.sin(now * 0.85 + grp.position.x * 0.05) * 0.6;

    const s = isHot ? 1.16 : 1.0;
    art.scale.lerp(new THREE.Vector3(s, s, s), Math.min(1, dt * 6));

    if (art.userData.bars) updateMarketsArt(art, now);
    if (art.userData.swim)  art.rotation.z = Math.sin(now * 1.5) * 0.10;
    if (art.userData.glide) {
      art.rotation.z = Math.sin(now * 0.8) * 0.22;
      art.rotation.x = Math.sin(now * 0.55) * 0.12;
    }
    const w = art.userData.wafer;
    if (w) {
      w.position.set(Math.cos(now * 0.5) * 7.8, 1.4 + Math.sin(now * 0.75) * 0.9, Math.sin(now * 0.5) * 7.8);
      w.rotation.y = now * 0.38;
      w.rotation.x = Math.sin(now * 0.28) * 0.35;
    }

    // keep labels upright and facing the camera
    const lab = grp.userData.label;
    if (lab) lab.material.opacity = isHot ? 1 : 0.86;
  });

  if (chessBars) {
    chessBars.children.forEach((bar) => {
      const target = bar.userData.target * (1 + audioBass * 0.10);
      bar.scale.y += (target - bar.scale.y) * Math.min(1, dt * 3.2);
      bar.position.y = bar.scale.y * 0.5;
    });
  }

  // the cart pulses gently so the point stays legible against the paper
  if (cart) {
    const s = 1 + Math.sin(now * 2.4) * 0.07;
    cart.scale.setScalar(s);
    const halo = cart.userData.halo;
    if (halo) halo.material.opacity = 0.42 + Math.sin(now * 2.4) * 0.18;
  }

  updateDrift(dt, now);
  updateTape(dt, now);

  paperUniforms.uCam.value.copy(camera.position);
  paperUniforms.uBass.value = audioBass;
  paperUniforms.uTime.value = now;

  renderer.render(scene, camera);
}

/* ============================================================================
   20 · GO
   ========================================================================= */

init();
