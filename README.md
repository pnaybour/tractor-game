# Green Digger Carrots

A gentle browser game for a young child who likes typing.

Press any key, or tap the big **Go** button, and the green digger moves through a simple loop:

1. Drive to the carrot patch.
2. Dig up a carrot.
3. Drive to the horse.
4. Feed the horse.
5. Make a happy horse sound when the horse is full.

The game uses big visual shapes, forgiving controls, cheerful sound effects, and soft background music. There is no losing state, no timer, and no wrong key.

## Run Locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 5173
```

Then visit:

```text
http://127.0.0.1:5173
```

## Test

```bash
npm install
npm test
```

The Playwright tests check keyboard play, button play, horse feeding, and digger alignment with the dirt track.

## Sound Credits

See `ASSETS.md` for the source and license notes for the local sound effects.
