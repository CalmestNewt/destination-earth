// Compare difficulty configs with two pilots:
//   casual  = bang-bang controller, a proxy for someone playing loosely
//   skilled = 1.4s lookahead search, a proxy for someone playing well
//
// "shipped" is read from index.html via constants.js, so this always grades
// what actually ships. "tighter" is a stored candidate kept for comparison —
// edit it freely, it is not claimed to be live.

const C = require("./constants.js");
const { W, GROUND_Y, STEP, GOAL, SHIP_X, lerp, hitRect } = C;

const AIM = GROUND_Y / 2;

const SHIPPED = {
  GRAV: C.GRAV, FLAP: C.FLAP, MAXFALL: C.MAXFALL, SHIP_R: C.SHIP_R, SW: C.SW,
  SPACING0: C.SPACING0, SPACING1: C.SPACING1, SPEED0: C.SPEED0, SPEED1: C.SPEED1,
  GAP0: C.GAP0, GAP1: C.GAP1, RAMP: C.RAMP, DELTA: C.DELTA, MARGIN: C.MARGIN,
};

// the pre-launch candidate: faster fall, tighter gaps, steeper ramp
const TIGHTER = {
  GRAV: 587, FLAP: -158, MAXFALL: 215, SHIP_R: 4, SW: 21,
  SPACING0: 80, SPACING1: 72, SPEED0: 51, SPEED1: 72,
  GAP0: 59, GAP1: 46, RAMP: 26, DELTA: 50, MARGIN: 20,
};

function mk(K){
  return {
    K,
    speed:   s => lerp(K.SPEED0,   K.SPEED1,   s / K.RAMP),
    gap:     s => lerp(K.GAP0,     K.GAP1,     s / K.RAMP),
    spacing: s => lerp(K.SPACING0, K.SPACING1, s / K.RAMP),
  };
}

function dead(y, spires, g){
  const K = g.K;
  if (y + K.SHIP_R >= GROUND_Y) return true;
  for (const s of spires){
    const half = s.g / 2;
    if (hitRect(SHIP_X, y, K.SHIP_R, s.x, -30, K.SW, (s.gy - half) + 30)) return true;
    if (hitRect(SHIP_X, y, K.SHIP_R, s.x, s.gy + half, K.SW, GROUND_Y - (s.gy + half))) return true;
  }
  return false;
}

function run(g, policy, maxGates, seed){
  const K = g.K;
  let rnd = seed;
  const rand = () => ((rnd = rnd * 1103515245 + 12345 & 0x7fffffff) / 0x7fffffff);

  let y = 87, vy = K.FLAP, score = 0, steps = 0;
  const spires = [];
  const add = x => {
    const gg = g.gap(score);
    let lo = K.MARGIN + gg / 2, hi = GROUND_Y - K.MARGIN - gg / 2;
    if (spires.length){
      const p = spires[spires.length - 1].gy;
      lo = Math.max(lo, p - K.DELTA);
      hi = Math.min(hi, p + K.DELTA);
    }
    spires.push({ x, gy: lo + rand() * Math.max(1, hi - lo), g: gg, scored: false });
  };
  add(W + 30);
  add(W + 30 + g.spacing(0));

  while (score < maxGates && steps < 120 * 1500){
    steps++;
    const sp = g.speed(score);
    if (policy(y, vy, spires, g, sp)) vy = K.FLAP;
    vy += K.GRAV * STEP; if (vy > K.MAXFALL) vy = K.MAXFALL;
    y += vy * STEP;
    for (const s of spires) s.x -= sp * STEP;
    const last = spires[spires.length - 1];
    if (last && last.x < W - g.spacing(score)) add(last.x + g.spacing(score));
    while (spires.length && spires[0].x + K.SW < -8) spires.shift();
    for (const s of spires) if (!s.scored && s.x + K.SW < SHIP_X - K.SHIP_R){ s.scored = true; score++; }
    if (y - K.SHIP_R < -2){ y = -2 + K.SHIP_R; vy = 14; }
    if (dead(y, spires, g)) return score;
  }
  return score;
}

const casual = (y, vy, spires, g) => {
  const n = spires.find(s => s.x + g.K.SW > SHIP_X - g.K.SHIP_R);
  return y > (n ? n.gy : AIM) - 6 && vy > -40;
};

function survive(y, vy, spires, sp, first, horizon, g){
  const K = g.K;
  let Y = y, V = vy;
  const S = spires.map(s => ({ x: s.x, gy: s.gy, g: s.g }));
  for (let i = 0; i < horizon; i++){
    if (i === 0 && first) V = K.FLAP;
    else if (i > 0){
      const n = S.find(s => s.x + K.SW > SHIP_X - K.SHIP_R);
      const aim = n ? n.gy : AIM;
      if (V > 0 && Y > aim - 4) V = K.FLAP;
    }
    V += K.GRAV * STEP; if (V > K.MAXFALL) V = K.MAXFALL;
    Y += V * STEP;
    for (const s of S) s.x -= sp * STEP;
    if (Y - K.SHIP_R < -2){ Y = -2 + K.SHIP_R; V = 14; }
    if (dead(Y, S, g)) return i;
  }
  return horizon;
}

const skilled = (y, vy, spires, g, sp) =>
  survive(y, vy, spires, sp, true, 170, g) > survive(y, vy, spires, sp, false, 170, g);

function stats(g, policy, n = 15){
  const out = [];
  for (let i = 1; i <= n; i++) out.push(run(g, policy, 50, i * 7919));
  out.sort((a, b) => a - b);
  return {
    med: out[Math.floor(n / 2)],
    min: out[0],
    max: out[out.length - 1],
    finish: Math.round(out.filter(v => v >= GOAL).length / n * 100),
  };
}

function show(name, K){
  const g = mk(K);
  const cs = stats(g, casual), sk = stats(g, skilled);
  console.log(name.padEnd(9) +
    "| casual med " + String(cs.med).padStart(2) + "  (range " + String(cs.min).padStart(2) + "-" + String(cs.max).padStart(2) + ")" +
    "  | skilled med " + String(sk.med).padStart(2) + "  reaches " + GOAL + " in " + String(sk.finish).padStart(3) + "%");
}

console.log("");
show("shipped", SHIPPED);
show("tighter", TIGHTER);

const f = K => ({
  apex: (K.FLAP * K.FLAP / (2 * K.GRAV)).toFixed(1),
  rise: (-K.FLAP / K.GRAV).toFixed(2),
  t0:   (K.SPACING0 / K.SPEED0).toFixed(2),
  t1:   (K.SPACING1 / K.SPEED1).toFixed(2),
  gapD: (K.GAP1 / (K.SHIP_R * 2)).toFixed(1),
});
const a = f(SHIPPED), b = f(TIGHTER);
console.log("\n                       shipped -> tighter");
console.log("thrust apex (px)         " + a.apex + "   -> " + b.apex);
console.log("rise time (s)            " + a.rise + "   -> " + b.rise);
console.log("gate interval, start (s) " + a.t0 + "   -> " + b.t0);
console.log("gate interval, end   (s) " + a.t1 + "   -> " + b.t1);
console.log("tightest gap (ship dia)  " + a.gapD + "   -> " + b.gapD);
console.log("");
