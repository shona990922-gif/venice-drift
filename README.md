# Venice Drift

**Current scope:** desktop only. Mobile adaptation and mobile acceptance are paused at the user’s request; existing quality tiers remain available without a claim of mobile readiness.

A slow gondola journey through a composed Venetian canal district. Settle into the passenger seat, look around, and let the city move past. Daylight gradually becomes golden hour and sunset; the boat disturbs reflected architecture and the sun's path across the water.

## Run

Requires Node.js **22.13+** or **24+**, npm, and a browser with hardware-accelerated WebGL2 and floating-point render targets.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5188/`. All runtime assets are local; no account, API key or remote service is needed.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

The release output is **`dist/`**. Preview it at `http://127.0.0.1:4188/`. Serve the directory over HTTP(S), rather than opening `index.html` as a local file. Relative asset URLs support deployment beneath a subdirectory. No deployment or remote push is performed by these commands.

## Experience and controls

- Start Journey begins the automatic ride and permits ambient audio.
- Hold and drag the mouse, or swipe with one finger, to look freely. The boat follows its route automatically; releasing the pointer does not recenter the view.
- Weather: Auto light (journey progression), Day, Sunset or Light rain. Changes blend gradually, without resetting the route or water field. There is no Night option.
- Boat speed: Stopped, Slow (~1 m/s), Normal (~1.55 m/s) or Brisk (~1.94 m/s), with smooth acceleration and automatic bridge/turn slowdown. This changes pace, not direction.
- Desktop shortcuts: **W** cycles weather, **V** cycles pace, **Space** stops/resumes. Shortcuts do not intercept focused form controls.
- Sound, Quality and Fullscreen remain available. Sound preference is stored locally when browser storage is available. Water audio uses a softer, distant CC0 Venice field recording; light rain follows the weather and the same mute control.
- Quality changes preserve weather, pace, journey position and viewing direction across the brief renderer reload.
- The route is **499.73 m**, approximately **5 minutes 34 seconds**, with five sections and three different stone/brick bridge passages. A seven-second gradual fade overlaps continued boat motion and returns to the beginning. This is an open route with a covered reset, not a geometrically seamless closed loop.

The composition is inspired by Venice; it is an authored district, not a surveyed replica of a particular real canal.

## Water and environment

Three.js, TypeScript, Vite and WebGL2 power the scene. WaterThreeJS's original Gerstner spectrum, micro surface detail, optical depth, Beer–Lambert absorption, refraction, Fresnel and glitter are imported directly. Four source modules remain byte-for-byte identical to the inspected local reference project; a test checks their recorded hashes. Integration hooks live in `src/water/v2/WaterThreeCanal.ts`, outside the vendored files.

The curved canal mesh, dark bed and reduced long waves adapt that ocean renderer to this journey. Planar reflection is the selected canal mode because façades and bridges often lie outside the screen. SSR and hybrid integration remain available in the water module for development; they are not both rendered unconditionally.

Ten hull-volume samples (six on Low), plus weak bow and stern impulses, drive the credited height/velocity solver in a 24 m moving, world-anchored domain. The resulting normal changes affect reflection, refraction and sun highlights. Stopping emissions lets the wake decay; there is no foam overlay or painted V-shaped texture.

A unified `JourneyEnvironment` reuses the tested lab atmosphere controller for the sun, source sky/clouds, fog, environment lighting, exposure, water environment and warm city lights. Auto light blends Day into Sunset along the journey; manual weather overrides remain until changed. The water body remains blue-green at sunset. Linear HDR is tone-mapped with the source ACES implementation and encoded to sRGB once.

## Performance strategy

- Twelve Meshopt-compressed GLB chunks: preload ahead, retain a short section behind, dispose retired geometries. Shared PBR materials and textures remain resident.
- Detailed nearby façades, simpler mid-range geometry and inexpensive distant silhouettes. Repeated mooring poles are instanced and other static modules are merged by material.
- Mostly 1K material maps; 2K plaster on desktop and a 1K Low-tier derivative. No 4K texture dependency.
- High / Medium / Low retain reflections, micro ripple and boat interaction. Reflection targets are 1024 / 512 / 256; simulation grids are 512 / 256 / 128.
- Sustained pressure reduces pixel ratio gradually, then reflection resolution, shadows and distant detail. A 30 Hz display cap alone does not trigger degradation.
- Audio starts after interaction, fades between zones, and suspends when the page is hidden. Missing audio never blocks the ride. Missing textures use neutral PBR fallbacks; failed city chunks retain distant silhouettes and retry.

Measured results and their hardware/emulation limits are in `docs/FINAL_REPORT.md` and `docs/validation/`. Browser viewport emulation is not a physical-phone performance certification.

## Development and evidence

`?debug=1` enables route inspection, live metrics, screenshots, a 288-pose white-screen regression, touch-event verification, wake verification and two-journey recording. Normal URLs contain no debug HUD. `?quality=low` selects a specific quality tier.

On local preview, add `&qa=1` to let debug evidence save into the ignored `qa/` directory. The local-only middleware accepts PNG, JSON and WebM files from localhost. It is not included in `dist` and uploads nothing externally. Canvas recording uses only the app's own rendered frames and audio, never a microphone or screen-sharing permission.

`npm run build:city` rebuilds the authored scene chunks. Checked-in GLBs are ready to use; normal development and production builds do not need to rebake them. Non-normalized UV notices during baking describe intentional metre-scale tiling.

The separate `water-lab/` project and source checkpoint preserve the original A/B comparison. Release screenshots and a short journey video are in `showcase/`.

## Credits

See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for WaterThreeJS, the heightfield solver, planar-reflection reference, Three.js, meshoptimizer, Poly Haven textures and CC0 field recordings. Required notices are shipped in `dist/licenses/`.

## Atmosphere and dynamic-water lab

Open `/environment-lab/` for **Day / Sunset / Rain** manual presets. Night and Night Rain were removed; twilight remains a bright colour reference, not a night mode. Sun, source cloud genera, exposure, environmental fill and warm lamps can be adjusted together. Poly Haven's three CC0 HDRIs are available inside the same ACES pipeline for qualitative colour comparison.

The lab uses the actual `@takustaqu/atmosphere` shader, not a re-created look. Its sky is art-directed, rather than a physical atmosphere solver. The formal desktop journey now shares these tested presets, while retaining continuous automatic daylight-to-sunset progression as its default. `procedural-clouds-threejs` is not stacked on top of the current clouds.

Dynamic Water V3 is enabled in the journey; `?water=v2` preserves the previous interaction implementation for rollback and comparison. Both paths share the same WaterThreeJS optical tuning. V3's debug views and GPU tests live only in the lab. Use `?quality=low&halfFloat` to inspect the half-float compatibility path. Rain impacts and hull displacement enter the same propagating GPU field, then modify the existing water normals and optics.

See [the atmosphere module map](docs/atmosphere-lab/README.md) and [V3 implementation and measured limitations](docs/dynamic-water-v3.md). Local evidence is saved through the lab's capture and diagnostic controls. The forced half-float test and a mobile viewport do not certify a physical iOS device.

No paid models, commercial music, account system, driving mode, tasks or multiplayer are included. The experience ends at sunset rather than full night.
