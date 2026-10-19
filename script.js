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
    { count: 3,  palette: ["#481522", "#551b29", "#5d2130"] },
    { count: 6,  palette: ["#511a28", "#5c1f30", "#652636"] },
    { count: 9,  palette: ["#5a1e2e", "#652435", "#6e2a3b"] },
    { count: 12, palette: ["#632333", "#6e2a3b", "#783143"] },
    { count: 15, palette: ["#6c2939", "#783141", "#82394a"] },
    { count: 18, palette: ["#753041", "#823a4b", "#8d4354"] },
    { count: 19, palette: ["#7e394a", "#8b4556", "#985262"] },
    { count: 19, palette: ["#8a4454", "#985361", "#a5616f"] }
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

  function petalPath(len, half, rand, ring) {
    const lean = (rand() - 0.5) * half * 0.2;
    const asym = (rand() - 0.5) * half * 0.08;
    const shoulderY = -len * (0.775 + rand() * 0.03);
    const leftShoulder = -half * (0.75 + rand() * 0.04) + lean * 0.25 + asym;
    const rightShoulder = half * (0.75 + rand() * 0.04) + lean * 0.25 + asym;
    const leftLobe = -half * (0.3 + rand() * 0.06) + lean * 0.72 + asym * 0.6;
    const rightLobe = half * (0.3 + rand() * 0.06) + lean * 0.72 + asym * 0.6;
    const tipLeft = -len * (0.992 + rand() * 0.008);
    const tipRight = -len * (0.968 + rand() * 0.022);
    const notch = -len * (ring > 2 ? 0.928 : 0.952) + (rand() - 0.5) * len * 0.012;
    return [
      "M 0 0",
      `C ${-half * 0.46} ${-len * 0.075} ${-half * 0.97} ${-len * 0.29} ${-half * 1.015} ${-len * 0.5}`,
      `C ${-half * 1.02} ${-len * 0.64} ${-half * 0.92} ${-len * 0.73} ${leftShoulder.toFixed(2)} ${shoulderY.toFixed(2)}`,
      `C ${(leftShoulder * 0.82).toFixed(2)} ${(-len * 0.89).toFixed(2)} ${(leftLobe * 0.96).toFixed(2)} ${tipLeft.toFixed(2)} ${leftLobe.toFixed(2)} ${tipLeft.toFixed(2)}`,
      `Q ${(lean * 0.45).toFixed(2)} ${notch.toFixed(2)} ${rightLobe.toFixed(2)} ${tipRight.toFixed(2)}`,
      `C ${(rightLobe * 0.96).toFixed(2)} ${tipRight.toFixed(2)} ${(rightShoulder * 0.82).toFixed(2)} ${(-len * 0.89).toFixed(2)} ${rightShoulder.toFixed(2)} ${shoulderY.toFixed(2)}`,
      `C ${half * 0.92} ${-len * 0.73} ${half * 1.02} ${-len * 0.64} ${half * 1.015} ${-len * 0.5}`,
      `C ${half * 0.97} ${-len * 0.29} ${half * 0.46} ${-len * 0.075} 0 0 Z`
    ].join(" ");
  }

  function veinPath(len, half, rand) {
    const drift = (rand() - 0.5) * half * 0.3;
    return `M 0 ${-len * 0.05} C ${half * 0.09} ${-len * 0.31} ${-half * 0.08} ${-len * 0.6} ${drift.toFixed(2)} ${-len * 0.86}`;
  }

  function creasePath(len, half, rand) {
    const side = rand() > 0.5 ? 1 : -1;
    return `M 0 ${-len * 0.08} C ${(side * half * 0.24).toFixed(2)} ${-len * 0.34} ${(side * half * 0.32).toFixed(2)} ${-len * 0.53} ${(side * half * 0.25).toFixed(2)} ${-len * 0.7}`;
  }

  const petalsGroup = document.getElementById("petals");
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

  for (let index = 0; index < TOTAL_PETALS; index += 1) {
    const t = index / (TOTAL_PETALS - 1);
    const ring = stageFor(index);
    const conf = RINGS[ring];
    const rand = mulberry32(101 + index * 7919);
    const angle = index * 137.508 + 8 + (rand() - 0.5) * 2.4;
    const baseOpen = 10 + 196 * Math.pow(t, 1.3) + (rand() - 0.5) * 10;
    const baseClosed = 4 + 44 * Math.pow(t, 1.16) + (rand() - 0.5) * 3;
    const len = (92 + 108 * Math.pow(t, 0.82)) * (0.94 + rand() * 0.12);
    const half = (50 + 88 * Math.pow(t, 0.88)) * (0.94 + rand() * 0.12);
    const closedSX = lerp(0.7, 0.5, t) + (rand() - 0.5) * 0.03;
    const closedSY = lerp(0.72, 0.49, t) + (rand() - 0.5) * 0.03;
    const twistClosed = -(14 + t * 38) + (rand() - 0.5) * 6;
    const twistOpen = index < 13
      ? 34 + index * 3.1 + (rand() - 0.5) * 5
      : index < 26
        ? 13 + (index - 13) * 1.15 + (rand() - 0.5) * 5
        : 1 + (rand() - 0.5) * 7;
    const duration = 570 + t * 250 + Math.round(rand() * 100);
    const d = petalPath(len, half, rand, ring);
    const v = veinPath(len, half, rand);
    const c = creasePath(len, half, rand);
    const color = conf.palette[index % conf.palette.length];

    const el = document.createElementNS(SVG_NS, "g");
    el.setAttribute("class", "petal");
    el.setAttribute("data-ring", String(ring));
    el.setAttribute("data-order", String(index));
    el.setAttribute("data-petal", "");
    el.innerHTML = `
      <g class="petal__slide" transform="translate(0 ${(-baseClosed).toFixed(2)})">
        <g class="petal__fold" transform="scale(${closedSX.toFixed(3)} ${closedSY.toFixed(3)}) rotate(${twistClosed.toFixed(2)})">
          <path class="petal__blade" d="${d}" fill="${color}" stroke="rgba(42,11,20,.32)" stroke-width="${ring > 4 ? 1.6 : 1.3}" stroke-linejoin="round"/>
          <path class="petal__side" d="${d}" fill="url(#petalSide)"/>
          <path class="petal__sheen" d="${d}" fill="url(#petalSheen)"/>
          <path class="petal__base" d="${d}" fill="url(#petalBase)"/>
          <path class="petal__vein" d="${v}" fill="none" stroke="${ring > 4 ? "rgba(45,10,20,.28)" : "rgba(255,240,228,.16)"}" stroke-width="1.15" stroke-linecap="round"/>
          <path class="petal__crease" d="${c}" fill="none" stroke="rgba(48,12,22,.14)" stroke-width="1.4" stroke-linecap="round"/>
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
    record.slide.setAttribute("transform", `translate(0 ${(-r).toFixed(2)})`);
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
  const ticks = [];

  for (let i = 0; i < TOTAL_PETALS; i += 1) {
    const tick = document.createElement("span");
    tick.className = i % 10 === 0 ? "tick tick--major" : "tick";
    tick.setAttribute("aria-hidden", "true");
    rulerEl.appendChild(tick);
    ticks.push(tick);
  }

  function setProgress(opened) {
    countEl.textContent = String(opened).padStart(2, "0");
    rulerEl.setAttribute("aria-valuenow", String(opened));
    rulerEl.setAttribute("aria-valuetext", `${opened} pétales sur ${TOTAL_PETALS}`);
    ticks.forEach((tick, index) => tick.classList.toggle("is-open", index < opened));
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
    player: null,
    musicPlaying: false,
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

    state.phase = "blooming";
    state.animating = true;
    plate.classList.add("has-begun");
    roseBtn.setAttribute("aria-busy", "true");
    const record = petals[state.opened];
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
      createPlayer();
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
  const VIDEO_ID = "cvamJ4oKBGY";

  function createPlayer() {
    if (state.player) return;
    const iframe = document.createElement("iframe");
    const origin = /^https?:$/.test(window.location.protocol)
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : "";
    iframe.src = `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1${origin}`;
    iframe.title = "Bande sonore — YouTube";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.setAttribute("frameborder", "0");
    iframe.loading = "eager";
    playerMount.appendChild(iframe);

    state.player = iframe;
    state.musicPlaying = true;
    musicToggle.hidden = false;
    musicToggle.textContent = "Pause";
    musicToggle.setAttribute("aria-label", "Mettre la musique en pause");
  }

  function toggleMusic() {
    if (!state.player || !state.player.contentWindow) return;
    const shouldPause = state.musicPlaying;
    state.player.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: shouldPause ? "pauseVideo" : "playVideo", args: [] }),
      "*"
    );
    state.musicPlaying = !shouldPause;
    musicToggle.textContent = shouldPause ? "Reprendre" : "Pause";
    musicToggle.setAttribute("aria-label", shouldPause ? "Reprendre la musique" : "Mettre la musique en pause");
  }

  musicToggle.addEventListener("click", toggleMusic);

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
