# Results Summary

Last updated: 2026-06-06

One real-scene desktop harness validation result exists. No Android/mobile benchmark result exists yet.

Smoke-test JSON/CSV files may exist in `benchmarks/results/` from collector verification. They are not performance results and must not be included in paper tables.

## Current Evidence

- Real scene `kaliurang` was ingested from bundled SOG.
- Baseline A desktop harness run exists for `kaliurang`.
- Baseline B is prepared only; no `lod-meta.json` exists for `kaliurang`.
- SOG payload analysis exists in `benchmarks/analysis/sog-size-breakdown.*`.
- Bottleneck classification exists in `benchmarks/analysis/bottleneck-classification.*`.
- Phase 3 LOD generation and benchmark matrix planning artifacts exist in `benchmarks/analysis/kaliurang-lod-generation.*` and `benchmarks/analysis/kaliurang-matrix.*`.
- Active-splat envelope analysis exists in `benchmarks/analysis/active-splat-envelope.*`, but it currently includes only Baseline A bundled SOG runs plus one stalled SH0 attempt.
- No mobile performance claims have been made.

## SOG Payload Analysis

| Scene | SOG size | Gaussians | Bytes/Gaussian | SH bytes | SH share | Source PLY compression |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `kaliurang` | 17,903,258 | 1,178,520 | 15.191306 | 7,276,708 | 40.6446% | Unknown; no PLY exists locally. |
| `kaliurang-sh0` | 14,071,473 | 1,178,520 | 11.939953 | 3,657,700 | 25.9937% | Derived from SOG with SplatTransform, not source PLY. |

## Bottleneck Analysis

| Run ID | Classification | Confidence | Evidence |
| --- | --- | --- | --- |
| `2026-06-06T13-32-37-714Z_kaliurang_baselineA` | `splat-count-bound` | Medium | p95 1009.7 ms, active splats 1,178,520, bytes10s equals bytes30s, assetLoadedMs 559.7. |
| `2026-06-06T13-36-02-781Z_kaliurang_baselineA` | `unknown` | High that run is inconclusive | One frame row over 322.989 s; likely stalled/background-throttled. |

## Device Inventory

| Device | Role | RAM / memory hint | GPU | OS | Browser | WebGPU available | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop in-app browser | Harness validation only | 32 GB exposed | NVIDIA RTX 4070 Laptop GPU | Windows | Chrome 149 in local in-app browser | Yes | Not a low-end/mobile target. |

## Baseline Results

| Scene | Device | Method | Renderer | Avg FPS | p50 ms | p95 ms | First visible ms | Bytes 10s | Active splats | Crash/failure | Visual notes | Run ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `kaliurang` | Desktop in-app browser | `baselineA` | WebGPU / renderer `1` | 0.983 | 1000.7 | 1009.7 | 1758.5 | 17904329 | 1178520 | None reported | Canvas capture saved but black; `nonEmptyCanvas=false`. Desktop harness only. | `2026-06-06T13-32-37-714Z_kaliurang_baselineA` |
| `kaliurang` | Desktop in-app browser | `baselineA` overview route | WebGPU / renderer `1` | 0.003 | 322988.3 | 322988.3 | 322988.3 | 17904323 | 0 final | Stalled/inconclusive | Only one frame row; no screenshot; first visible after configured duration. Do not use as performance evidence except as a failed/stalled run. | `2026-06-06T13-36-02-781Z_kaliurang_baselineA` |

Result files:

- `benchmarks/results/2026-06-06T13-32-37-714Z_kaliurang_baselineA_summary.json`
- `benchmarks/results/2026-06-06T13-32-37-714Z_kaliurang_baselineA_frames.csv`
- `benchmarks/results/2026-06-06T13-32-37-714Z_kaliurang_baselineA_screenshot.png`
- `benchmarks/results/2026-06-06T13-36-02-781Z_kaliurang_baselineA_summary.json`
- `benchmarks/results/2026-06-06T13-36-02-781Z_kaliurang_baselineA_frames.csv`
- `benchmarks/results/validation-summary.json`

Important limitation: the screenshot/canvas sanity result is black. The FPS numbers are valid harness logs for this browser session, but visual QA is not yet sufficient for paper figures.

## Candidate Results

Candidate evaluation is frozen in Phase 2 until Baseline A/B evidence is available. No candidate result is reported here.

## Phase 3 Active-Splat Envelope

Source files:

- `benchmarks/analysis/active-splat-envelope.json`
- `benchmarks/analysis/active-splat-envelope.csv`
- `benchmarks/analysis/kaliurang-method-comparison.json`
- `benchmarks/analysis/kaliurang-method-comparison.csv`

Current status: no Streamed SOG result exists. The analyzer sees two Baseline A desktop harness runs, one stalled SH0 attempt, and the latest assetless smoke row. Smoke rows are excluded from research threshold calculations.

| Threshold | Reached by saved results? | Notes |
| --- | --- | --- |
| 12 FPS minimum usable | No | Best saved real-scene result is 0.983 FPS. |
| 18 FPS low usable | No | No static budget or LOD clamp result exists. |
| 24 FPS target usable | No | No Streamed SOG result exists. |
| 30 FPS preferred usable | No | No mobile result exists. |

Best measured config so far remains the historical Baseline A desktop harness run by FPS, but it is `unusable` and visually inconclusive because the canvas sanity capture was black. Do not treat it as a production recommendation.

## Pareto Summary

No Pareto frontier is reported yet. There is only one real-scene baseline run and no mobile data.

## Result Integrity Rules

- Raw JSON/CSV must exist before a row is filled.
- Failed or visually inconclusive runs are recorded, not deleted.
- Subjective artifact notes must be attached to fixed route timestamps or screenshots where possible.
- Desktop development runs may guide implementation but cannot support low-end mobile claims.
