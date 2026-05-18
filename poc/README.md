# Committen v0.2 — Pet Hatch P0 POC

Validates the core claim of `docs/v0.2-pet-hatch.md` §3: that
`@imgly/background-removal` + a small canvas pixelizer can produce
**acceptable** pet sprites from real user photos.

> **Gate (spec §6):** if pixelization quality is judged "unacceptable"
> after this POC, P1 is **not** started and the proposal is re-evaluated
> (possibly killed or re-routed to Route B).

---

## Run

POC uses native ES modules + CDN-loaded `@imgly`. Needs a static HTTP server
(browsers won't load ESM from `file://`).

```powershell
# from D:\focuscat
npx http-server poc -p 8080 -c-1
```

Open: <http://localhost:8080>

Alternatives:

```powershell
# Python (no Node required)
cd poc
python -m http.server 8080
```

```powershell
# VS Code Live Server extension — also works; right-click index.html
```

### First-run cost

`@imgly` downloads an ONNX model (~50 MB) on first use. The browser caches
it (IndexedDB). To purge: DevTools → Application → Storage → Clear site data.

### CDN fallback

If `https://esm.sh/@imgly/background-removal@1` fails (CORS, worker issues,
CDN outage), install locally:

```powershell
cd poc
npm init -y
npm install @imgly/background-removal
```

Then in `app.js` swap the import for:

```js
import { removeBackground } from "./node_modules/@imgly/background-removal/dist/index.mjs";
```

(exact path may vary — check the package's `exports` field after install.)

---

## What to evaluate

Drop a photo. Adjust three sliders:

| Slider       | Range       | Default | Effect |
| ------------ | ----------- | ------- | ------ |
| Pixel size   | 32 / 48 / 64 / 80 / 96 | 64 | Granularity of pixel grid (long edge) |
| Palette      | 4 – 32 (step 4) | 16 | Number of distinct colors |
| Outline      | 0 / 1 / 2   | 0       | Inward-darkened edge thickness (px in low-res space) |

Bg-removal only runs **once per file**. Slider changes re-run pixelization
only (fast).

---

## Recommended test set

Spec §6 calls for ≥5 photos covering different failure modes. Use your own;
suggested categories:

- ✅ **Closeup pet, clean background** — best-case
- ✅ **Pet full body, busy background** — bg-removal stress test
- ✅ **Object** (toy / plant / mug) — non-pet sanity check
- ✅ **Person face portrait** — common user input
- ✅ **Backlit / low contrast** — known failure mode

Record findings in `TEST_RESULTS.md` (alongside this file). The PO gate
decision lives there.

---

## File layout

```
poc/
├── index.html       — UI shell
├── styles.css       — minimal dark theme
├── app.js           — orchestration: file → bg-remove → pixelize → render
├── pixelize.js      — pure: canvas + opts → canvas (median-cut + outline)
├── README.md        — this file
└── TEST_RESULTS.md  — gate evaluation log (created on first run)
```

`pixelize.js` is the algorithmic core. It will move to
`src/renderer/hatch/pixelize.js` in P2; keeping it pure / framework-free
here so the migration is mechanical.
