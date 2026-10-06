# ROUND 02.5 acceptance · 2026-10-06

Scope: bow pressure/ripples, hull-side disturbance and world-space stern history. No changes to the accepted ROUND 02 city, route, camera, body colours or PlanarReflection renderer.

## Actual browser results

Chrome 153.0.8010.55, Mac hardware acceleration / Metal, headless, no recording or encoding during the performance sample.

| Test | Desktop High | Touch emulation Low |
| --- | --- | --- |
| Viewport / pixel ratio | 1920 × 1080 / 1 | 390 × 844 / 1 |
| Sampled frames | 599 | 359 |
| Mean FPS | 60.00 | 60.00 |
| 95th percentile frame interval | 16.8 ms | 16.7 ms |
| Draw calls in measured segment | 226–252 | 170–172 |
| Triangles across all passes | 914,511–1,099,818 | 690,002–720,218 |
| Planar reflection | 1024², every frame | 256², every other frame |
| Wake mask | 256², ~30 Hz | 256², ~30 Hz |
| Wake update p95 CPU time | 6.6 ms per update | 7.4 ms per update |

Counts include reflection and shadow passes, not only visible scene geometry. Mobile is browser touch emulation on the same Mac, not physical phone performance. The new interaction adds one texture and no draw calls or triangles.

Mouse drag changed yaw by 0.607 rad while the boat travelled another 2.00 m. Actual touch events changed yaw by 1.147 rad while it travelled another 2.32 m. No console or page errors.

Same-frame off/on colour-buffer comparison: 7,067 bow pixels, 3,066 side pixels and 7,696 stern pixels changed by more than 2/255 in a channel. These occupy 0.15–0.37% of the full desktop frame. No pixels changed in the top quarter containing buildings/sky. Low portrait side view has a small visible region: 52 changed pixels. These comparisons confirm local reflection response; they are not a substitute for judging the continuous ride visually.

On a debug stop, 59 prior samples remained briefly; after 10.3 seconds the field was exactly neutral again. Unit tests verify old samples stay at their world positions through turns and that a reset does not paint a connecting streak.

## Evidence and validation

- 12 / 12 tests passed across journey and interaction suites.
- TypeScript and production Vite build succeeded.
- `ACCEPTANCE-ROUND025.json` contains raw measurements and snapshots.
- Delivery folder `round025-evidence/` contains direct WebGL screenshots, paired off/on images and `water-interaction.mp4`, a continuous real browser recording using mouse gestures.
- Original reference module execution and shader adaptation details: `RESEARCH.md`.

## Tuning

`src/water/BoatWaterInteraction.ts`: .24 m emission interval, 10 s life, .28 m/s outward spread, .20→.37 m soft ridge width over lifetime, 36 m field span. Samples come from the stern, not the camera. `CanalWater.ts`: bow pressure and spreading arcs, narrow tapered side band, local normal and projective-reflection UV response. No white tint/foam, no ocean displacement, no full fluid solver.
