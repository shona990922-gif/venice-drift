# Desktop controls, ambient audio and look stability

2026-10-07. Scope: the existing automatic journey. No map changes, night mode or mobile work.

## Delivered

- Permanent Weather and Boat speed selectors. Weather offers Auto light, Day, Sunset and Light rain; pace offers Stopped / Slow / Normal / Brisk. Route following and bridge slowdown remain automatic. W cycles weather, V cycles pace, Space stops/resumes the last moving pace. Canvas pointer-down restores keyboard focus without intercepting native form controls.
- Formal journey reuses the tested takustaqu atmosphere adapter. Auto light retains a continuous journey time curve. Manual changes blend over approximately 10 seconds; rain particles, water impacts, wetness and sound follow the same state. Switching weather does not reset the heightfield. Quality reload preserves the weather, pace, actual speed, distance and look direction.
- Replaced the close burbling canal loop with a softened derivative of the existing CC0 distant Venice waterclaps recording. Water mix is reduced from 0.42–0.50 to 0.17–0.205 before speed attenuation; 1.5 kHz low-pass and offline transient compression soften close texture. Wood accents are reduced from 0.035 to 0.006. Rain shares the master mute. No new external asset or licence was introduced.

## White-screen investigation

The intermittent whole-screen white failure was **not reproduced in the baseline** (288 poses); the exact original trigger therefore remains unconfirmed. Inspection found three unsafe numerical paths and these are now guarded:

1. Reject singular oblique near-plane clipping before modifying the mirror projection.
2. Check projected W, bounds and reflection validity; fade missing reflection samples into the shared sky instead of stretching the render-target border.
3. Clamp invalid/extreme radiance before half-float output and ACES; skip the disabled bloom read. Restore camera layers and water visibility in a `finally` block.

WaterThreeJS vendored modules and water colour / absorption parameters are unchanged. These are integration protections, not a replacement optical model.

## Actual browser evidence

See `validation/desktop-controls/` for raw JSON and `../showcase/desktop-controls/` for actual rendered PNGs. Each look sweep covers 168 extreme/grid poses and 120 continuous yaw/pitch poses. The final settled Day-under-bridge, Sunset and Rain sweeps total 864 poses and use the stricter RGB > 230 near-white threshold; the initial baseline/day sweeps used > 247. No sweep reached the 80% whole-screen failure threshold. The bridge-transition result records the actual sun elevation, not just the requested preset name.

Verified through the desktop UI: all weather/pace choices, W / V / Space, smooth stopping to zero speed, restarting without steering, quality reload retaining settings, actual rain impacts and audio decoding/playback. The rain snapshot records ~1.006 m/s Slow pace, 6,419 rain impacts, 3 loaded audio buffers, a running AudioContext and nonzero RMS. Fresh browser console reported no errors. Acoustic processing and playback were checked; this does not claim a human listening-panel evaluation.

Production build and lint passed. The final full suite passed **25/25 tests in 9.56 s**. Earlier runs hit wall-clock timeouts in exhaustive route/collision checks while host load averages exceeded 40. Static fixture bounding boxes now reject irrelevant facade batches before ray/triangle intersection, preserving every ray and assertion; no timeout was increased and no assertion was removed. Performance snapshots from this busy session are retained as observations, **not a 60 FPS certification**. No physical mobile or Safari validation was performed in this pass.
