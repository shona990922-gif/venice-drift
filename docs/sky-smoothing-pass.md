# Sky motion smoothing

The previous atmosphere cache updated all six cubemap faces every 0.3 seconds and replaced the displayed sky immediately. Sun and cloud motion therefore visibly stepped at about 3.3 updates per second.

The existing atmosphere shader now renders one cubemap face per animation frame into a third buffer. Only complete cubes are published, and the two completed frames blend continuously. Sun-centred reprojection keeps the solar disc aligned with the live sun direction during that blend. The sky display and water reflection use the same sampling uniforms. Environment lighting reuses its PMREM target and updates separately; shadows refresh independently at 30 Hz. Water optical parameters and vendor atmosphere code are unchanged.

## Validation

- GPU pixel audit: Day, Sunset transition and Rain transition each changed on all 120 measured frames; 360/360 total, zero held frames, maximum one atmosphere face rendered per frame. See `validation/sky-smoothing/motion.json`.
- These are fixed-step content-continuity measurements, not a claim of 60 FPS rendering.
- Actual High passenger-view capture: 39.9 FPS at capture time; GPU mean 11.1 ms, p95 20.9 ms, 251 draw calls, adaptive framebuffer 1216 × 684. A later live sample reached 52.3 FPS. Overall frame rate remains variable on this host; see `validation/sky-smoothing/journey.json` for the saved snapshot.
- Runtime error list empty. Lint, all 28 tests, production build and whitespace validation passed.
- A 12-second real passenger-view Day → Sunset recording is saved at `showcase/sky-smoothing/transition.mp4`. Inspected frames retain one sun, continuous sky colour and intact canal reflections.

The debug-only “天空流畅度检查” button runs the GPU audit. Its readback cost is excluded from the normal journey performance sample. No mobile or night work was included.
