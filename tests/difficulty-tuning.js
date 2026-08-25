// Compare difficulty configs with two pilots:
//   naive  = bang-bang controller, a proxy for a casual player
//   planner= 1.25s lookahead search, a proxy for a skilled player
const H=208, GROUND_Y=181, W=128, STEP=1/120;

const CUR = {GRAV:587,FLAP:-158,MAXFALL:215,SHIP_R:4,SW:21,
  SPACING0:80,SPACING1:72,SPEED0:51,SPEED1:72,GAP0:59,GAP1:46,
  RAMP:26,DELTA:50,MARGIN:20};

const EASY = {GRAV:470,FLAP:-142,MAXFALL:190,SHIP_R:3.5,SW:21,
  SPACING0:84,SPACING1:78,SPEED0:45,SPEED1:60,GAP0:70,GAP1:56,
  RAMP:34,DELTA:42,MARGIN:18};

const lerp=(a,b,t)=>a+(b-a)*Math.min(t,1);
const inb=(y)=>y;
function hit(cx,cy,r,x,y,w,h){const nx=Math.max(x,Math.min(cx,x+w)),ny=Math.max(y,Math.min(cy,y+h));const dx=cx-nx,dy=cy-ny;return dx*dx+dy*dy<r*r;}

function mk(C){
  return {
    speed:s=>lerp(C.SPEED0,C.SPEED1,s/C.RAMP),
    gap:s=>lerp(C.GAP0,C.GAP1,s/C.RAMP),
    spacing:s=>lerp(C.SPACING0,C.SPACING1,s/C.RAMP),
    C
  };
}
function dead(y,spires,g){
  const C=g.C;
  if(y+C.SHIP_R>=GROUND_Y)return true;
  for(const s of spires){const half=s.g/2;
    if(hit(38,y,C.SHIP_R,s.x,-30,C.SW,(s.gy-half)+30))return true;
    if(hit(38,y,C.SHIP_R,s.x,s.gy+half,C.SW,GROUND_Y-(s.gy+half)))return true;}
  return false;
}
function run(g,policy,maxGates,seed){
  const C=g.C;
  let rnd=seed;const rand=()=>((rnd=rnd*1103515245+12345&0x7fffffff)/0x7fffffff);
  let y=87,vy=C.FLAP,score=0,spires=[],steps=0;
  const add=x=>{
    const gg=g.gap(score);
    let lo=C.MARGIN+gg/2, hi=GROUND_Y-C.MARGIN-gg/2;
    if(spires.length){const p=spires[spires.length-1].gy;lo=Math.max(lo,p-C.DELTA);hi=Math.min(hi,p+C.DELTA);}
    spires.push({x,gy:lo+rand()*Math.max(1,hi-lo),g:gg,scored:false});
  };
  add(W+30);add(W+30+g.spacing(0));
  while(score<maxGates&&steps<120*1500){
    steps++;
    const sp=g.speed(score);
    if(policy(y,vy,spires,g,sp))vy=C.FLAP;
    vy+=C.GRAV*STEP; if(vy>C.MAXFALL)vy=C.MAXFALL;
    y+=vy*STEP;
    for(const s of spires)s.x-=sp*STEP;
    const last=spires[spires.length-1];
    if(last&&last.x<W-g.spacing(score))add(last.x+g.spacing(score));
    while(spires.length&&spires[0].x+C.SW<-8)spires.shift();
    for(const s of spires)if(!s.scored&&s.x+C.SW<38-C.SHIP_R){s.scored=true;score++;}
    if(y-C.SHIP_R<-2){y=-2+C.SHIP_R;vy=14;}
    if(dead(y,spires,g))return score;
  }
  return score;
}
const naive=(y,vy,sp,g,cur)=>{const n=sp.find(s=>s.x+g.C.SW>38-g.C.SHIP_R);return y>(n?n.gy:95)-6&&vy>-40;};
function survive(y,vy,spires,sp,first,horizon,g){
  const C=g.C;let Y=y,V=vy;
  const S=spires.map(s=>({x:s.x,gy:s.gy,g:s.g}));
  for(let i=0;i<horizon;i++){
    if(i===0&&first)V=C.FLAP;
    else if(i>0){const n=S.find(s=>s.x+C.SW>38-C.SHIP_R);const aim=n?n.gy:95;if(V>0&&Y>aim-4)V=C.FLAP;}
    V+=C.GRAV*STEP;if(V>C.MAXFALL)V=C.MAXFALL;
    Y+=V*STEP;
    for(const s of S)s.x-=sp*STEP;
    if(Y-C.SHIP_R<-2){Y=-2+C.SHIP_R;V=14;}
    if(dead(Y,S,g))return i;
  }
  return horizon;
}
const planner=(y,vy,spires,g,sp)=>
  survive(y,vy,spires,sp,true,170,g) > survive(y,vy,spires,sp,false,170,g);
function stats(g,policy,n=15){
  const out=[];
  for(let i=1;i<=n;i++)out.push(run(g,policy,50,i*7919));
  out.sort((a,b)=>a-b);
  const finished=out.filter(v=>v>=50).length;
  return {med:out[Math.floor(n/2)], min:out[0], max:out[out.length-1],
          finish:Math.round(finished/n*100)};
}
function show(name,C){
  const g=mk(C);
  const nv=stats(g,naive), pl=stats(g,planner);
  console.log(name.padEnd(9)+
    "| casual med "+String(nv.med).padStart(2)+"  (range "+String(nv.min).padStart(2)+"-"+String(nv.max).padStart(2)+")"+
    "  | skilled med "+String(pl.med).padStart(2)+"  finishes "+String(pl.finish).padStart(3)+"%");
}
console.log("");
show("current", CUR);
show("easier",  EASY);
console.log("");
const f=(C)=>({
  apex:(C.FLAP*C.FLAP/(2*C.GRAV)).toFixed(1),
  rise:(-C.FLAP/C.GRAV).toFixed(2),
  t0:(C.SPACING0/C.SPEED0).toFixed(2),
  t1:(C.SPACING1/C.SPEED1).toFixed(2),
  gapD:(C.GAP1/(C.SHIP_R*2)).toFixed(1)
});
const a=f(CUR), b=f(EASY);
console.log("                       current -> easier");
console.log("thrust apex (px)         "+a.apex+"  -> "+b.apex);
console.log("rise time (s)            "+a.rise+"   -> "+b.rise);
console.log("gate interval, start (s) "+a.t0+"   -> "+b.t0);
console.log("gate interval, end   (s) "+a.t1+"   -> "+b.t1);
console.log("tightest gap (ship dia)  "+a.gapD+"   -> "+b.gapD);
console.log("");
