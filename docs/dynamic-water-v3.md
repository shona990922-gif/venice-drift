# Dynamic Water Interaction V3

**Current scope:** desktop only. Mobile adaptation and mobile acceptance are paused at the user’s request; existing quality tiers remain available without a claim of mobile readiness.

V3 adds a shared GPU disturbance layer to the established WaterThreeJS water. It does not replace its optical model, change the canal layout or introduce boat steering. The main journey enables V3; `?water=v2` retains the previous interaction path. Rain and the new manual environment remain isolated in `/environment-lab/`.

## Actual source integration

`jeantimex/threejs-water`, inspected revision `f35a700a16fe386beac997806ed4471018c93ef7`, supplies `src/water/vendor/b/Water.ts` and its ripple, wave, normal and compound-sphere shaders. Its MIT notice credits Evan Wallace and Yong Su. The solver is used directly, with integration changes outside its wave equations.

The upstream class comment is misleading: **G stores discrete velocity**, not previous height. The actual update adds a neighbour-Laplacian acceleration to G, damps it, and adds G to R. Raw channels are R height, G velocity, B normal X, A normal Z. The integration follows those actual shaders rather than copying the inaccurate channel description.

| File | Role |
|---|---|
| `DynamicRippleSystem.ts` | Actual upstream ping-pong stepping and normal reconstruction, bounded fixed ticks, cosine-drop batching, absorbing boundaries, output packing and readback. |
| `RippleWindow.ts` | 24 m square, whole-texel scrolling, world-to-UV mapping; route-based canal and bridge bounds. |
| `BoatWaterInteraction.ts` | Ten hull spheres (six on Low), old/new centres for `moveSpheres`, low-strength paired bow/stern impulses, speed response. No white decal wake. |
| `RainWaterInteraction.ts` | Local world-space streak trajectories; exact crossing of water level yields a canal-tested impact. No per-particle mesh raycast. |
| `WaterImpact.ts` | Bounded queue decouples rendering from simulation. Up to 24 drops in one pass, rather than one target pass per raindrop. |
| `v2/WaterThreeCanal.ts` | Consumes the stable output texture using the existing additive local-normal, roughness and displacement hooks. |
| `DynamicWaterDebug.ts` | Isolated height/normal/mask views, emitter/window helpers, actual GPU readback tests. Not loaded by the journey entry. |

The four original WaterThreeJS modules remain byte-identical; a test checks their hashes. Gerstner motion, micro detail, Beer–Lambert absorption, refraction, Fresnel, SSR/planar strategy and sun sparkle remain intact. Normal perturbation is inserted before reflection/refraction/Fresnel/GGX evaluation. It does not paint the water colour.

## Simulation and scale

| Tier | Grid | Tick rate | Hull spheres | Rain impacts/frame cap |
|---|---:|---:|---:|---:|
| High | 512² | 60 Hz | 10 | 8 |
| Medium | 256² | 30 Hz | 10 | 4 |
| Low | 128² | 30 Hz | 6 | 2 |

All grids cover 24 × 24 metres. Two stable substeps per tick use metre-scale wave speed (1.15 m/s) and exponential damping (0.9/s). Catch-up is capped at three ticks. Old RGBA history scrolls by exact texels as the window moves, so a wake remains at its world position. Borders absorb departing waves; the canal mask removes land propagation. Covered bridge positions reject rain, while boat waves continue below the bridge.

Float render targets use nearest filtering; the upstream half-float fallback is retained and can be explicitly exercised with `?halfFloat`. Height and normal bounds prevent runaway values. The output texture packs slope into RG, disturbance energy into B, and height into A, matching the established optical integration.

Rain radii of 5.5–9.5 cm are smaller than a Low-tier texel. They are therefore widened to at least 1.6 cells with area-corrected energy. Low uses an additional strength compensation for this coarse filtering; its measured height remains around a millimetre, far below the boat displacement. Low preserves the interaction but cannot resolve the same tiny ring detail as High. This is an explicit spatial-resolution limit, not an exact droplet-scale simulation.

Rain ramps over roughly 10 seconds and drying is slower. Switching to clear changes emission density; it never clears the existing field. Pausing the gondola likewise stops new hull displacement without erasing its wake. Explicit route jumps reset the field to avoid carrying waves across a teleport.

## Actual measurements

These measurements were made in the local Chromium-based browser, not on a physical phone. Raw records are in `docs/validation/v3/`.

At 1280 × 720, Medium, the same six-and-a-half-second sample windows measured:

| Mode | FPS | GPU mean | GPU p95 | Simulation passes/second |
|---|---:|---:|---:|---:|
| Interaction disabled | 59.99 | 8.93 ms | 13.83 ms | 0 |
| Boat | 59.99 | 8.84 ms | 13.82 ms | 226.8 |
| Boat + light rain | 60.00 | 9.35 ms | 15.89 ms | 250.6 |

The small non-monotonic mean difference is measurement noise, not a claim that adding boat simulation is faster. Draw counts vary with reflection, cubemap and shadow updates: sampled frames were 206 / 339 / 207 and about 743k–1.079M triangles. They are individual frames, not average draw counts. The boat+rain sample injected about 219 impacts/s, capped at four per render frame and batched per simulation tick.

GPU checks:

- Float32 and forced Float16 both preserve exact world-scroll alignment (maximum height error **0**) and equal-time 30/60 FPS cadence results (maximum channel error **0**).
- A moving boat generated about **1.63 cm** maximum displacement. In the daylight passenger view, **39,547 reflection pixels** changed by more than two 8-bit channel levels when only the dynamic normal contribution was toggled.
- Stopping the boat held emission count unchanged. Seven seconds later normal energy was about **0.7%** of its earlier value.
- Sunset rain produced about **0.273 mm** peak displacement and **554 changed reflection pixels**. All 32 retained impact samples lay in uncovered canal water.
- At rain switch-off, the field was retained exactly. Twelve seconds later intensity was about **0.0083**; residual waves continued to decay.

## Validation limits

The strongest measured response is in architecture reflection. Refraction is intentionally subtle over the dark, low-visibility canal bed. The isolated GGX channel at the passenger hero position has not yet demonstrated a large pixel response: city occlusion, a distant low-angle highlight and the local simulation footprint limit overlap. A separate explicitly unoccluded optical fixture measured **36,893 changed GGX pixels** (maximum channel difference 136), confirming that the normal field reaches that lighting term. This fixture uses a camera and sun aligned with the trailing field; it must not be confused with proof of a passenger-camera golden-wake hero shot. The existing reflected-sky sparkle reads the perturbed normal, but the final golden-path visual criterion remains subject to visual review.

Physical iOS Safari and a real mid-range phone have not been tested in this environment. Forced half-float and responsive viewport checks exercise code paths, not device certification. This branch is a reviewed development checkpoint, not a renewed claim that every release-candidate visual criterion is already approved.

## Controls and rollback

The lab exposes Final / Height / Normal / Mask / Reflection / Refraction / GGX, Boat and Rain toggles, base-wave and micro toggles, SSR, emitters, a manual drop, Boat Interaction Only, Rain Ripple Only, GPU numerical checks and a three-mode profile. Height/normal debug colours are amplified for inspection; this does not increase physical wave height.

The atmosphere presets are Day, Sunset and Rain. Night and Night Rain were removed. The previous stable release remains at `ab84085`; Water V2 can also be selected without changing assets using `?water=v2`.
