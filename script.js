/* ==========================================================================
   La rose aux cent une pétales — 20 octobre
   Vanilla ES2020. No framework, no build step, no dependencies.

   The flower itself is *designed offline* by tools/build-rose.mjs and baked
   into assets/rose.js: 101 petals, their outlines, their colours and their
   place in one golden-angle spiral. This file only builds the DOM for that
   geometry and animates it — it never invents a petal at runtime.

   The shading is deliberately filter-free. Every petal is four painted
   layers (body, along-petal shade, global light wash, rim light) over one
   shared path, so the whole bloom costs one cheap drop shadow instead of
   200+ blur filters re-rasterising on every animation frame.
   ========================================================================== */
(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const TOTAL_PETALS = 101;
  const AUTO_BLOOM_INTERVAL = 1000;

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = () => reduceQuery.matches;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, prefersReduced() ? 0 : ms));

  /* ======================================================================
     The rose
     ====================================================================== */
  const geometry = window.ROSE_GEOMETRY;
  const petalsGroup = document.getElementById("petals");
  const roseBtn = document.getElementById("rose");
  const plate = document.querySelector(".plate");
  const letter = document.getElementById("lettre");
  const throatEl = document.querySelector(".rose__throat");

  if (!geometry || !petalsGroup) {
    // Without the baked geometry there is no rose; fail loudly rather than
    // leaving a silent half-built page.
    throw new Error("assets/rose.js is missing or malformed");
  }

  /* --- one shared set of painted layers -------------------------------- */
  // The outline of every petal lives once in <defs>. Each petal is then
  // painted as a stack of <use> elements over that single path.
  const roseDefs = document.createElementNS(SVG_NS, "defs");
  roseDefs.setAttribute("id", "roseDefs");
  petalsGroup.parentNode.insertBefore(roseDefs, petalsGroup);

  const petals = [];
  const petalByElement = new Map();

  // The flower is painted from the outside in: the broad guard petals go
  // down first and the folded heart is laid on top of them, exactly as the
  // petals stack on a real bloom. Index 0 is the heart, index 100 the last
  // guard petal, so the paint order is the reverse of the opening order.
  geometry.petals.forEach((spec, index) => {
    const shapeId = `rosePetal${index}`;
    const shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute("id", shapeId);
    shape.setAttribute("d", spec.d);
    roseDefs.appendChild(shape);

    const el = document.createElementNS(SVG_NS, "g");
    el.setAttribute("class", "petal");
    el.setAttribute("data-petal", "");
    el.setAttribute("data-state", "closed");
    el.setAttribute("data-order", String(index));
    el.setAttribute("transform", `rotate(${spec.angle})`);

    const fold = document.createElementNS(SVG_NS, "g");
    fold.setAttribute("class", "petal__fold");

    // The shadow this petal casts on the petal beneath it. One shared
    // gradient, no filter: the occlusion dissolves towards the rim.
    const shadow = document.createElementNS(SVG_NS, "use");
    shadow.setAttribute("class", "petal__shadow");
    shadow.setAttribute("href", `#${shapeId}`);
    shadow.setAttribute("fill", "url(#petalShadow)");
    shadow.setAttribute("transform", "translate(2 3.5)");

    const blade = document.createElementNS(SVG_NS, "use");
    blade.setAttribute("class", "petal__blade");
    blade.setAttribute("href", `#${shapeId}`);
    blade.setAttribute("fill", spec.colour);

    const shade = document.createElementNS(SVG_NS, "use");
    shade.setAttribute("class", "petal__shade");
    shade.setAttribute("href", `#${shapeId}`);
    shade.setAttribute("fill", "url(#petalShade)");

    const wash = document.createElementNS(SVG_NS, "use");
    wash.setAttribute("class", "petal__wash");
    wash.setAttribute("href", `#${shapeId}`);
    wash.setAttribute("fill", "url(#petalWash)");

    const veins = document.createElementNS(SVG_NS, "path");
    veins.setAttribute("class", "petal__veins");
    veins.setAttribute("d", spec.veins);
    veins.setAttribute("fill", "none");
    veins.setAttribute("stroke", "rgba(24,2,9,.11)");
    veins.setAttribute("stroke-width", "1");
    veins.setAttribute("stroke-linecap", "round");

    const rim = document.createElementNS(SVG_NS, "use");
    rim.setAttribute("class", "petal__rim");
    rim.setAttribute("href", `#${shapeId}`);
    rim.setAttribute("fill", "none");
    rim.setAttribute("stroke", "url(#petalRim)");
    rim.setAttribute("stroke-width", "1.15");
    rim.setAttribute("stroke-linejoin", "round");

    fold.append(shadow, blade, shade, wash);
    // A petal whose edge rolls over shows a narrow turned band along the rim.
    if (spec.curl) {
      const curl = document.createElementNS(SVG_NS, "path");
      curl.setAttribute("class", "petal__curl");
      curl.setAttribute("d", spec.curl);
      curl.setAttribute("fill", "rgba(92,10,26,.20)");
      fold.appendChild(curl);
    }
    fold.append(veins, rim);
    el.appendChild(fold);
    petalsGroup.appendChild(el);

    const record = {
      index,
      spec,
      el,
      fold,
      // final pose
      baseR: spec.baseR,
      sy: spec.sy,
      lean: spec.lean,
      swirl: spec.swirl,
      // furled pose
      closedBaseR: spec.baseR * 0.86,
      closedSY: Math.max(0.12, spec.sy * 0.38),
      closedLean: spec.lean + 32,
      closedSwirl: spec.swirl - 24,
      status: "closed",
      duration: 760 + Math.round((spec.s || 0) * 180),
    };
    // Start every petal furled, hidden inside the bud. The unfolding then
    // reads as a petal opening, not as a shape appearing.
    applyPetalState(record, 0);
    petals.push(record);
    petalByElement.set(el, record);
  });

  // Paint order is the reverse of the opening order: the broad guard petals
  // go down first, the folded heart is laid on top of them.
  for (let i = petals.length - 1; i >= 0; i -= 1) {
    petalsGroup.appendChild(petals[i].el);
  }

  /* --- the pose of a petal --------------------------------------------- */
  function applyPetalState(record, progress) {
    const p = clamp(progress, 0, 1);
    const r = lerp(record.closedBaseR, record.baseR, p);
    const sy = lerp(record.closedSY, record.sy, p);
    const lean = lerp(record.closedLean, record.lean, p);
    const swirl = lerp(record.closedSwirl, record.swirl, p);
    const sx = lerp(0.46, 1, p);
    record.fold.setAttribute(
      "transform",
      `translate(0 ${(-r).toFixed(2)}) rotate(${lean.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) rotate(${swirl.toFixed(2)})`
    );
  }

  /* --- the unfolding ---------------------------------------------------- */
  // One shared rAF loop drives every petal that is currently opening. When
  // nothing is animating the loop stops completely: there is no permanent
  // animation running on the page.
  const opening = new Set();
  let rafId = 0;

  function tick(now) {
    rafId = 0;
    opening.forEach((entry) => {
      const t = Math.min(1, (now - entry.start) / entry.record.duration);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      applyPetalState(entry.record, eased);
      entry.record.el.style.opacity = String(Math.min(1, 0.08 + eased * 1.25));
      if (t >= 1) {
        opening.delete(entry);
        settlePetal(entry.record);
      }
    });
    if (opening.size) rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function settlePetal(record) {
    if (record.status !== "opening") return;
    record.status = "open";
    record.el.setAttribute("data-state", "open");
    record.el.style.opacity = "1";
    applyPetalState(record, 1);

    openedCount += 1;
    setProgress(openedCount);
    updateRoseLabel();
    if (openedCount >= TOTAL_PETALS) finishBloom();
  }

  /* --- the stem and its leaves -------------------------------------------- */
  /* The foliage is designed with the same care as the petals and comes from
     the same baked file, so every leaf really springs from the stem instead
     of floating beside it. */
  const stemGroup = document.getElementById("stem");
  const stem = geometry.stem;
  const LEAF_GREENS = [
    { h: 102, s: 13, l: 43 },   // sage
    { h: 92,  s: 16, l: 38 },   // olive
    { h: 110, s: 15, l: 34 },   // forest
    { h: 97,  s: 12, l: 41 }    // grey-sage
  ];

  function hslHex(h, s, l) {
    const sn = s / 100;
    const ln = clamp(l, 0, 100) / 100;
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

  function buildStem() {
    if (!stemGroup || !stem) return;

    const shade = document.createElementNS(SVG_NS, "path");
    shade.setAttribute("class", "stem__shade");
    shade.setAttribute("d", stem.path);
    shade.setAttribute("fill", "none");
    shade.setAttribute("stroke", "#40503f");
    shade.setAttribute("stroke-width", "12.5");
    shade.setAttribute("stroke-linecap", "round");
    shade.setAttribute("opacity", ".2");

    const line = document.createElementNS(SVG_NS, "path");
    line.setAttribute("class", "stem__line");
    line.setAttribute("d", stem.path);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "url(#stemGrad)");
    line.setAttribute("stroke-width", "8.5");
    line.setAttribute("stroke-linecap", "round");

    const light = document.createElementNS(SVG_NS, "path");
    light.setAttribute("class", "stem__light");
    light.setAttribute("d", stem.light);
    light.setAttribute("fill", "none");
    light.setAttribute("stroke", "#c9d0bd");
    light.setAttribute("stroke-width", "1.6");
    light.setAttribute("stroke-linecap", "round");
    light.setAttribute("opacity", ".42");

    stemGroup.append(shade, line, light);

    (stem.thorns || []).forEach((d) => {
      const thorn = document.createElementNS(SVG_NS, "path");
      thorn.setAttribute("class", "stem__thorn");
      thorn.setAttribute("d", d);
      thorn.setAttribute("fill", "#5c6b52");
      thorn.setAttribute("opacity", ".85");
      stemGroup.appendChild(thorn);
    });

    (geometry.leaves || []).forEach((leaf, index) => {
      const base = LEAF_GREENS[index % LEAF_GREENS.length];
      const lightness = clamp(base.l * leaf.tone * leaf.lit, 24, 48);
      const colour = hslHex(base.h + (index % 3) - 1, base.s, lightness);

      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("class", "leaf");
      // The petiole leaves the stem more horizontally than the blade, so the
      // leaf reads as bending away from the stem rather than sprouting from it.
      const side = leaf.dir > 90 ? -1 : 1;
      const lift = 22;
      const petioleDir = leaf.dir - side * lift;
      group.setAttribute("transform", `translate(${leaf.x} ${leaf.y}) rotate(${petioleDir.toFixed(2)})`);

      const petiole = document.createElementNS(SVG_NS, "path");
      petiole.setAttribute("class", "leaf__petiole");
      petiole.setAttribute("d", leaf.petiole);
      petiole.setAttribute("fill", "none");
      petiole.setAttribute("stroke", colour);
      petiole.setAttribute("stroke-width", "3.4");
      petiole.setAttribute("stroke-linecap", "round");
      petiole.setAttribute("opacity", ".92");

      const bladeGroup = document.createElementNS(SVG_NS, "g");
      bladeGroup.setAttribute("transform", `translate(${leaf.petioleLen || 0} 0) rotate(${(side * lift).toFixed(2)})`);

      const blade = document.createElementNS(SVG_NS, "path");
      blade.setAttribute("class", "leaf__blade");
      blade.setAttribute("d", leaf.blade);
      blade.setAttribute("fill", colour);

      const form = document.createElementNS(SVG_NS, "path");
      form.setAttribute("class", "leaf__form");
      form.setAttribute("d", leaf.blade);
      form.setAttribute("fill", "url(#leafForm)");

      const roll = document.createElementNS(SVG_NS, "path");
      roll.setAttribute("class", "leaf__roll");
      roll.setAttribute("d", leaf.blade);
      roll.setAttribute("fill", "url(#leafRoll)");

      const veins = document.createElementNS(SVG_NS, "path");
      veins.setAttribute("class", "leaf__veins");
      veins.setAttribute("d", leaf.veins);
      veins.setAttribute("fill", "none");
      veins.setAttribute("stroke", "#dfe6cd");
      veins.setAttribute("stroke-width", ".6");
      veins.setAttribute("stroke-linecap", "round");
      veins.setAttribute("opacity", ".17");

      const midrib = document.createElementNS(SVG_NS, "path");
      midrib.setAttribute("class", "leaf__midrib");
      midrib.setAttribute("d", leaf.midrib);
      midrib.setAttribute("fill", "none");
      midrib.setAttribute("stroke", "#e6ecd6");
      midrib.setAttribute("stroke-width", ".9");
      midrib.setAttribute("stroke-linecap", "round");
      midrib.setAttribute("opacity", ".3");

      bladeGroup.append(blade, form, roll, veins, midrib);
      group.append(petiole, bladeGroup);
      stemGroup.appendChild(group);
    });
  }

  /* --- progress --------------------------------------------------------- */
  const countEl = document.getElementById("count");
  const rulerEl = document.getElementById("ruler");
  const ticks = [];
  let openedCount = 0;

  for (let i = 0; i < TOTAL_PETALS; i += 1) {
    const tick = document.createElement("span");
    tick.className = i % 10 === 0 ? "tick tick--major" : "tick";
    tick.setAttribute("aria-hidden", "true");
    rulerEl.appendChild(tick);
    ticks.push(tick);
  }

  function setProgress(opened) {
    const value = clamp(opened, 0, TOTAL_PETALS);
    countEl.textContent = String(value).padStart(2, "0");
    rulerEl.setAttribute("aria-valuenow", String(value));
    rulerEl.setAttribute("aria-valuetext", `${value} pétales sur ${TOTAL_PETALS}`);
    // Only the tick that just opened changes: touching all 101 on every
    // petal would be 10 000 class writes over the sequence.
    if (value > 0 && ticks[value - 1]) ticks[value - 1].classList.add("is-open");
    if (throatEl) throatEl.style.opacity = value > 0 ? "1" : "0";
  }

  /* --- state ------------------------------------------------------------ */
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

  /* --- opening a petal --------------------------------------------------- */
  function updateRoseLabel() {
    const label = openedCount === 1 ? "1 pétale ouvert" : `${openedCount} pétales ouverts`;
    roseBtn.setAttribute(
      "aria-label",
      openedCount >= TOTAL_PETALS
        ? "La rose aux cent une pétales est entièrement épanouie."
        : `La rose aux cent une pétales. ${label}. Activer pour ouvrir un pétale.`
    );
  }

  function openPetal(record, source) {
    // The single concurrency boundary: a petal can only be claimed once, and
    // the automatic sequence and a manual click share this one function.
    if (!record || record.status !== "closed" || state.bloomFinished) return false;

    record.status = "opening";
    record.el.setAttribute("data-state", "opening");
    record.el.setAttribute("data-source", source);
    if (state.phase === "initial") state.phase = "blooming";
    plate.classList.add("has-begun");
    roseBtn.setAttribute("aria-busy", "true");

    const reduced = prefersReduced();
    opening.add({
      record,
      start: performance.now(),
    });
    if (reduced) {
      // Reduced motion keeps the state change but settles it at once.
      applyPetalState(record, 1);
      record.el.style.opacity = "1";
      opening.clear();
      settlePetal(record);
    } else {
      startLoop();
    }
    return true;
  }

  function nextClosedPetal() {
    for (let i = 0; i < petals.length; i += 1) {
      if (petals[i].status === "closed") return petals[i];
    }
    return null;
  }

  function handleRoseClick(event) {
    if (state.bloomFinished) return;
    if (state.phase !== "initial" && state.phase !== "blooming") return;

    let record = null;
    if (event && event.detail !== 0 && event.target instanceof Element) {
      const petalEl = event.target.closest("[data-petal]");
      if (petalEl) {
        const hit = petalByElement.get(petalEl);
        // Petals that are already opening or open are inert: no restart,
        // no second count.
        if (!hit || hit.status !== "closed") return;
        record = hit;
      } else if (event.target.closest("[data-rose-hit]")) {
        record = nextClosedPetal();
      } else {
        return;
      }
    } else {
      // Keyboard and assistive activation of the rose itself.
      record = nextClosedPetal();
    }

    if (!record) return;
    openPetal(record, "manual");
  }

  roseBtn.addEventListener("click", handleRoseClick);

  /* --- the automatic sequence -------------------------------------------- */
  // Exactly one interval, one petal per tick, started after the first paint
  // so the first petal arrives about a second after the page is ready.
  let autoBloomTimer = null;

  function stopAutoBloom() {
    if (autoBloomTimer !== null) {
      window.clearInterval(autoBloomTimer);
      autoBloomTimer = null;
    }
  }

  function startAutoBloom() {
    if (autoBloomTimer !== null || state.bloomFinished) return;
    autoBloomTimer = window.setInterval(() => {
      if (state.bloomFinished) {
        stopAutoBloom();
        return;
      }
      const next = nextClosedPetal();
      if (!next) {
        stopAutoBloom();
        return;
      }
      openPetal(next, "auto");
    }, AUTO_BLOOM_INTERVAL);
  }

  function finishBloom() {
    if (state.bloomFinished) return;
    state.bloomFinished = true;
    stopAutoBloom();
    roseBtn.disabled = true;
    roseBtn.removeAttribute("aria-busy");
    roseBtn.classList.add("is-bloomed");
    plate.classList.add("is-bloomed");
    setProgress(TOTAL_PETALS);
    updateRoseLabel();
    // The last petal has already settled; give the final mark a breath,
    // then let the letter take its place.
    setTimeout(unlockGreeting, prefersReduced() ? 40 : 300);
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
    '<path d="M20 21c-3.2-4.2-3.8-7.8 0-12 3.8 4.2 3.2-7.8 0-12Z"/>' +
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
    // The soundtrack has been playing since page initialisation. Opening the
    // letter must not restart it or trigger a second attempt.
    if (state.phase === "greetingUnlocked") state.phase = "secretOpen";

    dialog.showModal();
    document.documentElement.classList.add("is-dialog-open");
    document.body.classList.add("is-dialog-open");
    const sheet = dialog.querySelector(".secret__sheet");
    if (sheet) sheet.scrollTop = 0;
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

  /* ======================================================================
     Music — YouTube IFrame Player API
     ----------------------------------------------------------------------
     The frame is created by this page, not by the YouTube API, so the
     `allow="autoplay"` permission and `autoplay=1` are present from the very
     first byte. That gives the browser its earliest possible chance to grant
     audible autoplay, instead of making the decision after the ~1 s API
     download. The frame stays rendered (a display:none or 0x0 iframe does
     not play reliably) but is 2x2 px and transparent, so no video is ever
     shown.
     ====================================================================== */
  const VIDEO_ID = "cvamJ4oKBGY";
  const MUSIC_VOLUME = 35;
  const START_WINDOW_MS = 7000;
  const START_POLL_MS = 600;
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
    frame: null,
    player: null,
    apiLoading: false,
    apiReady: false,
    ready: false,
    wanted: false,
    started: false,
    playing: false,
    blocked: false,
    failed: false,
    userInitiated: false,
    attempts: 0,
    lastPlayCall: 0,
    watchdog: 0,
    watcher: 0,
    poll: 0,
    clockAtStart: 0
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

  function clearPlaybackWatchdog() {
    if (music.watchdog) {
      window.clearTimeout(music.watchdog);
      music.watchdog = 0;
    }
  }

  function clearStartWatcher() {
    if (music.watcher) {
      window.clearInterval(music.watcher);
      music.watcher = 0;
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

  function applyVolume() {
    if (!music.player || typeof music.player.setVolume !== "function") return;
    try {
      music.player.setVolume(MUSIC_VOLUME);
    } catch (error) {
      music.failed = true;
      setMusicStatus("Le volume n'a pas pu être réglé par le navigateur.");
    }
  }

  function safeUnmute() {
    if (!music.player || typeof music.player.unMute !== "function") return;
    try {
      music.player.unMute();
    } catch (error) {
      /* best effort; the watchdog reports the real state */
    }
  }

  function safePause() {
    if (!music.player || typeof music.player.pauseVideo !== "function") return;
    try {
      music.player.pauseVideo();
    } catch (error) {
      /* best effort */
    }
  }

  /* --- the frame -------------------------------------------------------- */
  function createMusicFrame() {
    if (music.frame || !playerMount) return music.frame;
    const frame = document.createElement("iframe");
    frame.id = "musicFrame";
    frame.className = "music__frame";
    frame.title = "Bande sonore";
    frame.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frame.setAttribute("frameborder", "0");
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("tabindex", "-1");
    frame.setAttribute("aria-hidden", "true");
    frame.width = 2;
    frame.height = 2;
    const params = new URLSearchParams({
      enablejsapi: "1",
      autoplay: "1",
      playsinline: "1",
      mute: "0",
      controls: "0",
      disablekb: "1",
      fs: "0",
      iv_load_policy: "3",
      modestbranding: "1",
      rel: "0",
      origin: window.location.origin
    });
    frame.src = `https://www.youtube.com/embed/${VIDEO_ID}?${params.toString()}`;
    playerMount.appendChild(frame);
    music.frame = frame;
    return frame;
  }

  /* --- the API ---------------------------------------------------------- */
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
      music.failed = true;
      clearPlaybackWatchdog();
      reflectMusic();
      setMusicStatus("La musique n'a pas pu être chargée. Ouvrez la vidéo sur YouTube.");
      setCueBusy(false);
      showMusicCue("La musique n'a pas pu être chargée. Ouvrez la vidéo sur YouTube.", true);
    });
    document.head.appendChild(tag);
  }

  function buildPlayer() {
    if (music.player || !music.apiReady || !window.YT || !window.YT.Player) return;
    const frame = createMusicFrame();
    if (!frame) return;
    try {
      music.player = new window.YT.Player(frame, {
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      });
    } catch (error) {
      music.player = null;
      onPlayerError();
    }
  }

  /* --- playback --------------------------------------------------------- */
  // Some YouTube streams never emit a PLAYING state event and keep
  // reporting UNSTARTED while the media clock is already running — that is
  // what happens on the live site. The clock is the honest evidence, so the
  // start watcher trusts it and confirms playback within about a second
  // instead of waiting for a state label that may never arrive.
  function confirmPlaying() {
    clearStartWatcher();
    clearPlaybackWatchdog();
    music.playing = true;
    music.starting = false;
    music.started = true;
    music.blocked = false;
    music.failed = false;
    hideMusicCue();
    setCueBusy(false);
    setMusicStatus("Lecture en cours.");
    reflectMusic();
    startProgressPolling();
  }

  function handleStartFailure() {
    clearStartWatcher();
    clearPlaybackWatchdog();
    if (music.userInitiated) {
      // The recipient already clicked "Activer la musique" and the player
      // still refused. Say so, and give them the video link.
      markPlaybackFailure("La musique n'a pas pu démarrer. Ouvrez la vidéo sur YouTube.");
      return;
    }
    markAutoplayBlocked();
  }

  function armStartWatcher() {
    clearStartWatcher();
    const deadline = performance.now() + START_WINDOW_MS;
    music.watcher = window.setInterval(() => {
      const state = playerState();
      const advanced = playerCurrentTime() >= music.clockAtStart + 0.4;
      if (state === YT_PLAYING || advanced) {
        if (playerMuted()) {
          // A muted start is not audible playback. Try once to unmute.
          safeUnmute();
          if (playerMuted()) {
            handleStartFailure();
            return;
          }
        }
        confirmPlaying();
        return;
      }
      if (performance.now() > deadline) {
        if (state === YT_BUFFERING) {
          // Buffering is progress, not a refusal: give it one more window.
          armStartWatcher();
          return;
        }
        handleStartFailure();
      }
    }, START_POLL_MS);
  }

  function markAutoplayBlocked() {
    music.playing = false;
    music.starting = false;
    music.blocked = true;
    music.failed = false;
    clearPlaybackWatchdog();
    clearStartWatcher();
    stopProgressPolling();
    if (playerMuted() || playerState() === YT_PLAYING) safePause();
    setMusicStatus("La lecture automatique est bloquée par le navigateur. Activez la musique.");
    reflectMusic();
    setCueBusy(false);
    showMusicCue("La lecture automatique est bloquée par le navigateur. Activez la musique.", false);
  }

  function markPlaybackFailure(message) {
    music.playing = false;
    music.starting = false;
    music.blocked = false;
    music.failed = true;
    clearPlaybackWatchdog();
    clearStartWatcher();
    stopProgressPolling();
    if (playerMuted() || playerState() === YT_PLAYING) safePause();
    setMusicStatus(message);
    reflectMusic();
    setCueBusy(false);
    showMusicCue(message, true);
  }

  function onPlayerReady() {
    music.ready = true;
    applyVolume();
    safeUnmute();
    // The audible attempt happens here, on the very first ready event, and
    // nowhere else.
    if (music.wanted) startPlayback(music.userInitiated);
  }

  function startPlayback(userInitiated) {
    music.wanted = true;
    if (music.playing) {
      if (userInitiated) setCueBusy(false);
      hideMusicCue();
      return;
    }
    if (!music.player || !music.ready) {
      if (userInitiated) setCueBusy(true);
      setMusicStatus("Chargement de la musique…");
      return;
    }
    // One play call per gesture. The document-level unlock below and the
    // button's own handler can both fire for a single click; asking the
    // player to start twice in a row is what makes some builds ignore the
    // request altogether.
    const now = performance.now();
    if (now - music.lastPlayCall < 500) return;
    music.lastPlayCall = now;

    if (userInitiated) {
      music.userInitiated = true;
      music.blocked = false;
      music.failed = false;
    }

    music.clockAtStart = playerCurrentTime();
    try {
      // Keep the user gesture as close to playVideo() as possible: Chrome
      // only honours the delegated autoplay permission of the parent frame
      // while that gesture is still fresh.
      music.player.playVideo();
    } catch (error) {
      onPlayerError();
      return;
    }
    music.attempts += 1;
    music.starting = true;
    applyVolume();
    if (playerMuted()) safeUnmute();
    setMusicStatus("Chargement de la musique…");
    reflectMusic();
    armStartWatcher();
  }

  function onPlayerStateChange(event) {
    const status = event && typeof event.data === "number" ? event.data : YT_CUED;
    if (status === YT_PLAYING) {
      // YouTube can start a policy-blocked autoplay muted. That is not
      // audible playback: try one unmute, then report the truth.
      if (playerMuted()) {
        safeUnmute();
        if (playerMuted()) {
          handleStartFailure();
          return;
        }
      }
      confirmPlaying();
    } else if (status === YT_PAUSED) {
      music.playing = false;
      if (!music.started) {
        if (music.userInitiated) {
          setMusicStatus("Chargement de la musique…");
        } else {
          markAutoplayBlocked();
        }
        return;
      }
      setMusicStatus("En pause.");
      reflectMusic();
      stopProgressPolling();
      updateProgress();
    } else if (status === YT_ENDED) {
      music.playing = false;
      clearPlaybackWatchdog();
      setMusicStatus("Lecture terminée.");
      reflectMusic();
      stopProgressPolling();
      updateProgress();
    } else if (status === YT_BUFFERING) {
      if (music.wanted && !music.blocked) setMusicStatus("Chargement de la musique…");
    }
  }

  function onPlayerError() {
    music.playing = false;
    music.starting = false;
    music.blocked = false;
    music.failed = true;
    clearPlaybackWatchdog();
    clearStartWatcher();
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
    if (music.playing) {
      try {
        music.player.pauseVideo();
      } catch (error) {
        onPlayerError();
        return;
      }
      music.playing = false;
      music.started = true;
      setMusicStatus("En pause.");
      reflectMusic();
      stopProgressPolling();
      updateProgress();
      return;
    }
    music.userInitiated = true;
    startPlayback(true);
  }

  musicToggle.addEventListener("click", toggleMusic);

  if (enableMusic) {
    enableMusic.addEventListener("click", () => {
      // The genuine user gesture that resolves an autoplay refusal. This is
      // the only manual retry; there is no automatic retry loop.
      music.userInitiated = true;
      startPlayback(true);
    });
  }

  // Any first gesture on the page is a legitimate chance to unlock audio
  // that the browser refused to start on its own. It never restarts a track
  // that is already playing.
  document.addEventListener(
    "pointerdown",
    () => {
      if (music.playing || music.started) return;
      if (!music.blocked && music.attempts === 0) return;
      music.userInitiated = true;
      startPlayback(true);
    },
    { passive: true, once: false }
  );

  // Read-only hook so the automated checks can assert the real player state.
  window.__roseMusic = {
    isReady: () => music.ready,
    volume: () => (music.player && typeof music.player.getVolume === "function" ? music.player.getVolume() : null),
    playerState: () => (music.player && typeof music.player.getPlayerState === "function" ? music.player.getPlayerState() : null),
    // The truth the interface itself uses. Some YouTube streams keep
    // reporting UNSTARTED while the media clock runs, so the raw state
    // alone is not a reliable answer.
    isPlaying: () => music.playing,
    isMuted: () => playerMuted(),
    blocked: () => music.blocked,
    failed: () => music.failed,
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

  /* ======================================================================
     Initialise
     ====================================================================== */
  setProgress(0);
  updateSequenceRule();
  updateRoseLabel();
  buildStem();

  // Every fresh page load starts from the same all-closed records. No petal
  // state or progress is written to storage, cookies, the URL or a backend.
  // A bfcache restoration is forced back through a fresh load so a returning
  // recipient never inherits an already-opened flower.
  window.addEventListener("pagehide", () => {
    stopAutoBloom();
    clearPlaybackWatchdog();
    clearStartWatcher();
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
      if (prefersReduced()) {
        opening.forEach((entry) => {
          applyPetalState(entry.record, 1);
          entry.record.el.style.opacity = "1";
        });
        opening.clear();
      }
    });
  }

  // The soundtrack is independent of the rose: the frame is created now so
  // the browser can judge the autoplay permission as early as possible, and
  // the single audible attempt happens on the player's first ready event.
  music.wanted = true;
  setMusicStatus("Chargement de la musique…");
  createMusicFrame();
  loadMusicApi();

  // Automatic blooming starts after the first paint, so the first petal
  // arrives about one second after the page is on screen.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => startAutoBloom());
  });
})();
