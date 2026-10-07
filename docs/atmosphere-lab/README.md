# Manual atmosphere lab

**Current scope:** desktop only. Mobile adaptation and mobile acceptance are paused at the user’s request; existing quality tiers remain available without a claim of mobile readiness.

Entry: `/environment-lab/`. This remains separate from the established journey environment. Presets: **Day, Sunset, Rain**. Night was removed at the user's request; neither Night Rain nor an automatic descent into darkness is exposed.

## Source and module map

Inspected and ran the upstream manual controller from `takustaqu/atmosphere`, commit `92b6b6f69f4399597851d32af4abe4bb3bede81e`, npm `0.3.2`. The source's evaluated `FRAG` and noise lattice are retained in `src/environment/vendor/atmosphere/`; recorded hashes are in `source-manifest.json`.

| Module | Responsibility |
|---|---|
| `src/environment/lab/AtmosphereSky.ts` | Adapts the real fragment shader to world-space cubemap rays, retaining its cloud genera and sky shading. Removes the source display transform so linear HDR reaches the existing WaterThreeJS ACES post pass exactly once. Renames GLSL identifiers reserved by WebGL2; vendor files remain unchanged. |
| `src/environment/lab/ManualEnvironment.ts` | Uses upstream `StateAnimator` and `celestialLights`; shares sun direction, light colour, cubemap, IBL, fog, lamps and wetness with the city and water. |
| `src/environment/lab/presets.ts` | Three editable presets, explicit sun elevation/azimuth, moderate rain and bright sunset fill. |
| `src/environment/WeatherController.ts` | About ten seconds to settle into light rain, slower drying, no ripple-texture reset. |
| `src/environment/lab/ReferenceSky.ts` | Lazy-loads original CC0 HDRIs in the same scene-linear/ACES/sRGB chain. |
| `src/environment/lab/main.ts` | Independent entry, controls, captures, numerical GPU checks and quality comparisons. |

This library provides an **art-directed procedural sky**, not a Hillaire-style physical scattering model. No claim of physical atmospheric radiometry is made.

The lab cubemap is 256² per face on High/Medium and 128² on Low; the formal journey uses 128². Three targets keep both displayed frames immutable while one face of the next cubemap is rendered per animation frame. Completed frames are interpolated every frame, with a sun-centred reprojection to avoid a stepping or doubled solar disc. The sky dome and water fallback share that exact lookup. IBL work runs on cube publication frames and reuses its allocated target; steady-state refresh is reduced to every five seconds. The existing WaterThreeJS optical model, body colour and absorption coefficients remain unchanged. Only its environment lookup and light multipliers follow the new sky. The source's lens droplet effect is disabled; actual world-space rain particles feed water impacts instead.

## Colour references and cloud decision

Viewed Venice Sunrise, Venice Sunset and Twilight Sunset in the running lab, including the opposite horizon. These informed **qualitative** comparisons: cool upper sky, pale warm horizon, restrained sunset colour, visible façades and blue-green water. This is not numerical HDR colour matching. Sunset is held at +5.5° with brighter ambient fill; the optional twilight study stops at -1° and remains readable.

`CK42BB/procedural-clouds-threejs` was inspected as a collection of implementation guidance/shader examples, not a drop-in compatible renderer. The current source already supplies several cloud genera. A second cloud system is therefore not added: it would duplicate lighting and reflection work before demonstrating a visual improvement.

## Scope

The manual controls, reference viewer, light rain, wetness and rain audio remain in the lab. The formal journey continues to use its existing cinematic Day → Golden Hour → Sunset environment. No map, route or driving interaction was changed. See `../dynamic-water-v3.md` for the shared water interaction layer and actual measurements.
