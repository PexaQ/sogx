# LowEndGS Baseline Notes

Last updated: 2026-06-06

## Baseline Principle

Baselines must be implemented as reproducible configurations, not anecdotes. PlayCanvas/SuperSplat/SOG features are treated as prior work and as the comparison target.

## PlayCanvas/SOG Controls to Use

- `app.scene.gsplat.splatBudget`: global target splat count across GSplat assets. This is the main baseline control for Streamed SOG.
- `app.scene.gsplat.lodRangeMin` / `lodRangeMax`: clamp available LOD levels. Useful for coarse-first loading and download/memory experiments.
- `entity.gsplat.lodBaseDistance` and `entity.gsplat.lodMultiplier`: tune LOD transition distances.
- `app.scene.gsplat.lodUnderfillLimit`: allow temporary coarser LOD while optimal data is not resident.
- `app.scene.gsplat.minPixelSize`: discard small screen-space splats.
- `app.scene.gsplat.minContribution`: discard low contribution splats in compute renderer where supported.
- `app.scene.gsplat.alphaClipForward`: forward-pass opacity clipping threshold.
- `app.scene.gsplat.renderer` and `currentRenderer`: request auto/WebGPU modes and record actual fallback path.
- `app.scene.gsplat.antiAlias`: splat anti-aliasing compensation; expected to be off for low-end baseline unless source requires it.
- Application DPR/render resolution: primary fill-rate control for weak GPUs.

Sources:

- PlayCanvas performance guide: https://developer.playcanvas.com/user-manual/gaussian-splatting/building/performance/
- GSplatParams API: https://api.playcanvas.com/engine/classes/GSplatParams.html

## SplatTransform Baseline Commands

These commands are drafts until datasets are selected. Use the CLI for reproducibility; the SuperSplat UI is useful for inspection but not for paper-grade batch conversion.

```powershell
# Baseline A: bundled SOG
splat-transform input.ply output.sog

# Baseline D: low SH bands
splat-transform input.ply --filter-harmonics 0 output.sh0.sog

# Baseline E: NaN cleanup and opacity pruning draft
splat-transform input.ply --filter-nan --filter-value opacity,gt,0.01 output.pruned.sog

# Morton/spatial ordering diagnostic
splat-transform input.ply --morton-order output.morton.ply

# Simple decimation chain for Streamed SOG
splat-transform lod0.ply --decimate 50% lod1.ply
splat-transform lod1.ply --decimate 50% lod2.ply
splat-transform lod2.ply --decimate 50% lod3.ply
splat-transform -C 512 -X 16 lod0.ply --lod 0 lod1.ply --lod 1 lod2.ply --lod 2 lod3.ply --lod 3 scene/lod-meta.json

# Reference render from a fixed camera
splat-transform output.sog refs/view-000.webp --camera 2,1,-2 --look-at 0,0,0 --fov 60 --resolution 1920x1080 --near 0.2 --background 0,0,0,1
```

Source:

- SplatTransform README and Streamed SOG guide: https://github.com/playcanvas/splat-transform and https://github.com/playcanvas/splat-transform/blob/main/guides/STREAMED_SOG.md

Important caveats:

- `meta.json` and `lod-meta.json` must use those exact filenames.
- `lod-meta.json` is an output format for Streamed SOG packaging, not a general SplatTransform input for reference rendering.
- `-C` is approximate Gaussians per chunk in thousands; default `512`.
- `-X` is approximate chunk extent in world units; default `16`.
- Smaller chunks give finer streaming but increase file/request count.
- `--filter-value opacity,...` uses transformed linear opacity unless `_raw` is used.
- SOG payload images must be lossless; lossy encodings corrupt quantized values.
- GPU is the default path for SOG compression and reference rendering; CPU fallback can be much slower.

## Baseline Configurations

| ID | Name | Asset | Runtime config | Expected value | Must record |
| --- | --- | --- | --- | --- | --- |
| A | Bundled SOG | `scene.sog` | Auto renderer, no streaming, default DPR unless configured. | Static compact-delivery reference. | Load time, memory, crash risk, FPS. |
| B | Default Streamed SOG | `lod-meta.json` | Default LOD ranges and distances; budget disabled or documented default. | Main PlayCanvas/SuperSplat-style streaming baseline. | First frame, chunks, bytes, FPS, visible popping. |
| C | Static mobile budget | `lod-meta.json` | `splatBudget` fixed, starting candidates: 250k, 500k, 750k, 1M. | Simple production knob for low-end phones. | Pareto behavior vs B. |
| D | Low SH | SH-reduced SOG/streamed SOG | Same as B/C, with `--filter-harmonics 0` or lowest available. | Lower memory/bandwidth and shading cost. | Color loss and view-dependent artifact notes. |
| E | Aggressive cleanup | Pruned SOG/streamed SOG | Same as B/C. | Remove invalid/low-opacity noise before runtime. | Holes, thin feature loss, file size, active splats. |
| F | Low fill-rate mode | Any above | Lower DPR, anti-alias off, high-res disabled where app exposes it. | Fill-rate relief for weak GPUs. | FPS vs blur/readability trade-off. |

Configured method IDs live in `benchmarks/configs/baselines.json`.

| Method ID | Query behavior | Notes |
| --- | --- | --- |
| `baseline-a` | Bundled `scene.sog`. | Requires `/scenes/<scene>/bundled/scene.sog`. |
| `baseline-b` | Streamed `lod-meta.json` defaults. | Main Streamed SOG comparison point. |
| `baseline-c` | Streamed SOG with fixed `splatBudget`. | Start with 500k, then sweep. |
| `baseline-d` | Bundled SH0 variant via `variant=sh0`. | Generated by conversion script. |
| `baseline-e` | Bundled opacity-pruned variant via `variant=opacity-0.01`. | Generated by conversion script after NaN cleanup. |
| `baseline-f` | Low DPR and anti-alias disabled. | Fill-rate baseline. |
| `adaptive-budget` | Dynamic `splatBudget` and DPR controller. | Candidate 1 scaffold. |
| `network-aware-stream` | Coarse-first LOD startup, then staged unlock. | Candidate 2 scaffold; follows PlayCanvas fast-first-frame guidance. |
| `visibility-decimation` | Bundled route-aware variant via `variant=visibility-25pct`. | Candidate 3 scaffold generated with `--route ... --visibilityKeep 25%`. |
| `contribution-culling` | `minPixelSize`, `minContribution`, and `alphaClipForward` profile. | Candidate 4 scaffold; thresholds are experimental defaults. |

## Phase 2 Evidence Gate Baselines

Baseline A exact config:

```text
http://127.0.0.1:4173/run?scene=kaliurang&asset=/assets/scenes/kaliurang/scene.sog&mode=baselineA&duration=30&autoStart=true&autoExport=server&resultEndpoint=/api/save-run&route=orbit-demo&captureScreenshot=true
```

Settings actually used:

- Asset: bundled SOG at `/assets/scenes/kaliurang/scene.sog`.
- Method/mode: `baselineA`.
- Renderer request: `auto`.
- Controllers: `adaptiveBudget=false`, `networkAwareStream=false`.
- Route: `orbit-demo`.
- Duration: 30 seconds.
- Export endpoint: `/api/save-run`.

Baseline B intended config:

```text
http://127.0.0.1:4173/run?scene=kaliurang&asset=/assets/scenes/kaliurang/lod-meta.json&mode=baselineB&duration=30&autoStart=true&autoExport=server&resultEndpoint=/api/save-run&route=orbit-demo
```

Baseline B status: prepared only. No `lod-meta.json` exists for `kaliurang` yet, and no streamed result was generated.

Conversion path to prepare Baseline B from the current bundled SOG source:

```powershell
npx --yes @playcanvas/splat-transform "datasets/samples/kaliurang.sog" "datasets/processed/kaliurang/source.ply"
node scripts/convert/generate-baselines.mjs --input "datasets/processed/kaliurang/source.ply" --out "datasets/processed/kaliurang"
```

If direct SOG-to-PLY conversion is unsupported by the installed SplatTransform version, obtain the original PLY source from the scene source and run `generate-baselines.mjs` on that PLY.

## Phase 3 Streamed SOG Baseline B

Baseline B name: `baselineB_streamed_sog_default`.

Definition:

- Asset: `/assets/scenes/kaliurang/streamed/<variant>/lod-meta.json`.
- Mode: `baselineB`.
- Controllers: disabled.
- Static budget: disabled unless PlayCanvas reports an implicit default.
- Adaptive DPR/LOD/budget: disabled.
- LOD clamp: default.
- `minPixelSize` / `minContribution`: default.

Preferred first variant, once generated:

```text
http://127.0.0.1:4173/run?scene=kaliurang&asset=/assets/scenes/kaliurang/streamed/aggressive_sh0/lod-meta.json&mode=baselineB&duration=30&autoStart=true&autoExport=server&resultEndpoint=/api/save-run&route=orbit-demo&captureScreenshot=true&resultName=kaliurang_aggressive_sh0_baselineB_streamed_sog_default
```

Current status: prepared only. `benchmarks/analysis/kaliurang-lod-generation.json` records planned SplatTransform commands from the existing bundled SOG, but no streamed `lod-meta.json` exists yet.

## Phase 3 Static Budget Sweep

These modes are static measurement configurations, not adaptive methods:

- `staticBudget_1000000`
- `staticBudget_750000`
- `staticBudget_500000`
- `staticBudget_250000`
- `staticBudget_150000`
- `staticBudget_100000`
- `staticBudget_75000`
- `staticBudget_50000`
- `staticBudget_25000`

Example:

```text
http://127.0.0.1:4173/run?scene=kaliurang&asset=/assets/scenes/kaliurang/streamed/aggressive_sh0/lod-meta.json&mode=staticBudget_100000&duration=30&autoStart=true&autoExport=server&resultEndpoint=/api/save-run&route=orbit-demo&captureScreenshot=true&resultName=kaliurang_aggressive_sh0_budget100000
```

Rules:

- Only set `app.scene.gsplat.splatBudget` to the fixed budget.
- Do not change DPR dynamically.
- Do not change LOD dynamically.
- Do not enable adaptive controllers.
- Record actual `splatBudget`, `splatBudgetAccepted`, active splats, renderer, and frame timing every run.

## Phase 3 LOD Clamp Sweep

These modes are static measurement configurations:

- `lodClamp_default`: no clamp.
- `lodClamp_coarseOnly`: force the coarsest visible LOD if PlayCanvas exposes LOD count.
- `lodClamp_noLOD0`: prevent highest-detail LOD.
- `lodClamp_noLOD0_noLOD1`: prevent top two detail levels.
- `lodClamp_midOnly`: restrict to a middle LOD when available.

The viewer records `finalLodRangeMin`, `finalLodRangeMax`, and `finalLodClampState`. If the LOD count is not visible on the PlayCanvas resource, the run is still saved but the clamp state is marked unavailable.

## Baseline Integrity Checks

- Do not compare adaptive methods only against weak baselines. Include Baseline B and C for every scene.
- Use the same camera route, viewport size, browser, and device state per method.
- Export raw JSON/CSV before summarizing.
- Mark runs invalid if tab reloads, context is lost, or assets fail to load.
- Record actual renderer path; requested WebGPU is not evidence of WebGPU if `currentRenderer` reports fallback.
- Record active splats from `app.stats.frame.gsplats` where available; treat chunk counts as estimates unless backed by a public API.
