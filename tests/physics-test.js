// Headless port of the game's physics, to check it is playable and fairly
// tuned. Constants come from index.html via constants.js — never copy them
// here, or this file goes back to grading a game that no longer exists.
//
// Thresholds below describe the shipped "floatier and roomier than a strict
// flappy clone" tuning, in the 128 x 208 pixel world.

const C = require("./constants.js");
const {
  W, GROUND_Y, STEP, GOAL, GRAV, FLAP, MAXFALL,
  SHIP_X, SHIP_R, SW, RAMP, DELTA, MARGIN,
  speed, gap, spacing, hitRect,
} = C;

// Mirrors the game's step order exactly: policy, gravity, integrate, scroll,
// spawn, cull, score, collide, ground, ceiling.
function run(policy, maxGates, seed){
  let rnd = seed;
  const rand = () => ((rnd = rnd * 1103515245 + 12345 & 0x7fffffff) / 0x7fffffff);

  let y = 87, vy = FLAP, score = 0, t = 0, steps = 0;
  const spires = [];

  const addSpire = x => {
    const g = gap(score);
    let lo = MARGIN + g / 2, hi = GROUND_Y - MARGIN - g / 2;
    if (spires.length){
      const prev = spires[spires.length - 1].gy;
      lo = Math.max(lo, prev - DELTA);
      hi = Math.min(hi, prev + DELTA);
    }
    spires.push({ x, gy: lo + rand() * Math.max(1, hi - lo), g, scored: false });
  };
  addSpire(W + 30);
  addSpire(W + 30 + spacing(0));

  while (score < maxGates && steps < 120 * 900){
    steps++; t += STEP;
    const sp = speed(score);

    if (policy(y, vy, spires, score)) vy = FLAP;
    vy += GRAV * STEP; if (vy > MAXFALL) vy = MAXFALL;
    y += vy * STEP;

    for (const s of spires) s.x -= sp * STEP;
    const last = spires[spires.length - 1];
    if (last && last.x < W - spacing(score)) addSpire(last.x + spacing(score));
    while (spires.length && spires[0].x + SW < -8) spires.shift();

    for (const s of spires){
      if (!s.scored && s.x + SW < SHIP_X - SHIP_R){ s.scored = true; score++; }
      const half = s.g / 2;
      if (hitRect(SHIP_X, y, SHIP_R, s.x, -30, SW, (s.gy - half) + 30) ||
          hitRect(SHIP_X, y, SHIP_R, s.x, s.gy + half, SW, GROUND_Y - (s.gy + half)))
        return { score, death: "rock", t };
    }
    if (y + SHIP_R >= GROUND_Y) return { score, death: "ground", t };
    if (y - SHIP_R < -2){ y = -2 + SHIP_R; vy = 14; }
  }
  return { score, death: null, t };
}

const masher = () => true;   // holds thrust: a proxy for panic
const idle   = () => false;  // never thrusts

let pass = 0, fail = 0;
const chk = (name, ok, detail) => {
  ok ? pass++ : fail++;
  console.log("  " + (ok ? "PASS" : "FAIL") + "  " + name + (detail ? "  (" + detail + ")" : ""));
};

console.log("-- reachability is proved separately by fairness-planner.js --");

console.log("\n-- is it losable? --");
const m = run(masher, 200, 42), i = run(idle, 60, 42);
chk("holding thrust pins the saucer to the ceiling and into rock",
    m.death !== null, "died to " + m.death + " at gate " + m.score + ", t=" + m.t.toFixed(2) + "s");
chk("never thrusting hits the ground fast",
    i.death === "ground" && i.t < 1.4, "ground at t=" + i.t.toFixed(2) + "s");

console.log("\n-- flappy feel: is one tap the right size? --");
const apex  = (FLAP * FLAP) / (2 * GRAV);
const riseT = -FLAP / GRAV;
chk("one thrust lifts ~19-24px, about a ninth of the canyon",
    apex > 19 && apex < 24, apex.toFixed(1) + "px, " + (apex / GROUND_Y * 100).toFixed(0) + "% of the drop");
chk("rise takes ~0.26-0.34s", riseT > 0.26 && riseT < 0.34, riseT.toFixed(3) + "s");

console.log("\n-- gap geometry stays legal at every difficulty --");
let ok = true, tight = Infinity;
for (let s = 0; s <= RAMP + 10; s++){
  const g = gap(s);
  if (GROUND_Y - MARGIN - g / 2 <= MARGIN + g / 2) ok = false;
  tight = Math.min(tight, g / (SHIP_R * 2));
}
chk("gap window never inverts as difficulty ramps", ok);
chk("tightest gap still >=4 ship-diameters", tight >= 4, tight.toFixed(2) + " diameters");

console.log("\n-- pacing --");
const t0 = spacing(0) / speed(0), t1 = spacing(RAMP) / speed(RAMP);
chk("gate every ~1.9s at the start", t0 > 1.7 && t0 < 2.05, t0.toFixed(2) + "s");
chk("gate every ~1.3s at full difficulty", t1 > 1.15 && t1 < 1.45, t1.toFixed(2) + "s");
chk("difficulty tightens but never doubles the rate", t0 / t1 < 1.6, (t0 / t1).toFixed(2) + "x faster");

console.log("\n-- the ship fits through with room to steer --");
const clearance = (gap(RAMP) - SHIP_R * 2) / 2;
chk("clearance above and below at hardest gap >=4 ship-radii",
    clearance >= SHIP_R * 4, clearance.toFixed(1) + "px each side, " + (clearance / SHIP_R).toFixed(1) + " radii");

// the promise addSpire's DELTA clamp makes: never demand an altitude change
// the saucer cannot make in the time it has
console.log("\n-- the generator never demands an impossible climb --");
const climbRate = apex / riseT;          // chaining thrusts at the apex
const climbable = climbRate * t1;        // in one gate interval at full speed
chk("DELTA fits inside a gate interval with margin to spare",
    DELTA < climbable * 0.7,
    "DELTA " + DELTA + "px vs " + climbable.toFixed(0) + "px climbable in " + t1.toFixed(2) + "s");

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
