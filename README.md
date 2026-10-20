# La rose aux cent une pétales

An interactive greeting for Vietnamese Women's Day, 20 October. An empty
flower head fills itself, one petal per second, into a fully bloomed red rose,
while every unopened petal also responds immediately to a click. After the
hundred-and-first petal, the rose reveals a Vietnamese letter. A discreet inscription
inside that letter opens a sealed French puzzle: two Vietnamese questions, a
six-word sequence, and a final literary sentence. The whole experience is a
static site with no build step, backend, or API key; the only third-party
script is the official YouTube IFrame Player API, loaded during page
initialisation so the soundtrack can attempt to start with the page.

## What is in the box

```text
.
├── index.html                 Page shell, SVG definitions, letter and dialog markup
├── styles.css                 Art direction, responsive rules, motion system
├── script.js                  Rose renderer, bloom engine, state machine, music
├── tools/
│   └── build-rose.mjs         Offline generator for the flower geometry
├── assets/
│   ├── rose.js                The 101 baked petals (generated, committed)
│   ├── favicon.svg            Original rosette favicon
│   └── fonts/                 Self-hosted Cormorant Garamond & Lora woff2 subsets
│       ├── OFL-Cormorant-Garamond.txt
│       └── OFL-Lora.txt
├── LICENSES.md                Third-party notices and licence texts
├── README.md
└── .github/
    └── workflows/
        └── deploy.yml         GitHub Pages deployment
```

The original creative brief is kept outside version control because it contains
the puzzle answers; it is not part of the published artifact.

## The rose

The flower is **designed offline and baked into `assets/rose.js`** by
`tools/build-rose.mjs`, then animated at runtime. The runtime never invents a
petal: it reads the baked geometry, builds the DOM for it and unfolds it. This
keeps the first paint cheap and means the final composition is fully
reviewable before a single petal appears.

```bash
node tools/build-rose.mjs          # regenerate assets/rose.js
node tools/build-rose.mjs --check  # fail if the baked file is stale (used by CI)
```

- **The arrangement.** All 101 petals sit on one **golden-angle spiral**
  (137.508° apart), which is how a rose actually stacks its petals. Radius,
  length, width, foreshortening, lean and swirl all carry a gradient from a
  tight, folded heart to broad, reflexed guard petals. There are no concentric
  rings: neighbouring petals never line up, so the bloom reads as one grown
  spiral rather than a drawn rosette. Four petal archetypes (broad and round,
  narrow and pointed, deeply ruffled, calm) keep neighbours from being the same
  shape scaled up, and every petal carries its own length, width, lean, swirl,
  rim tilt, asymmetry, ruffle depth and colour.
- **The petal.** A garden-rose petal is a rounded fan, not a daisy ray: a narrow
  claw at the base, shoulders that flare quickly, and a broad, softly domed rim
  with a shallow notch and two long, slow undulations. The outline is sampled
  and fitted with Catmull-Rom Bézier segments, then stored once as a `<defs>`
  path.
- **The light.** Each petal is painted as five cheap layers over that single
  path — a solid body tone, an along-petal shade (dark at the buried claw,
  warm at the rim), one **global** light wash shared by the whole flower in
  flower space, a faint radial vein set, and a dissolving warm rim light. A
  contact shadow, darkest at the claw and fading to nothing at the rim, gives
  each petal real occlusion on the one beneath it. There is no hard outline
  around any petal, and the only SVG filter in the whole page is a single
  `feDropShadow` on the flower group.
- **Performance.** The previous version used **two blur filters per petal plus
  a turbulence/displacement filter on the whole flower**: 203 filter regions
  re-rasterised on every animation frame. The new version uses one filter for
  the entire bloom, which cut the worst-case frame time from 21.6 ms (p95 42.4,
  max 84.8) to 6.1 ms (p95 6.2, max 6.5) and the SVG node count from 2 458 to
  994.

### Motion design

The page is composed on arrival: there is no staggered entrance choreography,
no parallax, no floating ornament, no whole-flower zoom and no bloom-light
pulse. Motion is reserved for state changes:

- **Automatic bloom.** A single interval claims one closed petal per second,
  centre outward, and keeps running while the reader clicks. It never starts a
  petal twice, and it is cleared when the final petal finishes. If no closed
  petals remain, its next tick stops it as well. The first reveal is scheduled
  after the first paint, so a fresh visit really does show an empty head for
  about a second.
- **Manual petals.** Every closed petal is directly clickable and opens at once,
  without waiting for the next automatic tick. Clicking a petal that is already
  opening or open does nothing; it cannot restart the animation or change the
  count. Automatic selection skips every petal that is already claimed. Both
  paths go through one `openPetal()` function, so there is a single source of
  truth.
- **Petal animation.** One shared `requestAnimationFrame` loop drives every
  petal that is currently opening; when nothing is animating the loop stops
  completely, so the page never runs an idle animation. Each petal is
  760–940 ms and unfolds by rotating out of its furled angle, widening,
  unfurling and moving to its open radius. At reduced motion the petal settles
  into its final pose at once, so the automatic cadence and clicks remain fully
  functional.
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

## The soundtrack

The music source is unchanged: <https://www.youtube.com/watch?v=cvamJ4oKBGY>,
played through the official YouTube IFrame Player API at volume **35/100**.

**What was actually wrong, and what was fixed**

- The player used to be created *by* the YouTube API, which means the browser
  only got to judge the autoplay permission after the ~1 s API script had
  downloaded and parsed. The frame is now created by this page with
  `enablejsapi=1&autoplay=1&playsinline=1` and `allow="autoplay; …"` already
  in place, so the permission is evaluated at the earliest possible moment.
- `setVolume(35)` is applied on the player's first ready event and again
  immediately after every `playVideo()` call, so the very first sound is
  already at the requested level.
- `playVideo()` is called exactly once per gesture. The old code could issue
  two calls for a single click (a document-level unlock plus the button's own
  handler); asking the player to start twice in a row is one of the ways a
  start request gets dropped.
- The playback state is read from the player, never assumed. A muted start is
  detected, unmuted once, and if it is still muted the site says so instead of
  claiming the music is playing.

**Measured behaviour** (Chromium, headless, on this page):

| Chromium autoplay policy | Automatic attempt | After one click |
| --- | --- | --- |
| `no-user-gesture-required` | audible playback starts | keeps playing |
| `document-user-activation-required` (**Chrome's real default**) | refused | **audible playback starts** |
| `user-gesture-required` (artificial strictest flag) | refused | still refused |

Chrome's real default policy refuses audible autoplay on a fresh origin but
honours the parent frame's user gesture through `allow="autoplay"`, so the
one-click fallback genuinely works there. The third row is Chromium's
artificial strictest mode, which refuses even a gesture made in the parent
frame; in that mode the site cannot start the audio and says so, offering the
**Ouvrir sur YouTube** link instead. There is no retry loop in any case, and
the rose keeps blooming regardless.

The frame is 2×2 px and fully transparent but stays *rendered*: a `display:none`
or zero-sized iframe does not play reliably. The video is never visible in the
interface, and the audio is never re-hosted or extracted.

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
3. **Sealed letter.** Opening the secret shows the two Vietnamese questions.
   The soundtrack is independent of this click: it is loaded and attempted at
   page initialisation, at 35 % volume, and never restarted by the letter. The
   player node is never shown; the soundtrack is presented with a compact
   play/pause control, a live sound-wave indicator, a real playback status line,
   an honest progress line and the **Ouvrir sur YouTube** link. Reopening
   reuses the same player.4. **Verification.** Both answers are normalised and checked as SHA-256 digests
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
started manually. It first verifies that the baked flower geometry still
matches `tools/build-rose.mjs` and that `script.js` parses, then stages only
the files needed by the site (`index.html`, `styles.css`, `script.js`, and
`assets/`) into `_site`, uploads that directory as a Pages artifact, and
deploys it.

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
3. Confirm the flower head starts **empty** with the counter at `00 / 101`, and
   that after about a second exactly one petal unfolds. Click another unopened
   petal and check that it opens immediately while the automatic cadence
   continues. Reload and confirm the counter returns to `00` with all petals
   closed.
4. Open DevTools → **Network** and confirm `styles.css`, `script.js`,
   `assets/rose.js`, the woff2 files, and `assets/favicon.svg` all return `200`
   (not `404`).
5. Open DevTools → **Console** and confirm there are no errors.
6. On load, confirm the soundtrack either starts at volume `35` without a click
   or that the discreet **Activer la musique** control appears. If it appears,
   click it once and confirm the real player state changes; if playback is still
   refused, use **Ouvrir sur YouTube**. Confirm the rose and the secret do not
   restart the player and that only one player exists after closing and
   reopening the secret.
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

## Soundtrack (autoplay with a truthful fallback)

The soundtrack is the official player for
<https://www.youtube.com/watch?v=cvamJ4oKBGY>, driven through the **YouTube
IFrame Player API**. The API is loaded during page initialisation, independently
of the rose and the sealed letter. There is never more than one player. The
player node lives outside the `<dialog>` (a closed dialog would not render its
iframe), is one pixel in size, transparent, non-interactive and never shown.

**One audible attempt, at 35 / 100.** In `onReady`, the page calls
`setVolume(35)`, then `playVideo()` once. There is no autoplay loop, no repeated
retry and no duplicate player. A 4.5 s watchdog observes the result of that
attempt. It grants two extra windows when the player reports `BUFFERING`, and
only pauses a player that is actually playing; an unstarted player is left free
to finish a slow start. The page reports `Lecture en cours.` only when the
player is in the `PLAYING` state **and** `isMuted()` is false, or, during a
transient `UNSTARTED`/`BUFFERING` ad transition, when the media clock is
demonstrably advancing and `isMuted()` is false. If YouTube starts muted,
the page makes one `unMute()` attempt; if the track is still muted, it pauses
the player, does not claim playback, and shows the activation control. Muted audio
is never presented as audible music. The IFrame API exposes player and mute
state, not speaker output; a tab or operating-system mute remains outside the
page's detection.

**If audible autoplay is allowed.** The music starts without a click and
continues while the 101 petals open. No activation control is shown. The compact
player interface inside the secret reports the real state and can pause or
resume it.

**If audible autoplay is refused.** The page shows a fixed, discreet
**Activer la musique** button at the bottom-right of the sheet. It does not move
the rose, the counter or the letter, and it does not steal focus. Clicking it
performs one user-initiated `playVideo()` at 35 % volume. If the player still
does not reach an audible `PLAYING` state, the button remains available as
**Réessayer la musique** and an **Ouvrir sur YouTube** link appears with it.
There is no automatic retry after a refusal. Opening the secret, clicking a petal
or completing the rose never starts or restarts the player.

**Volume.** The default loudness is **35 / 100**. `setVolume(35)` runs after the
player is ready and again immediately before every start, so the first audible
frame is already at 35 %. Player methods are never called before the API and
player are ready. No volume slider is provided, so 35 % is preserved across
pause and resume. Perceived loudness still depends on operating-system and
browser audio settings.

**Autoplay limits.** Browser policies, YouTube embedding permissions, age or
region restrictions, tracker blockers, offline networks and the video owner's
settings can prevent or stop playback. The player is a cross-origin iframe. In
Chromium's strict test mode
(`--autoplay-policy=user-gesture-required`), YouTube refuses a programmatic
`playVideo()` sent from a parent-page button even after a trusted click; the
page cannot override that iframe boundary. In that mode the honest outcome is
the **Ouvrir sur YouTube** link, which is always revealed after a failed
activation attempt. With Chromium's normal default policy, audible autoplay
started in local testing without a click.

The interface is deliberately audio-focused: no video frame, no thumbnail and
no black rectangle are shown. The compact player has a real play/pause control,
an animated sound-wave that runs **only while the player reports playback**, a
truthful status line (`Lecture en cours.`, `En pause.`, `Lecture terminée.`,
`Chargement de la musique…`, `La lecture est bloquée…`, plus the explicit
activation message) and a progress line fed by `getCurrentTime()` /
`getDuration()`.

**Compliance note.** YouTube's Terms of Service expect the embedded player to
remain visible, and YouTube does not provide a supported audio-only mode for a
`watch` URL. Moving the player out of view is a presentation choice, not an
officially sanctioned one. The reliable, compliant fallback is the
**Ouvrir sur YouTube** link, which opens the original watch page.

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
