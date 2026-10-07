# Gondola contact visibility

The existing GPU heightfield was active, but its tip emitters sat inside the
visible hull and its displaced-volume scale was too restrained to read clearly
from the passenger seat. This pass keeps the WaterThreeJS optical shader and all
colour, absorption, Fresnel, reflection and refraction settings unchanged.

- Place the bow source at +5.18 m and stern source at -4.95 m, just beyond the
  BoatVisual tips. Retain ten compound hull samples and the upstream solver.
- Increase the compound-volume scale from 0.045 to 0.10 (the upstream pass itself
  applies a further 0.1 factor). The side interaction setting now controls drag.
- Use balanced 7 mm bow / 4.5 mm stern source pairs, spaced every 24 cm travelled.
  Preserve the fractional distance and interpolate source positions so rendering
  at 30 or 120 Hz leaves the same trail. Speed still scales strength.
- Interpolate the display height/normal texture where supported to avoid stepped
  highlights. Solver textures retain nearest filtering, and unsupported float
  filtering retains its fallback.
- No foam, painted wake ribbon, new water colour, added simulation pass, camera
  change, or map change.

## Runtime checks

Use `?quality=high&debug=1&qa=1`, select a waterline view and run **验证尾流**.
The test travels at normal pace, stops, compares the same frame with dynamic
height/normals enabled and disabled, then checks decay and emission counts.
The render toggle leaves simulation history intact. All controls remain hidden
in the normal journey.

Captured browser evidence is in `showcase/boat-water/`:

- `bow-on.png` / `bow-off.png`: final daylight A/B, same frame and camera.
- `bow-motion.mp4`: final daylight passenger recording.
- `wake-motion.mp4`: earlier rear-facing recording from this tuning pass.
- `validation.json`: original baseline and bow/side/stern/daylight measurements.

The final daylight check measured a 0.02915 m peak 0.9 seconds after stopping,
falling to 0.000613 m after another ten seconds. No new emissions occurred during
the stop. The composite A/B differed by more than two channel levels in 74,665
pixels; reflection-only also responded. Earlier side and rear checks passed.
These image differences verify optical coupling, not photorealism by themselves;
the actual captures and recordings were also inspected.

Runtime performance varied with host load and adaptive resolution, so the stored
FPS samples are observations rather than a controlled before/after benchmark.
No additional render target or simulation pass was introduced. There were no
browser errors; the pre-existing sky PMREM sample-limit warning remains.

Validation: lint, TypeScript, production build, and all 34 tests passed. A first
full test run under active rendering hit the existing exhaustive route-test time
limit; after closing the temporary rendering tab, the unchanged suite passed in
16.57 seconds. The route timeout and test assertions were not loosened.

This remains a lightweight heightfield approximation of hull contact, not CFD.
