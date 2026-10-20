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

  /* --- Deterministic geometry ------------------------------------------- */
  // The rose is grown as a phyllotactic spiral; rings only tint the petals
  // and define how far the opening sequence has travelled outwards.
  const RINGS = [
    { count: 3,  palette: ["#4d1625", "#571a2a", "#622031"] },
    { count: 6,  palette: ["#571a2a", "#622031", "#6d2738"] },
    { count: 9,  palette: ["#5f1e2d", "#6b2536", "#762c3d"] },
    { count: 12, palette: ["#682536", "#742d3e", "#803545"] },
    { count: 15, palette: ["#712c3c", "#7d3445", "#893d4e"] },
    { count: 18, palette: ["#7b3343", "#873e4e", "#934959"] },
    { count: 19, palette: ["#873d4e", "#934b5b", "#9f5868"] },
    { count: 19, palette: ["#934b5a", "#a05a69", "#ac6978"] }
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Nudge a petal's colour towards white (amount > 0) or black (amount < 0).
  function shadeHex(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const target = amount >= 0 ? 255 : 0;
    const k = Math.min(1, Math.abs(amount));
    const mix = (c) => Math.round(c + (target - c) * k);
    return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
  }

  // Catmull-Rom through a closed loop of points, emitted as smooth cubic
  // Bézier segments. Every join keeps a continuous tangent, so the petal
  // outline has no angular corners anywhere.
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

  // A single rose petal. Unlike a daisy ray, a rose petal never narrows to a
  // point: it rises from a narrow claw, flares into broad shoulders and closes
  // in a domed, faintly notched, softly waved rim. The rim flares just beyond
  // each shoulder and carries two slow undulations rather than a row of small
  // ripples, so the silhouette reads as a broad, soft petal edge. The spine is
  // *curved* and every petal sweeps the same way, so the head wraps into one
  // spiral instead of radiating like a daisy. `curl` < 0 tucks the rim inwards
  // (the tight folded centre); `curl` > 0 lets it fall open.
  function petalOutline(len, half, rand, t, curl, bend) {
    const lean = (rand() - 0.5) * 0.1;
    const asym = (rand() - 0.5) * lerp(0.34, 0.16, t);
    const rimShift = (rand() - 0.5) * half * lerp(0.16, 0.06, t);
    const ruffleAmp = lerp(0.04, 0.08, t) * (0.7 + rand() * 0.5);
    const ruffleFreq = 1.6 + rand() * 0.7;
    const rippleAmp = 0.004 + rand() * 0.012;
    const rippleFreq = 4.2 + rand() * 1.8;
    const phase = rand() * Math.PI * 2;
    const claw = lerp(0.3, 0.42, t) + (rand() - 0.5) * 0.08;
    const shoulder = lerp(0.5, 0.56, t) + (rand() - 0.5) * 0.09;
    const notch = lerp(0.04, 0.06, t) + rand() * 0.018;
    const p = lerp(0.55, 0.78, t) + (rand() - 0.5) * 0.18;
    const flare = half * (0.02 + 0.02 * t) * (0.7 + rand() * 0.8);

    const sweep = bend * half;
    const spineX = (u) => sweep * u * u + lean * half * u;
    const spineY = (u) => -len * u;
    const tanX = (u) => 2 * sweep * u + lean * half;

    const frame = (u) => {
      const tx = tanX(u);
      const tl = Math.hypot(tx, -len);
      return { cx: spineX(u), cy: spineY(u), nx: len / tl, ny: tx / tl, ox: tx / tl, oy: -len / tl };
    };

    const pts = [[0, 0]];
    const steps = 12;
    const side = (u) => half * (claw + (1 - claw) * Math.sin(Math.PI * 0.5 * Math.pow(u / shoulder, p)));

    for (let i = 1; i <= steps; i += 1) {
      const u = (shoulder * i) / steps;
      const w = side(u);
      const f = frame(u);
      pts.push([f.cx - w * f.nx, f.cy - w * f.ny]);
    }

    const f = frame(shoulder);
    // Reflexed outer petals flatten their dome; the incurved centre keeps a
    // taller, more hooded rim.
    const domeH = (1 - shoulder) * len * 1.55 * (1 - 0.14 * curl) * (0.9 + rand() * 0.2);
    const rimSteps = 14;
    for (let i = 1; i < rimSteps; i += 1) {
      const a = (Math.PI * i) / rimSteps;
      const wave = 1
        + ruffleAmp * Math.sin(ruffleFreq * a * 2 + phase)
        + rippleAmp * Math.sin(rippleFreq * a + phase * 1.7);
      const halfEff = half * (1 + asym * (1 - Math.cos(a))) * wave;
      const lat = -halfEff * Math.cos(a) - flare * Math.sin(a) * Math.cos(a) + rimShift * Math.sin(a);
      const out = domeH * Math.sin(a) * (1 - notch * Math.sin(a))
        * (1 + ruffleAmp * 0.5 * Math.sin(ruffleFreq * a * 2 + phase + 1.1));
      pts.push([f.cx + f.nx * lat + f.ox * out, f.cy + f.ny * lat + f.oy * out]);
    }

    for (let i = steps; i >= 1; i -= 1) {
      const u = (shoulder * i) / steps;
      const w = side(u) * (1 + asym);
      const f2 = frame(u);
      pts.push([f2.cx + w * f2.nx, f2.cy + w * f2.ny]);
    }

    return smoothClosedPath(pts, 0.9);
  }

  function veinPath(len, half, rand) {
    const bend = (rand() - 0.5) * half * 0.3;
    const top = -len * (0.58 + rand() * 0.16);
    const mid = -len * (0.28 + rand() * 0.1);
    return (
      `M 0 ${(-len * 0.1).toFixed(2)} ` +
      `C ${(half * 0.05).toFixed(2)} ${(-len * 0.2).toFixed(2)} ` +
      `${(bend * 0.4).toFixed(2)} ${(mid).toFixed(2)} ${(bend * 0.85).toFixed(2)} ${(top * 0.92).toFixed(2)} ` +
      `S ${(bend * 1.05).toFixed(2)} ${(top * 0.99).toFixed(2)} ${(bend).toFixed(2)} ${(top).toFixed(2)}`
    );
  }

  // A secondary vein, set off the spine. One fine line per petal is enough to
  // suggest the grain of the surface without turning the flower into a
  // drawing.
  function sideVein(len, half, rand, dir) {
    const root = dir * half * (0.12 + rand() * 0.1);
    const mid = dir * half * (0.34 + rand() * 0.16);
    const tip = dir * half * (0.5 + rand() * 0.14);
    return (
      `M ${(root * 0.4).toFixed(2)} ${(-len * 0.18).toFixed(2)} ` +
      `C ${root.toFixed(2)} ${(-len * 0.32).toFixed(2)} ` +
      `${(mid * 0.9).toFixed(2)} ${(-len * 0.48).toFixed(2)} ` +
      `${tip.toFixed(2)} ${(-len * 0.64).toFixed(2)}`
    );
  }

  function creasePath(len, half, rand) {
    const side = rand() > 0.5 ? 1 : -1;
    const spread = half * (0.15 + rand() * 0.12) * side;
    return (
      `M ${(spread * 0.25).toFixed(2)} ${(-len * 0.06).toFixed(2)} ` +
      `C ${spread.toFixed(2)} ${(-len * 0.32).toFixed(2)} ` +
      `${(spread * 0.8).toFixed(2)} ${(-len * 0.58).toFixed(2)} ` +
      `${(spread * 0.35).toFixed(2)} ${(-len * 0.78).toFixed(2)}`
    );
  }

  const petalsGroup = document.getElementById("petals");
  // One reusable outline per petal lives in <defs>; the shading layers are
  // <use> references, so the (long) organic path data is stored only once.
  const petalDefs = document.createElementNS(SVG_NS, "defs");
  petalDefs.setAttribute("id", "petalDefs");
  petalsGroup.parentNode.insertBefore(petalDefs, petalsGroup);
  const petals = [];        // opening sequence order, centre outward
  const cumulative = [];
  RINGS.reduce((sum, conf) => {
    const next = sum + conf.count;
    cumulative.push(next);
    return next;
  }, 0);

  function stageFor(index) {
    for (let i = 0; i < cumulative.length; i += 1) {
      if (index < cumulative[i]) return i;
    }
    return RINGS.length - 1;
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };

  // Angular placement. The folded centre is laid down with a short, steady
  // step so those petals chain into one visible spiral roll; further out the
  // step opens onto the golden angle, which packs the broad petals evenly.
  const angles = [];
  let acc = 8;
  for (let i = 0; i < TOTAL_PETALS; i += 1) {
    acc += i < 10 ? 20.5 : 137.508;
    angles.push(acc);
  }

  for (let index = 0; index < TOTAL_PETALS; index += 1) {
    const t = index / (TOTAL_PETALS - 1);
    const ring = stageFor(index);
    const conf = RINGS[ring];
    const rand = mulberry32(101 + index * 7919);
    // The centre is deliberately crumpled: stronger jitter in angle, radius
    // and lean near the middle keeps the inner petals from nesting into a
    // neat rosette, which would read as a camellia.
    const crumple = (1 - t) * (1 - t);
    const angle = angles[index] + (rand() - 0.5) * (6 + t * 22 + 58 * crumple) + 4 * Math.sin(index * 0.9);
    // Inner petals are wrapped around the bud and unfold outwards; outer
    // petals are already open. Interpolating this angle is what makes the
    // opening read as an unfolding rather than a flat scale-up.
    const tiltOpen = lerp(124, 70, Math.pow(t, 0.92)) + (rand() - 0.5) * (12 + 34 * crumple);
    const tiltClosed = lerp(136, 98, Math.pow(t, 0.8)) + (rand() - 0.5) * 12;
    // Every petal is attached at the receptacle, so the inner (short) petals
    // sit on top and hide the long outer petals' bases — the way a rose is
    // actually built. Only the outer part of each long petal is ever seen.
    const baseOpen = 4 + 38 * Math.pow(t, 1.15) + (rand() - 0.5) * (4 + t * 22 + 46 * crumple);
    const baseClosed = 1.5 + 14 * Math.pow(t, 1.15) + (rand() - 0.5) * 2;
    // A cabbage rose is a dense folded centre wrapped in many broad petals.
    // The size gradient is strong but spread across the outer third, so the
    // silhouette is made of overlapping lobes rather than a handful of flat
    // plates.
    const outer = smoothstep(0.72, 1, t);
    const innerBoost = 1 + 0.28 * Math.pow(1 - t, 3);
    const len = (44 + 80 * Math.pow(t, 0.82)) * (1 + 1.05 * outer) * innerBoost * (0.78 + rand() * (0.36 + t * 0.12));
    const half = len * lerp(0.48, 0.78, Math.pow(t, 0.55)) * (0.85 + rand() * 0.3);
    const bend = lerp(1.8, 0.45, t) * (0.8 + rand() * 0.4);
    const curl = lerp(-0.75, 0.75, t) + (rand() - 0.5) * 0.26;
    // Inner petals stand up inside the cup, so they stay foreshortened even
    // when the flower is open; outer petals lie flat and reach full size.
    const openSX = lerp(0.8, 1, t) + (rand() - 0.5) * 0.03;
    const openSY = lerp(0.78, 1, t) + (rand() - 0.5) * 0.03;
    const closedSX = lerp(0.58, 0.48, t) + (rand() - 0.5) * 0.035;
    const closedSY = lerp(0.62, 0.5, t) + (rand() - 0.5) * 0.035;
    const twistClosed = -(18 + t * 30) + (rand() - 0.5) * 7;
    const twistOpen = index < 14
      ? 8 + index * 1.6 + (rand() - 0.5) * 5
      : index < 30
        ? 4 + (rand() - 0.5) * 5
        : (rand() - 0.5) * 6;
    // Larger outer petals travel farther, so they take slightly longer. The
    // timing follows the petal's position, never a random per-petal dice roll.
    const duration = Math.round(470 + t * 250);
    const d = petalOutline(len, half, rand, t, curl, bend);
    const v = veinPath(len, half, rand);
    const vs = sideVein(len, half, rand, rand() > 0.5 ? 1 : -1);
    const c = creasePath(len, half, rand);
    // A warm/cool shift per petal keeps the head from looking machined. The
    // light comes from the upper left, so petals on that side of the head are
    // lifted and those opposite fall into a slightly deeper wash.
    const baseColor = conf.palette[index % conf.palette.length];
    const lightRel = Math.cos(((angle - 225) * Math.PI) / 180);
    const color = shadeHex(baseColor, lightRel * 0.13 + (rand() - 0.5) * 0.16);
    const shapeId = `petalShape${index}`;
    // Light comes from the upper left; cast shadows therefore fall down and
    // to the right, onto the petal beneath. A soft, low-contrast shadow reads
    // as depth instead of a cut-paper edge.
    const shadowX = 1 + rand() * 1.8;
    const shadowY = 1.4 + rand() * 2.4;
    const shadowOpacity = (0.03 + rand() * 0.04).toFixed(3);
    const creaseMarkup = ring < 5
      ? `<path class="petal__crease" d="${c}" fill="none" stroke="rgba(48,12,22,.028)" stroke-width="1.1" stroke-linecap="round"/>`
      : "";

    const shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute("id", shapeId);
    shape.setAttribute("d", d);
    petalDefs.appendChild(shape);

    const el = document.createElementNS(SVG_NS, "g");
    el.setAttribute("class", "petal");
    el.setAttribute("data-ring", String(ring));
    el.setAttribute("data-order", String(index));
    el.setAttribute("data-petal", "");
    el.setAttribute("data-state", "closed");
    el.innerHTML = `
      <g class="petal__slide" transform="translate(0 ${(-baseClosed).toFixed(2)}) rotate(${tiltClosed.toFixed(2)})">
        <g class="petal__fold" transform="scale(${closedSX.toFixed(3)} ${closedSY.toFixed(3)}) rotate(${twistClosed.toFixed(2)})">
          <use class="petal__shadow" href="#${shapeId}" transform="translate(${shadowX} ${shadowY})" fill="#1c050c" opacity="${shadowOpacity}" filter="url(#petalSoft)"/>
          <use class="petal__blade" href="#${shapeId}" fill="${color}"/>
          <use class="petal__volume" href="#${shapeId}" fill="url(#petalVolume)"/>
          <use class="petal__side" href="#${shapeId}" fill="url(#petalSide)"/>
          <use class="petal__sheen" href="#${shapeId}" fill="url(#petalSheen)"/>
          <use class="petal__cup" href="#${shapeId}" fill="url(#petalCup)"/>
          <use class="petal__base" href="#${shapeId}" fill="url(#petalBase)"/>
          <use class="petal__curl" href="#${shapeId}" fill="url(#petalCurl)"/>
          <use class="petal__rim" href="#${shapeId}" fill="none" stroke="url(#petalRim)" stroke-width="${ring > 4 ? 0.45 : 0.35}" stroke-linejoin="round"/>
          <use class="petal__edge" href="#${shapeId}" fill="none" stroke="#3a0d1a" stroke-opacity="${ring < 5 ? 0.18 : 0.09}" stroke-width="${ring < 5 ? 0.65 : 0.5}" stroke-linejoin="round"/>
          <path class="petal__vein" d="${v}" fill="none" stroke="${ring > 4 ? "rgba(50,12,24,.1)" : "rgba(255,240,228,.09)"}" stroke-width="1" stroke-linecap="round"/>
          ${ring > 3 ? `<path class="petal__vein petal__vein--side" d="${vs}" fill="none" stroke="rgba(50,12,24,.05)" stroke-width=".9" stroke-linecap="round"/>` : ""}
          ${creaseMarkup}
        </g>
      </g>`;
    const orientation = document.createElementNS(SVG_NS, "g");
    orientation.setAttribute("class", "petal__orientation");
    orientation.setAttribute("transform", `rotate(${angle.toFixed(3)})`);
    orientation.appendChild(el);

    petals.push({
      el,
      orientation,
      slide: el.querySelector(".petal__slide"),
      fold: el.querySelector(".petal__fold"),
      closedR: baseClosed,
      openR: baseOpen,
      closedSX,
      closedSY,
      openSX,
      openSY,
      twistClosed,
      twistOpen,
      tiltClosed,
      tiltOpen,
      status: "closed",
      duration
    });
  }

  // Draw the outermost petals first; the spiral centre sits on top.
  for (let index = petals.length - 1; index >= 0; index -= 1) {
    petalsGroup.appendChild(petals[index].orientation);
  }

  function applyPetalState(record, progress) {
    const r = record.closedR + (record.openR - record.closedR) * progress;
    const sx = record.closedSX + (record.openSX - record.closedSX) * progress;
    const sy = record.closedSY + (record.openSY - record.closedSY) * progress;
    const rotation = record.twistClosed + (record.twistOpen - record.twistClosed) * progress;
    const tilt = record.tiltClosed + (record.tiltOpen - record.tiltClosed) * progress;
    record.slide.setAttribute("transform", `translate(0 ${(-r).toFixed(2)}) rotate(${tilt.toFixed(2)})`);
    record.fold.setAttribute("transform", `scale(${sx.toFixed(4)} ${sy.toFixed(4)}) rotate(${rotation.toFixed(2)})`);
  }

  function animatePetal(record) {
    // Reduced motion still shows a short, simple unfold rather than disabling
    // the experience. The automatic cadence remains one petal per second.
    const reducedAtStart = prefersReduced();
    const duration = reducedAtStart ? 120 : record.duration;

    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        // If the reader turns on reduced motion mid-unfold, settle the petal
        // immediately instead of finishing the long tween.
        if (!reducedAtStart && prefersReduced()) {
          applyPetalState(record, 1);
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
  const ticks = [];

  for (let i = 0; i < TOTAL_PETALS; i += 1) {
    const tick = document.createElement("span");
    tick.className = i % 10 === 0 ? "tick tick--major" : "tick";
    tick.setAttribute("aria-hidden", "true");
    rulerEl.appendChild(tick);
    ticks.push(tick);
  }

  // The directional-light overlays only make sense around an opened bloom, so
  // they fade in with the flower instead of hovering over the bud.
  function updateAmbient(bloom) {
    if (!lightingEl) return;
    lightingEl.style.opacity = (bloom * bloom).toFixed(3);
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

    // One interval owns the automatic sequence. Every tick selects at most one
    // closed petal; manually selected petals are already "opening"/"open" and
    // are therefore skipped.
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
    // This guard is the concurrency boundary: a petal can only be claimed once.
    if (!record || record.status !== "closed" || state.bloomFinished) return false;

    record.status = "opening";
    record.el.setAttribute("data-state", "opening");
    record.el.setAttribute("data-source", source);
    record.el.classList.add("is-opening");
    if (state.phase === "initial") state.phase = "blooming";
    plate.classList.add("has-begun");
    roseBtn.setAttribute("aria-busy", "true");

    animatePetal(record).then(() => {
      // Only the transition that claimed this petal may complete it.
      if (record.status !== "opening") return;
      record.status = "open";
      record.el.setAttribute("data-state", "open");
      record.el.classList.remove("is-opening");
      record.el.classList.add("is-open");

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
      // Pointer clicks must land on the flower.
      const target = event.target;
      if (!(target instanceof Element)) return;
      const petalEl = target.closest("[data-petal]");
      if (petalEl) {
        const hit = petals.find((candidate) => candidate.el === petalEl);
        // Clicking a petal that is already opening or open does nothing: it
        // must not restart, duplicate, or open a different petal by accident.
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
    // The YouTube player is loaded only when the sealed letter is opened, so
    // an early petal click cannot compete with the automatic bloom.
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
    // The last petal has already settled; give the final progress mark a beat
    // to register, then let the letter take over without a staged pause.
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
      // BUFFERING while the media clock is already running. A real current
      // time is stronger evidence of playback than the transient state label.
      if (!playerMuted() && playerCurrentTime() >= 0.75 &&
          (currentState === YT_UNSTARTED || currentState === YT_BUFFERING)) {
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
  }

  function onPlayerStateChange(event) {
    const status = event && typeof event.data === "number" ? event.data : YT_CUED;
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
