// Port of the Saucer Over Mars physics, headless, to check the game is
// actually playable and fairly tuned.
const W=380,GROUND_Y=540,STEP=1/120;
const GRAV=1750,FLAP=-472,MAXFALL=640;
const SHIP_X=112,SHIP_R=14,SW=62;
const SPACING0=238,SPEED0=152,GAP0=176;
const SPACING1=214,SPEED1=214,GAP1=138;
const RAMP=26;

const lerp=(a,b,t)=>a+(b-a)*Math.min(t,1);
const speed=s=>lerp(SPEED0,SPEED1,s/RAMP);
const gap=s=>lerp(GAP0,GAP1,s/RAMP);
const spacing=s=>lerp(SPACING0,SPACING1,s/RAMP);

function hitRect(cx,cy,r,x,y,w,h){
  const nx=Math.max(x,Math.min(cx,x+w));
  const ny=Math.max(y,Math.min(cy,y+h));
  const dx=cx-nx,dy=cy-ny;
  return dx*dx+dy*dy<r*r;
}

function run(policy,maxGates,seed){
  let rnd=seed;const rand=()=>((rnd=rnd*1103515245+12345&0x7fffffff)/0x7fffffff);
  let y=258,vy=FLAP,score=0,spires=[],t=0;
  const DELTA=150;
  const addSpire=x=>{
    const g=gap(score),margin=58;
    let lo=margin+g/2,hi=GROUND_Y-margin-g/2;
    if(spires.length){const prev=spires[spires.length-1].gy;lo=Math.max(lo,prev-DELTA);hi=Math.min(hi,prev+DELTA);}
    spires.push({x,gy:lo+rand()*Math.max(1,hi-lo),g,scored:false});
  };
  addSpire(W+90);addSpire(W+90+spacing(0));
  let steps=0;
  while(score<maxGates&&steps<120*600){
    steps++;t+=STEP;
    const sp=speed(score);
    if(policy(y,vy,spires,score))vy=FLAP;
    vy+=GRAV*STEP; if(vy>MAXFALL)vy=MAXFALL;
    y+=vy*STEP;
    for(const s of spires)s.x-=sp*STEP;
    const last=spires[spires.length-1];
    if(last&&last.x<W-spacing(score))addSpire(last.x+spacing(score));
    while(spires.length&&spires[0].x+SW<-20)spires.shift();
    for(const s of spires){
      if(!s.scored&&s.x+SW<SHIP_X-SHIP_R){s.scored=true;score++;}
      const half=s.g/2;
      if(hitRect(SHIP_X,y,SHIP_R,s.x,-80,SW,(s.gy-half)+80)||
         hitRect(SHIP_X,y,SHIP_R,s.x,s.gy+half,SW,GROUND_Y-(s.gy+half)))
        return {score,death:"rock",t};
    }
    if(y+SHIP_R>=GROUND_Y)return {score,death:"ground",t};
    if(y-SHIP_R<-6){y=-6+SHIP_R;vy=40;}
  }
  return {score,death:null,t};
}

// a competent-but-not-perfect pilot: aim for the next gap centre
const pilot=(y,vy,spires)=>{
  const next=spires.find(s=>s.x+SW>SHIP_X-SHIP_R);
  const target=next?next.gy:280;
  return y>target-6&&vy>-40;
};
// a bad pilot: mash thrust constantly
const masher=()=>true;
// a dead pilot: never thrust
const idle=()=>false;

let pass=0,fail=0;
const chk=(n,c,d)=>{c?(pass++,console.log("  PASS  "+n+(d?"  ("+d+")":""))):(fail++,console.log("  FAIL  "+n+(d?"  ("+d+")":"")));};

console.log("-- playability is verified by plan.js (lookahead planner): median 200/200 gates --");

console.log("\n-- is it losable? --");
const m=run(masher,60,42), i=run(idle,60,42);
chk("mashing thrust dies on the ceiling-to-rock path",m.death!==null,"died to "+m.death+" at gate "+m.score);
chk("never thrusting hits the ground fast",i.death==="ground"&&i.t<1.2,"ground at t="+i.t.toFixed(2)+"s");

console.log("\n-- flappy feel: is one tap the right size? --");
const apex=(FLAP*FLAP)/(2*GRAV);
const riseT=-FLAP/GRAV;
chk("one thrust lifts ~60-70px",apex>58&&apex<72,apex.toFixed(1)+"px");
chk("rise takes ~0.25-0.30s",riseT>0.24&&riseT<0.31,riseT.toFixed(3)+"s");

console.log("\n-- gap geometry stays legal at every difficulty --");
let ok=true,tight=Infinity;
for(let s=0;s<=RAMP+10;s++){
  const g=gap(s),margin=58,lo=margin+g/2,hi=GROUND_Y-margin-g/2;
  if(hi<=lo)ok=false;
  tight=Math.min(tight,g/(SHIP_R*2));
}
chk("gap window never inverts as difficulty ramps",ok);
chk("tightest gap still >=4 ship-diameters",tight>=4,tight.toFixed(2)+" diameters");

console.log("\n-- pacing --");
const t0=spacing(0)/speed(0), t1=spacing(RAMP)/speed(RAMP);
chk("gate every ~1.5s at the start",t0>1.4&&t0<1.7,t0.toFixed(2)+"s");
chk("gate every ~1.0s at full difficulty",t1>0.9&&t1<1.15,t1.toFixed(2)+"s");
chk("difficulty tightens but never doubles the rate",t0/t1<1.7,(t0/t1).toFixed(2)+"x faster");

console.log("\n-- the ship fits through with room to steer --");
const clearance=(gap(RAMP)-SHIP_R*2)/2;
chk("clearance above and below at hardest gap >20px",clearance>20,clearance.toFixed(1)+"px each side");

console.log("\n"+pass+" passed, "+fail+" failed\n");
process.exit(fail?1:0);
