# Round 05 — Performance and mobile

## Measured run

`evidence/two-journeys.json` records two complete, **unaccelerated** journeys in the actual Chromium browser. Duration **689.61 seconds**, 41,372 frames, **59.99 FPS**, P95 frame time **18.60 ms**, P99 **18.70 ms**, one frame over 50 ms. There were no visibility interruptions or chunk/audio errors. This long run used 1280×720, Medium, a local production build.

- Shared texture count stayed **27** across both journeys.
- Maximum four GLB chunks resident. At the end: 27 loads, 24 disposals, three retained chunks.
- Geometry count increased during initial, lazy upload of static scenery, then remained bounded. Second-loop peak 306; third-loop sample also 306. Texture count remained 27. This is WebGL-resource evidence, not a claim of exhaustive browser-heap leak proof.
- Audio buffers remained three, active sources remained bounded; playback continued after reset.
- No adaptive reductions were needed in this run.

The timer in the long-run build covers water/reflection/main render passes; it excludes occasional environment-map refreshes. Final-build instrumentation was moved ahead of those refreshes. The frame-time data above already includes all work.

Final-build 1920×1080 daylight snapshot: **59.86 FPS**, **11.29 ms mean GPU / 12.95 ms P95**, 229 average draws and 926,642 triangles across render passes. These are measured at the first bridge, not a claim that every possible device sustains 60 FPS. Additional final viewport captures are stored alongside this document.

## Changes

- Shared JPEG download size reduced 14.12 MB → 6.65 MB without reducing desktop map dimensions. Low receives 1K plaster derivatives, reducing estimated uncompressed PBR texture residency from 128 MiB to 80 MiB including mipmaps.
- Far silhouettes do not cast shadows. Chunk updates are distance-throttled, preserve the selected quality after asynchronous loading, preload ahead and release retired geometry.
- Terrace light count remains constant, with zero distant intensity, avoiding a new light-count shader variant at the hero area.
- Medium/High main HDR target uses 2× MSAA. Low avoids that cost. Unused main HDR depth texture removed.
- Sustained pressure reduces pixel ratio in 0.06 steps, then reflection, shadows and far detail. Display caps and short loading spikes are tested. Boat interaction remains enabled.
- Final teardown disposes shared scene assets; loading failures retain silhouettes or neutral textures. Audio and Fullscreen failures do not block the journey.

## Limits

Mobile viewport and touch-event checks run on the desktop GPU. No physical mid-range phone or Safari result is claimed. Actual handset testing remains a release-review recommendation. The release does not include KTX2 textures; measured budgets do not justify adding another decoding pipeline at this stage.

Final Low-tier 390×844 viewport (331×717 render buffer): 60 FPS on the desktop GPU, 6.35 ms mean GPU / 10.15 ms P95, 166 average draws, 535,864 triangles. Paired-render verification still detects 169 changed reflection pixels and 3,225 changed final-composite pixels; after 10 seconds, disturbance energy is 0.087% of the stopped-boat sample. Final browser-dispatched touch test independently advances the boat 2.343 m while changing yaw/pitch and preserves the view after release.

Hardware: Apple M2 MacBook Air, 8 GB RAM. Desktop and viewport-emulation measurements use this same host. Final responsive checks also cover 1366×768 laptop, 820×1180 tablet-like and 844×390 landscape viewports; controls remain within the viewport.

High-tier laptop test also remained at approximately 60 FPS with the full 512 simulation grid and 1024 reflection target; exact final snapshot is `evidence/high-tier-1707x960.json`. Low uses no MSAA; Medium and High retain 2× MSAA on the main HDR target. The six active custom water/main render targets are separate from environment-map/shadow allocations. Five upstream post-process target objects are retained at 1×1 and unused; the report does not present the count as a total VRAM measurement.
