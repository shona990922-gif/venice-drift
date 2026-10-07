# Third-party notices

The release contains the following code and media. Full required notices are shipped in `public/licenses/` (and copied to `dist/licenses/`). The project makes no claim of ownership over these components.

## Runtime code

| Component | Use | License / notice |
|---|---|---|
| [Three.js](https://github.com/mrdoob/three.js) 0.185.1 | WebGL renderer, scene graph, geometry, glTF loading, post-process quad | MIT; `three-MIT.txt` |
| [WaterThreeJS](https://github.com/achrefelouafi/WaterThreeJS/tree/4f85f4a557da80a1dd24b9243869177f30c604c7), © 2026 mohamedachrefelouafi | Directly vendored Ocean.js, Sky.js, Post.js and shaders/common.js; canal integration is separate | MIT; `WaterThreeJS-MIT.txt` |
| [threejs-water](https://github.com/jeantimex/threejs-water), original © 2011 Evan Wallace; modifications © 2026 Yong Su | Height/velocity ping-pong solver and ripple/normal shaders, adapted with time-step controls and lifecycle cleanup | MIT; `jeantimex-MIT.txt` |
| [screen-space-reflections-water-plane](https://github.com/m2-md/screen-space-reflections-water-plane), © 2026 Mustafa Morbel | Mirror-camera / oblique near-plane clipping mathematics | MIT; `planar-reference-MIT.txt` |
| [takustaqu/atmosphere](https://github.com/takustaqu/atmosphere/tree/92b6b6f69f4399597851d32af4abe4bb3bede81e), © 2026 Harada Moses Kiyohide | 0.3.2 state controller, celestial lighting, original sky/cloud shader and noise; Three.js adapter in the isolated environment lab | MIT; `takustaqu-atmosphere-MIT.txt` |
| [meshoptimizer](https://github.com/zeux/meshoptimizer), © 2016–2026 Arseny Kapoulkine | Meshopt GLB decoder bundled by Three.js; build-time encoder | MIT; `meshoptimizer-MIT.txt` |

WaterThreeJS's ocean, object models, beach, particles and volumetric-cloud demo are not shipped. Its object foam was not misrepresented as a heightfield simulation: the separately credited solver supplies propagating gondola disturbances. Earlier experimental water versions remain in the separate water-lab and Git history, not in the release bundle.

## Textures

All material maps are [Poly Haven CC0](https://polyhaven.com/license). Original URLs, hashes and resolutions are retained in `public/licenses/materials.json`. Release JPEG recompression and Low-tier derivatives are recorded in `texture-derivatives.json`.

- [Plastered Wall 04](https://polyhaven.com/a/plastered_wall_04): plaster, 2K; Low uses 1K.
- [White Sandstone Blocks 02](https://polyhaven.com/a/white_sandstone_blocks_02): stone, 1K.
- [Medieval Red Brick](https://polyhaven.com/a/medieval_red_brick): brick, 1K.
- [Clay Roof Tiles 02](https://polyhaven.com/a/clay_roof_tiles_02): roof, 1K.
- [Dark Wooden Planks](https://polyhaven.com/a/dark_wooden_planks): wood, 1K.

The historical material-manifest HDRI remains unshipped. The atmosphere lab separately includes these original **1K CC0 HDRIs**, for reference viewing only:

- [Venice Sunrise](https://polyhaven.com/a/venice_sunrise) — golden-hour reference.
- [Venice Sunset](https://polyhaven.com/a/venice_sunset) — sunset reference.
- [Twilight Sunset](https://polyhaven.com/a/twilight_sunset) — bright twilight colour reference.

Their source URLs, SHA-256 hashes and licence are recorded in `public/licenses/atmosphere-references.json`. They are lazy-loaded in the lab; photographed buildings are not substituted for scene geometry.

## Audio

CC0 recordings, downloaded through their public downloadable previews/files, are edited and level-balanced for this experience. No film, music, commercial boat-model audio or Open Water media is included.

| Recording | Creator | Source |
|---|---|---|
| Nice burbling water in a canale in Venice | krakenkraft | [Freesound 638067](https://freesound.org/people/krakenkraft/sounds/638067/) |
| Venice waterclaps tourist ambience | krakenkraft | [Freesound 730929](https://freesound.org/people/krakenkraft/sounds/730929/) |
| Ambient Bird Sounds | isaiah658 | [OpenGameArt](https://opengameart.org/content/ambient-bird-sounds) |

Source SHA-256 hashes, download URLs, edits and licensing are in `public/licenses/audio.json`. Bell, wood accents, the short bridge reverberation impulse and the lab’s filtered-noise light-rain bed are original Web Audio synthesis. The birds and synthesized bell are sound design, not claimed as location-authenticated Venice recordings.

## Original project assets and research

The gondola, Venetian modular façades, bridges, landmark, terrace, route and decorative geometry were authored for this project. No purchased models or generative 3D assets are included. The route is a composed Venetian scene, not an OSM-derived survey or a claim of geographically exact Venice.

Open Water, city-tour, OSM2World and the camera-follow-path examples informed earlier research. Their media and generated city data are not distributed. Historical research notices are retained where relevant; they do not imply those projects supply the release's artwork.

Build-only tools are locked in `package-lock.json` and retain their package notices in their npm distributions. They are not copied into the hosted runtime.
