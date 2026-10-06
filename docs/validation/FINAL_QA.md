# Release candidate QA

Date: 2026-10-07. Host: Apple M2 MacBook Air, 8 GB RAM. Browser: Codex Chromium in-app browser.

## Passed

- Continuous 499.73 m authored route, five sections, three distinct open bridge passages. Automated swept rays test both façades and nearby moored boats, poles, terrace and bridge scenery.
- Two full real-time journeys; supplementary third-loop resource sample. See `ROUND05.md` for the measured data and its limits.
- Mouse drag and browser-dispatched touch events; independent route advance, damping, pitch limits, unlimited yaw and no automatic recentering.
- Actual Day, Golden Hour, Sunset and bridge screenshots. Shared sky/sun/water directions and stable lit-window identifiers.
- Final 1080p paired renders: 100,112 reflection pixels and 64,365 composite pixels respond to local water disturbance. Peak sampled height 0.978 cm; after ten stopped seconds, energy remaining 0.0794%. Emission count does not increase while stopped.
- Low-tier paired renders also pass, with 256 reflection / 128 interaction targets. See `mobile-low-wake.json`.
- Normal audio, mute, bridge/section gains and repeated playback across loops. Recorded app audio has no clipping. It uses no microphone or screen-share permission.
- Final end transition keeps the boat moving, resets only at full fade, then reveals the new journey. Verified with actual recording `evidence/final-loop.webm`; representative frames were inspected before and after reset. This final small correction follows the long-run performance baseline.
- Missing-plaster-texture fault injection uses a neutral fallback and visible non-blocking notice; the route and water continue. See `missing-texture-fallback.json`.
- Desktop 1920×1080, laptop 1366×768, tablet-like 820×1180, portrait 390×844 and landscape 844×390. Safe-area insets are honored. All permanent controls remain within the viewport.
- Vendored source hashes, quality degradation ordering, reflection clipping math, route acceleration and collision checks pass. Lint and strict TypeScript check pass; production build succeeds.

## Platform limits

- Mobile tests are viewport and touch-event emulation on the desktop GPU. No physical-phone 30 FPS claim is made.
- Safari native testing was attempted, but the Mac was locked and native UI access could not proceed. Safari remains unverified; no lock-screen bypass was attempted.
- GPU timing uses actual disjoint timer queries when available; unsupported browsers display unavailable values. Texture memory is an explicit uncompressed-map estimate, not driver-reported total VRAM.

Normal URLs hide every debug control; the normal 844×390 entry page was visually inspected and Start Journey remains within the viewport. Fullscreen capability checks and failure notices are retained because the embedded browser does not establish native fullscreen coverage. Fault injection and diagnostics require an explicit debug query. All release media in `showcase/` is captured from the running app, with no image-generation or retouching step.
