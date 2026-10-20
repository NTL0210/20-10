/* ==========================================================================
   build-rose.mjs — offline generator for the 101-petal rose
   --------------------------------------------------------------------------
   The whole flower is *designed here*, once, and written to assets/rose.js as
   a static data file. The runtime never invents a petal: it only reads the
   baked geometry and animates it. That keeps the first paint cheap and makes
   the final composition reviewable before a single petal appears.

   Run:  node tools/build-rose.mjs          -> writes assets/rose.js
         node tools/build-rose.mjs --check  -> fails if the baked file is stale
   ========================================================================== */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "..", "assets", "rose.js");
const TOTAL = 101;
const GOLDEN_ANGLE = 137.50776405003785;

/* --- deterministic noise -------------------------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20251020);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const num = (v) => (Math.round(v * 10) / 10).toString();

/* Piecewise-linear curve lookup: table is [[key, value], ...] sorted by key. */
function curve(table, key) {
  if (key <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i += 1) {
    if (key <= table[i][0]) {
      const [k0, v0] = table[i - 1];
      const [k1, v1] = table[i];
      return lerp(v0, v1, (key - k0) / (k1 - k0));
    }
  }
  return table[table.length - 1][1];
}

/* --------------------------------------------------------------------------
   The structure of the flower, read as a botanical plan.

   A rose is not a set of concentric rings. It is one continuous spiral of
   petals that grow from a tight, folded heart into broad guard petals, and
   every petal is offset from the last by roughly the golden angle. The tables
   below describe how one petal changes as it travels outwards.

   s = 0 is the heart, s = 1 the outermost guard petal.
   -------------------------------------------------------------------------- */

/* Radius reached by the tip of the petal, by index. The heart stays small,
   the mass of the flower gathers in the middle band, and only the last
   fifteen petals carry the silhouette. */
const TIP_RADIUS = [
  [0, 12], [6, 26], [10, 36], [24, 74], [34, 100], [46, 130],
  [58, 165], [72, 204], [82, 233], [91, 269], [100, 308],
];
/* How far from the centre the petal is born (its claw). */
const BASE_RATIO = [[0, 0.34], [0.2, 0.28], [0.5, 0.225], [0.8, 0.185], [1, 0.155]];
/* Half width as a fraction of petal length: folded heart -> broad guard. */
const HALF_RATIO = [[0, 0.30], [0.15, 0.335], [0.4, 0.415], [0.7, 0.475], [1, 0.525]];
/* Vertical foreshortening: heart petals stand up, guard petals lie open. */
const FORESHORTEN = [[0, 0.40], [0.15, 0.50], [0.4, 0.66], [0.7, 0.85], [1, 1.0]];
/* Lean away from the radius. */
const LEAN = [[0, 27], [0.2, 19], [0.5, 11], [0.8, 6], [1, 3]];
/* Swirl around the axis, always in the same hand as the spiral. */
const SWIRL = [[0, -15], [0.3, -9], [0.6, -3], [1, 4]];
/* Width of the claw at the base of the petal. */
const CLAW = [[0, 0.30], [0.3, 0.19], [0.7, 0.105], [1, 0.075]];
/* How quickly the petal widens away from the claw. */
const BELLY = [[0, 0.46], [0.4, 0.62], [1, 0.86]];
/* Where the rim begins, as a fraction of the length. */
const SHOULDER = [[0, 0.62], [0.4, 0.72], [1, 0.83]];
/* Top fullness of the rim (1 = round, lower = broader and flatter). */
const RIM_ROUND = [[0, 0.98], [0.4, 0.70], [1, 0.46]];
/* Depth of the ruffles along the rim. */
const RUFFLE = [[0, 0.006], [0.35, 0.018], [0.7, 0.032], [1, 0.046]];
/* Depth of the notch in the middle of the rim. */
const NOTCH = [[0, 0.004], [0.4, 0.014], [1, 0.030]];
/* How lopsided the two halves of the petal are. */
const ASYM = [[0, 0.05], [0.4, 0.10], [1, 0.175]];
/* Rim tilt: one side of the rim sits a little higher than the other. */
const RIM_TILT = [[0, 0.010], [0.4, 0.020], [1, 0.032]];
/* Colour: burgundy heart, rose-red outer petals. */
const HUE = [[0, 350], [0.5, 352], [1, 354]];
const SAT = [[0, 58], [0.5, 64], [1, 70]];
const LIGHT = [[0, 14], [0.25, 19], [0.6, 27], [1, 36]];

/* --- helpers -------------------------------------------------------------- */
function hslToHex(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = ln - c / 2;
  const to = (v) => Math.round(clamp((v + m) * 255, 0, 255)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/* Catmull-Rom through a closed loop, emitted as cubic Bézier segments. */
function smoothClosedPath(points, tension) {
  const k = (tension === undefined ? 0.85 : tension) / 6;
  const n = points.length;
  const out = [`M${num(points[0][0])},${num(points[0][1])}`];
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    out.push(
      `C${num(p1[0] + (p2[0] - p0[0]) * k)},${num(p1[1] + (p2[1] - p0[1]) * k)}` +
      ` ${num(p2[0] - (p3[0] - p1[0]) * k)},${num(p2[1] - (p3[1] - p1[1]) * k)}` +
      ` ${num(p2[0])},${num(p2[1])}`
    );
  }
  out.push("Z");
  return out.join("");
}

/* --------------------------------------------------------------------------
   One rose petal.

   A garden-rose petal is not a leaf and not a spoon. It is a rounded fan:
   a narrow claw at the base that widens quickly, broad shoulders, and a rim
   that is soft, slightly notched in the middle and gently ruffled. Outer
   petals are broader and more lopsided; the folded heart petals are narrow
   and stand up.
   -------------------------------------------------------------------------- */
function petalOutline(len, half, p, rnd) {
  const sideSteps = 7;
  const rimSteps = 20;
  const phase = rnd() * Math.PI * 2;
  const rufFreq = 1.6 + rnd() * 1.3;
  const rufPhase = rnd() * Math.PI * 2;
  const tipShift = half * p.asym * (rnd() - 0.5) * 1.4;
  const pts = [];
  const rim = [];

  /* left flank: claw -> shoulder */
  for (let i = 0; i <= sideSteps; i += 1) {
    const t = i / sideSteps;
    const w = half * (p.claw + (1 - p.claw) * Math.pow(t, p.belly));
    const bulge = 1 + 0.055 * Math.sin(Math.PI * t);
    const edge = 1 + 0.03 * Math.sin((3.5 * t + phase) * Math.PI);
    pts.push([-w * bulge * edge + tipShift * t * t, -len * t * p.shoulder]);
  }

  /* the rim */
  for (let i = 1; i < rimSteps; i += 1) {
    const s = i / rimSteps;
    const dome = Math.pow(Math.sin(Math.PI * s), p.rimRound);
    const ruffle = len * p.ruffle * Math.sin(2 * Math.PI * rufFreq * s + rufPhase) * Math.sin(Math.PI * s);
    const notch = len * p.notch * Math.exp(-Math.pow((s - 0.5) / 0.17, 2));
    const tilt = len * p.rimTilt * (2 * s - 1);
    const x =
      half * (2 * s - 1) * (1 + 0.05 * Math.sin(3 * Math.PI * s + phase)) +
      half * p.asym * Math.sin(Math.PI * s) * 0.7 +
      tipShift;
    const y = -len * (p.shoulder + (1 - p.shoulder) * dome) + ruffle + notch + tilt;
    pts.push([x, y]);
    rim.push([x, y]);
  }

  /* right flank: shoulder -> claw */
  for (let i = sideSteps; i >= 0; i -= 1) {
    const t = i / sideSteps;
    const w = half * (p.claw + (1 - p.claw) * Math.pow(t, p.belly));
    const bulge = 1 + 0.055 * Math.sin(Math.PI * t);
    const edge = 1 + 0.03 * Math.sin((3.5 * t - phase) * Math.PI);
    const lean = 1 + p.asym * 0.42 * Math.sin(Math.PI * t);
    pts.push([w * bulge * edge * lean + tipShift * t * t, -len * t * p.shoulder]);
  }

  return { d: smoothClosedPath(pts, 0.85), rim };
}

/* The rolled rim: a narrow band just inside the edge of the petal that turns
   back towards the base. It is what makes a real petal read as a curled
   sheet of tissue rather than a flat cut-out. The band is inset from the
   outline on purpose: a band that sat on the edge would read as a contour
   line around the petal, which is exactly the hard outline to avoid. */
function petalCurlBand(rim, inset, depth) {
  if (rim.length < 4) return "";
  const at = (amount) => rim.map(([x, y]) => {
    const l = Math.hypot(x, y) || 1;
    return [x + (x / l) * amount, y + (y / l) * amount];
  });
  const near = at(inset);
  const far = at(inset + depth);
  const out = [`M${num(near[0][0])},${num(near[0][1])}`];
  for (let i = 1; i < near.length; i += 1) out.push(`L${num(near[i][0])},${num(near[i][1])}`);
  for (let i = far.length - 1; i >= 0; i -= 1) out.push(`L${num(far[i][0])},${num(far[i][1])}`);
  return out.join("") + "Z";
}

/* Faint radial veins: one path holding several sub-paths. */
function petalVeins(len, half, p, rnd) {
  const count = 3 + Math.floor(rnd() * 3);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const f = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const spread = half * (0.16 + rnd() * 0.42) * f;
    const reach = len * (0.52 + rnd() * 0.26);
    const bow = (rnd() - 0.5) * half * 0.16;
    out.push(
      `M${num(spread * 0.12)},${num(-len * 0.08)}` +
      `C${num(spread * 0.6 + bow)},${num(-len * 0.28)}` +
      ` ${num(spread + bow * 0.6)},${num(-reach * 0.72)}` +
      ` ${num(spread * 1.15)},${num(-reach)}`
    );
  }
  return out.join("");
}

/* ==========================================================================
   The stem and its foliage
   --------------------------------------------------------------------------
   A cut rose carries a handful of real leaves. They are the second half of
   the illustration: without them the flower floats on a bare line. The
   leaves are generated here with the same care as the petals — a lanceolate
   blade with a serrated margin, a midrib, secondary veins, a visible
   petiole — and are baked into the same data file.
   ========================================================================== */

/* The spine of the stem, from the flower head down to the bottom edge. */
const STEM_SPINE = [
  [500, 396], [496, 470], [503, 548], [497, 624], [504, 702],
  [500, 782], [507, 862], [509, 942], [515, 1022], [518, 1092], [522, 1142]
];

/* Catmull-Rom through an open list, emitted as cubic Bézier segments. */
function smoothOpenPath(points, tension) {
  const k = (tension === undefined ? 0.9 : tension) / 6;
  const n = points.length;
  const out = [`M${num(points[0][0])},${num(points[0][1])}`];
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    out.push(
      `C${num(p1[0] + (p2[0] - p0[0]) * k)},${num(p1[1] + (p2[1] - p0[1]) * k)}` +
      ` ${num(p2[0] - (p3[0] - p1[0]) * k)},${num(p2[1] - (p3[1] - p1[1]) * k)}` +
      ` ${num(p2[0])},${num(p2[1])}`
    );
  }
  return out.join("");
}

function sampleSpline(points, count) {
  const segs = points.length - 1;
  const out = [];
  for (let s = 0; s < count; s += 1) {
    const u = (s / (count - 1)) * segs;
    const i = Math.min(segs - 1, Math.floor(u));
    const t = u - i;
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    const h = (a, b, c, d) =>
      0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    out.push([h(p0[0], p1[0], p2[0], p3[0]), h(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

const spine = sampleSpline(STEM_SPINE, 121);

/* The stem is drawn as three strokes: a soft shadow, the body, and a thin
   highlight running up the lit side. */
function offsetSpine(dx) {
  const out = [];
  for (let i = 0; i < spine.length; i += 1) {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(spine.length - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    out.push([spine[i][0] - (ty / len) * dx, spine[i][1] + (tx / len) * dx]);
  }
  return smoothOpenPath(out, 0.9);
}

/* The lanceolate width profile of a leaflet: narrow at the claw, widest at
   about a third of the way, and drawn to a point. */
function leafProfile(u, width) {
  return width * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.78);
}

/* --- one leaflet ---------------------------------------------------------- */
/* The blade is built around a curved midrib. The margin is sampled finely so
   the lanceolate profile stays smooth, then a saw-tooth is laid over it to
   give the fine serration a rose leaflet has. */
function leafBlade(len, width, rnd, opts) {
  const { arch, droop, teeth, toothDepth } = opts;
  const samples = teeth * 4;
  const mid = [];
  for (let i = 0; i <= samples; i += 1) {
    const u = i / samples;
    // cubic from (0,0) to (len, droop) arching over the top
    const c1x = len * 0.28;
    const c1y = -arch;
    const c2x = len * 0.72;
    const c2y = droop * 0.35 - arch * 0.45;
    const t = u;
    const mt = 1 - t;
    mid.push([
      3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * len,
      3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * droop
    ]);
  }
  const norm = [];
  for (let i = 0; i <= samples; i += 1) {
    const a = mid[Math.max(0, i - 1)];
    const b = mid[Math.min(samples, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    norm.push([-ty / l, tx / l]);
  }
  const tooth = (u) => {
    const phase = (u * teeth) % 1;
    // saw-tooth: a valley then a point leaning towards the tip
    const v = phase < 0.45 ? phase / 0.45 : 1 - (phase - 0.45) / 0.55;
    return 1 - toothDepth * (1 - v) * (u > 0.06 && u < 0.94 ? 1 : 0);
  };
  const margin = (i, sign) => {
    const u = i / samples;
    const w = leafProfile(u, width) * tooth(u);
    return [mid[i][0] + norm[i][0] * w * sign, mid[i][1] + norm[i][1] * w * sign];
  };
  const pts = [];
  for (let i = 0; i <= samples; i += 1) pts.push(margin(i, -1));
  for (let i = samples; i >= 0; i -= 1) pts.push(margin(i, 1));
  return { outline: pts, mid, norm, samples, width };
}

/* The midrib, and the secondary veins that fan from it to the margin. */
function leafVeins(blade, rnd) {
  const { mid, norm, samples, width } = blade;
  const midrib = smoothOpenPath(mid, 0.9);
  const out = [];
  const count = 5 + Math.floor(rnd() * 2);
  for (let s = 1; s <= count; s += 1) {
    const u = 0.12 + (s / (count + 1)) * 0.72;
    const idx = Math.round(u * samples);
    const endIdx = Math.min(samples, Math.round((u + 0.14) * samples));
    const wRoot = leafProfile(u, width);
    const wEnd = leafProfile((endIdx / samples), width);
    for (const sign of [-1, 1]) {
      const root = mid[idx];
      const tip = [
        mid[endIdx][0] + norm[endIdx][0] * wEnd * sign,
        mid[endIdx][1] + norm[endIdx][1] * wEnd * sign
      ];
      const c1 = [
        root[0] + norm[idx][0] * wRoot * 0.5 * sign,
        root[1] + norm[idx][1] * wRoot * 0.5 * sign
      ];
      const c2 = [root[0] + (tip[0] - root[0]) * 0.66, root[1] + (tip[1] - root[1]) * 0.66];
      out.push(
        `M${num(root[0])},${num(root[1])}` +
        `C${num(c1[0])},${num(c1[1])} ${num(c2[0])},${num(c2[1])} ${num(tip[0])},${num(tip[1])}`
      );
    }
  }
  return { midrib, veins: out.join("") };
}

/* --- the leaves ------------------------------------------------------------ */
/* Rose leaves are alternate on the stem. They are not mirror images: the
   lengths, droops and heights are all different, and a few sit close
   together so the lower stem reads as a leafy spray rather than a pattern. */
const LEAF_PLAN = [
  { y: 648, side: 1, len: 92, wid: 24, droop: 26, arch: 9, teeth: 10, petiole: 24, tone: 1.02 },
  { y: 704, side: -1, len: 118, wid: 33, droop: 30, arch: 12, teeth: 11, petiole: 30, tone: 1.06 },
  { y: 758, side: 1, len: 146, wid: 39, droop: 22, arch: 15, teeth: 12, petiole: 34, tone: 0.94 },
  { y: 822, side: -1, len: 178, wid: 48, droop: 26, arch: 20, teeth: 13, petiole: 38, tone: 1.10 },
  { y: 896, side: 1, len: 192, wid: 52, droop: 19, arch: 18, teeth: 13, petiole: 36, tone: 0.90 },
  { y: 966, side: -1, len: 164, wid: 44, droop: 24, arch: 16, teeth: 12, petiole: 33, tone: 1.02 },
  { y: 1032, side: 1, len: 130, wid: 35, droop: 17, arch: 13, teeth: 11, petiole: 29, tone: 0.96 },
  { y: 1090, side: -1, len: 102, wid: 27, droop: 21, arch: 10, teeth: 10, petiole: 26, tone: 1.04 }
];

const leafRecords = [];
LEAF_PLAN.forEach((plan, index) => {
  const rnd = mulberry32(5521 + index * 7717);
  const len = plan.len * (0.95 + rnd() * 0.1);
  const width = plan.wid * (0.92 + rnd() * 0.16);
  const arch = plan.arch * (0.85 + rnd() * 0.3);
  const droop = plan.droop * (0.8 + rnd() * 0.4);
  const blade = leafBlade(len, width, rnd, {
    arch, droop, teeth: plan.teeth, toothDepth: 0.07 + rnd() * 0.05
  });
  const veins = leafVeins(blade, rnd);

  // The stem point the leaf springs from.
  let best = spine[0];
  let bestD = Infinity;
  spine.forEach((p) => {
    const d = Math.abs(p[1] - plan.y);
    if (d < bestD) { bestD = d; best = p; }
  });

  // Direction: out to the side and down, with the droop varying per leaf.
  const dir = plan.side < 0 ? 180 - droop : droop;

  // The petiole leaves the stem and curves slightly before the blade starts.
  const pet = plan.petiole;
  const petiole =
    `M0,0` +
    `C${num(pet * 0.3)},${num(-pet * 0.1)} ${num(pet * 0.66)},${num(-pet * 0.16)} ${num(pet)},0`;

  leafRecords.push({
    x: Number(best[0].toFixed(2)),
    y: Number(best[1].toFixed(2)),
    dir: Number(dir.toFixed(2)),
    petiole: petiole,
    petioleLen: pet,
    blade: leafBladePath(blade),
    midrib: veins.midrib,
    veins: veins.veins,
    tone: plan.tone,
    // a hint of how much of the page's upper-left light reaches this leaf
    lit: Number((plan.side < 0 ? 1 : 0.86).toFixed(3)),
  });
});

function leafBladePath(blade) {
  const p = blade.outline;
  let d = `M${num(p[0][0])},${num(p[0][1])}`;
  for (let i = 1; i < p.length; i += 1) d += `L${num(p[i][0])},${num(p[i][1])}`;
  return d + "Z";
}

/* A few small thorns, low on the stem, where they would really sit. */
const THORN_PLAN = [
  { y: 782, side: 1, len: 17, drop: 12 },
  { y: 932, side: -1, len: 15, drop: 10 },
  { y: 1058, side: 1, len: 14, drop: 9 }
];
const thorns = THORN_PLAN.map((plan) => {
  let best = spine[0];
  let bestD = Infinity;
  spine.forEach((p) => {
    const d = Math.abs(p[1] - plan.y);
    if (d < bestD) { bestD = d; best = p; }
  });
  const dx = plan.side * plan.len;
  return (
    `M${num(best[0])},${num(best[1] - 3)}` +
    `C${num(best[0] + dx * 0.55)},${num(best[1] - 4)}` +
    ` ${num(best[0] + dx * 0.92)},${num(best[1] + plan.drop * 0.35)}` +
    ` ${num(best[0] + dx)},${num(best[1] + plan.drop)}` +
    `C${num(best[0] + dx * 0.5)},${num(best[1] + plan.drop * 0.55)}` +
    ` ${num(best[0] + dx * 0.2)},${num(best[1] + plan.drop * 0.3)}` +
    ` ${num(best[0])},${num(best[1] + 4)}Z`
  );
});

/* --- build the flower ----------------------------------------------------- */
const petals = [];

for (let i = 0; i < TOTAL; i += 1) {
  const s = i / (TOTAL - 1);
  const rnd = mulberry32(9109 + i * 7919);

  /* Golden-angle spiral: no two petals of a whorl line up, and the whole
     bloom turns in one consistent hand. */
  const angleJitter = (rnd() - 0.5) * 34;
  const angle = (i * GOLDEN_ANGLE + 17.5 + angleJitter) % 360;

  const tip = curve(TIP_RADIUS, i) * (1 + (rnd() - 0.5) * 0.11);
  const baseRatio = curve(BASE_RATIO, s);
  /* Every petal is born on the receptacle, close to the middle. The heart
     petals are simply the smallest: they close over each other and make the
     tight folded centre. (An earlier version pushed them past the middle,
     which opened a hole in the middle of the bud.) */
  const baseR = tip * baseRatio * (1 + (rnd() - 0.5) * 0.12);
  const len = tip - baseR;
  /* Four petal archetypes keep neighbouring petals from being the same
     shape scaled up: broad and round, narrow and pointed, deeply ruffled,
     and calm. */
  const variant = Math.floor(rnd() * 4);
  const halfRatio = curve(HALF_RATIO, s) * (1 + (rnd() - 0.5) * 0.18) *
    (variant === 1 ? 0.86 : variant === 0 ? 1.07 : 1);
  const half = len * halfRatio;
  const sy = curve(FORESHORTEN, s) * (1 + (rnd() - 0.5) * 0.07);
  /* A few of the outer petals splay further out than the rest. That single
     irregularity is what stops the silhouette from being a perfect circle. */
  const splay = s > 0.74 && rnd() < 0.34 ? 11 + rnd() * 17 : 0;
  const lean = curve(LEAN, s) + (rnd() - 0.5) * 9 + splay;
  const swirl = curve(SWIRL, s) + (rnd() - 0.5) * 7;

  const p = {
    claw: curve(CLAW, s),
    belly: curve(BELLY, s) * (variant === 1 ? 1.14 : variant === 0 ? 0.9 : 1),
    shoulder: curve(SHOULDER, s),
    rimRound: clamp(
      curve(RIM_ROUND, s) * (variant === 0 ? 0.82 : variant === 1 ? 1.22 : 1),
      0.34,
      1.05
    ),
    ruffle: curve(RUFFLE, s) * (0.7 + rnd() * 0.6) * (variant === 2 ? 1.55 : 1),
    notch: curve(NOTCH, s) * (0.5 + rnd() * 1.1) * (variant === 1 ? 1.35 : 1),
    asym: curve(ASYM, s) * (0.7 + rnd() * 0.6),
    rimTilt: curve(RIM_TILT, s) * (0.6 + rnd() * 0.8),
  };

  const hue = curve(HUE, s) + (rnd() - 0.5) * 9;
  const sat = clamp(curve(SAT, s) + (rnd() - 0.5) * 9, 38, 84);
  const light = clamp(curve(LIGHT, s) + (rnd() - 0.5) * 6.4, 9, 46);
  const colour = hslToHex(hue, sat, light);

  const shape = petalOutline(len, half, p, rnd);
  /* Roughly a third of the petals carry a rolled rim, mostly the broader
     ones. It is the detail that separates a living petal from a cut-out. */
  const curl = s > 0.22 && rnd() < 0.42
    ? petalCurlBand(shape.rim, len * 0.012, len * (0.03 + rnd() * 0.045))
    : "";

  petals.push({
    i,
    s: Number(s.toFixed(4)),
    angle: Number(angle.toFixed(3)),
    baseR: Number(baseR.toFixed(2)),
    sy: Number(sy.toFixed(4)),
    lean: Number(lean.toFixed(2)),
    swirl: Number(swirl.toFixed(2)),
    colour,
    d: shape.d,
    curl,
    veins: petalVeins(len, half, p, rnd),
  });
}

/* --- emit ----------------------------------------------------------------- */
const banner = `/* ==========================================================================
   rose.js — the 101 petals of "La rose aux cent une pétales".
   GENERATED FILE. Do not edit by hand.
   Source: tools/build-rose.mjs   (node tools/build-rose.mjs)
   The arrangement is a single golden-angle spiral: petal 0 is the folded
   heart, petal 100 the last broad guard petal. Opening order == index order,
   so the flower always grows from its centre outwards.
   ========================================================================== */
`;

const body = `${banner}window.ROSE_GEOMETRY = ${JSON.stringify({
  total: TOTAL,
  goldenAngle: GOLDEN_ANGLE,
  stem: {
    path: smoothOpenPath(spine, 0.9),
    shade: offsetSpine(3.4),
    light: offsetSpine(-2.4),
    thorns,
  },
  leaves: leafRecords,
  petals,
})};
`;

mkdirSync(dirname(OUT), { recursive: true });

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== body) {
    console.error("assets/rose.js is out of date. Run: node tools/build-rose.mjs");
    process.exit(1);
  }
  console.log("assets/rose.js is up to date.");
} else {
  writeFileSync(OUT, body, "utf8");
  const kb = (Buffer.byteLength(body, "utf8") / 1024).toFixed(1);
  console.log(`wrote assets/rose.js — ${TOTAL} petals, ${kb} kB`);
}
