# Green Digger Carrots and Toy Train Driver

This is a tiny two-page website with gentle browser games for a very young child who likes typing and clicking. Both games are deliberately forgiving: normal keyboard keys work, there is no losing state, and every action moves play forward.

The pages are:

- `index.html`: Green Digger Carrots
- `train.html`: Toy Train Driver

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

Toy Train Driver is a first-person wooden toy train game on a classic Brio-style figure-eight track with a little bridge over the crossing. The main view looks forward from the train cab, and a small top-down map shows where the train is on the track.

Click, tap, or press any normal key to make the train go faster. Repeated clicks make it speed up; if the child pauses, it gently slows down. There is no crash, score, or failure state.

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

Modifier shortcuts such as `Ctrl`, `Alt`, and `Meta` combinations are ignored so browser/system shortcuts still behave normally.

## Features

- CSS-drawn farm scene with hills, fence, carrot mounds, dirt track, digger, troughs, and horses.
- Three progressive levels with one, two, then three horses.
- Canvas-drawn toy train driver view with a figure-eight track map and bridge crossing.
- Real local sound effects for shovel digging, carrot crunching, and horse neighing.
- Synthesized engine/tread movement sounds for the digger and gentle train chuffs.
- Synthesized soft background music using the Web Audio API.
- Cleared digger input buffer, so fast typing does not create a long delayed action queue.
- Responsive layout for desktop and mobile-sized screens.
- Playwright tests for keyboard play, button play, level progression, carrot feeding, canvas rendering, and digger alignment.

## Run Locally

You can open `index.html` directly in a browser.

You can also open `train.html` directly for the train game.

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

The Playwright tests check keyboard play, button play, level progression, horse feeding, digger input buffering, digger alignment with the dirt track, and the train canvas/map behavior.

## Project Structure

```text
.
├── index.html                # Game markup
├── train.html                # Toy train game markup
├── styles.css                # Farm, digger, train, horses, and responsive visual styling
├── game.js                   # Gameplay loop, input handling, animation timing, and audio
├── train.js                  # Train speed, first-person canvas, top-down map, and audio
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
