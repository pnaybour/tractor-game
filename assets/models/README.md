# Original Bluebell railway glTF models

These two self-contained glTF 2.0 models were made specifically for this project:

- `bluebell-tank-engine.gltf` — a cheerful blue tank engine with a smiling face, two blinking eye groups and animated wheel pivots.
- `storybook-coach.gltf` — a red-and-cream passenger coach, loaded twice and recoloured for the second coach.

Both assets are designed from original geometry. No third-party Thomas & Friends character artwork, trademarks, textures or downloaded model meshes are included. The art direction is a friendly and colourful classic British storybook railway.

The files embed their binary vertex/index buffers as base64 data URIs, so there are no external texture or .bin dependencies. Three.js `GLTFLoader` loads them via `train3d-gltf.mjs`. Important named glTF nodes: `wheel_*`, `eye_left`, `eye_right`. The locomotive faces its local **+Z** direction and its origin is at rail level. To replace the files with Blender-exported glTF/GLB models, preserve the origin, orientation and named animation pivots.

Run `npm run test:3d` to check geometry and validate the model structure.
