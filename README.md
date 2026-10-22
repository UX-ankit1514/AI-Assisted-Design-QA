# DesignSync QA — AI Assisted Design QA (MVP v0.1)

An internal Arnifi tool that compares an approved **Figma design screenshot** with a screenshot of the **developed website**, highlights potential visual differences, and turns the confirmed ones into a tracked bug list.

> Compare → Identify → Review → Track → Verify

Built from `PRD DesignSync QA Requirements` (MVP v0.1). Everything runs in the browser: screenshots are compared on your machine and saved only in this browser's IndexedDB. There is no backend, no account and no AI service.

---

## Quick start

Requirements: **Node.js 20.9+** (developed on Node 22) and Google Chrome for the end-to-end tests.

```bash
npm install
npm run dev          # http://localhost:3108
```

Open the app and click **Try With Sample Screenshots**, then **Run Comparison**. The sample pair is a generated Arnifi-style homepage with six intentional differences (clearly labelled *Sample data*). The comparison itself is real.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3108 |
| `npm run build` / `npm start` | Production build / serve it on port 3108 |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (Next.js + React Compiler rules) |
| `npm test` | Vitest unit tests (engine, workflow, CSV, storage, detection rate) |
| `npm run test:e2e` | Playwright acceptance tests against a production build (system Chrome) |
| `npm run samples` | Regenerate the sample pair in `public/samples/` |
| `npm run fixtures` | Regenerate e2e fixtures in `tests/fixtures/` (run after `samples`) |

## The journey

1. **New Comparison** (`/`): name the project and add both screenshots (drop, browse, or paste — Figma's *Copy as PNG* works). The app checks the real file format, size (≤ 50 MB), pixel count (≤ 64 MP, e.g. a 1440 × 44,000 px landing page or a 2x export up to ~22,000 px tall), that it decodes, and that both have identical dimensions. It never resizes or stretches to force a match.
2. **Run Comparison**: decode → normalise → pixel compare → group into regions → prepare the workspace, with a visible progress stepper and a percentage for the pixel step. A 1440 × 3083 pair takes about 0.3 s, and a 2880 × 9040 (26 MP) 2x export about 1.5 s.
3. **Comparison Workspace** (`/comparisons/[id]`): side-by-side, overlay (opacity + difference blend) and difference-mask views on one synchronised zoom/pan. Selecting a card highlights and focuses its region on both screenshots, and clicking a highlight opens its card. Each potential difference has design/website crops, an editable title and description, and **Confirm Bug** / **Dismiss**. After each decision the next pending region opens. **Add Issue** lets you draw a box around anything the comparison missed.
4. **Design Issues** (`/issues`): confirmed bugs only, with status summary tiles (which double as filters), a project filter, inline severity/status changes, inline editing, and **Export CSV**. Statuses are Open → In Progress → Fixed → Verified, and **Verified is only reachable from Fixed**: a fix is never verified automatically.

Keyboard: `J`/`K` next/previous, `C` confirm, `D` dismiss, `H` highlights, `+`/`−` zoom, `0` fit, `1` actual size, `Esc` deselect.

## How the comparison works

`src/lib/engine/` is pure TypeScript with no DOM, so it is unit-tested in Node. It runs in a Web Worker in the browser, with a main-thread fallback.

Long landing pages are compared **in horizontal bands** of about 4 MP each. Each band is read from the decoded bitmap through one reusable canvas and compared with two rows of overlap, so the result is identical to a single pass (unit-tested). Memory then stays flat however tall the page is. Very long pages get a downscaled difference-mask image, so it stays within browser canvas limits; detection always runs at full resolution.

```ts
compareScreenshots(reference: RasterImage | ImageSource, implementation: RasterImage | ImageSource, options?: Partial<CompareOptions>, hooks?: CompareHooks): ComparisonResult
// → { width, height, totalPixels, diffPixelCount, differencePercentage, diffMask, regions, warnings }
```

| Stage | File | Notes |
| --- | --- | --- |
| A. Validate | `validate.ts`, `inspect.ts` | Magic-byte format check (PNG/JPEG/WebP), size, megapixels, decode, matching dimensions. Oversized images are rejected from the file header alone, before decoding. Gives a hint for 2× (Retina) captures. |
| B. Normalise | `normalize.ts`, `decode.ts` | Embedded colour profiles converted to sRGB. Alpha is flattened onto white for both images. |
| C. Compare | `compare.ts` | [pixelmatch 8](https://github.com/mapbox/pixelmatch) (OKLab, anti-aliasing detection) in `diffMask` mode, band by band. |
| D. Group | `regions.ts` | Drop isolated pixels → 16 px tiles → active tiles → merge across a 1-tile gap → tight boxes → size filters → pad → merge overlaps → reading order → cap at 120. |
| Alignment | `alignment.ts` | When differences are broad, a coarse-to-fine search tests whether shifting the whole build lines it up. If it does, the app warns about misalignment and holds back the regions instead of listing dozens of misleading bugs. |
| Wording | `describe.ts` | Deterministic titles such as "Possible colour difference near the top right". Only location and pixel-based hints, and **never** CSS or Figma values. |

Sensitivity presets (`presets.ts`) are tuning parameters, not quality rules:

| Preset | Threshold | Tile | Use |
| --- | --- | --- | --- |
| Relaxed | 0.15 | 20 px | JPG screenshots, busy pages; ignores subtle colour shifts |
| Balanced (default) | 0.10 | 16 px | Most Figma exports and browser screenshots |
| Strict | 0.05 | 12 px | Catch everything; more regions to review |

**Measured on the sample pair** (`tests/unit/detection.test.ts`):
- **Balanced and Strict:** 6 of 6 intentional changes found, with no stray regions.
- **Relaxed:** 5 of 6. It skips the subtle off-token CTA blue by design.
- **Identical pair:** 0 regions.
- **Whole page shifted 12 px:** reported as a misalignment of exactly 12 px.

These are results on a controlled set, not performance claims about real pages.

## Project structure

```
src/
  app/                      routes: / · /comparisons/[id] · /issues
  components/
    comparison/             New Comparison screen, Workspace, notices, progress
    viewer/                 shared zoom/pan (useViewport), panes, highlights, toolbar
    issues/                 issue cards, crops, status/severity selects, sidebar
    tracker/                Design Issues tracker
    upload/                 upload card (drop, browse, paste)
    ui/                     Arnifi DS components + shadcn/ui primitives (Radix)
  lib/
    engine/                 comparison engine (pure) + browser decode/worker
    issues/                 workflow rules, CSV, text sanitising
    store/                  data model, IndexedDB repository, client store
scripts/                    sample + fixture generators
tests/unit, tests/e2e       Vitest and Playwright suites
public/samples/             generated sample pair + manifest of intentional changes
```

## Technical decisions

- **Stack per PRD §12:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui (Radix) for Select/Tabs/Tooltip/ToggleGroup/Slider, Lucide, pixelmatch, IndexedDB via `idb`.
- **Client-only by design:** no API routes, no database. Persistence uses IndexedDB, with an in-memory fallback and a visible banner when storage is unavailable or a save fails.
- **Web Worker:** keeps the page responsive on 12 MP images. Progress stages are posted back to the stepper.
- **One store for all screens** (`qa-store.ts`, `useSyncExternalStore`): the nav badge, workspace counts and tracker counts always agree. Writes apply on screen first, then are queued to IndexedDB in order.
- **IDs:** candidates are `R1…Rn` per comparison. Confirmed bugs get a global `BUG-n` that is never reused, even after deletion or a return to review. Manually marked issues are `M1…`.
- **Severity** starts as **Untriaged**: the algorithm doesn't pretend to know business impact.
- **Visual style:** the **Arnifi Design System**, not the PRD §8 palette (your choice on 22 Oct 2026). That means Lora for page titles, Inter everywhere else, an Arnique-900 primary with the DS arrow CTA, Dusk neutrals, and Ruby used only for differences and errors. The tokens live in `src/app/globals.css`, and shadcn's colour names are aliased to them. The app is light mode only.
- **Copy:** headings follow the DS written rule (Title Case, no full stop), so the PRD's line renders as "Compare Your Design With the Developed Website". British spelling throughout.
- **No AI in v0.1** (your choice). The PRD's optional "Explain Difference with AI" (§10) is not built. Nothing in the UI is presented as AI output.

## Privacy and security (PRD §16)

- **No network use for screenshots:** screenshots never leave the browser. Production responses send a Content-Security-Policy with `connect-src 'self'`, so the page can't send data to a third party. Every e2e test also fails if any request leaves localhost (AC-10).
- **Headers and indexing:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, plus `robots: noindex` metadata.
- **User text:** only ever rendered as React text (no HTML injection). It is cleaned of control and bidi characters and length-capped. CSV cells are protected against spreadsheet-formula injection.
- **No logging:** screenshot contents are never logged, and no URL fetching exists.
- **Browser-local data:** comparisons live only in this browser. Clearing site data deletes them, and a link to a comparison won't open on someone else's machine.

## Known limitations

- **Same pixel dimensions required:** the app does not align, crop or scale screenshots.
- **Rendering-sensitive:** pixel comparison reacts to font rendering, anti-aliasing, JPG compression, live content (dates, carousels), animations, scroll position and browser differences. Use the capture tips on the New Comparison screen, and the Relaxed preset for noisy captures.
- **No exact values:** it shows *where* screens differ, never exact CSS values such as a font size. Check those against Figma.
- **Region grouping is heuristic:** one change can produce two regions (for example two edited lines of text), and neighbouring changes can merge into one.
- **Misalignment check is global only:** it detects whole-page shifts. A single shifted section is reported as regions.
- **Browser-local and single-user:** no sharing or collaboration, which is out of scope for the MVP. Export CSV to share.
- **Browser coverage:** tested in Chrome on macOS (desktop 1440 and mobile 390). Edge should behave the same. Safari 16.4+ supports every API used (OffscreenCanvas, module workers) but wasn't tested here. The workspace is desktop-first.
- **Size limits:** up to 64 megapixels, 32,000 px per side and 50 MB per file (raised from the PRD's suggested 10 MB / 12 MP so full-page captures fit). Larger pages: export at 1x, or split the page into two comparisons.
- **Region cap:** at most 120 regions per comparison. The rest are reported in a notice.

## Testing

- **Unit (Vitest, 64 tests):**
  - Image validation, difference percentage and region grouping (merge, threshold, cap, order).
  - Misalignment, wording guardrails (no px or CSS values), and review/status transitions.
  - Summaries and filters, CSV formatting and injection, sanitising, and storage (IndexedDB via `fake-indexeddb`, memory fallback, save failure).
  - The sample-pair detection rate, banded-versus-single-pass equivalence, and a 30,000 px page with a change across a band seam.
- **Synthetic fixtures (`tests/unit/helpers/raster.ts`):** identical, heading-size change, button colour change, shifted section, multiple separate changes, different dimensions, global misalignment, and scattered noise.
- **End to end (Playwright, 18 tests, system Chrome):**
  - AC-01 to AC-10 and the error, progress and empty states.
  - Overlay and mask views, the misalignment flow, keyboard review, manual issues, CSV download contents, reload persistence, and a mobile no-horizontal-scroll check.
  - A 22 MP long landing page (1440 × 15,415) with changes far down the page, and instant rejection of a page that is too tall.

```bash
npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e
```

## Deployment

Any Node host that runs Next.js works. For **Vercel**: import the folder as a project (framework preset *Next.js*, no environment variables), or run `vercel` from this directory.

⚠️ **Before deploying, read PRD §16.** A public deployment is fine for demos with the sample data. Because processing is local, a hosted copy still never receives screenshots. Even so, **a public demo is not an approved production environment for confidential designs**. Turn on Vercel Deployment Protection (or equivalent access control) before sharing the URL with the team.

## Demo

See [`docs/demo-script.md`](docs/demo-script.md) for the PRD §19 stakeholder walkthrough.
