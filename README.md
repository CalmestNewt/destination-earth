# Destination Earth

A pixel-art flappy-style game: fly an alien saucer through 25 rock gates in a
Martian canyon at sunset, then set course for Earth.

Published as a Claude artifact. The URL is kept out of this repo — it is in
`.artifact-url` locally (gitignored), and `/artifacts` in Claude Code lists it.

`destination-earth.html` is the whole game — one self-contained file, no build
step and no dependencies. Open it directly in a browser to play locally.

## Continuing this later

Tell Claude Code: *"continue working on ~/destination-earth"* and paste the
artifact URL from `.artifact-url`. Passing that URL when republishing updates
the existing artifact in place and keeps the same shareable link; publishing
without it creates a second, separate artifact.

Every published version is kept in the artifact's version picker, so earlier
builds (100 gates, the pre-pixel-art vector look, the original split-flap
2048 this file started life as) can still be recovered there.

## How it is put together

- The world is a fixed **128 x 208 pixel grid**. The canvas backing store is
  that size and the browser scales it up with `image-rendering: pixelated`, so
  the art is genuinely low-resolution rather than a filter over hi-res drawing.
- Physics run on a **fixed 1/120s timestep** with an accumulator, so the game
  plays identically at 60Hz and 120Hz.
- The sky is banded and blended with an ordered **4x4 Bayer dither**; the
  saucer is a hand-authored 15x8 sprite defined as strings in `SHIP_SPR`.
- The Martian sunset colours are real: dust scatters red forward through the
  sky and passes blue only near the sun, so the horizon is butterscotch and the
  sun sits in a cold blue halo.

### Difficulty knobs

All at the top of the script block. Current values are tuned, not guessed —
see `tests/`.

| constant | value | meaning |
|---|---|---|
| `GOAL` | 25 | gates to trigger the ending |
| `GRAV` / `FLAP` | 470 / -142 | fall rate and thrust impulse |
| `GAP0` / `GAP1` | 70 / 56 | canyon gap, opening and hardest |
| `SPEED0` / `SPEED1` | 45 / 60 | scroll speed, opening and hardest |
| `RAMP` | 34 | gates taken to reach full difficulty |
| `DELTA` | 42 | most a gap may shift from the one before |
| `SHIP_R` | 3.5 | collision radius (kept inside the sprite) |

A 25-gate run ends about 74% up the ramp. Lower `RAMP` to ~18 if you want the
last gates at full intensity.

## Tests

Run with `node`. No dependencies.

- `tests/constants.js` — reads the difficulty knobs back out of `index.html`
  and exports them, along with the ramp curves
- `tests/physics-test.js` — thrust size, pacing, gap geometry, losability, and
  that `DELTA` never demands a climb the saucer cannot make in the time it has
- `tests/fairness-planner.js` — a lookahead planner that proves the goal is
  actually reachable; this is what caught levels demanding an impossible
  altitude swing between gates
- `tests/difficulty-tuning.js` — compares configs using two bots, a casual
  bang-bang controller and the planner, and reports completion rates

The tests read the constants from `index.html` at run time rather than keeping
copies, so changing a knob in the HTML changes what the tests grade and a stale
test is not possible. They previously did keep copies, and spent the pixel-art
rewrite quietly grading the old 380x540 vector build while reporting all green.

`difficulty-tuning.js` also carries a stored `tighter` candidate to compare
against. That one is a plain literal and is deliberately not live.

## Verified in a real browser

Touch and pointer input are confirmed in Chrome: a tap starts the run, flies
the saucer, and relaunches from the crash card, and one physical tap produces
exactly one thrust. That last part needed fixing: one tap arrives as
pointerdown, touchstart, mousedown and click, and `preventDefault` has to run
even for the duplicates. Letting the dedupe return early skipped it, so
touchstart still emitted its compatibility mousedown and click when the finger
lifted — well outside the dedupe window — and every tap thrust twice.

The keyboard handler answers to Space, W, Up, the legacy `Spacebar`/`Up` key
names, and correctly ignores modifier combos like cmd+Space. That was checked
by dispatching the events, not by typing: the automation harness delivers no
keydown to the page at all, so real hardware keys remain unconfirmed.

## Known unverified

- The ending cinematic past its opening fade.
- The `max-width:460px` layout at a true phone width. Chrome would not shrink
  its window far enough to trigger it, so it has only been reasoned about.
  Easiest check is DevTools device emulation, or just opening it on a phone.
