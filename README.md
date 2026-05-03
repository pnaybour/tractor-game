# Green Digger Carrots

Green Digger Carrots is a gentle browser game for a very young child who likes typing. The game is deliberately forgiving: any normal keyboard key works, there is no losing state, and every action moves the scene forward.

The player helps a green digger find carrots and feed them to a horse. When the horse has eaten enough carrots, it becomes full and happy and plays a cheerful horse sound.

## Gameplay

Press any key, or tap the big **Go** button, and the digger moves through a simple repeated loop:

1. Drive to the carrot patch.
2. Dig up a carrot.
3. Drive to the horse.
4. Feed the horse.
5. Repeat until the horse has eaten five carrots.
6. Celebrate with a happy horse animation and sound.

After the horse is full, the round resets automatically and the child can keep playing.

## Design Goals

- Age-appropriate for a toddler with help from an adult.
- Works with random typing, so letters, numbers, space, and enter all count.
- No wrong answers, no timer, no score pressure, and no failure screen.
- Large friendly visuals with a green digger, carrot patches, a horse, and a simple farm scene.
- Cheerful sound effects and soft background music that starts only after the first input.
- Runs as a small static web page with no backend.

## Controls

| Input | Action |
| --- | --- |
| Any normal keyboard key | Do the next digger action |
| Big **Go** button | Do the next digger action |

Modifier shortcuts such as `Ctrl`, `Alt`, and `Meta` combinations are ignored so browser/system shortcuts still behave normally.

## Features

- CSS-drawn farm scene with hills, fence, carrot mounds, dirt track, digger, trough, and horse.
- Real local sound effects for shovel digging, carrot crunching, and horse neighing.
- Synthesized engine/tread movement sounds for the digger.
- Synthesized soft background music using the Web Audio API.
- Queued input, so fast typing is not lost while the digger is moving.
- Responsive layout for desktop and mobile-sized screens.
- Playwright tests for keyboard play, button play, carrot feeding, and digger alignment.

## Run Locally

You can open `index.html` directly in a browser.

For the most browser-like local setup, serve the folder:

```bash
python3 -m http.server 5173
```

Then visit:

```text
http://127.0.0.1:5173
```

Press any key once the page opens. Browsers generally require a user gesture before audio can start, so the music and sounds begin after the first input.

## Development

Install the test dependency:

```bash
npm install
```

Run the Playwright tests:

```bash
npm test
```

The Playwright tests check keyboard play, button play, horse feeding, and digger alignment with the dirt track.

## Project Structure

```text
.
├── index.html                # Game markup
├── styles.css                # Farm, digger, horse, and responsive visual styling
├── game.js                   # Gameplay loop, input handling, animation timing, and audio
├── assets/sounds/            # Local sound effects
├── tests/digger.spec.mjs     # Playwright tests
├── playwright.config.mjs     # Desktop and mobile test configuration
├── ASSETS.md                 # Sound source and license notes
└── README.md                 # Project documentation
```

## Audio

The game uses a mix of local audio files and synthesized Web Audio:

- shovel sound when digging
- carrot crunch sounds when feeding the horse
- horse neigh when the horse is full
- generated digger movement sounds while driving
- generated soft background music during play

The background music is intentionally quiet and simple so it supports play without becoming overwhelming.

## Sound Credits

See `ASSETS.md` for the source and license notes for the local sound effects.

## Notes

This is a small static game. It does not collect data, make network requests during play, or require a server beyond simple static file hosting.
