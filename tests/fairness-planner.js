// A lookahead planner that proves the goal is actually reachable — this is
// what caught levels demanding an altitude swing the saucer could not make.
// Constants come from index.html via constants.js; never copy them here.
//
// The sweep varies the DELTA clamp (how far a gap may shift from the one
// before) against the planner's lookahead, so an unfair generator shows up as
// a collapse in the median even when the pilot plays perfectly.

const C = require("./constants.js");
const {
  W, GROUND_Y, STEP, GOAL, GRAV, FLAP, MAXFALL,
  SHIP_X, SHIP_R, SW, DELTA, MARGIN,
  speed, gap, spacing, hitRect,
} = C;

const AIM = GROUND_Y / 2;   // where to sit when no gate is in front of you

function dead(y, spires){
  if (y + SHIP_R >= GROUND_Y) return true;
  for (const s of spires){
    const half = s.g / 2;
    if (hitRect(SHIP_X, y, SHIP_R, s.x, -30, SW, (s.gy - half) + 30)) return true;
    if (hitRect(SHIP_X, y, SHIP_R, s.x, s.gy + half, SW, GROUND_Y - (s.gy + half))) return true;
  }
  return false;
}

// roll the world forward under a fixed opening action, return survival depth
function survive(y, vy, spires, sp, firstFlap, horizon){
  let Y = y, V = vy;
  const S = spires.map(s => ({ x: s.x, gy: s.gy, g: s.g }));
  for (let i = 0; i < horizon; i++){
    if (i === 0 && firstFlap) V = FLAP;
    else if (i > 0){                       // afterwards: thrust when sinking below the aim point
      const n = S.find(s => s.x + SW > SHIP_X - SHIP_R);
      const aim = n ? n.gy : AIM;
      if (V > 0 && Y > aim - 4) V = FLAP;
    }
    V += GRAV * STEP; if (V > MAXFALL) V = MAXFALL;
    Y += V * STEP;
    for (const s of S) s.x -= sp * STEP;
    if (Y - SHIP_R < -2){ Y = -2 + SHIP_R; V = 14; }
    if (dead(Y, S)) return i;
  }
  return horizon;
}

function run(seed, maxGates, deltaCap, horizon){
  let rnd = seed;
  const rand = () => ((rnd = rnd * 1103515245 + 12345 & 0x7fffffff) / 0x7fffffff);

  let y = 87, vy = FLAP, score = 0, steps = 0, prev = null;
  const spires = [];
  const add = x => {
    const g = gap(score);
    let lo = MARGIN + g / 2, hi = GROUND_Y - MARGIN - g / 2;
    if (prev !== null && isFinite(deltaCap)){
      lo = Math.max(lo, prev - deltaCap);
      hi = Math.min(hi, prev + deltaCap);
    }
    const gy = lo + rand() * Math.max(1, hi - lo);
    prev = gy;
    spires.push({ x, gy, g, scored: false });
  };
  add(W + 30);
  add(W + 30 + spacing(0));

  while (score < maxGates && steps < 120 * 1200){
    steps++;
    const sp = speed(score);
    if (survive(y, vy, spires, sp, true, horizon) > survive(y, vy, spires, sp, false, horizon)) vy = FLAP;
    vy += GRAV * STEP; if (vy > MAXFALL) vy = MAXFALL;
    y += vy * STEP;
    for (const s of spires) s.x -= sp * STEP;
    const last = spires[spires.length - 1];
    if (last && last.x < W - spacing(score)) add(last.x + spacing(score));
    while (spires.length && spires[0].x + SW < -8) spires.shift();
    for (const s of spires) if (!s.scored && s.x + SW < SHIP_X - SHIP_R){ s.scored = true; score++; }
    if (y - SHIP_R < -2){ y = -2 + SHIP_R; vy = 14; }
    if (dead(y, spires)) return score;
  }
  return score;
}

const SEEDS = 8, CAP = 200;
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

console.log("\nplanner sweep — " + SEEDS + " seeds, capped at " + CAP + " gates, goal is " + GOAL + "\n");
console.log("deltaCap  horizon   scores over " + SEEDS + " seeds" + " ".repeat(12) + "median");

let shippedMedian = null;
for (const d of [Infinity, DELTA, Math.round(DELTA * 0.75)]){
  for (const h of [90, 150]){
    const out = [];
    for (let s = 1; s <= SEEDS; s++) out.push(run(s * 7919, CAP, d, h));
    const med = median(out);
    if (d === DELTA && h === 150) shippedMedian = med;
    console.log(String(d).padEnd(10) + String(h).padEnd(10) + JSON.stringify(out).padEnd(30) + med);
  }
}

console.log("\n-- the shipped generator is fair --");
const ok = shippedMedian >= GOAL;
console.log("  " + (ok ? "PASS" : "FAIL") +
  "  a planning pilot clears the " + GOAL + "-gate goal at DELTA=" + DELTA +
  "  (median " + shippedMedian + "/" + CAP + ")");
console.log("");
process.exit(ok ? 0 : 1);
