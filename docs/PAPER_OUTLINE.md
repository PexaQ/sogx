# Paper Outline

Working title: LowEndGS: Budget-Adaptive Streamed Gaussian Splatting for Low-End Mobile Web Devices

Last updated: 2026-06-05

## Draft Abstract

3D Gaussian Splatting enables photorealistic scene reconstruction and real-time rendering on desktop-class hardware, but practical browser deployment on sub-$200 mobile phones remains constrained by weak GPUs, limited memory, unstable networks, and inconsistent WebGPU availability. LowEndGS studies whether a PlayCanvas/SOG-based pipeline can make large Gaussian Splat scenes interactive on low-end Android browsers through low-end-focused offline optimization and runtime adaptation. The method combines Streamed SOG generation, route-aware pruning and LOD preparation, coarse-first loading, dynamic splat budgeting, adaptive render resolution, and contribution culling. We evaluate against bundled SOG and default Streamed SOG baselines using fixed camera routes on low-end Android devices, measuring frame time, first visible frame, memory, downloaded bytes, active splats, chunk behavior, and visual artifacts. Results will be filled in only after reproducible experiments are complete.

## Contributions

- A reproducible benchmark harness for low-end mobile Gaussian Splat rendering in the browser.
- A device-adaptive Streamed SOG runtime controller for splat budget, LOD, contribution culling, and render resolution.
- An offline low-end-focused SOG/LOD optimization pipeline.
- An empirical comparison against PlayCanvas/SuperSplat default SOG and Streamed SOG baselines.
- Optional: a hybrid fallback for ultra-low-end property-tour devices.

## Section Plan

1. Introduction
   - Problem: photorealistic 3DGS is hard to deploy on cheap mobile web devices.
   - Key distinction: compression is necessary but not sufficient; runtime smoothness, memory, and network behavior matter.
   - Narrow novelty statement.

2. Related Work
   - 3D Gaussian Splatting foundations.
   - Compression and pruning: LightGaussian, EAGLES, compressed 3DGS/VQ, Mobile-GS.
   - LOD and large scenes: Hierarchical 3D Gaussians, LODGE, Octree-GS, CityGaussian, CLoD-GS, Matryoshka GS.
   - Web/browser renderers: PlayCanvas SOG/Streamed SOG, PlayCanvas WebGPU/WebGL renderers, WebSplatter.

3. Method
   - Baseline ecosystem: PlayCanvas SOG and Streamed SOG.
   - Offline pipeline: cleanup, SH reduction, simple LOD, visibility-aware decimation.
   - Runtime controller: frame-time controller, network-aware LOD unlock, DPR and budget policy.
   - Ultra-low fallback if implemented.

4. Benchmark
   - Devices, browsers, scenes, dataset licenses.
   - Metrics and route protocol.
   - Visual quality protocol.
   - Reproducibility scripts and logs.

5. Results
   - Baseline table.
   - Candidate tables.
   - Pareto comparison.
   - Case studies and artifacts.

6. Discussion
   - What improved the Pareto frontier.
   - What failed.
   - WebGPU vs WebGL2 behavior.
   - Production settings.

7. Limitations
   - Device coverage.
   - Browser memory observability.
   - Dataset generality.
   - Training-free offline optimization limits.
   - Visual metric limitations.

8. Conclusion

## Claim Discipline

- No result belongs in the abstract until it exists in `benchmarks/results/`.
- Every related-work claim must cite `docs/LITERATURE_MATRIX.md`.
- Every performance claim must cite a run ID and raw log.
