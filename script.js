/* ==========================================================================
   La rose aux cent une pétales — 20 octobre
   Vanilla ES2020. The rose is generated, never pre-drawn.
   ========================================================================== */
(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const TOTAL_PETALS = 101;
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = () => reduceQuery.matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, prefersReduced() ? 0 : ms));

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
  const randBetween = (rand, range) => range[0] + (range[1] - range[0]) * rand();

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Catmull-Rom through a closed loop, emitted as smooth cubic Bézier
  // segments. The outline is sampled rather than described with a handful of
  // rigid arcs, so every petal can have its own shoulder, notch and ripple.
  function smoothClosedPath(points, tension) {
    const k = (tension === undefined ? 0.9 : tension) / 6;
    const n = points.length;
    const out = [`M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`];
    for (let i = 0; i < n; i += 1) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];
      const c1x = p1[0] + (p2[0] - p0[0]) * k;
      const c1y = p1[1] + (p2[1] - p0[1]) * k;
      const c2x = p2[0] - (p3[0] - p1[0]) * k;
      const c2y = p2[1] - (p3[1] - p1[1]) * k;
      out.push(
        `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ` +
        `${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
      );
    }
    out.push("Z");
    return out.join(" ");
  }

  // Botanical drawing rather than a radial daisy. A garden-rose petal has a
  // narrow, cupped claw, broad shoulders and a soft, undulating rim. The rim
  // sits well above the shoulders, can carry a shallow central notch, and the
  // whole outline is allowed to lean and to be slightly lopsided. `depth` runs
  // from 0 at the folded heart to 1 at the broad guard petals.
  function petalOutline(len, half, rand, depth) {
    const asym = (rand() - 0.5) * (0.16 + depth * 0.08);
    const tipShift = (rand() - 0.5) * half * (0.12 + depth * 0.12);
    const shoulder = 0.82 + (rand() - 0.5) * 0.035;
    const rimLift = 0.79 + (rand() - 0.5) * 0.045;
    const waveA = (0.012 + depth * 0.032) * (0.72 + rand() * 0.55);
    const waveB = (0.004 + depth * 0.012) * (0.72 + rand() * 0.6);
    const phase = rand() * Math.PI * 2;
    const notch = (0.009 + depth * 0.026) * (0.20 + rand() * 1.20);
    const rimTilt = (rand() - 0.5) * (0.015 + depth * 0.035);
    const baseShare = 0.055 + Math.pow(1 - depth, 2) * 0.30;
    const sideSteps = 8;
    const rimSteps = 18;
    const points = [];

    // Left side, from the base to the shoulder. The folded heart gets a
    // broader claw so the tiny inner petals overlap instead of leaving a
    // star-shaped hole at the exact centre.
    for (let i = 0; i <= sideSteps; i += 1) {
      const t = i / sideSteps;
      const u = t * shoulder;
      const width = half * (baseShare + (1 - baseShare) * Math.pow(t, 0.72));
      const bulge = 1 + 0.10 * Math.sin(Math.PI * t);
      const irregular = half * 0.014 * Math.sin((5.5 * t + phase) * Math.PI);
      const x = -(width * bulge + irregular * t) * (1 - asym * 0.55 * Math.sin(Math.PI * t)) + tipShift * t * t;
      points.push([x, -len * u]);
    }

    // The rim: one broad, softly domed lobe from shoulder to shoulder. The
    // two long, slow waves are deliberate; many small ripples would read as
    // cut paper. A shallow notch keeps the top edge from looking stamped.
    for (let i = 1; i < rimSteps; i += 1) {
      const s = i / rimSteps;
      const a = Math.PI * (1 - s);
      const sine = Math.sin(a);
      const x = tipShift + half * Math.cos(a)
        + half * 0.030 * Math.sin(4.4 * a + phase) * sine;
      const dome = rimLift + (1 - rimLift) * Math.pow(sine, 0.58);
      const wave = len * (waveA * Math.sin(3.1 * a + phase)
        + waveB * Math.sin(6.7 * a + phase * 1.6)) * Math.pow(sine, 1.3);
      const dip = len * notch * Math.exp(-Math.pow((a - Math.PI / 2) / 0.36, 2));
      const tiltY = len * rimTilt * Math.cos(a);
      const y = -len * dome + wave + dip + tiltY;
      points.push([x, y]);
    }

    // Right side, returning to the base. The opposite asymmetry and a
    // different swell keep the two halves from being mirror images.
    for (let i = sideSteps; i >= 0; i -= 1) {
      const t = i / sideSteps;
      const u = t * shoulder;
      const width = half * (baseShare + (1 - baseShare) * Math.pow(t, 0.72));
      const bulge = 1 + 0.10 * Math.sin(Math.PI * t);
      const irregular = half * 0.014 * Math.sin((5.5 * t - phase) * Math.PI);
      const x = (width * bulge + irregular * t) * (1 + asym * 0.55 * Math.sin(Math.PI * t)) + tipShift * t * t;
      points.push([x, -len * u]);
    }

    return smoothClosedPath(points, 0.9);
  }

  function veinPath(len, half, rand, depth) {
    const lean = (rand() - 0.5) * half * 0.16;
    const top = -len * (0.58 + rand() * 0.17);
    const mid = -len * (0.26 + rand() * 0.12);
    return (
      `M ${(lean * 0.1).toFixed(2)} ${(-len * 0.08).toFixed(2)} ` +
      `C ${(half * 0.05 + lean * 0.2).toFixed(2)} ${(-len * 0.20).toFixed(2)} ` +
      `${(lean * 0.5).toFixed(2)} ${mid.toFixed(2)} ${(lean * 0.8).toFixed(2)} ${top.toFixed(2)} ` +
      `S ${(lean * 1.05).toFixed(2)} ${(top * 0.99).toFixed(2)} ${(lean * 1.1).toFixed(2)} ${(top * 0.90).toFixed(2)}`
    );
  }

  function sideVeinPath(len, half, rand, dir, depth) {
    const root = dir * half * (0.10 + rand() * 0.08);
    const mid = dir * half * (0.28 + rand() * 0.15);
    const tip = dir * half * (0.40 + rand() * 0.16);
    return (
      `M ${(root * 0.35).toFixed(2)} ${(-len * 0.16).toFixed(2)} ` +
      `C ${root.toFixed(2)} ${(-len * (0.28 + depth * 0.03)).toFixed(2)} ` +
      `${(mid * 0.9).toFixed(2)} ${(-len * 0.45).toFixed(2)} ` +
      `${tip.toFixed(2)} ${(-len * (0.58 + depth * 0.04)).toFixed(2)}`
    );
  }

  function creasePath(len, half, rand) {
    const side = rand() > 0.5 ? 1 : -1;
    const spread = half * (0.12 + rand() * 0.13) * side;
    return (
      `M ${(spread * 0.2).toFixed(2)} ${(-len * 0.05).toFixed(2)} ` +
      `C ${spread.toFixed(2)} ${(-len * 0.28).toFixed(2)} ` +
      `${(spread * 0.85).toFixed(2)} ${(-len * 0.55).toFixed(2)} ` +
      `${(spread * 0.30).toFixed(2)} ${(-len * 0.76).toFixed(2)}`
    );
  }

  // HSL keeps the red clear instead of letting white/black mixing turn the
  // flower mauve. The heart is nearly burgundy; the guard petals open into a
  // saturated garden-rose crimson, with a little extra warmth on the side
  // that faces the upper-left light.
  function petalColour(depth, angle, rand) {
    const lightRel = Math.cos(((angle - 315) * Math.PI) / 180);
    const hue = 351 + (rand() - 0.5) * 7 + depth * 2.5;
    const sat = 62 + depth * 10 + (rand() - 0.5) * 5;
    const lightness = 17.5 + depth * 19 + (1 - depth) * 1.5 + lightRel * 4.2 + (rand() - 0.5) * 2.5;
    return { h: hue, s: sat, l: clamp(lightness, 11, 43) };
  }

  const hsl = (c, dl) => `hsl(${c.h.toFixed(1)} ${clamp(c.s, 0, 100).toFixed(1)}% ${clamp(c.l + dl, 0, 100).toFixed(1)}%)`;

  const petalsGroup = document.getElementById("petals");
  const flowerClipEl = document.getElementById("flowerClip");
  const petalDefs = document.createElementNS(SVG_NS, "defs");
  petalDefs.setAttribute("id", "petalDefs");
  petalsGroup.parentNode.insertBefore(petalDefs, petalsGroup);

  // Eight shallow whorls rather than one mechanically even grid. Their counts
  // are deliberately uneven, and each petal is jittered inside its own whorl.
  const ROSE_LAYERS = [
    { count: 3,  angle: 12, baseR: [0, 2],    len: [25, 45],  half: [14, 24],  tilt: [55, 100], sy: [0.36, 0.55], jitter: 0.95 },
    { count: 5,  angle: 44, baseR: [2, 8],    len: [35, 65],  half: [18, 32],  tilt: [45, 85],  sy: [0.40, 0.60], jitter: 0.72 },
    { count: 7,  angle: 20, baseR: [5, 15],   len: [50, 85],  half: [24, 42],  tilt: [35, 72],  sy: [0.46, 0.66], jitter: 0.58 },
    { count: 10, angle: 66, baseR: [12, 24],  len: [70, 105], half: [32, 52],  tilt: [26, 58],  sy: [0.52, 0.72], jitter: 0.44 },
    { count: 13, angle: 31, baseR: [20, 34],  len: [95, 130], half: [42, 64],  tilt: [14, 40], sy: [0.58, 0.76], jitter: 0.34 },
    { count: 16, angle: 8,   baseR: [24, 42],  len: [112, 158], half: [52, 78],  tilt: [6, 30],  sy: [0.64, 0.82], jitter: 0.26 },
    { count: 18, angle: 54,  baseR: [28, 50],  len: [135, 200], half: [68, 108], tilt: [-6, 24], sy: [0.70, 0.88], jitter: 0.24 },
    { count: 16, angle: 27,  baseR: [34, 56],  len: [168, 235], half: [88, 140], tilt: [-14, 18], sy: [0.78, 0.94], jitter: 0.28 },
    { count: 13, angle: 72,  baseR: [40, 62],  len: [205, 280], half: [112, 172], tilt: [-20, 16], sy: [0.84, 1.02], jitter: 0.26 }
  ];

  const petals = [];        // opening sequence order, heart outward
  const defRecords = new Map();

  function shuffle(records, rand) {
    for (let i = records.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const temp = records[i];
      records[i] = records[j];
      records[j] = temp;
    }
  }

  ROSE_LAYERS.forEach((layer, layerIndex) => {
    const depth = layerIndex / (ROSE_LAYERS.length - 1);
    const layerRecords = [];
    const layerRand = mulberry32(4103 + layerIndex * 7919);
    const step = 360 / layer.count;

    for (let i = 0; i < layer.count; i += 1) {
      const rand = mulberry32(101 + i * 37 + layerIndex * 104729);
      // Golden-angle placement keeps the petals from stacking into obvious
      // concentric rings. Consecutive petals in a whorl no longer sit at a
      // constant angular step, which is what made the old flower read as a
      // geometric rosette rather than a grown one.
      const angle = layer.angle
        + i * 137.508
        + (rand() - 0.5) * (8 + layer.jitter * 16)
        + 3.5 * Math.sin(layerIndex * 1.37 + i * 2.11);
      const silhouette = 1
        + 0.090 * Math.cos((angle - 18) * Math.PI / 180)
        + 0.028 * Math.sin(angle * Math.PI / 180 * 3 + 0.7);
      const len = randBetween(rand, layer.len) * silhouette * (0.90 + rand() * 0.20);
      const half = randBetween(rand, layer.half) * (0.82 + rand() * 0.34);
      const baseR = randBetween(rand, layer.baseR) + (rand() - 0.5) * (6 + depth * 14);
      const tiltOpen = randBetween(rand, layer.tilt) + 3.5 * Math.sin(angle * Math.PI / 180 * 2 + layerIndex);
      const tiltClosed = clamp(tiltOpen * 0.40 + 6 + (rand() - 0.5) * 3, -15, 60);
      const openSX = 0.96 + rand() * 0.08;
      const openSY = randBetween(rand, layer.sy);
      const closedSX = 0.58 + rand() * 0.10;
      const closedSY = 0.46 + depth * 0.08 + rand() * 0.07;
      const duration = Math.round(700 + depth * 100 + rand() * 90);

      const shapeId = `petalShape${petals.length}`;
      const bodyId = `petalBody${petals.length}`;
      const colour = petalColour(depth, angle, rand);
      const shape = petalOutline(len, half, rand, depth);
      const crease = creasePath(len, half, rand);
      const vein = veinPath(len, half, rand, depth);
      const sideVein = sideVeinPath(len, half, rand, rand() > 0.5 ? 1 : -1, depth);

      const shapeEl = document.createElementNS(SVG_NS, "path");
      shapeEl.setAttribute("id", shapeId);
      shapeEl.setAttribute("d", shape);
      petalDefs.appendChild(shapeEl);

      // A clip path lets the blurred edge stroke fall only inside the petal,
      // which produces a soft, rounded inner shadow instead of a flat plate.
      const clipId = `petalClip${petals.length}`;
      const clipEl = document.createElementNS(SVG_NS, "clipPath");
      clipEl.setAttribute("id", clipId);
      clipEl.setAttribute("clipPathUnits", "userSpaceOnUse");
      const clipUse = document.createElementNS(SVG_NS, "use");
      clipUse.setAttribute("href", `#${shapeId}`);
      clipEl.appendChild(clipUse);
      petalDefs.appendChild(clipEl);

      // Shade the petal across the same upper-left light that falls over the
      // whole bloom. The gradient vector is rotated into the petal's own
      // frame, so a guard petal on the right is lit on its upper side rather
      // than carrying an identical left-to-right sheen.
      const lightAngle = ((angle + tiltOpen * 0.22) * Math.PI) / 180;
      const lightX = -0.7071;
      const lightY = -0.7071;
      const localX = lightX * Math.cos(lightAngle) + lightY * Math.sin(lightAngle);
      const localY = -lightX * Math.sin(lightAngle) + lightY * Math.cos(lightAngle);
      const gradient = document.createElementNS(SVG_NS, "linearGradient");
      gradient.setAttribute("id", bodyId);
      gradient.setAttribute("x1", (0.5 + localX * 0.5).toFixed(4));
      gradient.setAttribute("y1", (0.5 + localY * 0.5).toFixed(4));
      gradient.setAttribute("x2", (0.5 - localX * 0.5).toFixed(4));
      gradient.setAttribute("y2", (0.5 - localY * 0.5).toFixed(4));
      const stops = [
        [0, hsl(colour, 9)],
        [0.38, hsl(colour, 3.5)],
        [0.72, hsl(colour, -2)],
        [1, hsl(colour, -7)]
      ];
      stops.forEach(([offset, colourValue]) => {
        const stop = document.createElementNS(SVG_NS, "stop");
        stop.setAttribute("offset", String(offset));
        stop.setAttribute("stop-color", colourValue);
        gradient.appendChild(stop);
      });
      petalDefs.appendChild(gradient);

      const el = document.createElementNS(SVG_NS, "g");
      el.setAttribute("class", "petal");
      el.setAttribute("data-petal", "");
      el.setAttribute("data-ring", String(layerIndex));
      el.setAttribute("data-order", String(petals.length));
      el.setAttribute("data-state", "closed");
      el.innerHTML = `
        <g class="petal__slide">
          <g class="petal__fold">
            <use class="petal__shadow" href="#${shapeId}" transform="translate(${(3 + depth * 4).toFixed(2)} ${(4 + depth * 6).toFixed(2)})" fill="#170208" opacity="${(0.055 + depth * 0.045).toFixed(3)}" filter="url(#petalSoft)"/>
            <use class="petal__blade" href="#${shapeId}" fill="url(#${bodyId})"/>
            <use class="petal__shade" href="#${shapeId}" fill="url(#petalShade)"/>
            <g class="petal__inner" clip-path="url(#${clipId})">
              <use href="#${shapeId}" fill="none" stroke="url(#petalInnerShade)" stroke-width="${(5 + depth * 7).toFixed(2)}" filter="url(#petalInnerSoft)"/>
              <use href="#${shapeId}" fill="none" stroke="url(#petalInnerLight)" stroke-width="${(5 + depth * 7).toFixed(2)}" filter="url(#petalInnerSoft)"/>
            </g>
            <use class="petal__rim" href="#${shapeId}" fill="none" stroke="url(#petalRim)" stroke-width=".5" stroke-linejoin="round"/>
            <use class="petal__edge-light" href="#${shapeId}" fill="none" stroke="url(#petalEdgeLight)" stroke-width="${(0.6 + depth * 0.8).toFixed(2)}" stroke-linejoin="round"/>
            <path class="petal__crease" d="${crease}" fill="none" stroke="rgba(23,2,8,.085)" stroke-width="${(0.8 + depth * 0.35).toFixed(2)}" stroke-linecap="round"/>
            <path class="petal__vein" d="${vein}" fill="none" stroke="rgba(255,194,168,.045)" stroke-width=".7" stroke-linecap="round"/>
            ${depth > 0.26 ? `<path class="petal__vein petal__vein--side" d="${sideVein}" fill="none" stroke="rgba(24,2,9,.035)" stroke-width=".65" stroke-linecap="round"/>` : ""}
          </g>
        </g>`;
      const orientation = document.createElementNS(SVG_NS, "g");
      orientation.setAttribute("class", "petal__orientation");
      orientation.setAttribute("transform", `rotate(${angle.toFixed(3)})`);
      orientation.appendChild(el);

      const record = {
        el,
        orientation,
        angle,
        shapeId,
        slide: el.querySelector(".petal__slide"),
        fold: el.querySelector(".petal__fold"),
        baseR,
        openR: baseR,
        closedR: Math.max(0, baseR - 1.5),
        openSX,
        openSY,
        closedSX,
        closedSY,
        tiltOpen,
        tiltClosed,
        twistClosed: -(12 + depth * 20) + (rand() - 0.5) * 6,
        twistOpen: (rand() - 0.5) * (depth > 0.5 ? 8 : 15),
        status: "closed",
        duration
      };
      applyPetalState(record, 1);
      el.style.opacity = "0";
      layerRecords.push(record);
      defRecords.set(el, record);
    }

    // Open around each whorl in a continuous clockwise sweep, starting at a
    // different notch in every layer. Consecutive petals overlap into a
    // rolled bud; a random shuffle can produce a four-pointed star instead.
    layerRecords.sort((a, b) => a.angle - b.angle);
    const start = Math.floor(layerRand() * layerRecords.length);
    petals.push(...layerRecords.slice(start), ...layerRecords.slice(0, start));
  });

  // Outer petals are drawn first and the folded heart sits on top, as in a
  // real bloom. Within one whorl the shuffled order is kept, so the overlap
  // does not read as a tidy card fan.
  for (let layerIndex = ROSE_LAYERS.length - 1; layerIndex >= 0; layerIndex -= 1) {
    const layer = petals.filter((record) => Number(record.el.getAttribute("data-ring")) === layerIndex);
    layer.forEach((record) => petalsGroup.appendChild(record.orientation));
  }

  function applyPetalState(record, progress) {
    const p = clamp(progress, 0, 1);
    const r = lerp(record.closedR, record.openR, p);
    const sx = lerp(record.closedSX, record.openSX, p);
    const sy = lerp(record.closedSY, record.openSY, p);
    const rotation = lerp(record.twistClosed, record.twistOpen, p);
    const tilt = lerp(record.tiltClosed, record.tiltOpen, p);
    record.slide.setAttribute("transform", `translate(0 ${(-r).toFixed(2)}) rotate(${tilt.toFixed(2)})`);
    record.fold.setAttribute("transform", `scale(${sx.toFixed(4)} ${sy.toFixed(4)}) rotate(${rotation.toFixed(2)})`);
  }

  // The directional relief is clipped to the petals that have actually
  // opened. A single global wash then reads as one light falling across the
  // bloom, instead of an identical highlight painted onto every petal.
  function mountPetalInClip(record) {
    if (!flowerClipEl) return;
    const shape = document.createElementNS(SVG_NS, "g");
    shape.setAttribute(
      "transform",
      `rotate(${record.angle.toFixed(3)}) translate(0 ${(-record.openR).toFixed(2)}) ` +
      `rotate(${record.tiltOpen.toFixed(2)}) scale(${record.openSX.toFixed(4)} ${record.openSY.toFixed(4)}) ` +
      `rotate(${record.twistOpen.toFixed(2)})`
    );
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", `#${record.shapeId}`);
    shape.appendChild(use);
    flowerClipEl.appendChild(shape);
  }

  function animatePetal(record) {
    // A restrained unfold: the petal grows just enough to suggest furling,
    // while its own tilt and rotation do the visible work. Reduced motion
    // keeps the state change but settles it almost immediately.
    const reducedAtStart = prefersReduced();
    const duration = reducedAtStart ? 110 : record.duration;

    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        if (!reducedAtStart && prefersReduced()) {
          applyPetalState(record, 1);
          record.el.style.opacity = "1";
          resolve();
          return;
        }
        const t = Math.min(1, (now - start) / duration);
        const eased = reducedAtStart
          ? t
          : t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
        applyPetalState(record, eased);
        record.el.style.opacity = String(Math.min(1, 0.12 + eased * 1.35));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  /* --- Progress ---------------------------------------------------------- */
  const countEl = document.getElementById("count");
  const rulerEl = document.getElementById("ruler");
  const lightingEl = document.querySelector(".rose__lighting");
  const groundEl = document.querySelector(".rose__ground");
  const heartEl = document.querySelector(".rose__heart");
  const ticks = [];

  for (let i = 0; i < TOTAL_PETALS; i += 1) {
    const tick = document.createElement("span");
    tick.className = i % 10 === 0 ? "tick tick--major" : "tick";
    tick.setAttribute("aria-hidden", "true");
    rulerEl.appendChild(tick);
    ticks.push(tick);
  }

  // The cast shadow, the throat and the directional wash only make sense
  // around an opened bloom. They vanish with an empty head and arrive with
  // the petals rather than sitting under them as a ghost flower.
  function updateAmbient(bloom) {
    if (lightingEl) lightingEl.style.opacity = Math.pow(bloom, 1.7).toFixed(3);
    if (groundEl) groundEl.style.opacity = (bloom * 0.46).toFixed(3);
    if (heartEl) heartEl.style.opacity = clamp((bloom - 0.012) * 5, 0, 1).toFixed(3);
  }

  function setProgress(opened) {
    countEl.textContent = String(opened).padStart(2, "0");
    rulerEl.setAttribute("aria-valuenow", String(opened));
    rulerEl.setAttribute("aria-valuetext", `${opened} pétales sur ${TOTAL_PETALS}`);
    ticks.forEach((tick, index) => tick.classList.toggle("is-open", index < opened));
    updateAmbient(opened / TOTAL_PETALS);
  }

  /* --- State ------------------------------------------------------------- */
  const state = {
    phase: "initial",
    greetingBuilt: false,
    verifying: false,
    q1: false,
    q2: false,
    sequenceStep: 0,
    sequenceLocked: false,
    completed: false,
    closing: false,
    bloomFinished: false
  };

  /* --- Rose interaction -------------------------------------------------- */
  const roseBtn = document.getElementById("rose");
  const plate = document.querySelector(".plate");
  const letter = document.getElementById("lettre");
  const AUTO_BLOOM_INTERVAL = 1000;
  let autoBloomTimer = null;

  function countPetals(status) {
    return petals.reduce(
      (total, record) => total + (record.status === status ? 1 : 0),
      0
    );
  }

  function updateRoseLabel() {
    const opened = countPetals("open");
    const countLabel = opened === 1 ? "1 pétale ouvert" : `${opened} pétales ouverts`;
    roseBtn.setAttribute(
      "aria-label",
      opened >= TOTAL_PETALS
        ? "La rose aux cent une pétales est entièrement épanouie."
        : `La rose aux cent une pétales. ${countLabel}. Activer pour ouvrir un pétale.`
    );
  }

  function stopAutoBloom() {
    if (autoBloomTimer !== null) {
      window.clearInterval(autoBloomTimer);
      autoBloomTimer = null;
    }
  }

  function startAutoBloom() {
    if (autoBloomTimer !== null || state.bloomFinished) return;

    // One interval owns the automatic sequence. A manual click can claim a
    // petal between ticks; the next tick simply finds the next closed record.
    autoBloomTimer = window.setInterval(() => {
      if (state.bloomFinished) {
        stopAutoBloom();
        return;
      }
      const next = petals.find((record) => record.status === "closed");
      if (!next) {
        stopAutoBloom();
        return;
      }
      openPetal(next, "auto");
    }, AUTO_BLOOM_INTERVAL);
  }

  function openPetal(record, source) {
    // The concurrency boundary: a petal can only be claimed once.
    if (!record || record.status !== "closed" || state.bloomFinished) return false;

    record.status = "opening";
    record.el.setAttribute("data-state", "opening");
    record.el.setAttribute("data-source", source);
    record.el.classList.add("is-opening");
    if (state.phase === "initial") state.phase = "blooming";
    plate.classList.add("has-begun");
    roseBtn.setAttribute("aria-busy", "true");

    animatePetal(record).then(() => {
      if (record.status !== "opening") return;
      record.status = "open";
      record.el.setAttribute("data-state", "open");
      record.el.classList.remove("is-opening");
      record.el.classList.add("is-open");
      record.el.style.opacity = "1";
      mountPetalInClip(record);

      const opened = countPetals("open");
      setProgress(opened);
      updateRoseLabel();
      if (!petals.some((candidate) => candidate.status === "opening")) {
        roseBtn.removeAttribute("aria-busy");
      }
      if (opened >= TOTAL_PETALS) finishBloom();
    });
    return true;
  }

  function handleRoseClick(event) {
    if (state.bloomFinished) return;
    if (state.phase !== "initial" && state.phase !== "blooming") return;

    let record = null;
    if (event && event.detail !== 0) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const petalEl = target.closest("[data-petal]");
      if (petalEl) {
        const hit = defRecords.get(petalEl) || petals.find((candidate) => candidate.el === petalEl);
        // A clicked petal must be closed; opening and open petals are inert.
        if (!hit || hit.status !== "closed") return;
        record = hit;
      } else if (target.closest("[data-rose-hit]")) {
        record = petals.find((candidate) => candidate.status === "closed") || null;
      } else {
        return;
      }
    } else {
      // Keyboard and assistive clicks target the rose button itself.
      record = petals.find((candidate) => candidate.status === "closed") || null;
    }

    if (!record) return;
    openPetal(record, "manual");
  }

  function finishBloom() {
    if (state.bloomFinished) return;
    state.bloomFinished = true;
    state.phase = "blooming";
    stopAutoBloom();
    roseBtn.disabled = true;
    roseBtn.removeAttribute("aria-busy");
    roseBtn.classList.add("is-bloomed");
    plate.classList.add("is-bloomed");
    setProgress(TOTAL_PETALS);
    updateRoseLabel();
    // The last petal has already settled; give the final progress mark a
    // breath, then let the letter take its place without a staged pause.
    setTimeout(unlockGreeting, prefersReduced() ? 40 : 280);
  }

  roseBtn.addEventListener("click", handleRoseClick);


  /* --- The Vietnamese letter --------------------------------------------- */
  const GREETING_PARAGRAPHS = [
    "Chúc các bạn nữ luôn giữ được nét dịu dàng theo cách riêng của mình, sự tự tin để theo đuổi những điều mình mong muốn, và đủ bình yên để trân trọng những gì thực sự có ý nghĩa.",
    "Mong rằng mỗi ngày đều mang đến cho các bạn những niềm vui nhỏ, những cơ hội xứng đáng, và những người luôn biết trân trọng sự hiện diện của mình.",
    "Chúc các bạn một ngày 20/10 thật nhiều niềm vui, bình an và những điều tốt đẹp."
  ];
  const ORNAMENT_SVG =
    '<svg viewBox="0 0 40 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".9">' +
    '<path d="M20 3c3.2 4.2 3.8 7.8 0 12-3.8-4.2-3.2-7.8 0-12Z"/>' +
    '<path d="M20 21c-3.2-4.2-3.8-7.8 0-12 3.8 4.2 3.2 7.8 0 12Z"/>' +
    '<path d="M7 12c4.2-3.2 7.8-3.8 12 0-4.2 3.8-7.8 3.2-12 0Z"/>' +
    '<path d="M33 12c-4.2 3.2-7.8 3.8-12 0 4.2-3.8 7.8-3.2 12 0Z"/>' +
    '<circle cx="20" cy="12" r="1.2" fill="currentColor"/></g></svg>';
  const KEYHOLE_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1"/>' +
    '<path d="M12 7.9a2.5 2.5 0 0 0-1.25 4.66c-.3 1.1-.7 2.2-1.05 3.34h4.6c-.35-1.14-.75-2.24-1.05-3.34A2.5 2.5 0 0 0 12 7.9Z" fill="currentColor"/>' +
    "</svg>";

  function buildGreeting() {
    if (state.greetingBuilt) return;
    const bloom = document.getElementById("bloom");
    const greeting = document.createElement("div");
    greeting.className = "greeting";

    const kicker = document.createElement("p");
    kicker.className = "kicker";
    kicker.lang = "fr";
    kicker.textContent = "Le vingt octobre";

    const title = document.createElement("h2");
    title.id = "greetingTitle";
    title.lang = "vi";
    title.tabIndex = -1;
    title.textContent = "Chúc mừng ngày Phụ nữ Việt Nam 20/10.";

    const rule = document.createElement("div");
    rule.className = "greeting__rule";
    rule.setAttribute("aria-hidden", "true");
    rule.innerHTML = ORNAMENT_SVG;

    greeting.append(kicker, title, rule);

    GREETING_PARAGRAPHS.forEach((text) => {
      const paragraph = document.createElement("p");
      paragraph.lang = "vi";
      paragraph.textContent = text;
      greeting.appendChild(paragraph);
    });

    const secret = document.createElement("button");
    secret.type = "button";
    secret.className = "secret-link";
    secret.id = "openSecret";
    secret.lang = "fr";
    secret.innerHTML = `${KEYHOLE_SVG}<span>Un secret pour mon petit détective</span>`;
    secret.addEventListener("click", openSecret);
    greeting.appendChild(secret);

    bloom.replaceChildren(greeting);

    state.greetingBuilt = true;
  }

  function unlockGreeting() {
    if (state.phase === "greetingUnlocked") return;
    state.phase = "greetingUnlocked";
    buildGreeting();

    const bloom = document.getElementById("bloom");
    bloom.hidden = false;
    letter.classList.add("is-unlocked");
    roseBtn.setAttribute("aria-label", "La rose aux cent une pétales est entièrement épanouie.");

    requestAnimationFrame(() => {
      bloom.classList.add("is-visible");
    });

    setTimeout(() => {
      const title = document.getElementById("greetingTitle");
      if (!title) return;
      title.focus({ preventScroll: true });
      if (window.innerWidth <= 900) {
        // Keep the opened flower in view; scroll only far enough to reveal the
        // greeting rather than centring it and cropping the bloom.
        title.scrollIntoView({ block: "nearest", behavior: prefersReduced() ? "auto" : "smooth" });
      }
    }, prefersReduced() ? 40 : 480);
  }

  /* --- The sealed letter ------------------------------------------------- */
  const dialog = document.getElementById("secretDialog");
  const closeBtn = document.getElementById("closeSecret");
  const form = document.getElementById("secretForm");
  const dateInput = document.getElementById("answerDate");
  const bookInput = document.getElementById("answerBook");
  const fieldDate = document.getElementById("fieldDate");
  const fieldBook = document.getElementById("fieldBook");
  const dateState = document.getElementById("dateState");
  const bookState = document.getElementById("bookState");
  const formStatus = document.getElementById("formStatus");
  const verifyBtn = document.getElementById("verifyBtn");
  const sequence = document.getElementById("sequence");
  const sequenceBtn = document.getElementById("sequenceBtn");
  const wordLabel = document.getElementById("wordLabel");
  const sequenceProgress = document.getElementById("sequenceProgress");
  const sequenceStatus = document.getElementById("sequenceStatus");
  const finalSection = document.getElementById("final");
  const finalSentence = document.getElementById("finalSentence");
  const musicToggle = document.getElementById("musicToggle");
  const playerMount = document.getElementById("playerMount");

  const OPEN_PHASES = new Set([
    "greetingUnlocked",
    "secretOpen",
    "answersVerified",
    "sequenceActive",
    "secretCompleted"
  ]);

  function openSecret() {
    if (!OPEN_PHASES.has(state.phase) || dialog.open) return;
    // The soundtrack is already attempting to play from page initialisation.
    // Opening the letter must not restart it or trigger a second attempt.
    if (state.phase === "greetingUnlocked") state.phase = "secretOpen";

    dialog.showModal();
    document.documentElement.classList.add("is-dialog-open");
    document.body.classList.add("is-dialog-open");
    const sheet = dialog.querySelector(".secret__sheet");
    if (sheet) sheet.scrollTop = 0;
    // The progress meter is only useful while the sheet is visible. Start its
    // lightweight poll now rather than running it behind the closed sheet.
    if (music.playing) {
      startProgressPolling();
      updateProgress();
    }

    setTimeout(() => {
      if (state.completed) {
        finalSentence.focus({ preventScroll: true });
      } else if (!sequence.hidden) {
        sequenceBtn.focus({ preventScroll: true });
      } else {
        dateInput.focus({ preventScroll: true });
      }
    }, 60);
  }

  function closeSecret() {
    if (!dialog.open || state.closing) return;
    state.closing = true;
    dialog.classList.add("is-closing");
    const finish = () => {
      dialog.close();
      dialog.classList.remove("is-closing");
      document.documentElement.classList.remove("is-dialog-open");
      document.body.classList.remove("is-dialog-open");
      stopProgressPolling();
      state.closing = false;
      if (state.phase === "secretOpen") state.phase = "greetingUnlocked";
      const opener = document.getElementById("openSecret");
      if (opener) opener.focus({ preventScroll: true });
    };
    if (prefersReduced()) finish();
    else setTimeout(finish, 180);
  }

  closeBtn.addEventListener("click", closeSecret);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSecret();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeSecret();
  });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("is-dialog-open");
    document.body.classList.remove("is-dialog-open");
    stopProgressPolling();
    if (state.phase === "secretOpen") state.phase = "greetingUnlocked";
  });

  /* --- Music ------------------------------------------------------------- */
  // The soundtrack is presented with its own compact control, not a video
  // frame. Playback runs through the official YouTube IFrame Player API; the
  // player node itself is kept out of the way (see .music__player).
  const VIDEO_ID = "cvamJ4oKBGY";
  const DEFAULT_VOLUME = 35;
  const AUTOPLAY_WATCHDOG_MS = 4500;
  const YT_UNSTARTED = -1;
  const YT_ENDED = 0;
  const YT_PLAYING = 1;
  const YT_PAUSED = 2;
  const YT_BUFFERING = 3;
  const YT_CUED = 5;

  const musicSection = document.getElementById("musicSection");
  const musicStatus = document.getElementById("musicStatus");
  const musicLabel = document.getElementById("musicLabel");
  const musicProgress = document.getElementById("musicProgress");
  const musicFill = document.getElementById("musicFill");
  const musicTime = document.getElementById("musicTime");
  const musicCue = document.getElementById("musicCue");
  const enableMusic = document.getElementById("enableMusic");
  const musicCueLabel = document.getElementById("musicCueLabel");
  const musicCueLink = document.getElementById("musicCueLink");
  const musicCueStatus = document.getElementById("musicCueStatus");

  const music = {
    player: null,
    apiLoading: false,
    apiReady: false,
    ready: false,
    wanted: false,
    started: false,
    playing: false,
    blocked: false,
    failed: false,
    poll: 0,
    attempts: 0,
    autoplayAttempted: false,
    autoplayPending: false,
    userInitiated: false,
    starting: false,
    watchdog: 0,
    confirmTimer: 0,
    clockAtStart: 0,
    bufferChecks: 0,
    attemptToken: 0
  };

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function setMusicStatus(text) {
    if (musicStatus) musicStatus.textContent = text;
  }

  function reflectMusic() {
    const playing = music.playing;
    musicToggle.setAttribute("aria-pressed", playing ? "true" : "false");
    musicToggle.setAttribute(
      "aria-label",
      playing ? "Mettre la musique en pause"
        : music.blocked ? "Activer la musique"
          : music.failed ? "Réessayer la lecture"
            : music.started ? "Reprendre la musique"
              : "Lancer la bande sonore"
    );
    if (musicLabel) {
      musicLabel.textContent = playing ? "Pause"
        : music.blocked ? "Activer"
          : music.failed ? "Réessayer"
            : music.started ? "Reprendre" : "Écouter";
    }
    if (musicSection) musicSection.classList.toggle("is-playing", playing);
  }

  function showMusicCue(message, showLink) {
    if (!musicCue) return;
    musicCue.hidden = false;
    if (musicCueLabel) musicCueLabel.textContent = showLink ? "Réessayer la musique" : "Activer la musique";
    if (musicCueLink) musicCueLink.hidden = !showLink;
    if (musicCueStatus && message) musicCueStatus.textContent = message;
  }

  function hideMusicCue() {
    if (!musicCue) return;
    musicCue.hidden = true;
  }

  function setCueBusy(busy) {
    if (!enableMusic) return;
    enableMusic.disabled = busy;
    if (busy) enableMusic.setAttribute("aria-busy", "true");
    else enableMusic.removeAttribute("aria-busy");
  }

  // The IFrame API is loaded during page initialisation. Loading it does not
  // make a sound: playback is a separate, single attempt made once the player
  // is ready. That attempt is still subject to the browser autoplay policy.
  function loadMusicApi() {
    if (music.apiLoading) return;
    if (window.YT && typeof window.YT.Player === "function") {
      music.apiReady = true;
      buildPlayer();
      return;
    }
    music.apiLoading = true;
    window.onYouTubeIframeAPIReady = () => {
      music.apiReady = true;
      music.apiLoading = false;
      buildPlayer();
    };
    const tag = document.createElement("script");
    tag.id = "youtubeIframeApi";
    tag.async = true;
    tag.src = "https://www.youtube.com/iframe_api";
    tag.addEventListener("error", () => {
      music.apiLoading = false;
      music.starting = false;
      music.playing = false;
      music.failed = true;
      clearPlaybackWatchdog();
      clearConfirmTimer();
      reflectMusic();
      setMusicStatus("La musique n'a pas pu être chargée. Ouvrez la vidéo sur YouTube.");
      setCueBusy(false);
      showMusicCue("La musique n'a pas pu être chargée. Ouvrez la vidéo sur YouTube.", true);
    });
    document.head.appendChild(tag);
  }

  function allowHiddenPlayerAutoplay() {
    const frame = music.player && typeof music.player.getIframe === "function"
      ? music.player.getIframe()
      : (playerMount && (playerMount.matches("iframe") ? playerMount : playerMount.querySelector("iframe")));
    if (!frame) return;
    frame.setAttribute("tabindex", "-1");
    const allow = frame.getAttribute("allow") || "";
    if (!/(^|;|\s)autoplay(\s|;|$)/i.test(allow)) {
      frame.setAttribute("allow", `${allow ? `${allow}; ` : ""}autoplay`);
    }
  }

  function buildPlayer() {
    if (music.player || !music.apiReady || !window.YT || !window.YT.Player) return;
    try {
      music.player = new window.YT.Player(playerMount, {
        videoId: VIDEO_ID,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          mute: 0,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      });
    } catch (error) {
      music.player = null;
      onPlayerError();
      return;
    }
    allowHiddenPlayerAutoplay();
  }

  // The requested default loudness. Applied on ready and again immediately
  // before each start, so the very first sound is already at 35/100.
  function applyVolume() {
    if (!music.player || typeof music.player.setVolume !== "function") return;
    try {
      music.player.setVolume(DEFAULT_VOLUME);
    } catch (error) {
      music.failed = true;
      setMusicStatus("Le volume n'a pas pu être réglé par le navigateur.");
    }
  }

  function playerMuted() {
    if (!music.player || typeof music.player.isMuted !== "function") return false;
    try {
      return music.player.isMuted();
    } catch (error) {
      return false;
    }
  }

  function playerState() {
    if (!music.player || typeof music.player.getPlayerState !== "function") return YT_UNSTARTED;
    try {
      return music.player.getPlayerState();
    } catch (error) {
      return YT_UNSTARTED;
    }
  }

  function playerCurrentTime() {
    if (!music.player || typeof music.player.getCurrentTime !== "function") return 0;
    try {
      return music.player.getCurrentTime();
    } catch (error) {
      return 0;
    }
  }

  function safeUnmute() {
    if (!music.player || typeof music.player.unMute !== "function") return;
    try {
      music.player.unMute();
    } catch (error) {
      // The player-state watchdog will report the failure honestly.
    }
  }

  function safePause() {
    if (!music.player || typeof music.player.pauseVideo !== "function") return;
    try {
      music.player.pauseVideo();
    } catch (error) {
      // Pausing is best-effort; it must not throw out of an event handler.
    }
  }

  function clearPlaybackWatchdog() {
    if (music.watchdog) {
      window.clearTimeout(music.watchdog);
      music.watchdog = 0;
    }
  }

  function clearConfirmTimer() {
    if (music.confirmTimer) {
      window.clearTimeout(music.confirmTimer);
      music.confirmTimer = 0;
    }
  }

  // Only silence a player that is demonstrably making sound (or trying to,
  // in a muted playing state). An unstarted or buffering player must be left
  // alone: pausing it would abort a slow but legitimate start.
  function pauseAudiblePlayback() {
    if (!music.player) return;
    if (playerMuted() || playerState() === YT_PLAYING) safePause();
  }

  function armPlaybackWatchdog(userInitiated) {
    clearPlaybackWatchdog();
    const token = ++music.attemptToken;
    music.watchdog = window.setTimeout(() => {
      music.watchdog = 0;
      if (token !== music.attemptToken) return;
      if (music.playing && !playerMuted()) return;
      const currentState = playerState();
      if (currentState === YT_PLAYING && !playerMuted()) {
        // The state event may have raced the watchdog. Treat the real player
        // state as the source of truth rather than reporting a false block.
        onPlayerStateChange({ data: YT_PLAYING });
        return;
      }
      // During some ad/stream transitions YouTube reports UNSTARTED or
      // BUFFERING while the media clock is already running. A clock that has
      // moved since this attempt began is stronger evidence of playback than
      // the transient state label (and does not mistake a paused position for
      // a resumed stream).
      if (!playerMuted() && playerCurrentTime() >= music.clockAtStart + 0.75 &&
          (currentState === YT_UNSTARTED || currentState === YT_BUFFERING || currentState === YT_CUED)) {
        onPlayerStateChange({ data: YT_PLAYING });
        return;
      }
      // Buffering is progress, not an autoplay refusal. Allow a couple of
      // extra watchdog windows before treating it as a failure.
      if (currentState === YT_BUFFERING && music.bufferChecks < 2) {
        music.bufferChecks += 1;
        setMusicStatus("Chargement de la musique…");
        armPlaybackWatchdog(userInitiated);
        return;
      }
      if (userInitiated) {
        markPlaybackFailure("La musique n'a pas pu démarrer. Activez-la à nouveau ou ouvrez la vidéo sur YouTube.");
      } else {
        markAutoplayBlocked();
      }
    }, AUTOPLAY_WATCHDOG_MS);
  }

  function markAutoplayBlocked() {
    music.playing = false;
    music.starting = false;
    music.autoplayPending = false;
    music.blocked = true;
    music.failed = false;
    clearPlaybackWatchdog();
    clearConfirmTimer();
    stopProgressPolling();
    pauseAudiblePlayback();
    setMusicStatus("La lecture automatique est bloquée. Activez la musique.");
    reflectMusic();
    setCueBusy(false);
    showMusicCue("La lecture automatique est bloquée. Activez la musique.", false);
  }

  function markPlaybackFailure(message) {
    music.playing = false;
    music.starting = false;
    music.autoplayPending = false;
    music.blocked = false;
    music.failed = true;
    clearPlaybackWatchdog();
    clearConfirmTimer();
    stopProgressPolling();
    pauseAudiblePlayback();
    setMusicStatus(message);
    reflectMusic();
    setCueBusy(false);
    showMusicCue(message, true);
  }

  function onPlayerReady() {
    music.ready = true;
    applyVolume();
    allowHiddenPlayerAutoplay();
    if (music.wanted) startPlayback(music.userInitiated);
  }

  function startPlayback(userInitiated) {
    music.wanted = true;
    if (music.playing) {
      if (userInitiated) setCueBusy(false);
      hideMusicCue();
      return;
    }
    if (music.starting) return;
    if (!music.apiReady) {
      if (userInitiated) setCueBusy(true);
      loadMusicApi();
      setMusicStatus("Chargement de la musique…");
      return;
    }
    if (!music.ready || !music.player) {
      if (userInitiated) setCueBusy(true);
      setMusicStatus("Chargement de la musique…");
      return;
    }
    if (!userInitiated && music.autoplayAttempted) return;

    if (userInitiated) {
      music.userInitiated = true;
      music.blocked = false;
      music.failed = false;
      music.autoplayPending = false;
      clearPlaybackWatchdog();
    } else {
      music.autoplayAttempted = true;
    }
    clearConfirmTimer();
    music.clockAtStart = playerCurrentTime();
    music.starting = true;
    music.autoplayPending = !userInitiated;
    if (!userInitiated) applyVolume();   // before the first automatic sound
    try {
      // Keep the user gesture as close to playVideo() as possible. Some
      // Chromium policies are sensitive to work done before this call.
      music.player.playVideo();
      if (userInitiated) {
        applyVolume();                   // immediately after the start call
        setCueBusy(true);
      }
      if (playerMuted()) safeUnmute();
    } catch (error) {
      music.starting = false;
      onPlayerError();
      return;
    }
    music.attempts += 1;
    music.bufferChecks = 0;
    setMusicStatus("Chargement de la musique…");
    reflectMusic();
    armPlaybackWatchdog(userInitiated);

    // A short confirmation window catches the common YouTube ad/stream glitch
    // where the clock runs while getPlayerState() is still UNSTARTED. It only
    // succeeds if the clock has actually advanced from this attempt's origin.
    const startClock = music.clockAtStart;
    music.confirmTimer = window.setTimeout(() => {
      music.confirmTimer = 0;
      if (!music.starting || music.playing) return;
      const currentState = playerState();
      if (currentState === YT_PAUSED || currentState === YT_ENDED) return;
      if (!playerMuted() && playerCurrentTime() >= startClock + 0.3) {
        onPlayerStateChange({ data: YT_PLAYING });
      }
    }, 900);
  }

  function onPlayerStateChange(event) {
    const status = event && typeof event.data === "number" ? event.data : YT_CUED;
    if (status === YT_PLAYING || status === YT_PAUSED || status === YT_ENDED) {
      clearConfirmTimer();
    }
    if (status === YT_PLAYING) {
      // YouTube can start a policy-blocked autoplay in a muted state. That is
      // not audible playback: try one unmute, and otherwise pause and show the
      // truthful activation control instead of claiming the music is playing.
      if (playerMuted()) {
        safeUnmute();
        if (playerMuted()) {
          if (music.userInitiated) {
            markPlaybackFailure("La musique reste bloquée en mode muet. Ouvrez la vidéo sur YouTube.");
          } else {
            markAutoplayBlocked();
          }
          return;
        }
      }
      music.playing = true;
      music.starting = false;
      music.started = true;
      music.autoplayPending = false;
      music.blocked = false;
      music.failed = false;
      clearPlaybackWatchdog();
      hideMusicCue();
      setCueBusy(false);
      setMusicStatus("Lecture en cours.");
      reflectMusic();
      startProgressPolling();
    } else if (status === YT_PAUSED) {
      if (music.blocked && !music.userInitiated) return;
      music.playing = false;
      music.starting = false;
      if (music.autoplayPending) {
        markAutoplayBlocked();
        return;
      }
      if (!music.started) {
        // A first user-initiated start can pause while the stream negotiates.
        // Do not call that "En pause." before any sound has played.
        setMusicStatus("Chargement de la musique…");
        return;
      }
      setMusicStatus("En pause.");
      reflectMusic();
      stopProgressPolling();
      updateProgress();
    } else if (status === YT_ENDED) {
      music.playing = false;
      music.starting = false;
      music.autoplayPending = false;
      clearPlaybackWatchdog();
      setMusicStatus("Lecture terminée.");
      reflectMusic();
      stopProgressPolling();
      updateProgress();
    } else if (status === YT_BUFFERING) {
      if (music.wanted && !music.blocked) setMusicStatus("Chargement de la musique…");
    } else if (status === YT_UNSTARTED || status === YT_CUED) {
      // Once the watchdog has confirmed a running media clock, a transient
      // UNSTARTED event must not replace the live status with "Chargement".
      if (music.wanted && !music.blocked && !music.playing) {
        setMusicStatus("Chargement de la musique…");
      }
    }
  }

  function onPlayerError() {
    music.playing = false;
    music.starting = false;
    music.autoplayPending = false;
    music.blocked = false;
    music.failed = true;
    clearPlaybackWatchdog();
    clearConfirmTimer();
    reflectMusic();
    stopProgressPolling();
    musicProgress.hidden = true;
    setMusicStatus("La lecture est bloquée. Ouvrez la vidéo sur YouTube.");
    setCueBusy(false);
    showMusicCue("La lecture est bloquée. Ouvrez la vidéo sur YouTube.", true);
  }

  function startProgressPolling() {
    if (music.poll || !dialog.open) return;
    music.poll = window.setInterval(updateProgress, 500);
    updateProgress();
  }

  function stopProgressPolling() {
    if (music.poll) {
      window.clearInterval(music.poll);
      music.poll = 0;
    }
  }

  function updateProgress() {
    if (!music.player || typeof music.player.getCurrentTime !== "function") return;
    const current = music.player.getCurrentTime();
    const duration = music.player.getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, current / duration));
    musicFill.style.width = `${(ratio * 100).toFixed(2)}%`;
    musicTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    musicProgress.hidden = false;
  }

  function toggleMusic() {
    music.userInitiated = true;
    if (music.playing) {
      try {
        music.player.pauseVideo();
      } catch (error) {
        onPlayerError();
        return;
      }
      // Do not depend solely on a PAUSED event: during ad/stream transitions
      // YouTube can keep reporting a transient state even after pausing.
      clearConfirmTimer();
      music.playing = false;
      music.starting = false;
      music.started = true;
      setMusicStatus("En pause.");
      reflectMusic();
      stopProgressPolling();
      updateProgress();
      return;
    }
    startPlayback(true);
  }

  musicToggle.addEventListener("click", toggleMusic);

  if (enableMusic) {
    enableMusic.addEventListener("click", () => {
      // This is the genuine user gesture that resolves an autoplay refusal.
      // It is the only manual retry; there is no automatic retry loop.
      startPlayback(true);
    });
  }

  function beginAutoplay() {
    music.wanted = true;
    setMusicStatus("Chargement de la musique…");
    loadMusicApi();
  }

  // Read-only hook so the automated checks can assert the real player state.
  window.__roseMusic = {
    isReady: () => music.ready,
    volume: () => (music.player && typeof music.player.getVolume === "function" ? music.player.getVolume() : null),
    playerState: () => (music.player && typeof music.player.getPlayerState === "function" ? music.player.getPlayerState() : null),
    isMuted: () => playerMuted(),
    blocked: () => music.blocked,
    cueVisible: () => !!(musicCue && !musicCue.hidden),
    attempts: () => music.attempts,
    status: () => (musicStatus ? musicStatus.textContent : ""),
    currentTime: () => (music.player && typeof music.player.getCurrentTime === "function" ? music.player.getCurrentTime() : null),
    duration: () => (music.player && typeof music.player.getDuration === "function" ? music.player.getDuration() : null)
  };

  /* --- Answer verification ----------------------------------------------- */
  // SHA-256 digests of normalised answers. The accepted strings are not stored.
  const Q1_DIGEST = "5887a5b907b51698710ebcaa33eb7225c97af9604b8ff39307c2079acbbe867a";
  const Q2_DIGESTS = new Set([
    "f3d41bafd14e335ebdfb4f36278c064fdb7a0c85311696619996e34a07c9699b",
    "35cf6efacdd3846e80ceb2a1b74d773eba25b8162e02cb58d5d06ba00b2a63ac",
    "870e6dab82f673f776439f5338b531840126f9cd8c6f3e450112e14da3ae1e2f",
    "714775dd31794551f67634db1362f1bc0e7e7a3285579b6cf7930973d94fb2b0",
    "81049a57575096a18b6acd8f04f166a100dec6d5b2d81e02bf051fbf573907f0"
  ]);

  function canonicalDate(value) {
    const compact = value.replace(/[\s\u00a0]+/g, "");
    const match = /^(\d{1,2})([\/-])(\d{1,2})\2(\d{4})$/.exec(compact);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[3]);
    const year = Number(match[4]);
    if (month < 1 || month > 12 || year < 1900 || year > 2100) return null;
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return null;
    return `${day}/${month}/${year}`;
  }

  function canonicalTitle(value) {
    return value.normalize("NFC").replace(/[\s\u00a0]+/g, " ").trim().toLocaleLowerCase("vi");
  }

  async function sha256Hex(text) {
    if (!window.crypto || !window.crypto.subtle) throw new Error("Web Crypto is unavailable");
    const bytes = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function verifyDate(value) {
    const canonical = canonicalDate(value);
    if (!canonical) return false;
    return (await sha256Hex(canonical)) === Q1_DIGEST;
  }

  async function verifyTitle(value) {
    const canonical = canonicalTitle(value);
    if (!canonical) return false;
    return Q2_DIGESTS.has(await sha256Hex(canonical));
  }

  function markField(field, stateEl, result, empty) {
    field.classList.remove("is-good", "is-bad");
    if (empty) {
      field.classList.add("is-bad");
      stateEl.textContent = "Une réponse est attendue.";
      field.querySelector("input").setAttribute("aria-invalid", "true");
      return;
    }
    field.classList.add(result ? "is-good" : "is-bad");
    stateEl.textContent = result ? "Exact" : "À revoir";
    field.querySelector("input").setAttribute("aria-invalid", result ? "false" : "true");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.verifying || state.phase !== "secretOpen") return;

    const dateValue = dateInput.value;
    const bookValue = bookInput.value;
    const dateEmpty = dateValue.trim() === "";
    const bookEmpty = bookValue.trim() === "";

    if (dateEmpty || bookEmpty) {
      markField(fieldDate, dateState, false, dateEmpty);
      markField(fieldBook, bookState, false, bookEmpty);
      formStatus.classList.add("is-quiet");
      formStatus.textContent = "Deux réponses sont attendues pour briser le cachet.";
      (dateEmpty ? dateInput : bookInput).focus();
      return;
    }

    state.verifying = true;
    verifyBtn.disabled = true;
    verifyBtn.setAttribute("aria-busy", "true");
    formStatus.classList.remove("is-quiet");
    formStatus.textContent = "Vérification…";

    try {
      const [dateOk, bookOk] = await Promise.all([verifyDate(dateValue), verifyTitle(bookValue)]);
      state.q1 = dateOk;
      state.q2 = bookOk;
      markField(fieldDate, dateState, dateOk);
      markField(fieldBook, bookState, bookOk);

      if (dateOk && bookOk) {
        state.phase = "answersVerified";
        formStatus.textContent = "Le cachet est brisé.";
        await wait(160);
        const lede = document.querySelector(".secret__lede");
        if (lede) lede.hidden = true;
        form.hidden = true;
        sequence.hidden = false;
        state.phase = "sequenceActive";
        updateSequenceRule();
        sequenceBtn.focus({ preventScroll: true });
      } else {
        formStatus.classList.add("is-quiet");
        formStatus.textContent =
          !dateOk && !bookOk
            ? "Le cachet résiste encore. Reprenez les deux réponses."
            : "Le cachet résiste encore. Une des deux réponses reste à préciser.";
      }
    } catch (error) {
      formStatus.classList.add("is-quiet");
      formStatus.textContent =
        "La vérification chiffrée n'est pas disponible ici. Ouvrez le site en HTTPS ou via un serveur local.";
    } finally {
      state.verifying = false;
      verifyBtn.disabled = false;
      verifyBtn.removeAttribute("aria-busy");
    }
  });

  /* --- Six fragments ----------------------------------------------------- */
  const SEQUENCE = ["Une", "deux", "trois", "Marche", "côté", "assemblé"];

  function updateSequenceRule() {
    const fraction = Math.min(SEQUENCE.length, state.sequenceStep + 1) / SEQUENCE.length;
    sequenceProgress.style.transform = `scaleX(${fraction.toFixed(4)})`;
  }

  function advanceSequence() {
    if (state.phase !== "sequenceActive" || state.completed) return;
    if (state.sequenceLocked || state.sequenceStep >= SEQUENCE.length) return;

    const nextStep = state.sequenceStep + 1;

    if (nextStep < SEQUENCE.length) {
      state.sequenceLocked = true;
      wordLabel.classList.add("is-out");
      setTimeout(() => {
        wordLabel.textContent = SEQUENCE[nextStep];
        state.sequenceStep = nextStep;
        updateSequenceRule();
        sequenceStatus.textContent = SEQUENCE[nextStep];
        wordLabel.classList.remove("is-out");
        setTimeout(() => {
          state.sequenceLocked = false;
        }, prefersReduced() ? 0 : 90);
      }, prefersReduced() ? 0 : 150);
    } else {
      state.sequenceStep = nextStep;
      updateSequenceRule();
      revealFinal();
    }
  }

  function revealFinal() {
    if (state.completed) return;
    state.completed = true;
    state.phase = "secretCompleted";
    sequence.classList.add("is-leaving");

    const sentence = document.createElement("span");
    sentence.appendChild(document.createTextNode("Il y a des jours où je te manquerai, "));
    const strong = document.createElement("strong");
    strong.textContent = "mon petit détective";
    sentence.appendChild(strong);
    sentence.appendChild(document.createTextNode("."));
    finalSentence.replaceChildren(sentence);

    setTimeout(() => {
      sequence.hidden = true;
      finalSection.hidden = false;
      dialog.classList.add("is-complete");
      requestAnimationFrame(() => finalSection.classList.add("is-visible"));
      setTimeout(() => finalSentence.focus({ preventScroll: true }), 320);
    }, prefersReduced() ? 0 : 220);
  }

  sequenceBtn.addEventListener("click", advanceSequence);

  /* --- Initialise -------------------------------------------------------- */
  setProgress(0);
  updateSequenceRule();
  updateRoseLabel();

  // Every fresh page load starts from the generated all-closed records above.
  // No petal state or progress is written to storage, cookies, the URL or a
  // backend. A bfcache restoration is forced back through a fresh load so a
  // returning recipient cannot inherit an already-opened flower.
  window.addEventListener("pagehide", () => {
    stopAutoBloom();
    clearPlaybackWatchdog();
    clearConfirmTimer();
    stopProgressPolling();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      stopAutoBloom();
      window.location.reload();
    }
  });

  if (typeof reduceQuery.addEventListener === "function") {
    reduceQuery.addEventListener("change", () => {
      // A mid-session reduction request settles any half-finished state
      // without leaving a stale transform behind.
      if (prefersReduced()) {
        petals.forEach((record) => {
          if (record.status === "opening") applyPetalState(record, 1);
        });
      }
    });
  }

  // The soundtrack is attempted independently of the rose: the player starts
  // loading now, and the single audible-autoplay attempt happens as soon as it
  // is ready. A refused attempt leaves the rose untouched and reveals the
  // activation control; it never loops or retries by itself.
  beginAutoplay();

  // Automatic blooming is not optional and starts only after every petal has
  // been generated in the closed state. The first automatic petal is selected
  // one second after this point.
  startAutoBloom();

})();
