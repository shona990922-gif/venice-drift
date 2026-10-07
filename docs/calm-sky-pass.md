# Calm sky refinement

The sky now prioritises a stable photographic composition over visibly active cloud animation. It still uses the installed `@takustaqu/atmosphere` implementation and its original cloud shader.

- The upstream `StateAnimator` exposes separate integrated translation and shape-evolution rates. Translation now runs at 10% of the original rate, shape evolution at 2.5%. Seeds remain unchanged; weather and solar interpolation keep the same 3.2-second time constant. Cinematic time changes do not accelerate the cloud field.
- Day uses restrained cirrus plus scattered cumulus. Sunset retains the warm horizon and cool upper sky, with less dense altocumulus. Rain remains available; night remains excluded.
- Desktop sky faces increase from 128 to 256 pixels. Steady skies publish completed cubes about every 0.9 seconds, with continuous per-frame interpolation; active weather transitions use 0.4 seconds. Individual face renders are spread through that interval. Initial blending is primed without a long stationary interval, and floating-point fade endpoints snap cleanly.
- The existing solar glare is narrowed to half its angular extent in the adapter, keeping the source scattering halo and sunlight. Vendor sources, WaterThreeJS optical parameters, route, camera behaviour and audio are unchanged.

Validation: lint, typecheck, production build and all 31 tests pass. Regression tests compare the actual upstream animator rates, verify unchanged lighting/weather response, preserve cloud phase across preset changes, and check complete-cube publication and continuous blending at reduced bake frequency.

The actual GPU sky audit also passes: Day, Sunset transition and Rain transition each update on all 120 measured frames, with zero held frames and at most one expensive face render per frame. Day's mean per-frame pixel difference is 0.00000388, versus 0.00005490 before this refinement (about 93% less change in this fixed-camera sample). These are content-continuity measurements, not a guarantee of rendering at 60 FPS. See `validation/calm-sky/motion.json` and the actual captures in `showcase/calm-sky/`.

The source folder is managed by cloud storage. Two evicted HDR reference files timed out during the first build. They were restored from their recorded Poly Haven URLs and verified against the existing SHA-256 manifest. Final validation ran from a local cache containing the same source; hashes of all changed source files were compared before copying the successful build back to `dist/`. No asset, license or test timeout was changed to bypass this issue.

Deployment and GitHub publication remain paused while the user reviews this refinement.
