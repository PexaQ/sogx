# AGENTS.md

## Project

StreamFitGS: Performance-Adaptive Gaussian Splat Streaming for Commodity Mobile Web Devices.

We are building a research prototype that makes PlayCanvas / SuperSplat / SOG / Streamed SOG Gaussian Splat scenes run better on commodity mobile browsers.

## Core rule

Do not define target devices by price. Define them by measured rendering capability.

A target device is one that fails to sustain the target frame rate under baseline PlayCanvas/SuperSplat SOG or Streamed SOG settings.

## Target platform

Primary:
- Android Chrome
- Android WebView
- WebGL2
- WebGPU when available, but never required
- 4 GB to 8 GB RAM commodity devices
- thermally constrained mobile GPUs

Secondary:
- high-end phones and desktop only for comparison

## Research integrity

- Do not fabricate citations.
- Do not fabricate benchmark numbers.
- Do not claim we invented SOG.
- Do not claim we invented LOD streaming.
- Do not hide failed experiments.
- Every claim must map to a source, experiment, or explicit hypothesis.

## Required docs

Maintain:

- docs/RESEARCH_LOG.md
- docs/LITERATURE_MATRIX.md
- docs/BASELINE_NOTES.md
- docs/DEVICE_TIERING.md
- docs/EXPERIMENT_PLAN.md
- docs/IMPLEMENTATION_NOTES.md
- docs/PAPER_OUTLINE.md
- docs/RESULTS_SUMMARY.md
- docs/OPEN_QUESTIONS.md
- docs/CLAIMS_AND_EVIDENCE.md

## Benchmark metrics

Measure:

- average FPS
- p50/p95/p99 frame time
- first visible frame time
- time to acceptable quality
- active splat count
- splat budget
- render scale
- DPR
- loaded chunks
- bytes downloaded
- JS heap memory where possible
- renderer backend
- visible artifacts
- crashes or tab reloads

## Candidate methods

Prioritize:

1. Adaptive splat budget
2. Adaptive render scale / DPR
3. Adaptive LOD range
4. Coarsest-LOD-first startup
5. Motion-aware quality
6. Network-aware stream scheduling
7. Visibility-aware offline decimation
8. Hybrid fallback for severely constrained devices

## Definition of done

A task is done only when:

- code builds, or failure is documented
- benchmark or test has been run where relevant
- results are saved under benchmarks/results
- docs/RESEARCH_LOG.md is updated
- docs/CLAIMS_AND_EVIDENCE.md is updated for new claims
- docs/RESULTS_SUMMARY.md is updated for benchmark results

## Style

Prefer simple measurable code over clever abstractions.
Keep experimental flags configurable.
Separate benchmark logging from rendering logic.
Separate debug HUD from controller logic.
Preserve reproducibility.
