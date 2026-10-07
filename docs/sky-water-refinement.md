# Sky and water refinement — 7 October 2026

The existing atmosphere and WaterThreeJS optics remain the rendering foundation.
This pass adds sunset colour separation and cloud detail, brighter sunny lighting,
fine surface glints and coordinated sunlight occlusion during rain. No route,
building, camera, absorption, refraction or heightfield-simulation changes.

## Appearance

- **Sunny** replaces the ambiguous “Day” label. Cloud cover is 0.34 with more
  cumulus and some altocumulus; wind/evolution remain at the previously approved
  slow rates. Exposure 1.12, environment intensity 1.5 and visibility 55 km
  improve daylight readability without recolouring the water.
- **Sunset** retains a blue/lavender upper sky with peach broken cloudlets and
  a golden horizon. The adapter calibrates the existing granular cloud model;
  it does not replace the sky with a screen overlay or generated image.
- The reflected sun and GGX highlight use the same capillary + boat normal.
  Low-elevation attenuation is gentler and highlight roughness transitions
  continuously. Water body colours and Beer–Lambert coefficients are unchanged.
- **Light rain** fades direct sunlight using one shared visibility function.
  Sky disc/halo, city sunlight and water direct glints reach zero together.
  Environment lighting, city lamps and their water reflections remain visible.
- High desktop sky cubes are 384px per face (formerly 256); amortised complete
  cube blending and slow cloud motion are unchanged. No new render passes.

## Actual local verification

Source and production build were checked on Chromium through the local preview.
The test suite passed 35/35, lint passed, and production build/typecheck passed.
Upstream WaterThreeJS source hashes still match the source manifest.

At the hero canal, captured High-tier samples:

| View | FPS | Mean GPU | p95 GPU | Render buffer | Draw calls |
| --- | ---: | ---: | ---: | --- | ---: |
| Sunny | 60 | 11.28 ms | 13.26 ms | 1600 × 900 | 248 |
| Sunny, hull-side glints | 60 | 10.76 ms | 13.91 ms | 1600 × 900 | 152 |
| Light rain | 60 | 10.48 ms | 13.81 ms | 1600 × 900 | 258 |
| Sunset, after camera stress check | 48.5 | 12.49 ms | 23.29 ms | see snapshot | see snapshot |

These are local samples, not cross-device performance guarantees. The camera
stress check forced synchronous framebuffer reads and reduced adaptive pixel
ratio; its frame timing is not normal journey performance. Before/after captures
also differ in cloud phase and adaptive resolution, so they are visual references,
not a controlled benchmark.

- 288 camera poses: no white frames; all camera matrices finite.
- Sunset boat check: 125,482 reflection pixels changed with ripple enabled,
  75,992 final-composite pixels changed. Residual wave-energy ratio after decay
  was 0.000829; emission count stayed 222 after stopping. Check passed.
- Rain: sky sun visibility = 0, direct-light intensity = 0,
  water direct-light multiplier = 0. Rain impacts and lamp reflections continued.
- No browser rendering errors. Existing startup PMREM blur warnings remain
  unrelated to this pass; no source assets or new dependencies were added.

Actual canvas captures and machine-readable snapshots are in
`showcase/sunset-refinement/`. The short sunny-glitter capture is in local `qa/`.
For publishing and rollback instructions, see `docs/DEPLOYMENT.md`.
