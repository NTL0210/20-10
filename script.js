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
    { count: 3,  palette: ["#43121f", "#4d1625", "#571a2a"] },
    { count: 6,  palette: ["#4d1524", "#581a2a", "#622031"] },
    { count: 9,  palette: ["#571a2a", "#632132", "#6d2738"] },
    { count: 12, palette: ["#622132", "#6d2939", "#782f40"] },
    { count: 15, palette: ["#6c2838", "#783040", "#833949"] },
    { count: 18, palette: ["#772f3f", "#833a4a", "#8e4555"] },
    { count: 19, palette: ["#83394a", "#8f4757", "#9b5464"] },
    { count: 19, palette: ["#8f4756", "#9c5665", "#a96574"] }
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
  // in a domed, faintly notched, softly waved rim. The spine is *curved* and
  // every petal sweeps the same way, so the head wraps into one spiral instead
  // of radiating like a daisy. `curl` < 0 tucks the rim inwards (the tight
  // folded centre); `curl` > 0 lets it fall open.
  function petalOutline(len, half, rand, t, curl, bend) {
    const lean = (rand() - 0.5) * 0.12;
    const asym = (rand() - 0.5) * 0.2;
    const ruffleAmp = lerp(0.06, 0.11, t) * (0.7 + rand() * 0.6);
    const ruffleFreq = 1.7 + rand() * 1.3;
    const phase = rand() * Math.PI * 2;
    const claw = lerp(0.18, 0.26, t) + rand() * 0.05;
    const shoulder = 0.56 + (rand() - 0.5) * 0.09;
    const notch = lerp(0.1, 0.04, t) + rand() * 0.03;
    const p = lerp(0.5, 0.72, t) + (rand() - 0.5) * 0.14;

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
    const steps = 10;
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
    const domeH = (1 - shoulder) * len * (1 - 0.12 * curl);
    const rimSteps = 10;
    for (let i = 1; i < rimSteps; i += 1) {
      const a = (Math.PI * i) / rimSteps;
      const wave = 1 + ruffleAmp * Math.sin(ruffleFreq * a * 2 + phase);
      const halfEff = half * (1 + asym * (1 - Math.cos(a))) * wave;
      const lat = -halfEff * Math.cos(a);
      const out = domeH * Math.sin(a) * (1 - notch * Math.sin(a))
        * (1 + ruffleAmp * 0.8 * Math.sin(ruffleFreq * a * 2 + phase + 1.3));
      pts.push([f.cx + f.nx * lat + f.ox * out, f.cy + f.ny * lat + f.oy * out]);
    }

    for (let i = steps; i >= 1; i -= 1) {
      const u = (shoulder * i) / steps;
      const w = side(u) * (1 + asym);
      const f2 = frame(u);
      pts.push([f2.cx + w * f2.nx, f2.cy + w * f2.ny]);
    }

    return smoothClosedPath(pts, 0.85);
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
    const angle = angles[index] + (rand() - 0.5) * (4 + t * 12 + 46 * crumple);
    // Inner petals wrap almost tangentially around the bud; outer petals lie
    // open along their radius. One direction for all, so the head spirals.
    const tilt = lerp(128, 74, Math.pow(t, 0.9)) + (rand() - 0.5) * 40 * crumple;
    // Every petal is attached at the receptacle, so the inner (short) petals
    // sit on top and hide the long outer petals' bases — the way a rose is
    // actually built. Only the outer part of each long petal is ever seen.
    const baseOpen = 4 + 40 * Math.pow(t, 1.2) + (rand() - 0.5) * (4 + t * 14 + 40 * crumple);
    const baseClosed = 2 + 16 * Math.pow(t, 1.2) + (rand() - 0.5) * 2;
    // A cabbage rose is a dense folded centre wrapped in a handful of very
    // large petals: the last tenth of the petals jump in size, so no ring of
    // similar-sized petals ever forms.
    const outer = smoothstep(0.82, 1, t);
    const len = (34 + 74 * Math.pow(t, 0.85)) * (1 + 1.9 * outer) * (0.9 + rand() * (0.2 + t * 0.12));
    const half = len * lerp(0.3, 0.54, Math.pow(t, 0.6)) * (0.9 + rand() * 0.2);
    const bend = lerp(1.4, 0.55, t) * (0.8 + rand() * 0.4);
    const curl = lerp(-0.5, 0.7, t) + (rand() - 0.5) * 0.2;
    const closedSX = lerp(0.72, 0.52, t) + (rand() - 0.5) * 0.03;
    const closedSY = lerp(0.74, 0.5, t) + (rand() - 0.5) * 0.03;
    const twistClosed = -(16 + t * 34) + (rand() - 0.5) * 6;
    const twistOpen = index < 14
      ? 8 + index * 1.6 + (rand() - 0.5) * 5
      : index < 30
        ? 4 + (rand() - 0.5) * 5
        : (rand() - 0.5) * 6;
    const duration = 570 + t * 250 + Math.round(rand() * 100);
    const d = petalOutline(len, half, rand, t, curl, bend);
    const v = veinPath(len, half, rand);
    const c = creasePath(len, half, rand);
    // A warm/cool shift per petal keeps the head from looking machined.
    const baseColor = conf.palette[index % conf.palette.length];
    const color = shadeHex(baseColor, (rand() - 0.5) * 0.22);
    const shapeId = `petalShape${index}`;
    const shadowX = (rand() - 0.5) * 2.6;
    const shadowY = -(2.6 + rand() * 4.2);      // the petal's rolled-over underside
    const shadowOpacity = (0.18 + rand() * 0.2).toFixed(3);

    const shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute("id", shapeId);
    shape.setAttribute("d", d);
    petalDefs.appendChild(shape);

    const el = document.createElementNS(SVG_NS, "g");
    el.setAttribute("class", "petal");
    el.setAttribute("data-ring", String(ring));
    el.setAttribute("data-order", String(index));
    el.setAttribute("data-petal", "");
    el.innerHTML = `
      <g class="petal__slide" transform="translate(0 ${(-baseClosed).toFixed(2)}) rotate(${tilt.toFixed(2)})">
        <g class="petal__fold" transform="scale(${closedSX.toFixed(3)} ${closedSY.toFixed(3)}) rotate(${twistClosed.toFixed(2)})">
          <use class="petal__shadow" href="#${shapeId}" transform="translate(${shadowX} ${shadowY})" fill="#1c050c" opacity="${shadowOpacity}" filter="url(#petalSoft)"/>
          <use class="petal__blade" href="#${shapeId}" fill="${color}"/>
          <use class="petal__side" href="#${shapeId}" fill="url(#petalSide)"/>
          <use class="petal__sheen" href="#${shapeId}" fill="url(#petalSheen)"/>
          <use class="petal__cup" href="#${shapeId}" fill="url(#petalCup)"/>
          <use class="petal__base" href="#${shapeId}" fill="url(#petalBase)"/>
          <use class="petal__curl" href="#${shapeId}" fill="url(#petalCurl)"/>
          <use class="petal__rim" href="#${shapeId}" fill="none" stroke="url(#petalRim)" stroke-width="${ring > 4 ? 0.7 : 0.5}" stroke-linejoin="round"/>
          <path class="petal__vein" d="${v}" fill="none" stroke="${ring > 4 ? "rgba(50,12,24,.1)" : "rgba(255,240,228,.09)"}" stroke-width="1" stroke-linecap="round"/>
          <path class="petal__crease" d="${c}" fill="none" stroke="rgba(48,12,22,.035)" stroke-width="1.1" stroke-linecap="round"/>
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
      twistClosed,
      twistOpen,
      tilt,
      opened: false,
      duration
    });
  }

  // Draw the outermost petals first; the spiral centre sits on top.
  for (let index = petals.length - 1; index >= 0; index -= 1) {
    petalsGroup.appendChild(petals[index].orientation);
  }

  function applyPetalState(record, progress) {
    const r = record.closedR + (record.openR - record.closedR) * progress;
    const sx = record.closedSX + (1 - record.closedSX) * progress;
    const sy = record.closedSY + (1 - record.closedSY) * progress;
    const rotation = record.twistClosed + (record.twistOpen - record.twistClosed) * progress;
    record.slide.setAttribute("transform", `translate(0 ${(-r).toFixed(2)}) rotate(${record.tilt.toFixed(2)})`);
    record.fold.setAttribute("transform", `scale(${sx.toFixed(4)} ${sy.toFixed(4)}) rotate(${rotation.toFixed(2)})`);
  }

  function animatePetal(record) {
    if (prefersReduced()) {
      applyPetalState(record, 1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - start) / record.duration);
        const eased = 1 - Math.pow(1 - t, 3);
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
  // they grow and fade in with the flower instead of hovering over the bud.
  function updateAmbient(bloom) {
    if (!lightingEl) return;
    lightingEl.style.opacity = (bloom * bloom).toFixed(3);
    lightingEl.setAttribute("transform", `scale(${(0.34 + 0.66 * bloom).toFixed(3)})`);
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
    opened: 0,
    animating: false,
    greetingBuilt: false,
    secretOpened: false,
    verifying: false,
    q1: false,
    q2: false,
    sequenceStep: 0,
    sequenceLocked: false,
    completed: false,
    closing: false,
    parallaxFrame: 0
  };

  /* --- Rose interaction -------------------------------------------------- */
  const roseBtn = document.getElementById("rose");
  const plate = document.querySelector(".plate");
  const letter = document.getElementById("lettre");

  function handleRoseClick(event) {
    if (state.phase !== "initial" && state.phase !== "blooming") return;
    if (state.animating || state.opened >= TOTAL_PETALS) return;

    // Pointer clicks must land on the flower; keyboard/assistive clicks are always accepted.
    if (event && event.detail !== 0) {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-petal], [data-rose-hit]")) return;
    }

    // A pointer click on a specific closed petal opens that petal. Any other
    // accepted click (the hit area, or an already-opened petal) opens the next
    // unopened petal, centre outward — so the flower still unfolds in order.
    let record = null;
    if (event && event.detail !== 0 && event.target instanceof Element) {
      const petalEl = event.target.closest("[data-petal]");
      if (petalEl) {
        const hit = petals.find((candidate) => candidate.el === petalEl);
        if (hit && !hit.opened) record = hit;
      }
    }
    if (!record) {
      record = petals.find((candidate) => !candidate.opened) || null;
    }
    if (!record) return;

    state.phase = "blooming";
    state.animating = true;
    loadMusicApi();               // warm up the player during early engagement
    plate.classList.add("has-begun");
    roseBtn.setAttribute("aria-busy", "true");
    record.opened = true;
    record.el.classList.add("is-open");

    animatePetal(record).then(() => {
      state.opened += 1;
      state.animating = false;
      roseBtn.removeAttribute("aria-busy");
      setProgress(state.opened);
      roseBtn.setAttribute(
        "aria-label",
        state.opened >= TOTAL_PETALS
          ? "La rose aux cent une pétales est entièrement épanouie."
          : `La rose aux cent une pétales. ${state.opened} pétales ouverts. Activer pour ouvrir le pétale suivant.`
      );
      if (state.opened >= TOTAL_PETALS) finishBloom();
    });
  }

  function finishBloom() {
    state.phase = "blooming";
    roseBtn.disabled = true;
    roseBtn.classList.add("is-bloomed", "is-settling");
    plate.classList.add("is-bloomed");
    setProgress(TOTAL_PETALS);
    setTimeout(() => {
      roseBtn.classList.remove("is-settling");
      unlockGreeting();
    }, prefersReduced() ? 60 : 1250);
  }

  roseBtn.addEventListener("click", handleRoseClick);

  /* --- Pointer depth (desktop only, always optional) --------------------- */
  function setupParallax() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const stage = document.getElementById("plateStage");
    let targetX = 0;
    let targetY = 0;

    const apply = () => {
      state.parallaxFrame = 0;
      stage.style.transform = `translate3d(${targetX.toFixed(2)}px, ${targetY.toFixed(2)}px, 0)`;
    };

    window.addEventListener("pointermove", (event) => {
      if (prefersReduced() || document.documentElement.classList.contains("is-dialog-open")) return;
      targetX = (event.clientX / window.innerWidth - 0.5) * -9;
      targetY = (event.clientY / window.innerHeight - 0.5) * -7;
      if (!state.parallaxFrame) state.parallaxFrame = requestAnimationFrame(apply);
    }, { passive: true });

    document.addEventListener("mouseleave", () => {
      targetX = 0;
      targetY = 0;
      if (!state.parallaxFrame) state.parallaxFrame = requestAnimationFrame(apply);
    });
  }

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
    Array.from(greeting.children).forEach((child, index) => {
      child.style.setProperty("--i", String(index));
    });

    state.greetingBuilt = true;
  }

  function unlockGreeting() {
    if (state.phase === "greetingUnlocked") return;
    state.phase = "greetingUnlocked";
    buildGreeting();

    const bloom = document.getElementById("bloom");
    const greeting = bloom.querySelector(".greeting");
    bloom.hidden = false;
    letter.classList.add("is-unlocked");
    roseBtn.setAttribute("aria-label", "La rose aux cent une pétales est entièrement épanouie.");

    requestAnimationFrame(() => {
      bloom.classList.add("is-visible");
      if (greeting) greeting.classList.add("is-visible");
    });

    setTimeout(() => {
      const title = document.getElementById("greetingTitle");
      if (!title) return;
      title.focus({ preventScroll: true });
      if (window.innerWidth <= 900) {
        title.scrollIntoView({ block: "center", behavior: prefersReduced() ? "auto" : "smooth" });
      }
    }, prefersReduced() ? 50 : 900);
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
    if (!state.secretOpened) {
      state.secretOpened = true;
      startPlayback();
    }
    if (state.phase === "greetingUnlocked") state.phase = "secretOpen";

    dialog.showModal();
    document.documentElement.classList.add("is-dialog-open");
    document.body.classList.add("is-dialog-open");
    const sheet = dialog.querySelector(".secret__sheet");
    if (sheet) sheet.scrollTop = 0;

    setTimeout(() => {
      if (state.completed) {
        finalSentence.focus({ preventScroll: true });
      } else if (!sequence.hidden) {
        sequenceBtn.focus({ preventScroll: true });
      } else {
        dateInput.focus({ preventScroll: true });
      }
    }, 80);
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
      state.closing = false;
      if (state.phase === "secretOpen") state.phase = "greetingUnlocked";
      const opener = document.getElementById("openSecret");
      if (opener) opener.focus({ preventScroll: true });
    };
    if (prefersReduced()) finish();
    else setTimeout(finish, 300);
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
    if (state.phase === "secretOpen") state.phase = "greetingUnlocked";
  });

  /* --- Music ------------------------------------------------------------- */
  // The soundtrack is presented with its own compact control, not a video
  // frame. Playback runs through the official YouTube IFrame Player API; the
  // player node itself is kept out of the way (see .music__player).
  const VIDEO_ID = "cvamJ4oKBGY";
  const DEFAULT_VOLUME = 35;
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

  const music = {
    player: null,
    apiLoading: false,
    apiReady: false,
    ready: false,
    wanted: false,
    started: false,
    playing: false,
    failed: false,
    poll: 0
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
        : music.failed ? "Réessayer la lecture"
          : music.started ? "Reprendre la musique"
            : "Lancer la bande sonore"
    );
    if (musicLabel) {
      musicLabel.textContent = playing ? "Pause"
        : music.failed ? "Réessayer"
          : music.started ? "Reprendre" : "Écouter";
    }
    if (musicSection) musicSection.classList.toggle("is-playing", playing);
  }

  // The IFrame API is loaded the first time the reader interacts with the
  // rose, so the player is ready (and can be started synchronously from a
  // genuine click) long before the sealed letter is opened.
  function loadMusicApi() {
    if (music.apiLoading || music.apiReady) return;
    music.apiLoading = true;
    window.onYouTubeIframeAPIReady = () => {
      music.apiReady = true;
      buildPlayer();
    };
    const tag = document.createElement("script");
    tag.id = "youtubeIframeApi";
    tag.async = true;
    tag.src = "https://www.youtube.com/iframe_api";
    tag.addEventListener("error", () => {
      music.failed = true;
      reflectMusic();
      setMusicStatus("La musique n'a pas pu être chargée. Ouvrez la vidéo sur YouTube.");
    });
    document.head.appendChild(tag);
  }

  function buildPlayer() {
    if (music.player || !music.apiReady || !window.YT || !window.YT.Player) return;
    music.player = new window.YT.Player(playerMount, {
      videoId: VIDEO_ID,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
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

  function onPlayerReady() {
    music.ready = true;
    applyVolume();
    if (music.wanted) startPlayback();
  }

  function startPlayback() {
    music.wanted = true;
    if (!music.apiReady) {
      loadMusicApi();
      setMusicStatus("Chargement de la musique…");
      return;
    }
    if (!music.ready || !music.player) {
      setMusicStatus("Chargement de la musique…");
      return;
    }
    applyVolume();                       // before the first audible frame
    try {
      if (typeof music.player.unMute === "function") music.player.unMute();
      music.player.playVideo();
    } catch (error) {
      onPlayerError();
      return;
    }
    music.started = true;
    music.failed = false;
    setMusicStatus("Lecture en cours…");
    reflectMusic();
  }

  function onPlayerStateChange(event) {
    const status = event && typeof event.data === "number" ? event.data : YT_CUED;
    if (status === YT_PLAYING) {
      music.playing = true;
      music.started = true;
      music.failed = false;
      setMusicStatus("Lecture en cours.");
      reflectMusic();
      startProgressPolling();
    } else if (status === YT_PAUSED) {
      music.playing = false;
      setMusicStatus("En pause.");
      reflectMusic();
      stopProgressPolling();
      updateProgress();
    } else if (status === YT_ENDED) {
      music.playing = false;
      setMusicStatus("Lecture terminée.");
      reflectMusic();
      stopProgressPolling();
      updateProgress();
    } else if (status === YT_BUFFERING) {
      if (music.wanted) setMusicStatus("Chargement de la musique…");
    }
  }

  function onPlayerError() {
    music.playing = false;
    music.failed = true;
    reflectMusic();
    stopProgressPolling();
    musicProgress.hidden = true;
    setMusicStatus("La lecture est bloquée. Ouvrez la vidéo sur YouTube.");
  }

  function startProgressPolling() {
    if (music.poll) return;
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
    if (music.playing) {
      try {
        music.player.pauseVideo();
      } catch (error) {
        onPlayerError();
      }
      return;
    }
    startPlayback();
  }

  musicToggle.addEventListener("click", toggleMusic);

  // Read-only hook so the automated checks can assert the real player state.
  window.__roseMusic = {
    isReady: () => music.ready,
    volume: () => (music.player && typeof music.player.getVolume === "function" ? music.player.getVolume() : null),
    playerState: () => (music.player && typeof music.player.getPlayerState === "function" ? music.player.getPlayerState() : null)
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
        await wait(380);
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
        }, prefersReduced() ? 0 : 140);
      }, prefersReduced() ? 0 : 240);
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
      setTimeout(() => finalSentence.focus({ preventScroll: true }), 700);
    }, prefersReduced() ? 0 : 360);
  }

  sequenceBtn.addEventListener("click", advanceSequence);

  /* --- Initialise -------------------------------------------------------- */
  setProgress(0);
  updateSequenceRule();
  setupParallax();

  if (typeof reduceQuery.addEventListener === "function") {
    reduceQuery.addEventListener("change", () => {
      if (prefersReduced()) {
        const stage = document.getElementById("plateStage");
        if (stage) stage.style.transform = "none";
      }
    });
  }

})();
