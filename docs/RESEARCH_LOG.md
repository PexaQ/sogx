# LowEndGS Research Log

Project: LowEndGS: Adaptive Streamed Gaussian Splatting for Sub-$200 Mobile Web Devices

Last updated: 2026-06-06

## Research Rules

- Do not claim invention of PlayCanvas SOG, Streamed SOG, LOD streaming, or existing PlayCanvas renderer controls.
- Keep novelty narrow: low-end mobile device adaptation, benchmark methodology, offline optimization, runtime control policy, and fallback strategy.
- Do not fabricate citations, datasets, device results, or benchmark numbers.
- Every paper claim must map to either a cited source or a reproducible experiment.
- Failed methods stay in the record with the reason they failed.
- Prefer working, reproducible benchmarks over impressive unsupported claims.

## Session 2026-06-05

### Initial State

- Workspace root: `C:\Users\Lenovo\Documents\3D Gaussian research`
- Git state: new repository with no commits.
- Existing project files before initialization: none besides `.git`.
- Created initial planning docs:
  - `docs/RESEARCH_LOG.md`
  - `docs/EXPERIMENT_PLAN.md`

### Problem Statement

3D Gaussian Splatting scenes can be photorealistic but are difficult to render smoothly in mobile browsers on low-end Android devices. The practical target is not only compression; it is stable interactive playback under weak GPU, limited RAM, unstable network, and WebGL2 fallback constraints.

### Target Envelope

- Primary devices: sub-$200 Android phones, approximately 2-4 GB RAM class.
- Primary browser: Chrome on Android and Android WebView.
- Renderer paths: WebGPU where available, WebGL2 fallback required.
- Minimum acceptable performance: stable 24 FPS at reduced quality.
- Stretch performance: stable 30 FPS.
- First visible frame: under 2 seconds on decent 4G / Wi-Fi after page load.
- Interaction: camera movement must not stall during chunk loading.
- Memory: avoid browser tab crashes; track JS heap, estimated GPU memory where possible, active splat count, and loaded chunks.

### Working Hypothesis

A low-end-focused pipeline that combines visibility-aware decimation, Streamed SOG chunking, dynamic splat budgeting, adaptive resolution, contribution culling, SH reduction, and optional impostor or mesh fallback can improve the Pareto frontier over static SOG or default Streamed SOG settings for cheap mobile phones.

### Immediate Next Steps

1. Create the minimal repository structure for the viewer, tools, scripts, benchmarks, datasets, paper, and docs.
2. Build a minimal PlayCanvas benchmark viewer with a metrics HUD and scripted camera route support.
3. Add reproducible benchmark output to CSV and JSON.
4. Select datasets and record licenses.
5. Implement baseline configs A-F.

## Evidence Ledger

| Date | Evidence | Status | Notes |
| --- | --- | --- | --- |
| 2026-06-05 | Empty repository inspection | Complete | No codebase exists yet; prototype structure should be created after milestone plan approval. |
| 2026-06-05 | Initial experiment plan | Draft | Needs literature-backed baselines and concrete PlayCanvas API mapping. |
| 2026-06-05 | Current-source literature and implementation review | First pass complete | Filled `docs/LITERATURE_MATRIX.md`; key PlayCanvas controls identified for runtime adaptation. |
| 2026-06-05 | Parallel sub-agent research | Complete | Six lanes returned notes on PlayCanvas APIs, SplatTransform, literature, harness design, datasets, and Android constraints. |
| 2026-06-05 | Viewer scaffold | Complete initial scaffold | Vite + PlayCanvas viewer builds; assetless mode, route player, HUD, metrics, capability detection, adaptive controller stub, and local result collector added. |
| 2026-06-05 | Smoke verification | Partial | `npm run viewer:build` passes; static server and result POST smoke tests pass. In-app Browser localhost navigation is blocked in this session. |
| 2026-06-05 | Post-compaction verification | Complete for scaffold | Re-ran `npm run viewer:build`; checked `http://localhost:4173/` and `/routes/orbit-demo.json`; dry-ran baseline conversion command generation. No real splat assets or device benchmarks used yet. |
| 2026-06-05 | Runtime candidates 2 and 4 | Implemented scaffold | Added `network-aware-stream` coarse-first unlock controller and `contribution-culling` profile. Both require streamed splat assets before validation. |
| 2026-06-05 | Config parser smoke test | Complete | Fixed `readNumber` so missing numeric query params use intended defaults instead of `0`; this preserves DPR and duration defaults. |
| 2026-06-05 | Candidate 3 offline scaffold | Complete initial scaffold | Added route-aware PLY decimator, tiny fixture smoke test, and optional generator integration for `scene.visibility-25pct.sog`. |
| 2026-06-06 | Phase 2 checklist | Complete | Created `docs/PHASE2_CHECKLIST.md`; froze candidate evaluation for Evidence Gate. |
| 2026-06-06 | Browser blocking workaround | Complete for current session | Added `/run`, `/api/save-run`, `/api/health`; in-app browser loaded `/run` successfully. Direct Chrome/mobile routes documented. |
| 2026-06-06 | Real scene ingestion | Complete | Ingested `datasets/samples/kaliurang.sog` as `kaliurang`; recorded size, SHA256, license text, 1,178,520 splats, SH present, no LOD. |
| 2026-06-06 | Baseline A desktop harness | Complete with visual warning | Saved JSON/CSV/screenshot for bundled SOG Baseline A. Controllers disabled. Canvas sanity reported black/non-empty false, so visual QA remains unresolved. |
| 2026-06-06 | Baseline B preparation | Prepared only | No `lod-meta.json` found. Added intended Baseline B URL and SplatTransform conversion commands. |
| 2026-06-06 | SOG-X payload analysis | Complete for available scene | Generated `benchmarks/analysis/sog-size-breakdown.*`; `kaliurang` is 15.191306 bytes/Gaussian and SH is 40.6446% of SOG. |
| 2026-06-06 | SOG-X bottleneck classification | Complete for saved runs | Generated `benchmarks/analysis/bottleneck-classification.*`; usable Baseline A run classified as `splat-count-bound` with medium confidence. |
| 2026-06-06 | SH0 SOG-compatible artifact | Payload evidence complete; runtime unresolved | Generated `kaliurang-sh0` with SplatTransform `--filter-harmonics 0`; size is 14,071,473 bytes, 21.40% smaller than original. In-app browser runtime attempt did not save a completed result. |
| 2026-06-06 | Phase 3 streamed SOG planning | Prepared tooling only | Added `scripts/convert/generate-kaliurang-lods.mjs`; dry-run report shows `kaliurang.sog` is available, no PLY and no existing `lod-meta.json`. |
| 2026-06-06 | Active-splat envelope analyzer | Prepared and run on existing results | Generated `benchmarks/analysis/active-splat-envelope.*`; only existing `kaliurang` Baseline A desktop runs are present and both classify as `unusable`. |

## Session 2026-06-06 - Phase 2 Evidence Gate

### Real Scene

- Found real bundled SOG: `datasets/samples/kaliurang.sog`.
- Ingested public local asset: `/assets/scenes/kaliurang/scene.sog`.
- Metadata:
  - Size: 17,903,258 bytes.
  - SHA256: `a6310167ad40ead5573db74f5231be7f1fed9a8999b85ed64d19d647ad830a75`.
  - Splat count: 1,178,520.
  - SH present: yes.
  - LOD present: no.
  - License: CC BY 4.0 text embedded in SOG `license.txt`.

### Baseline A Result

- Run ID: `2026-06-06T13-32-37-714Z_kaliurang_baselineA`.
- Result files:
  - `benchmarks/results/2026-06-06T13-32-37-714Z_kaliurang_baselineA_summary.json`
  - `benchmarks/results/2026-06-06T13-32-37-714Z_kaliurang_baselineA_frames.csv`
  - `benchmarks/results/2026-06-06T13-32-37-714Z_kaliurang_baselineA_screenshot.png`
- Result is desktop harness validation only, not mobile evidence.
- Visual sanity warning: screenshot capture was black and `nonEmptyCanvas=false`.
- A second scene-specific overview route attempt saved `2026-06-06T13-36-02-781Z_kaliurang_baselineA`, but it is marked inconclusive/stalled: only one frame row, first visible after the configured duration, no screenshot.

### Browser Blocking

- Previous `net::ERR_BLOCKED_BY_CLIENT` was worked around in this session by using `/run` and `/api/save-run`.
- `/api/health` returns 200 JSON locally.
- Direct Chrome and Android Chrome URLs are documented in `docs/MOBILE_TESTING.md`.

### Baseline B

- No `lod-meta.json` exists under the repo.
- Baseline B was not run.
- Conversion commands are documented in `docs/BASELINE_NOTES.md`.

## Session 2026-06-06 - Phase 3 Streamed SOG and Active-Splat Envelope

### Scope

- Phase 3 is limited to Streamed SOG Baseline B preparation, static splat-budget sweep support, LOD clamp sweep support, and active-splat envelope analysis.
- Adaptive controllers remain frozen until Streamed SOG and static budget results exist.
- No new file format is designed in this phase.

### Implementation

- Added `scripts/convert/generate-kaliurang-lods.mjs`.
  - Dry-run by default.
  - Supports `--execute true` for real local LOD generation.
  - Supports `--only aggressive_sh0_lod` to generate one variant before the full ladder.
  - Planned variants: `naive_original_sh_lod`, `aggressive_original_sh_lod`, `naive_sh0_lod`, `aggressive_sh0_lod`, and `route_visibility_lod`.
- Added static modes: `staticBudget_1000000`, `staticBudget_750000`, `staticBudget_500000`, `staticBudget_250000`, `staticBudget_150000`, `staticBudget_100000`, `staticBudget_75000`, `staticBudget_50000`, and `staticBudget_25000`.
- Added LOD clamp modes: `lodClamp_coarseOnly`, `lodClamp_noLOD0`, `lodClamp_noLOD0_noLOD1`, `lodClamp_midOnly`, and `lodClamp_default`.
- Added `scripts/run-kaliurang-matrix.mjs` for exact desktop URLs.
- Added `scripts/analyze-active-splat-envelope.mjs` for usability threshold classification.
- Updated `scripts/print-mobile-url.mjs` to support streamed assets, modes, duration, and `resultName`.

### Evidence Status

- LOD generation dry-run report: `benchmarks/analysis/kaliurang-lod-generation.json`.
- Matrix report: `benchmarks/analysis/kaliurang-matrix.json`.
- Active envelope report: `benchmarks/analysis/active-splat-envelope.json`.
- The active envelope analyzer currently includes the saved SH0 attempt, but that run is stalled/inconclusive and must not be used as a runtime win.
- No Streamed SOG `lod-meta.json` has been generated yet.
- Baseline B has not been run.
- Static budget sweep has not been run.
- LOD clamp sweep has not been run.
- No 12, 18, 24, or 30 FPS threshold is reached by existing saved results.

## Decisions

| Date | Decision | Rationale | Revisit When |
| --- | --- | --- | --- |
| 2026-06-05 | Treat PlayCanvas/SuperSplat/SOG as the baseline ecosystem, not the claimed novelty. | The project brief explicitly states that SOG, Streamed SOG, LOD streaming, and splat budgets already exist. | When writing abstract, related work, and contributions. |
| 2026-06-05 | Start with a benchmark harness before optimization scripts. | Without stable metrics, candidate methods cannot be compared honestly. | After minimal viewer logs FPS, first frame time, chunks, bytes, and splat counts. |
| 2026-06-05 | Use PlayCanvas GSplat APIs as the first adaptive-control surface. | Current docs expose `splatBudget`, LOD range, contribution/pixel culling, renderer fallback reporting, and fast first-frame LOD clamping. | If APIs are unstable or insufficient after prototype integration. |
| 2026-06-05 | Use `app.stats.frame.gsplats` as the preferred active splat metric. | Official examples expose this as frame stats; loaded chunk lists are not public API. | If a stable public chunk/residency API is found. |

## Open Risks

- Need real low-end devices or remote testing access; desktop throttling is not a substitute for final claims.
- Need compatible public scenes and clear licenses if local datasets are unavailable.
- Need to confirm exactly which PlayCanvas/SuperSplat SOG controls are public, stable, and scriptable.
- Browser memory and GPU memory observability may be limited on Android.
- Visual metrics require reference renders and stable camera paths.
