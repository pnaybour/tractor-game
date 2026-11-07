# Green Digger Carrots and Toy Train Driver

This is a tiny two-page website with gentle browser games for a very young child who likes typing and clicking. Both games are deliberately forgiving: normal keyboard keys work, there is no losing state, and every action moves play forward.

The pages are:

- `index.html`: Green Digger Carrots
- `train.html`: Toy Train Driver (original 2D)
- `train3d.html`: Toy Train Driver 3D (experimental)

## Green Digger Carrots

The player helps a green digger find carrots and feed them to happy horses. The game now has three gentle levels: first one horse, then two horses, then three horses. Each horse needs two carrots, keeping each little goal short and satisfying.

### Gameplay

Press any key, or tap the big **Go** button, and the digger moves through a simple repeated loop:

1. Drive to the carrot patch.
2. Dig up a carrot.
3. Drive to the next hungry horse.
4. Feed the horse.
5. Repeat until each visible horse has eaten two carrots.
6. Celebrate with a happy horse animation and sound.

After all horses in the level are full, the game automatically moves on: Level 1 has one horse, Level 2 has two horses, and Level 3 has three horses. After Level 3, it loops back to Level 1 so the child can keep playing.

The digger does not keep a long action buffer. Extra keys pressed while the digger is moving are cleared, so a burst of typing will not keep triggering delayed actions afterwards.

## Toy Train Driver

Toy Train Driver is a first-person wooden toy train game on a classic Brio-style figure-eight track with a little bridge over the crossing. A branch line leaves the right-hand loop and rejoins it, giving the child a choice of routes. The main view looks forward from the train cab, and a small top-down map shows where the train is on the track.

Click, tap, or press any normal key to make the train go faster. Repeated clicks make it speed up; if the child pauses, it gently slows down. Use the **Branch: OFF / ON** button to set the points for the next junction. The green branch track is shown alongside the main line on the map. There is no crash, score, or failure state.

## Toy Train Driver 3D — experimental

The optional 3D prototype at `train3d.html` uses **Three.js 0.187.0** via a pinned CDN import map. Unlike the original canvas-drawn game, its rails, wooden bridge, stations, trees, locomotive and two carriages are actual lit 3D meshes, with shadows and moving wheels. A small 2D inset is only a route map.

The original figure-eight centreline is retained (x = sin(t), y = 0.58 sin(t) cos(t)), rescaled to world coordinates. The elevated bridge clears the crossing at t=0. A second line leaves the right-hand loop at t=0.55 and rejoins it at t=2.59; its offset and tangent both reach zero at the turnouts. The **Branch** button sets the points for the next junction. The whole train follows that route, including both carriages.

The user can switch between a follow camera (shows the locomotive model), driver view and raised overview. The game remains forgiving: there is no collision/failure state or scoring, and any ordinary letter key or a tap accelerates the train. Space sounds the whistle, B switches the points, and V changes the camera.

The storybook locomotive and coaches are stored as self-contained glTF assets in `assets/models/`. They were designed for this game, so there is no dependency on third-party character artwork.

### Storybook character train and glTF models

The 3D game now features an original, cheerful blue tank engine named **Bluebell**, with a soft grey smiling face, movable eyes, yellow lining, black funnel and red buffer beam. It pulls two colourful passenger coaches through a brighter landscape with rounded trees, green hills, stations, a water tower and level-crossing signals. It is inspired by the friendly British children's railway tradition, but does not use Thomas branding, character artwork, or copied assets.

The locomotive and passenger coach are authored as real, self-contained **glTF 2.0 models**. Their geometry, materials and named animation pivots are stored in:

- `assets/models/bluebell-tank-engine.gltf`
- `assets/models/storybook-coach.gltf`

The Three.js `GLTFLoader` imports both models at runtime from the same website; the wheel pivots turn and the engine blinks. The original model builder in `train3d-model.mjs` is retained only as a graceful fallback if the glTF files cannot load. This keeps the game playable offline or when the assets are unavailable.

Both models were created specifically for this project, without external asset licensing requirements. They can later be upgraded or replaced by professionally modelled `.glb` files without modifying the railway geometry. The default camera now follows the train from the front at an angle, so the smiling face is visible.

### Host the 3D game on Vercel

Vercel can serve the 3D game as a **static website**, with no server, database or build system. The `vercel.json` file in this branch selects the **Other** framework, skips the build command, serves the repository root, and rewrites `/` to `/train3d.html`. On Vercel the 3D version is therefore the homepage; on GitHub Pages the existing digger home page is unchanged. The 3D game uses a pinned Three.js CDN import map.

To deploy a Vercel preview without changing the existing live games:

1. In Vercel, select **Add New → Project** and import `pnaybour/tractor-game` from GitHub.
2. Set Framework Preset to **Other**. Leave Build Command blank; use root directory `.` and output directory `.` if prompted.
3. Keep **main** as the production branch to preserve the existing live version. Vercel's integration can build a preview of the `feature/real-3d-train` pull request.
4. Once the 3D preview has been tested and is approved, you can publish the 3D site from the feature branch by choosing it as the Vercel production branch, or merge it into main. GitHub Pages continues to serve the original `index.html` at its root in either case.

**Important:** The Vercel account still needs to be linked to this GitHub repository. This branch is deployment-ready but does not itself create or publish a Vercel project.

**Important:** The 3D prototype must be served over HTTP(S) and requires an internet connection to load the pinned Three.js module. The existing 2D train and digger games remain independent and work as before.

Development smoke check: `npm run test:3d` runs Node-based geometry, bridge and turnout tests without a browser. A full browser/WebGL visual test should also be run before making this prototype the default.

## Design Goals

- Age-appropriate for a toddler with help from an adult.
- Works with random typing, so letters, numbers, space, and enter all count.
- No wrong answers, no timer, no score pressure, and no failure screen.
- Large friendly visuals with a green digger, carrot patches, happy horses, a toy train cab, and a wooden figure-eight bridge track.
- Cheerful sound effects and soft background music that starts only after the first input.
- Runs as a small static web page with no backend.

## Controls

| Input | Action |
| --- | --- |
| Any normal keyboard key | Do the next action in the current game |
| Big **Go** button | Do the next action or speed up the train |
| Click/tap the train view | Speed up the train |
| **Branch: OFF / ON** button | Select the route at the next junction |

Modifier shortcuts such as `Ctrl`, `Alt`, and `Meta` combinations are ignored so browser/system shortcuts still behave normally.

## Features

- CSS-drawn farm scene with hills, fence, carrot mounds, dirt track, digger, troughs, and horses.
- Three progressive levels with one, two, then three horses.
- Canvas-drawn toy train driver view with a figure-eight track map, branch line and bridge crossing.
- Real local sound effects for shovel digging, carrot crunching, and horse neighing.
- Synthesized engine/tread movement sounds for the digger and gentle train chuffs.
- Synthesized soft background music using the Web Audio API.
- Cleared digger input buffer, so fast typing does not create a long delayed action queue.
- Responsive layout for desktop and mobile-sized screens.
- Playwright tests for keyboard play, button play, level progression, carrot feeding, canvas rendering, and digger alignment.

## Run Locally

You can open `index.html` directly in a browser.

You can also open `train.html` directly for the original train game. For the 3D version, use the local HTTP server and open `http://127.0.0.1:5173/train3d.html`.

For the most browser-like local setup, serve the folder:

```bash
python3 -m http.server 5173
```

Then visit:

```text
http://127.0.0.1:5173
```

Press any key once the page opens. Browsers generally require a user gesture before audio can start, so the music and sounds begin after the first input.

## GitHub Pages

This repo is ready for GitHub Pages as a static site served from the `main` branch.

Expected Pages URL:

```text
https://pnaybour.github.io/tractor-game/
```

To enable it in GitHub:

1. Open the repository settings.
2. Go to **Pages**.
3. Set **Build and deployment** to **Deploy from a branch**.
4. Choose branch `main`.
5. Choose folder `/ (root)`.
6. Click **Save**.

The `.nojekyll` file keeps GitHub Pages in simple static-file mode. All browser asset paths are relative, so the game works correctly from the `/tractor-game/` project path used by GitHub Pages.

## Development

Install the test dependency:

```bash
npm install
```

Run the Playwright tests:

```bash
npm test
```

Run the 3D track geometry checks:

```bash
npm run test:3d
```

The Playwright tests check keyboard play, button play, level progression, horse feeding, digger input buffering, digger alignment with the dirt track, and the train canvas/map behavior.

## Project Structure

```text
.
├── index.html                # Game markup
├── train3d.html             # Standalone 3D train prototype
├── train3d.css              # 3D game control layout and HUD
├── train3d.mjs              # Three.js real-time scene, train motion and input
├── train3d-track.mjs        # Original figure-eight and branch parametric geometry
├── train3d-model.mjs        # Fallback 3D locomotive/carriage meshes
├── train3d-gltf.mjs         # Loads animated glTF character models
├── train3d-world.mjs        # Rails, elevated bridge, stations and scenery
├── train.html                # Toy train game markup
├── styles.css                # Farm, digger, train, horses, and responsive visual styling
├── game.js                   # Gameplay loop, input handling, animation timing, and audio
├── train.js                  # Train speed, first-person canvas, top-down map, and audio
├── assets/models/            # Original glTF 2.0 engine and passenger-coach models
├── .nojekyll                 # Keeps GitHub Pages in static-file mode
├── assets/sounds/            # Local sound effects
├── tests/digger.spec.mjs     # Playwright tests
├── playwright.config.mjs     # Desktop and mobile test configuration
├── ASSETS.md                 # Sound source and license notes
└── README.md                 # Project documentation
```

## Audio

The game uses a mix of local audio files and synthesized Web Audio:

- shovel sound when digging
- carrot crunch sounds when feeding the horses
- horse neigh when a horse is full
- generated digger movement sounds while driving
- generated soft background music during digger play
- generated toy train chuffs while the train is rolling

The background music is intentionally quiet and simple so it supports play without becoming overwhelming.

## Sound Credits

See `ASSETS.md` for the source and license notes for the local sound effects.

## Notes

This is a small static game. It does not collect data, make network requests during play, or require a server beyond simple static file hosting.
