# Format Proposal

Last updated: 2026-06-06

Status: no new format is justified yet.

This document intentionally does not define a final SOG-X/HomeGS/RouteGS/HGS format. The current evidence suggests the bottleneck is active splat rendering workload, not primarily SOG file size. A new format should only be proposed after SOG-compatible experiments fail to move the Pareto frontier.

## Decision Gate

Do not implement a new format until all are true:

- Baseline B Streamed SOG exists for the same real scene as Baseline A.
- Route-aware LOD beats naive decimation or is rejected with evidence.
- SH0/SH-tier variants are benchmarked.
- Zone/chunked SOG or Streamed SOG is benchmarked.
- Preview/impostor startup is benchmarked.
- Android Chrome results exist.

## Candidate Direction If Justified

Working name: HomeGS or SOG-X.

Possible file structure:

```text
scene.homegs.json
preview/
  route-start.webp
  optional-cubemap-*.webp
sog/
  base/
    lod-meta.json or scene.sog
  zones/
    zone-000/lod-meta.json
    zone-001/lod-meta.json
sidecars/
  importance.bin or importance.json
  route.json
  zones.json
  sh-tiers.json
```

Compatibility:

- Prefer PlayCanvas-compatible SOG or Streamed SOG payloads for actual splat rendering.
- Use sidecars to drive loading policy, route-aware LOD choice, and zone selection.
- Avoid custom SOG decoding unless PlayCanvas cannot express the required progressive behavior.

Decoder complexity:

- Initial SOG-X should be a manifest plus existing PlayCanvas assets.
- Browser-side decoder complexity should stay near zero.
- Any binary sidecar must be optional and independently cacheable.

Browser support:

- Must work in Chrome/Android and WebView with WebGL2.
- WebGPU may improve performance but cannot be required.

Mobile GPU memory layout:

- Keep active PlayCanvas GSplat assets small by zone/LOD.
- Avoid loading high-detail distant zones.
- Track active splats, JS heap, bytes, and renderer path.

Progressive loading behavior:

1. Show preview/impostor.
2. Load coarse route-relevant splats.
3. Load nearby/current-zone high-detail splats.
4. Defer higher-order SH or distant zones until frame time allows.

Fallback behavior:

- If WebGPU unavailable, use WebGL2 path.
- If frame time remains above target, keep preview/distant impostor and reduce active zones.
- If memory pressure or context loss occurs, fall back to coarse SOG/preview.

Migration path from SOG:

- Start from source PLY where possible.
- Generate standard bundled/streamed SOG assets with SplatTransform.
- Generate sidecar manifests and route/zone metadata.
- Preserve normal SOG assets so existing PlayCanvas viewers can still load the scene.

Risks:

- Sidecars may duplicate existing Streamed SOG LOD functionality.
- Route-aware layouts may overfit fixed property walkthroughs.
- Zone splitting may create visible seams or popping.
- SH tiering may require changes that are not SOG-compatible.
- Preview startup can improve perceived latency but not real splat-rendering FPS.

## Current Recommendation

Build a SOG-compatible HomeGS system first: manifest, preview, route metadata, Streamed SOG assets, and optional sidecars. Revisit a real new binary format only if this fails and benchmark evidence points specifically to SOG payload layout or decode behavior as the bottleneck.
