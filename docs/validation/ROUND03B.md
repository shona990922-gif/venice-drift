# Continuous daylight → evening environment

The passenger journey drives a single environment controller. Sun direction is shared by direct light, the source WaterThreeJS sky, planar reflection, GGX highlights and water glitter. The source optical absorption and teal water body are unchanged. The sunset extension changes atmosphere radiance, cloud illumination, exposure and gradually illuminated windows/lanterns; it is not a screen LUT.

Environment tests verify a constant daylight baseline through 43% of the journey, continuous sun/exposure, staggered light increase and solar clearance over the hero arch.

Actual 1280×720 sunset GPU readback, 2026-10-07:
- 59.95 FPS; 9.73 ms GPU mean, 14.90 ms p95.
- 157 draw calls, 738,153 triangles across all passes.
- Disabling just the local boat disturbance at the same camera/time changed 41,151 reflection pixels and 13,506 final composite pixels above 2/255.
- Peak local height after stopping: 1.019 cm; after 10 seconds: 0.0153 cm.
- Remaining squared-height energy: 0.0790%; emitter count stayed exactly 216 after stopping.
- No scene-loading errors.

Evidence: local `qa/sunset-wake-1791311621484.json`, passenger hero capture `qa/journey-381-1791311659186.png`. The main journey remains five minutes 34 seconds. Art refinement of the foreground terrace and skyline continues in Round 03C; rain is not part of this milestone.
