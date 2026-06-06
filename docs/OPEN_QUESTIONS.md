# Open Questions

Last updated: 2026-06-06

## Literature and Ecosystem

- Which exact PlayCanvas Engine version should be pinned for stable GSplat APIs? Initial scaffold uses `2.19.6`.
- Are Streamed SOG runtime internals public enough to measure loaded/resident chunks cleanly, or do we need instrumentation wrappers? Active splats can use `app.stats.frame.gsplats`.
- Does `minContribution` only apply to the WebGPU compute renderer, and what equivalent culling is available under WebGL2?
- Can `lodUnderfillLimit` provide a cleaner network-aware coarse fallback than manually clamping LOD ranges?
- Does SOG spatial ordering conflict with any prefix/importance ordering experiment?

## Datasets

- Which public indoor property-style scenes are downloadable with licenses compatible with redistribution or benchmark instructions?
- Can SuperSplat "Downloadable" scenes be used in research artifacts, and what exact license is attached per scene?
- Do we have at least one several-million-Gaussian scene that can be legally included or scripted as an external download?
- Are reference camera images/renders available for SSIM/PSNR/LPIPS, or should the benchmark rely on fixed SOG full-quality renders as pseudo-reference?

## Devices

- Which sub-$200 Android phones are physically available for testing?
- Do target devices expose WebGPU in Chrome, or are they WebGL2-only?
- Can Android WebView be tested in addition to Chrome?
- What is the repeatable thermal/battery protocol for runs?

## Metrics

- How reliable is `performance.memory` on Chrome Android for JS heap?
- Can GPU memory be estimated from PlayCanvas textures/buffers and SOG chunk metadata with enough accuracy to be useful?
- Can resource timing capture all SOG chunk downloads under the chosen hosting setup?
- How should browser tab crashes be detected on-device?
- The in-app Browser previously blocked localhost with `net::ERR_BLOCKED_BY_CLIENT`; `/run` and `/api/save-run` worked in Phase 2. Direct Chrome/mobile routes are still documented as the robust path.
- Why did WebGPU canvas capture for the first `kaliurang` Baseline A run produce a black screenshot despite active splat counts?
- Is the current `orbit-demo` route visually meaningful for `kaliurang`, or should a scene-specific route be used after visual QA is repaired?

## Phase 2 Remaining Blockers

- No Android device result exists yet.
- No Streamed SOG `lod-meta.json` exists for `kaliurang`; Baseline B is prepared only.
- Canvas visual sanity is captured but currently reports `nonEmptyCanvas=false` for the saved Baseline A desktop run.
- In-app Browser screenshot capture timed out after the Baseline A run, so browser-level visual proof is still pending.
- Loaded chunk count is unavailable for bundled SOG and remains an estimate/internal metric for streamed data.

## Phase 3 Remaining Blockers

- No `kaliurang` Streamed SOG variant has been generated yet; `benchmarks/analysis/kaliurang-lod-generation.json` is a dry-run plan.
- No source PLY exists locally. Naive and SH0 ladders can be attempted from `.sog` input with SplatTransform, but route-aware LOD will be expensive because it first needs a full PLY export.
- SplatTransform `--execute true` has not been run for the full LOD ladder; actual generation time, disk usage, and failures are unknown.
- Baseline B has not run because no `lod-meta.json` exists.
- Static budget sweep has not run.
- LOD clamp sweep has not run.
- LOD selection and loaded chunk metrics may remain unavailable until a real Streamed SOG asset is loaded and PlayCanvas resource internals are inspected.
- Active splat count source for streamed data still needs validation against `app.stats.frame.gsplats`.
- Android has not been tested.
- Visual quality is not measured; current visual sanity is only a crude canvas non-empty check.

## Method Risks

- Dynamic budget and DPR changes may cause visible quality pulsing.
- Coarse-first loading may improve first visible frame while increasing time to acceptable quality.
- Visibility-aware decimation from one route may overfit and fail under free navigation.
- Aggressive opacity/contribution pruning may remove thin structures, text, doorframes, and furniture silhouettes.
- Hybrid impostor fallback may be compelling for property tours but less general than the paper title implies.
