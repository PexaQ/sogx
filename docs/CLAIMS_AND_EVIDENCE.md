# Claims and Evidence

Last updated: 2026-06-06

Only claims backed by source files, saved results, or reproducible commands are listed here.

| Claim | Evidence | Status |
| --- | --- | --- |
| The viewer builds. | `npm run viewer:build` passed on 2026-06-06. | Supported |
| The safe server health route works. | `GET http://localhost:4173/api/health` returned 200 JSON on 2026-06-06. | Supported |
| The `/run` route works around the earlier in-app browser block in this session. | In-app browser loaded `http://127.0.0.1:4173/run?...` successfully on 2026-06-06. | Supported for current session |
| The ingestion script records real scene metadata. | `scripts/ingest-scene.mjs` ingested `datasets/samples/kaliurang.sog` into `datasets/scenes.json`. | Supported |
| A real bundled SOG scene exists for Phase 2. | `datasets/scenes.json` records `kaliurang`, 17,903,258 bytes, SHA256 `a6310167ad40ead5573db74f5231be7f1fed9a8999b85ed64d19d647ad830a75`, 1,178,520 splats. | Supported |
| Baseline A desktop harness result exists for `kaliurang`. | `benchmarks/results/2026-06-06T13-32-37-714Z_kaliurang_baselineA_summary.json` and frames CSV exist. | Supported |
| A second `kaliurang` Baseline A overview route run is inconclusive/stalled. | `benchmarks/results/2026-06-06T13-36-02-781Z_kaliurang_baselineA_summary.json` has one frame row, first visible after configured duration, and no screenshot. | Supported |
| Baseline A did not use adaptive controllers. | Result config and `controllerEnabled` record `adaptiveBudget=false`, `networkAwareStream=false`. | Supported |
| Baseline B has not been run. | No `lod-meta.json` found; `docs/BASELINE_NOTES.md` lists prepared-only commands. | Supported |
| Mobile performance has not been measured. | No Android result file exists in `benchmarks/results/`. | Supported |
| `kaliurang` bundled SOG is 17,903,258 bytes for 1,178,520 Gaussians, or 15.191306 bytes/Gaussian. | `benchmarks/analysis/sog-size-breakdown.csv`. | Supported |
| SH payload is 7,276,708 bytes, or 40.6446% of the `kaliurang` SOG. | `benchmarks/analysis/sog-size-breakdown.csv`. | Supported |
| A SH0-only SOG-compatible variant was generated for `kaliurang`. | `datasets/processed/kaliurang/variants/kaliurang.sh0.sog`; `datasets/scenes.json` entry `kaliurang-sh0`. | Supported |
| The SH0-only `kaliurang` SOG is 14,071,473 bytes, or 21.40% smaller than the original bundled SOG. | `benchmarks/analysis/sog-size-breakdown.csv`. | Supported |
| SH0-only runtime is faster than original SOG. | The saved SH0 attempt `2026-06-06T13-59-09-368Z_kaliurang-sh0_sh0-tiering_summary.json` has one frame row, first visible after configured duration, and no screenshot. | Unsupported |
| The valid `kaliurang` Baseline A run is classified as `splat-count-bound` with medium confidence. | `benchmarks/analysis/bottleneck-classification.csv`; p95 1009.7 ms, activeSplats 1,178,520, bytes10s equals bytes30s. | Supported |
| Current evidence does not show SOG file size as the primary bottleneck. | Baseline A loaded 17.9 MB early but steady frames were about 1 FPS with 1.18M active splats; `docs/SOGX_FEASIBILITY.md`. | Supported but limited to current desktop evidence |
| Phase 3 Streamed SOG LOD generation is prepared for `kaliurang`. | `scripts/convert/generate-kaliurang-lods.mjs`; dry-run report `benchmarks/analysis/kaliurang-lod-generation.json`. | Supported |
| SplatTransform is known to support `.sog` input and `lod-meta.json` output in the installed CLI. | `npx --yes @playcanvas/splat-transform --help` output during Phase 3 validation. | Supported |
| A real `kaliurang` Streamed SOG variant has been generated. | No `viewer/public/assets/scenes/kaliurang/streamed/*/lod-meta.json` exists yet. | Unsupported |
| Static budget and LOD clamp viewer modes are implemented. | `viewer/src/benchmark/config.js`, `viewer/src/main.js`, `viewer/src/benchmark/metrics.js`, and `benchmarks/configs/baselines.json`. | Supported |
| The active-splat envelope has been measured for Streamed SOG. | `benchmarks/analysis/active-splat-envelope.json` currently contains only Baseline A bundled SOG runs. | Unsupported |
| Existing saved `kaliurang` runs reach 12 FPS or higher. | `benchmarks/analysis/active-splat-envelope.json` has null thresholds for 12/18/24/30 FPS. | Unsupported |
| A new SOG-X/HomeGS binary format is justified now. | SOG-compatible baselines and experiments A-E are incomplete; no mobile data exists. | Unsupported |
| LowEndGS improves performance over PlayCanvas/SOG defaults. | No candidate-vs-baseline result exists. | Unsupported |

## Warnings

- The saved Baseline A screenshot is black and `visualSanity.nonEmptyCanvas=false`; do not use it as visual-quality evidence.
- Desktop in-app browser performance must not be reported as low-end mobile performance.
- Smoke-test files named `smoke-test-*` are collector checks, not research benchmarks.
