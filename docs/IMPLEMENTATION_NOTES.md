# LowEndGS Implementation Notes

Last updated: 2026-06-05

## Repository Inspection

The workspace began as a new Git repository with no project files besides `.git`. The first created files were:

- `docs/RESEARCH_LOG.md`
- `docs/EXPERIMENT_PLAN.md`
- `docs/LITERATURE_MATRIX.md`
- `docs/BASELINE_NOTES.md`
- `docs/IMPLEMENTATION_NOTES.md`
- `docs/PAPER_OUTLINE.md`
- `docs/RESULTS_SUMMARY.md`
- `docs/OPEN_QUESTIONS.md`

The first viewer scaffold has now been added.

## Proposed Repository Structure

```text
viewer/
  src/
    benchmark/
    controllers/
    playcanvas/
  public/
    scenes/
    routes/
  package.json
tools/
  lowendgs/
scripts/
  convert/
  benchmark/
benchmarks/
  configs/
  routes/
  results/
datasets/
  README.md
paper/
  figures/
  tables/
docs/
```

Implemented so far:

- Vite + PlayCanvas viewer in `viewer/`.
- Query-param benchmark config parser.
- PlayCanvas app creation with WebGPU-first / WebGL2 fallback request.
- Bundled `.sog` and streamed `lod-meta.json` loader path through `gsplat` assets.
- Assetless smoke-test mode with `asset=none`.
- Scripted route player.
- HUD.
- RAF frame sampler with p50/p95 summary.
- Resource Timing byte tracking.
- Capability detection for WebGPU and WebGL2.
- Adaptive budget controller prototype toggled by `method=adaptive-budget`.
- Network-aware stream controller prototype toggled by `method=network-aware-stream`.
- Contribution/screen-space culling profile toggled by `method=contribution-culling`.
- Local result collector: `npm run benchmark:serve`.
- Baseline conversion driver: `node scripts/convert/generate-baselines.mjs --input ... --out ...`.

Verification:

- `npm run viewer:build` passes with PlayCanvas `2.19.6`.
- Static server serves `viewer/dist` and `viewer/public`.
- Result POST writes JSON and CSV into `benchmarks/results/`.
- In-app Browser localhost navigation was blocked by the browser client in this session (`net::ERR_BLOCKED_BY_CLIENT`), so visual browser verification remains pending.

## Initial Technology Choices

- Viewer: PlayCanvas Engine `2.19.6` from npm.
- Build tool: Vite `8.0.16`.
- Metrics: browser `performance.now()`, `requestAnimationFrame` frame deltas, `PerformanceObserver` where available, resource timing for downloads, `performance.memory` when exposed by Chrome.
- Export: client-side JSON/CSV download first; optional local dev endpoint later if needed.
- Offline tools: SplatTransform CLI for baseline conversion; custom scripts for route-aware scoring and result aggregation.
- Automation: desktop browser automation for development only; real Android measurements required for paper claims.

## Public PlayCanvas Runtime API Map

- Load splats as `gsplat` assets and assign with `entity.addComponent('gsplat', { asset })`.
- Supported asset URLs include `.ply`, `.sog`, SOG `meta.json`, and streamed `lod-meta.json`.
- Prefer global `app.scene.gsplat` controls for benchmark methods.
- Record `app.scene.gsplat.currentRenderer`; WebGPU-only modes can fall back to CPU-sort on WebGL2.
- Use `app.stats.frame.gsplats` as the preferred active/rendered splat count.
- Use `app.systems.gsplat.on('frame:ready', (camera, layer, ready, loadingCount) => ...)` for streamed readiness and loading count.
- Loaded/resident chunk lists are not documented as stable public API. If inspected later through `resource.octree`, mark the metric source as an estimate/internal diagnostic.

Primary sources:

- GSplatComponent API: https://api.playcanvas.com/engine/classes/GSplatComponent.html
- GSplatParams API: https://api.playcanvas.com/engine/classes/GSplatParams.html
- createGraphicsDevice API: https://api.playcanvas.com/engine/functions/createGraphicsDevice.html
- Performance guide: https://developer.playcanvas.com/user-manual/gaussian-splatting/building/performance/

## Runtime Controller Design Draft

The adaptive controller should be small and inspectable:

- Inputs: frame-time window, p50/p95, first-frame state, camera velocity, loaded/loading chunk count, bytes loaded, renderer path, device memory hints, DPR.
- Outputs: `splatBudget`, DPR/render scale, `lodRangeMin`, `lodRangeMax`, `lodUnderfillLimit`, `minPixelSize`, `minContribution`, optional `alphaClipForward`.
- Policy: degrade quickly when p95 frame time exceeds target; improve slowly after a stable window; use hysteresis to avoid oscillation.
- Preference order: lower distant/detail LOD first, then reduce budget, then reduce DPR, then raise contribution/pixel culling thresholds.

Implemented controller toggles:

- `method=adaptive-budget`: frame-time controller that reduces `splatBudget` and DPR quickly when p95 frame time exceeds target, then restores slowly after stable windows.
- `method=network-aware-stream`: applies a coarse-first startup profile using `lodRangeMin`/`lodRangeMax` when streamed resources expose `octree.lodLevels`, then restores full range, budget, DPR, and culling settings in staged steps after `frame:ready`.
- `method=contribution-culling`: static low-end profile for `minPixelSize`, `minContribution`, `alphaClipForward`, budget, and anti-alias settings.

The network-aware controller follows the PlayCanvas performance guide's fast-time-to-first-frame pattern, but its benefit must be measured against Baseline B because default Streamed SOG already has LOD streaming and budget controls.

## Offline Pipeline Design Draft

Baseline first:

1. Convert PLY to bundled SOG.
2. Generate simple 50% LOD chain.
3. Package Streamed SOG.
4. Generate SH0-only and pruned variants.

Candidate offline work:

1. Parse scripted camera routes.
2. Estimate visibility and screen contribution per chunk or per Gaussian.
3. Produce weighted decimation variants.
4. Preserve route-critical structures by weighting high-frequency visible silhouettes and near-path surfaces.

Implemented offline scaffold:

- `scripts/convert/visibility-decimate.mjs` reads vertex-only Gaussian PLY files in ASCII or binary-little-endian format and writes a route-aware subset PLY plus a JSON report.
- The current heuristic scores each Gaussian from fixed route keyframes using view direction, distance falloff, near-route boost, opacity, and a scale proxy.
- `scripts/convert/generate-baselines.mjs --route <route.json> --visibilityKeep 25%` adds a `scene.visibility-25pct.sog` variant through SplatTransform.
- This is an initial Candidate 3 comparator against blind decimation, not a final visibility metric.

## Benchmark Harness Design Draft

Viewer route query examples:

```text
/viewer/?scene=small-room&method=baseline-b&route=walkthrough-01&duration=30
/viewer/?scene=small-room&method=adaptive-budget&targetFps=24&deviceClass=low2gb
```

Output schema draft:

```json
{
  "runId": "timestamp-scene-method-device",
  "scene": "small-room",
  "method": "baseline-b",
  "device": {},
  "browser": {},
  "renderer": {
    "requested": "auto",
    "actual": "unknown"
  },
  "samples": [],
  "summary": {
    "avgFps": null,
    "p50FrameMs": null,
    "p95FrameMs": null,
    "firstVisibleFrameMs": null,
    "bytes5s": null,
    "bytes10s": null,
    "bytes30s": null
  }
}
```

Current implementation uses the same overall shape, with `samples[]`, `summary`, `device.capabilities`, `config`, `runId`, and PlayCanvas version fields.

## Android Benchmark Protocol Draft

- Treat WebGL2 as the required baseline.
- Treat WebGPU as an optional measured fast path, not an assumption.
- Detect support with actual feature tests: `navigator.gpu`, `requestAdapter`, WebGL2 context creation, PlayCanvas `graphicsDevice.deviceType`, and `app.scene.gsplat.currentRenderer`.
- Log `navigator.deviceMemory` only as a coarse privacy-bucketed hint.
- Log `navigator.hardwareConcurrency` only as an exposed worker-capacity hint.
- Use `performance.memory` only as a Chrome diagnostic field, not a portable metric.
- Call `performance.setResourceTimingBufferSize(5000)` before scene load.
- Serve assets same-origin or with `Timing-Allow-Origin`, otherwise byte counts may be zero.
- Keep test conditions fixed: orientation, brightness, battery saver, network, background apps, and thermal cooldown.
- Do not keep DevTools open during measured runs.
- Use ADB sidecar logs for real-device runs where possible: `dumpsys meminfo`, `dumpsys thermalservice`, `dumpsys battery`.

## Verification Snapshot

2026-06-05 scaffold checks:

- `npm run viewer:build` passes with Vite. Warnings are currently limited to PlayCanvas worker-thread browser externalization and bundle size.
- Local benchmark server responds at `http://localhost:4173/`.
- Route fixture responds at `http://localhost:4173/routes/orbit-demo.json`.
- `scripts/convert/generate-baselines.mjs --dry-run` emits the expected bundled SOG, SH0, opacity-pruned, decimated LOD, and streamed `lod-meta.json` SplatTransform commands.
- `scripts/convert/generate-baselines.mjs --route viewer/public/routes/orbit-demo.json --visibilityKeep 25% --dry-run` emits the expected `scene.visibility-25pct` Candidate 3 variant commands.
- Query parser smoke test confirms missing numeric params now preserve intended defaults, including DPR.
- In-app browser navigation to localhost was blocked in this session by `net::ERR_BLOCKED_BY_CLIENT`; use direct Chrome/Android or another browser path for visual QA.
