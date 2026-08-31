// The game is one self-contained HTML file with no build step, so the tests
// cannot import its constants. They read them back out of the source instead:
// index.html stays the single source of truth, and a test that silently
// describes a world the game no longer has becomes impossible rather than
// merely discouraged.
//
// Two of these tests spent the pixel-art rewrite asserting against the old
// 380x540 vector build and still reported all green. Hence this file.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "index.html");

const NAMES = [
  "W", "H", "GROUND_Y", "STEP", "GOAL",
  "GRAV", "FLAP", "MAXFALL",
  "SHIP_X", "SHIP_R", "SW",
  "SPACING0", "SPEED0", "GAP0",
  "SPACING1", "SPEED1", "GAP1",
  "RAMP", "DELTA", "MARGIN",
];

function read(){
  const lines = fs.readFileSync(SRC, "utf8").split("\n");

  // the constants sit in one block at the top of the script; staying inside it
  // keeps `W` from matching some later assignment
  const start = lines.findIndex(l => l.indexOf('"use strict"') !== -1);
  if (start === -1) throw new Error("constants.js: script block not found in index.html");
  const block = lines.slice(start, start + 40).join("\n");

  const out = {};
  for (const name of NAMES){
    // `var GRAV = 470, FLAP = -142` and `var STEP = 1 / 120`
    const m = block.match(new RegExp("(?:var|,)\\s*" + name + "\\s*=\\s*([-0-9.\\s/]+?)\\s*[,;]"));
    if (!m){
      throw new Error(
        "constants.js: " + name + " not found in the constants block of index.html.\n" +
        "It moved, was renamed, or was removed — update NAMES here to match."
      );
    }
    const value = Function('"use strict"; return (' + m[1] + ");")();
    if (typeof value !== "number" || !isFinite(value)){
      throw new Error("constants.js: " + name + " parsed as " + value + ", expected a finite number");
    }
    out[name] = value;
  }
  return out;
}

const C = read();

// the ramp curves, identical to the ones in the game
C.lerp    = (a, b, t) => a + (b - a) * Math.min(t, 1);
C.speed   = s => C.lerp(C.SPEED0,   C.SPEED1,   s / C.RAMP);
C.gap     = s => C.lerp(C.GAP0,     C.GAP1,     s / C.RAMP);
C.spacing = s => C.lerp(C.SPACING0, C.SPACING1, s / C.RAMP);

C.hitRect = function(cx, cy, r, x, y, w, h){
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
};

module.exports = C;
