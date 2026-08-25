const W=380,GROUND_Y=540,STEP=1/120;
const GRAV=1750,FLAP=-472,MAXFALL=640,SHIP_X=112,SHIP_R=14,SW=62;
const SPACING0=238,SPEED0=152,GAP0=176,SPACING1=214,SPEED1=214,GAP1=138,RAMP=26;
const lerp=(a,b,t)=>a+(b-a)*Math.min(t,1);
const speed=s=>lerp(SPEED0,SPEED1,s/RAMP), gap=s=>lerp(GAP0,GAP1,s/RAMP), spacing=s=>lerp(SPACING0,SPACING1,s/RAMP);
function hit(cx,cy,r,x,y,w,h){const nx=Math.max(x,Math.min(cx,x+w)),ny=Math.max(y,Math.min(cy,y+h));const dx=cx-nx,dy=cy-ny;return dx*dx+dy*dy<r*r;}
function dead(y,spires){
  if(y+SHIP_R>=GROUND_Y)return true;
  for(const s of spires){const half=s.g/2;
    if(hit(SHIP_X,y,SHIP_R,s.x,-80,SW,(s.gy-half)+80))return true;
    if(hit(SHIP_X,y,SHIP_R,s.x,s.gy+half,SW,GROUND_Y-(s.gy+half)))return true;}
  return false;
}
// roll the world forward n steps under a fixed action, return survival depth
function survive(y,vy,spires,sp,firstFlap,horizon){
  let Y=y,V=vy;
  const S=spires.map(s=>({x:s.x,gy:s.gy,g:s.g}));
  for(let i=0;i<horizon;i++){
    if(i===0&&firstFlap)V=FLAP;
    else if(i>0){ // afterwards, thrust whenever falling below the aim point
      const n=S.find(s=>s.x+SW>SHIP_X-SHIP_R);
      const aim=n?n.gy:280;
      if(V>0&&Y>aim-4)V=FLAP;
    }
    V+=GRAV*STEP; if(V>MAXFALL)V=MAXFALL;
    Y+=V*STEP;
    for(const s of S)s.x-=sp*STEP;
    if(Y-SHIP_R<-6){Y=-6+SHIP_R;V=40;}
    if(dead(Y,S))return i;
  }
  return horizon;
}
function run(seed,maxGates,deltaCap,horizon){
  let rnd=seed;const rand=()=>((rnd=rnd*1103515245+12345&0x7fffffff)/0x7fffffff);
  let y=258,vy=FLAP,score=0,spires=[],prev=null,steps=0;
  const add=x=>{const g=gap(score),m=58;let lo=m+g/2,hi=GROUND_Y-m-g/2;
    if(prev!==null&&isFinite(deltaCap)){lo=Math.max(lo,prev-deltaCap);hi=Math.min(hi,prev+deltaCap);}
    const gy=lo+rand()*Math.max(1,hi-lo);prev=gy;spires.push({x,gy,g,scored:false});};
  add(W+90);add(W+90+spacing(0));
  while(score<maxGates&&steps<120*1200){
    steps++;
    const sp=speed(score);
    const a=survive(y,vy,spires,sp,true,horizon);
    const b=survive(y,vy,spires,sp,false,horizon);
    if(a>b)vy=FLAP;
    vy+=GRAV*STEP;if(vy>MAXFALL)vy=MAXFALL;
    y+=vy*STEP;
    for(const s of spires)s.x-=sp*STEP;
    const last=spires[spires.length-1];
    if(last&&last.x<W-spacing(score))add(last.x+spacing(score));
    while(spires.length&&spires[0].x+SW<-20)spires.shift();
    for(const s of spires)if(!s.scored&&s.x+SW<SHIP_X-SHIP_R){s.scored=true;score++;}
    if(y-SHIP_R<-6){y=-6+SHIP_R;vy=40;}
    if(dead(y,spires))return score;
  }
  return score;
}
console.log("deltaCap  horizon   scores over 8 seeds            median");
for(const d of [Infinity,170,140]){
  for(const h of [90,150]){
    const out=[];
    for(let s=1;s<=8;s++)out.push(run(s*7919,200,d,h));
    const sorted=[...out].sort((a,b)=>a-b);
    console.log(String(d).padEnd(10)+String(h).padEnd(10)+JSON.stringify(out).padEnd(30)+sorted[4]);
  }
}
