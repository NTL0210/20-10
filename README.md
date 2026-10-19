# La rose aux cent une pétales

An interactive greeting for Vietnamese Women's Day, 20 October. A closed,
mathematically drawn rose opens one petal per click. After the hundred-and-first
petal, the rose settles and reveals a Vietnamese letter. A discreet inscription
inside that letter opens a sealed French puzzle: two Vietnamese questions, a
six-word sequence, and a final literary sentence. The whole experience is a
static site with no build step, backend, API key, or third-party JavaScript.

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
elements are created on a golden-angle spiral. Each petal has its own Bézier
blade, shading layers, vein, crease, closed/open transform, duration, and
opening state. A separate decorative knot at the centre is not counted as a
petal.

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

1. **Rose.** Click the flower, or focus it and press Enter or Space. Exactly one
   unopened petal animates per accepted click. The counter and ruler show
   completed openings, from `00 / 101` to `101 / 101`. Input is ignored while a
   petal is animating.
2. **Greeting.** The letter is built only when the 101st petal finishes. It
   contains the Vietnamese greeting and the button
   `Un secret pour mon petit détective`.
3. **Sealed letter.** Opening the secret creates one YouTube iframe, attempts
   playback, and shows the two Vietnamese questions. Reopening reuses that same
   player.
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
`prefers-reduced-motion` removes decorative delays and petal tweening while
keeping every state change available.

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
3. Click the rose once and confirm the counter moves from `00` to `01`, then
   reload and confirm it returns to `00`.
4. Open DevTools → **Network** and confirm `styles.css`, `script.js`, the woff2
   files, and `assets/favicon.svg` all return `200` (not `404`).
5. Open DevTools → **Console** and confirm there are no errors.
6. Complete the rose (or emulate reduced motion to move quickly), open the
   secret, and confirm one YouTube iframe exists after closing and reopening.
7. Check the layout at a wide desktop size and at 390 × 844 in device
   emulation, including the dialog.

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
- **The rose is hard to click on a phone.** Tap the flower itself, not the
  surrounding paper. If motion is reduced, petals change state immediately and
  the next tap is accepted as soon as the state updates.

## YouTube playback

The site embeds the official player for
<https://www.youtube.com/watch?v=cvamJ4oKBGY>. The iframe is created only after
the visitor activates the secret inscription, which keeps the initial page
light and gives playback the best chance of being treated as user-initiated.
There is never more than one player.

Autoplay is not guaranteed. Browser autoplay policies, YouTube embedding
permissions, age or region restrictions, tracker blockers, offline networks,
and the video owner's settings can all prevent or stop playback. When sound
does not start:

- use the **Pause / Reprendre** control, which sends `pauseVideo` and
  `playVideo` commands to the existing iframe;
- press play directly inside the YouTube player;
- use **Ouvrir sur YouTube** to watch the original video in a new tab.

No audio is downloaded, extracted, proxied, or re-hosted. Music is optional and
does not gate any part of the experience.

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
