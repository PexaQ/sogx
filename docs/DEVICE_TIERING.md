# Device Tiering

Last updated: 2026-06-06

Per local project guidance, device tiers should be based on measured rendering capability, not price alone.

## Draft Tiers

| Tier | Definition | Evidence Required |
| --- | --- | --- |
| Failing baseline | Device cannot sustain target FPS under Baseline A or Baseline B. | Real Chrome/WebView result JSON with p95 frame time and failure state. |
| Low capability | Device sustains 24 FPS only after quality reductions. | Baseline and candidate result pairs. |
| Mid capability | Device sustains 24 FPS under baseline but may not sustain 30 FPS. | Baseline result. |
| High capability | Device sustains 30 FPS under baseline. | Baseline result. |

No real mobile device has been tiered yet.
