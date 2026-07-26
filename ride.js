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

const C = {
  paper:      new THREE.Color('#E8DCC0'),
  paperLit:   new THREE.Color('#F2E9D6'),
  gridFine:   new THREE.Color('#C9B896'),
  gridMed:    new THREE.Color('#B8A67E'),
  gridHeavy:  new THREE.Color('#A89468'),
  ink:        new THREE.Color('#2B2622'),
  inkSoft:    new THREE.Color('#5A5048'),
  inkFaint:   new THREE.Color('#8A7D6E'),
  accent:     new THREE.Color('#B8442E'),
  accentSoft: new THREE.Color('#D4785F'),
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
   so you have time to see the object and click it.                        */
const LOOP_SECONDS = 82;
const STATION_SLOW = 0.34;
const SLOW_WINDOW  = 0.040;   // t-radius over which the easing happens

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
  { id:'soccer',  label:'Pitch Analytics', sheet:'05', x: 375, y:  30 },
  { id:'contact', label:'Contact',         sheet:'06', x: 470, y:   0 },
];

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
  scene.fog = new THREE.Fog(0xD8CBAA, 150, 430);

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
  buildRailNav();
  lighting();
  bindEvents();
  initResumeCards();
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

    // crease shading from surface orientation
    float slope = 1.0 - clamp(vNormalW.y, 0.0, 1.0);
    col *= 1.0 - slope * 0.32;

    float hN = clamp(vHeight / 30.0, -1.0, 1.0);
    col = mix(col, col * vec3(0.86, 0.79, 0.66), clamp(-hN, 0.0, 1.0) * 0.40);
    col = mix(col, mix(col, uPaperLit, 0.35), clamp(hN, 0.0, 1.0) * 0.52);

    // faint topo banding
    float cband = grid(vec2(vHeight, vHeight), 4.0, 1.1);
    col = mix(col, uInkFaint, cband * 0.05 * fadeMed);

    vec3 L = normalize(vec3(-0.42, 0.82, -0.38));
    float ndl = clamp(dot(normalize(vNormalW), L), 0.0, 1.0);
    float hemi = 0.62 + 0.38 * clamp(vNormalW.y * 0.5 + 0.5, 0.0, 1.0);
    col *= (0.58 + 0.52 * ndl) * hemi;

    col *= 1.0 + uBass * 0.075;
    col = mix(col, vec3(0.847, 0.796, 0.667), smoothstep(150.0, 430.0, dist));

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
  const AX = C.accent;                        // X — red pencil
  const AY = new THREE.Color('#3E6B52');      // Y — green pencil
  const AZ = new THREE.Color('#2F5D8A');      // Z — blue pencil

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
  const lx = axisLabel('X', '#B8442E');
  lx.position.set(X1 - 16, fieldH(X1, 0) + 12, 0);
  scene.add(lx);

  const ly = axisLabel('Y', '#3E6B52');
  ly.position.set(0, fieldH(0, Y1) + 12, Y1 - 16);
  scene.add(ly);

  const lz = axisLabel('Z', '#2F5D8A');
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

  g.fillStyle = '#B8442E';
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
    soccer: objSoccer, contact: objContact,
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

  const co = el.querySelector('[data-coord]');
  if (co) co.textContent = `X ${st.x.toFixed(0)}  ·  Y ${st.y.toFixed(0)}  ·  Z ${st.h.toFixed(1)}`;

  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  el.querySelector('.sheet-close')?.focus?.();

  void pool; // pool is only the parking lot; nothing to do with it here
}

function closePanel() {
  const panel = $('#panel');
  if (!panel) return;
  panel.classList.remove('is-open');
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
    if (e.key === 'Escape' && (mode === 'focused' || mode === 'focusing')) release();
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
    hud.sheet.textContent = `${near.sheet} / 06`;
    hud.crit.textContent = 'Click the object to open';
  } else {
    hud.station.textContent = 'In Transit';
    hud.sheet.textContent = '— / 06';
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
  const b = VB();                                     // Sawtooth UAV
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
   18c · RESUME INTERACTIONS
   Each experience is an expandable card. Opening one counts its metrics up
   from zero — every figure here is straight off the resume.
   ========================================================================= */

function initResumeCards() {
  document.querySelectorAll('[data-entry]').forEach((entry) => {
    const head = entry.querySelector('.entry-head');
    if (!head) return;

    head.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = entry.classList.toggle('is-open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');

      const panel = entry.querySelector('.entry-panel');
      if (panel) panel.style.maxHeight = open ? `${panel.scrollHeight}px` : '';
    });
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
}

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

  paperUniforms.uCam.value.copy(camera.position);
  paperUniforms.uBass.value = audioBass;

  renderer.render(scene, camera);
}

/* ============================================================================
   20 · GO
   ========================================================================= */

init();
