# LowEndGS Experiment Plan

Project: LowEndGS: Adaptive Streamed Gaussian Splatting for Sub-$200 Mobile Web Devices

Last updated: 2026-06-06

## Phase 2 Evidence Gate

Before evaluating adaptive candidates, the project must produce baseline evidence from real scene assets.

Phase 2 rules:

- Do not evaluate adaptive controllers until Baseline A exists for at least one real scene.
- Do not evaluate Streamed SOG candidates until Baseline B exists for the same scene or its absence is documented.
- Treat desktop runs as harness validation only.
- Treat mobile Chrome/WebView runs as the first source of mobile performance claims.

Current status:

- Real bundled SOG scene found and ingested: `kaliurang`.
- Baseline A desktop harness result exists.
- Baseline B is prepared only because no `lod-meta.json` exists.
- Candidate comparisons remain frozen.

## Phase 3 Streamed SOG and Active-Splat Envelope

Current phase: generate Streamed SOG variants for `kaliurang`, run Baseline B, and measure the static active-splat envelope before re-enabling adaptive controllers.

Phase 3 rules:

- Do not design a new file format.
- Do not evaluate adaptive candidates until Streamed SOG Baseline B and static budget runs exist.
- Do not treat SH0 payload reduction as runtime improvement without a completed runtime result.
- Do not overwrite historical Baseline A results.

Prepared tooling:

- `scripts/convert/generate-kaliurang-lods.mjs` plans or executes Streamed SOG LOD ladders.
- `scripts/run-kaliurang-matrix.mjs` prints exact desktop benchmark URLs.
- `scripts/analyze-active-splat-envelope.mjs` classifies FPS thresholds and method rows from saved JSON/CSV results.
- Static budget and LOD clamp modes are supported in the viewer with controllers disabled.

Exit criteria:

- At least one real `lod-meta.json` exists for `kaliurang`.
- Baseline B completes with JSON/CSV result files.
- Static budget sweep includes at least `250000`, `100000`, and `50000`.
- LOD clamp sweep includes `coarseOnly`.
- `benchmarks/analysis/active-splat-envelope.*` is regenerated after the runs.

## Research Question

Can an automatic offline plus runtime pipeline adapt Gaussian Splat quality to cheap mobile browsers better than default PlayCanvas/SuperSplat Streamed SOG settings while preserving acceptable visual quality?

## Definition of Better

A method is better only if it improves at least one of these metrics while preserving acceptable visual quality:

- FPS or frame time
- First visible frame time
- Time to acceptable quality
- Memory footprint or crash rate
- Data downloaded over the first 5 seconds, 10 seconds, and 30 seconds
- Interaction smoothness during camera movement and chunk loading

The final selection should be Pareto optimal, not simply the highest-FPS configuration.

## Benchmark Scenes

At least three scenes are required.

| Scene Class | Candidate Source | Required Notes |
| --- | --- | --- |
| Small indoor property scene | SuperSplat Matterport-derived interior candidate | Verify CC BY 4.0 attribution, source format, splat count, SOG conversion command, reference route |
| Medium indoor/property scene | SuperSplat single family home in Bellevue WA candidate | Verify CC BY 4.0 attribution, source format, splat count, SOG conversion command, reference route |
| Large multi-million Gaussian scene | SuperSplat ISS synthetic scene candidate | Verify CC BY 4.0 plus NASA/source attribution chain, source format, splat count, SOG conversion command, reference route |

If local datasets are unavailable, public datasets must be selected during the literature and implementation review, with license terms recorded before use.

## Target Devices

| Device Tier | Role | Notes |
| --- | --- | --- |
| Low-end Android, 2 GB RAM | Hard target | Need real-device measurements before making paper claims. |
| Low-end Android, 3-4 GB RAM | Main target | Expected best fit for adaptive Streamed SOG. |
| Midrange Android | Sanity target | Useful to show adaptation does not harm better devices. |
| Desktop Chrome throttled | Development only | Not acceptable as final evidence. |

## Metrics

Runtime metrics:

- Average FPS
- p50 frame time
- p95 frame time
- Worst 1% frame time where possible
- First visible frame time
- Time to acceptable quality
- Active splat count
- Loaded chunk count
- Bytes downloaded at 5s, 10s, and 30s
- JS heap memory where browser APIs allow
- Estimated GPU texture/buffer memory where possible
- Device info, browser version, renderer path, DPR, viewport size, network hints
- Camera velocity and route phase
- Browser crash, tab reload, or context loss events
- Metric source labels for active splats, chunk count, memory, and bytes when the browser/API only exposes estimates.

Visual metrics:

- SSIM, PSNR, and LPIPS if reference renders are available
- Side-by-side screenshots on fixed camera route keyframes
- Subjective notes: popping, holes, blur, shimmer, over-pruning, color loss, floaters, missing thin structures

## Baselines

| ID | Name | Purpose | Status |
| --- | --- | --- | --- |
| A | Bundled `.sog` | Measures compact non-streamed SOG behavior. | Desktop harness run exists for `kaliurang`; mobile pending. |
| B | Default Streamed SOG | Main PlayCanvas/SuperSplat baseline. | Prepared only for `kaliurang`; no `lod-meta.json` yet. |
| C | Streamed SOG with static mobile splat budget | Tests simple low-end cap. | Viewer modes prepared; no streamed results yet. |
| D | Streamed SOG with low SH bands or no higher-order SH | Tests shading simplification. | SH0 payload exists; streamed SH0 runtime pending. |
| E | Aggressive opacity and NaN pruning | Tests basic offline cleanup. | Planned |
| F | Lower DPR, high-resolution disabled, antialias disabled | Tests renderer-quality reductions. | Planned |

## Candidate Methods

| ID | Candidate | Initial Implementation | Keep/Reject Criteria |
| --- | --- | --- | --- |
| 1 | Adaptive Splat Budget Controller | Sliding-window frame-time controller adjusts splat budget and DPR with hysteresis. | Keep if it improves p95 frame time or crash rate without severe popping. |
| 2 | Network-aware Streamed SOG Controller | Implemented scaffold: coarsest LOD startup when LOD metadata exposes `lodLevels`, delayed staged unlock, startup DPR/budget options. Velocity-aware prefetch is not implemented yet because no stable public prefetch API has been identified. | Keep if first frame or early bytes improve without unacceptable quality delay. |
| 3 | Visibility-aware Offline Decimator | Implemented scaffold: route-aware PLY decimator scores splats by camera-path visibility, proximity, opacity, and scale proxy, then emits a reduced PLY/SOG variant. Full image-space contribution scoring is still pending. | Keep if it beats simple decimation at similar splat budgets. |
| 4 | Contribution Culling / Screen-space Budgeting | Implemented scaffold: `method=contribution-culling` applies configurable `minPixelSize`, `minContribution`, `alphaClipForward`, budget, and anti-alias settings. | Keep if FPS improves with acceptable visual degradation. |
| 5 | Hybrid Ultra-Low-End Fallback | Panoramic impostor, layered impostor, coarse mesh, or cubemap background plus near splats. | Keep if worst-tier phones remain interactive where pure splats fail. |
| 6 | Prefix/importance-ordered SOG Experiment | Reorder Gaussians by opacity, projected area, visibility frequency, and distance importance if compatible. | Keep only if SOG decoding and renderer assumptions remain valid and prefix quality is coherent. |

## Benchmark Harness Requirements

- PlayCanvas viewer page.
- Ability to load fixed `.sog` and Streamed SOG `lod-meta.json` assets.
- Configurable method ID through URL query params.
- Scripted camera route support.
- On-screen debug HUD.
- Metrics recorder with JSON and CSV export.
- Result files written under `benchmarks/results/`.
- Browser automation route for desktop development.
- Real-device workflow for Android Chrome/WebView.

## Iteration Loop

1. Plan the next experiment.
2. Implement the smallest working version.
3. Run benchmark on at least one development target.
4. Save JSON and CSV logs.
5. Analyze result and artifact notes.
6. Update docs.
7. Keep, tune, or reject the method.
8. Move to the next candidate until no candidate improves the Pareto frontier.

## Initial Milestones

### M0 - Repository and Evidence Setup

- Create required docs and project folders.
- Complete literature matrix with citations and implementation notes.
- Select datasets and record licenses.

Exit criteria:

- `docs/LITERATURE_MATRIX.md`, `docs/BASELINE_NOTES.md`, and `docs/OPEN_QUESTIONS.md` exist and contain source-backed notes.
- Repo structure exists.
- Dataset choices are documented, even if downloads are deferred.

### M1 - Minimal Benchmark Viewer

- Create PlayCanvas-based viewer. Complete initial scaffold.
- Load static SOG and streamed SOG assets. Loader path implemented; real scene assets pending.
- Add scripted route and debug HUD. Complete initial scaffold.
- Log FPS, frame time percentiles, first visible frame, DPR, renderer path, active splats, chunks, bytes, and memory where available. Initial scaffold complete; chunk counts currently estimate/unavailable.
- Add local JSON/CSV result collector. Complete initial scaffold.

Exit criteria:

- A local browser can run a benchmark route and export JSON/CSV. Build and server smoke tests pass; in-app browser localhost navigation is blocked in this session, so visual browser QA remains pending.

### M2 - Baseline Measurements

- Implement Baselines A-F as reproducible configs.
- Run on development browser first.
- Run on at least one target Android phone before paper claims.

Exit criteria:

- Baseline result tables exist in `docs/RESULTS_SUMMARY.md`.
- Raw logs exist in `benchmarks/results/`.

### M3 - Adaptive Runtime Controllers

- Implement Candidate 1 adaptive splat/DPR controller.
- Implement Candidate 2 network-aware streaming policy. Initial scaffold complete; needs real streamed assets.
- Implement Candidate 4 contribution culling controls. Initial scaffold complete; thresholds need sweeps.

Exit criteria:

- Each controller can be toggled independently.
- Pareto comparison against Baseline B and C exists.

### M4 - Offline Optimization

- Implement pruning and simple decimation scripts. Initial baseline generator complete.
- Implement visibility-aware decimator over representative routes. Initial route-aware PLY decimator complete.
- Generate SOG/Streamed SOG variants.

Exit criteria:

- Candidate 3 is compared against simple 50%, 25%, and 10% decimation.

### M5 - Ultra-Low-End Fallback

- Prototype at least one fallback: panoramic impostor, layered impostor, coarse mesh, or cubemap route background.
- Keep Gaussian detail near the camera or focus region.

Exit criteria:

- Candidate 5 either improves failure cases or is rejected with evidence.

### M6 - Paper Draft and Reproducibility

- Produce draft abstract, related work, method, experiments, and limitations.
- Produce README reproduction steps.
- Produce final Pareto tables or plots.

Exit criteria:

- Every claim maps to a citation or experiment.
- Best method is selected with evidence.
