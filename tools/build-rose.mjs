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

  return smoothClosedPath(pts, 0.85);
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
  const lean = curve(LEAN, s) + (rnd() - 0.5) * 9;
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

  petals.push({
    i,
    s: Number(s.toFixed(4)),
    angle: Number(angle.toFixed(3)),
    baseR: Number(baseR.toFixed(2)),
    sy: Number(sy.toFixed(4)),
    lean: Number(lean.toFixed(2)),
    swirl: Number(swirl.toFixed(2)),
    colour,
    d: petalOutline(len, half, p, rnd),
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
