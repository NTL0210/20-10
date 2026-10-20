# La rose aux cent une pétales

An interactive greeting for Vietnamese Women's Day, 20 October. A closed,
mathematically drawn rose opens itself one petal per second, while every
unopened petal also responds immediately to a click. After the
hundred-and-first petal, the rose reveals a Vietnamese letter. A discreet inscription
inside that letter opens a sealed French puzzle: two Vietnamese questions, a
six-word sequence, and a final literary sentence. The whole experience is a
static site with no build step, backend, or API key; the only third-party
script is the official YouTube IFrame Player API, loaded on demand for the
soundtrack.

## What is in the box

```text
.
├── index.html                 Page shell, SVG definitions, letter and dialog markup
├── styles.css                 Art direction, responsive rules, motion system
├── script.js                  Rose generator, state machine, hashes, interactions
├── assets/
│   ├── favicon.svg            Original rosette favicon
│   └── fonts/                 Self-hosted Cormorant Garamond & Lora woff2 subsets
│       ├── OFL-Cormorant-Garamond.txt
│       └── OFL-Lora.txt
├── LICENSES.md                Third-party notices and licence texts
├── README.md
└── .github/
    └── workflows/
        └── deploy.yml         Optional GitHub Pages deployment
```

The original creative brief is kept outside version control because it contains
the puzzle answers; it is not part of the published artifact.

The rose is generated at runtime in `script.js`. It is not a raster image and
there are no pre-drawn petals. One hundred and one distinct `<g class="petal">`
elements are built from a rose-specific construction:

- **The petal.** A rose petal is not a daisy ray: it never narrows to a point.
  Each petal rises from a broad claw, flares into soft shoulders and closes in a
  tall, domed, faintly notched rim with two slow undulations rather than a row
  of small ripples. The spine of the petal is curved and every petal sweeps the
  same way, so the head wraps into one spiral instead of radiating. The outline
  is sampled, fitted with Catmull-Rom Bézier segments and stored once as a
  `<defs>` path referenced by `<use>` shading layers.
- **The arrangement.** Petals are attached at the receptacle and placed on a
  golden-angle spiral, with a short steady step for the first few so the folded
  centre chains into a visible spiral roll. Radius, length, tilt and width carry
  a strong gradient from a dense, crumpled, incurved centre to broad outer
  petals; the outer third grows progressively, so the silhouette is made of
  overlapping lobes rather than a handful of flat plates. Inner petals stay
  foreshortened even when open, as if standing inside the cup, while outer
  petals lie flat. Each petal has its own lean, curvature, curl, ruffle,
  asymmetry, palette tint and light-facing tone; the centre is jittered harder
  than the rim so it reads as folded cloth rather than a neat rosette.
- **The light.** A rolled-edge gradient, a cupped face gradient, a base shadow
  and a soft cast shadow sit under a global directional light across the whole
  bloom. The cast shadow falls down and to the right, matching the upper-left
  light, and stays low-contrast so petals read as overlapping surfaces rather
  than cut paper. The lighting overlay fades in with the bloom; it has no
  separate pulse or glow.

### Motion design

The page is composed on arrival: there is no staggered entrance choreography,
no parallax, no floating ornament, no whole-flower zoom and no bloom-light
pulse. Motion is reserved for state changes:

- **Automatic bloom.** A single interval claims one closed petal per second,
  centre outward, and keeps running while the reader clicks. It never starts a
  petal twice, and it is cleared when the final petal finishes. If no closed
  petals remain, its next tick stops it as well.
- **Manual petals.** Every closed petal is directly clickable and opens at once,
  without waiting for the next automatic tick. Clicking a petal that is already
  opening or open does nothing; it cannot restart the animation or change the
  count. Automatic selection skips every petal that is already claimed.
- **Petal animation.** One `requestAnimationFrame` tween per claimed petal,
  470–720 ms, ease-in-out. The petal rotates outward from its wrapped closed
  angle, expands and moves to its open radius; timing follows the petal's depth,
  not a random dice roll. At reduced motion the same unfold runs over 120 ms,
  linear, so the automatic cadence and clicks remain fully functional.
- **Petal state.** `closed` → `opening` → `open` is the single source of truth,
  mirrored in `data-state` and the `is-opening`/`is-open` classes. A petal is
  claimed exactly once. The counter and ruler represent **fully open** petals;
  they advance when that petal's unfold finishes, never beyond 101.
- **Progress.** One ruler tick inks in per finished petal. Ticks keep a fixed
  height so the ruler does not ripple. The final petal stops the scheduler and
  unlocks the letter.
- **Fresh visits.** Petal records are created in memory on every load; nothing
  is written to local storage, session storage, cookies, IndexedDB, the URL or a
  backend. A bfcache restoration is forced through a fresh load.
- **Letter.** The opening column collapses over 0.55 s and the greeting fades
  in as one block. There is no per-line stagger.
- **Sealed letter.** A 0.18 s backdrop and a 0.24 s sheet fade, no scale or
  slide; the seal stays still. The sequence word crossfades in 0.15 s and the
  rule advances in 0.5 s.
- **Finale.** The sentence and ornament fade in together over 0.55 s with an
  8 px rise; no particles, glow or zoom.
- **Soundtrack.** The five-bar wave animates only while the player is actually
  playing. Hover states change colour, not position.

## Run locally

No installation is required. Because the site loads local font files and uses
the Web Crypto API, open it through a local HTTP server rather than
`file://`.

With Python:

```bash
python -m http.server 4173
```

With Node.js:

```bash
npx serve .
```

Then open <http://localhost:4173/>. Any static server works; all paths are
relative so the same files also work from a repository subpath.

## Interaction map

1. **Rose.** The flower starts closed and automatically opens one petal every
   second. Click an unopened petal to open that specific petal immediately, or
   click the central flower / focus the rose and press Enter or Space to open
   the next closed petal. The automatic sequence continues at its normal cadence
   and skips petals that are already opening. Clicks on opening or open petals
   are ignored. The counter and ruler show fully opened petals, from
   `00 / 101` to `101 / 101`, and stop at 101.
2. **Greeting.** The letter is built only when the 101st petal finishes. It
   contains the Vietnamese greeting and the button
   `Un secret pour mon petit détective`.
3. **Sealed letter.** Opening the secret loads the official YouTube IFrame
   Player API (once, on that click), starts the soundtrack at 35 % volume and
   shows the two Vietnamese questions. The player node is
   never shown; the soundtrack is presented with a compact play/pause control,
   a live sound-wave indicator, a real playback status line, an honest progress
   line and the **Ouvrir sur YouTube** link. Reopening reuses the same player.
4. **Verification.** Both answers are normalised and checked as SHA-256 digests
   with the Web Crypto API. A partially correct submission preserves the
   correct field; both must pass to continue.
5. **Sequence.** The button reads, in order, `Une` → `deux` → `trois` →
   `Marche` → `côté` → `assemblé`. Each click advances exactly one word. The
   sixth word is created only after the sixth click.
6. **Finale.** The sentence is inserted into the document at the final step,
   never before, with **mon petit détective** in bold.

Keyboard and assistive-technology clicks are supported, focus moves into the
dialog, Escape or the backdrop closes it, and focus returns to the inscription.
`prefers-reduced-motion` removes transitions and petal tweening while keeping
every state change available.

## GitHub Pages

The repository is intended for `NTL0210/20-10`, which gives the expected public
URL **<https://ntl0210.github.io/20-10/>** once Pages is enabled. Deployment has
to be enabled in the repository settings; a successful workflow run is what
actually publishes the site.

### Option A — GitHub Actions (included)

`.github/workflows/deploy.yml` runs on every push to `main` and can also be
started manually. It stages only the files needed by the site
(`index.html`, `styles.css`, `script.js`, and `assets/`) into `_site`, uploads
that directory as a Pages artifact, and deploys it.

1. Push the project to the `main` branch.
2. In **Settings → Pages → Build and deployment**, set **Source** to
   **GitHub Actions**.
3. Open the **Actions** tab and watch the `Deploy to GitHub Pages` run.
4. Open the URL shown in the deployment environment, or the expected URL above.

The workflow needs the default `GITHUB_TOKEN` with `pages: write` and
`id-token: write`; those permissions are declared in the file. No secrets,
API keys, or paid services are used.

### Option B — publish from a branch

If you prefer not to use Actions, go to **Settings → Pages**, choose
**Deploy from a branch**, select `main` and the repository root (`/`), then
save. The site has no build step, so the root already contains the publishable
files. Do not enable both methods at the same time.

If the repository is renamed or moved under a custom domain, relative asset
paths continue to work; only the public URL changes. Do not hardcode the
repository name into HTML, CSS, or JavaScript.

## Verify a deployment

After the first successful publish:

1. Open the public URL in a private window so cached files do not mask a
   missing asset.
2. Check that the favicon and both typefaces load; Cormorant Garamond should
   appear in the heading and Lora in the body text.
3. Confirm the closed flower reads as a rosebud. After one second, check that
   exactly one petal unfolds; click another unopened petal and check that it
   opens immediately while the automatic cadence continues. Reload and confirm
   the counter returns to `00` with all petals closed.
4. Open DevTools → **Network** and confirm `styles.css`, `script.js`, the woff2
   files, and `assets/favicon.svg` all return `200` (not `404`).
5. Open DevTools → **Console** and confirm there are no errors.
6. Complete the rose (or emulate reduced motion to move quickly), open the
   secret, and confirm the soundtrack control reports the real player state with
   volume `35`, and that only one player exists after closing and reopening.
7. Check the layout at a wide desktop size and at 390 × 844 in device
   emulation, including the dialog and the soundtrack controls.

## Troubleshooting

- **Blank or unstyled page.** Confirm `index.html`, `styles.css`, and
  `script.js` are in the same directory and that the workflow staged `assets/`.
  All references are relative, so a site published from a subpath should work
  without edits.
- **Fonts fall back to Georgia.** The woff2 files may be missing from the
  published artifact, blocked by the host, or the browser may not support
  `woff2`. The CSS fallback stack keeps the page readable.
- **“La vérification chiffrée n'est pas disponible ici.”** Web Crypto requires
  a secure context: HTTPS, `localhost`, or `127.0.0.1`. A plain `file://` page
  or an insecure remote origin will show this fallback.
- **Pages shows 404 after a successful run.** Check that **Settings → Pages →
  Source** is set to **GitHub Actions**, and that the workflow completed in the
  `github-pages` environment. A repository-level 404 can also mean the Pages
  URL is still propagating; allow a minute and retry.
- **The workflow cannot deploy.** Confirm the repository allows GitHub Actions
  and that Pages is enabled. Organisation policies can restrict the
  `github-pages` environment.
- **The rose is hard to click on a phone.** Tap an unopened petal on the flower
  itself, not the surrounding paper. The automatic bloom also continues without
  input. With reduced motion the unfold is a 120 ms linear change, and the next
  tap is accepted as soon as that short state change settles.

## Soundtrack (audio-focused)

The soundtrack is the official player for
<https://www.youtube.com/watch?v=cvamJ4oKBGY>, driven through the **YouTube
IFrame Player API**. The player is created only when the visitor clicks
`Un secret pour mon petit détective`, so the third-party script never competes
with the automatic bloom. There is never more than one player.

The interface is deliberately audio-focused: no video frame, no thumbnail and
no black rectangle are shown. The player node is moved out of view and the
reader only sees a minimal play/pause control, an animated sound-wave that runs
**only while the player reports playback**, a truthful status line
(`Lecture en cours.`, `En pause.`, `Lecture terminée.`,
`Chargement de la musique…`, `La lecture est bloquée…`) and a progress line fed
by `getCurrentTime()` / `getDuration()`.

**Volume.** The default loudness is **35 / 100**. `setVolume(35)` is called in
the player's `onReady` handler and again immediately before every start, so the
first audible frame is already at 35 %. Player methods are never called before
the API and the player are ready. No volume slider is provided, so 35 % is
preserved across pause and resume. Perceived loudness still depends on the
operating-system and browser audio settings.

**Compliance note.** YouTube's Terms of Service expect the embedded player to
remain visible, and YouTube does not provide a supported audio-only mode for a
`watch` URL. Moving the player out of view is therefore a presentation choice,
not an officially sanctioned one. The reliable, compliant fallback is the
**Ouvrir sur YouTube** link, which is always present and always opens the
original watch page.

Autoplay is not guaranteed. Browser autoplay policies, YouTube embedding
permissions, age or region restrictions, tracker blockers, offline networks and
the video owner's settings can all prevent or stop playback. When sound does not
start, the status line says so honestly, the control offers **Réessayer**, and:

- the **Pause / Reprendre** control calls the real player (`pauseVideo` /
  `playVideo`) and reflects the real player state;
- **Ouvrir sur YouTube** opens the original video in a new tab.

No audio is downloaded, extracted, proxied, or re-hosted, and no unofficial
method is used to obtain the stream. Music is optional and never gates the rose,
the questions or the final sequence.

## Client-side verification limits

The two answers are never stored as plaintext in `script.js`, HTML, CSS, or
comments. Accepted inputs are normalised (dates: whitespace removed, `/` or `-`
separators, optional leading zero on day/month; titles: Unicode NFC, collapsed
whitespace, Vietnamese-aware lowercasing) and hashed with SHA-256 through
`crypto.subtle`. Only digests are compared.

This is **best-effort concealment, not security**. A static site sends its
JavaScript to every visitor. Anyone can read the digests, inspect the
normalisation code, modify the client, or test candidate answers offline. No
backend, obfuscation, minification, Base64, or hashing scheme can make a
client-side secret confidential. The hashes are used to keep casual inspection
from displaying the answers directly, and that is the full claim.

## Dependencies, licences, and originality

- No JavaScript framework and no animation library. Motion uses CSS transitions
  and a small `requestAnimationFrame` tween for each petal, which keeps the
  timeline deterministic and avoids a CDN dependency.
- Cormorant Garamond and Lora are self-hosted under the SIL Open Font License
  1.1. Copyright and licence texts are in `assets/fonts/` and summarised in
  `LICENSES.md`.
- The rose geometry, favicon, ornaments, styles, and interaction code are
  original to this project.
- The YouTube video remains the property of its creator and is used only via
  the official embedded player and a link to the original page.

See [LICENSES.md](LICENSES.md) for the complete notices.
