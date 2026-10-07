/* =====================================================================
   TYPE INVADERS - game engine
   Framework-free on purpose: this is a 60 fps canvas loop, not a React
   view. It is mounted once by GameCanvas.jsx and torn down by destroy().

   Everything the backend touches is funnelled through `opts`:
     opts.words       word packs pulled from GET /api/words
     opts.initialBest the player's personal best from the API
     opts.onStart()   fired when a run begins  -> Supabase ti_start_run
     opts.onFinish(r) fired when a run ends    -> Supabase ti_finish_run
   ===================================================================== */
import { GAME_TEMPLATE } from "./template.js";
import "./game.css";

export function startTypeInvader(host, opts = {}) {
  host.innerHTML = GAME_TEMPLATE;

  let rafId = 0, resizeTimer = 0, destroyed = false;
  const timers = new Set();
  function later(fn, delay) {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, delay);
    timers.add(id);
    return id;
  }
  const _off = [];
  function on(target, ev, fn, o) {
    target.addEventListener(ev, fn, o);
    _off.push(() => target.removeEventListener(ev, fn, o));
  }

  "use strict";
  function $(id){return host.querySelector("#"+id)}
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const pick=a=>a[(Math.random()*a.length)|0];
  function mulberry(seed){let t=seed>>>0;return function(){t+=0x6D2B79F5;let r=t;
    r=Math.imul(r^r>>>15,r|1);r^=r+Math.imul(r^r>>>7,r|61);return((r^r>>>14)>>>0)/4294967296}}

  /* ═════════ canvas ═════════ */
  const cvs=$('game'),ctx=cvs.getContext('2d');
  const ucv=$('ui'),uctx=ucv.getContext('2d');   // text layer, sits above the CRT overlay
  let W=0,H=0,DPR=1,SC=1,SW=480,SH=270;
  const SCENE_H=270;
  const scene=document.createElement('canvas'),sx=scene.getContext('2d');
  const CAMV={scx:240,shz:123,focal:418};
  /* The app's navbar is sticky and paints above the game, so it used to sit on
     top of the score and accuracy readouts. Measure it and hand the height to
     the stylesheet, which pushes #frame down by exactly that much. */
  function syncNavOffset(){
    const nav=document.querySelector('.navbar');
    document.documentElement.style.setProperty('--ti-nav',
      (nav?Math.round(nav.getBoundingClientRect().height):0)+'px');
  }
  function resize(){
    syncNavOffset();
    const r=$('tube').getBoundingClientRect();
    DPR=Math.min(window.devicePixelRatio||1,2);
    W=Math.max(320,r.width);H=Math.max(240,r.height);
    cvs.width=Math.floor(W*DPR);cvs.height=Math.floor(H*DPR);
    ucv.width=cvs.width;ucv.height=cvs.height;
    ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingEnabled=false;
    uctx.setTransform(DPR,0,0,DPR,0,0);uctx.imageSmoothingEnabled=false;
    SH=SCENE_H;SW=Math.round(SCENE_H*(W/H));
    scene.width=SW;scene.height=SH;sx.imageSmoothingEnabled=false;
    SC=W/SW;CAMV.scx=SW/2;CAMV.shz=SH*.455;CAMV.focal=SH*1.55;
    buildSkyline();
  }
  on(window,'resize',()=>{clearTimeout(resizeTimer);timers.delete(resizeTimer);resizeTimer=later(resize,80)});

  /* ═════════ audio ═════════ */
  const A={c:null,g:null,on:true};
  function ac(){if(!A.c){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
    A.c=new C();A.g=A.c.createGain();A.g.gain.value=.28;A.g.connect(A.c.destination)}
    if(A.c.state==='suspended')A.c.resume();return A.c}
  function tone(f1,f2,d,type,v,delay){if(!A.on)return;const c=ac();if(!c)return;
    const t=c.currentTime+(delay||0),o=c.createOscillator(),g=c.createGain();
    o.type=type||'square';o.frequency.setValueAtTime(f1,t);
    if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(f2,1),t+d);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v==null?.2:v,t+.005);
    g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(A.g);o.start(t);o.stop(t+d+.02)}
  function nz(d,v,f,delay){if(!A.on)return;const c=ac();if(!c)return;
    const t=c.currentTime+(delay||0),n=Math.floor(c.sampleRate*d),b=c.createBuffer(1,n,c.sampleRate),ch=b.getChannelData(0);
    for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*(1-i/n);
    const s=c.createBufferSource();s.buffer=b;const fl=c.createBiquadFilter();fl.type='lowpass';
    fl.frequency.setValueAtTime(f||1400,t);fl.frequency.exponentialRampToValueAtTime(150,t+d);
    const g=c.createGain();g.gain.setValueAtTime(v==null?.35:v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    s.connect(fl);fl.connect(g);g.connect(A.g);s.start(t);s.stop(t+d)}
  const SND={
    zap(){tone(rnd(1500,1750),380,.075,'square',.13)},
    kill(){nz(.32,.42,2400);tone(180,50,.28,'sawtooth',.11)},
    typo(){tone(150,84,.13,'sawtooth',.17)},
    lock(){tone(1900,2400,.04,'sine',.07)},
    hurt(){nz(.5,.55,600);tone(105,44,.45,'triangle',.2)},
    step(){nz(.09,.12,340)},
    sector(){tone(392,392,.1,'square',.1);tone(587,587,.1,'square',.1,.11);tone(784,784,.2,'square',.1,.22)},
    stage(){tone(261,261,.16,'square',.11);tone(392,392,.16,'square',.11,.17);
            tone(523,523,.16,'square',.11,.34);tone(784,784,.4,'square',.12,.51)},
    ui(){tone(880,1200,.04,'square',.08)},
    dead(){tone(300,60,1,'sawtooth',.18);nz(1.2,.35,500)},
    boss(){tone(112,112,.45,'sawtooth',.15);tone(84,84,.7,'sawtooth',.13,.4);nz(.8,.22,300,.1)},
    summon(){tone(72,44,.55,'sawtooth',.17);tone(320,190,.42,'square',.07,.05)},
    emerge(){nz(.3,.32,760);tone(96,58,.24,'triangle',.1)},
    win(){[523,659,784,1046,1318].forEach((f,i)=>tone(f,f,.3,'square',.12,i*.17))},
    /* Original game-over cue, written with the same oscillators as every other
       sound here. Plays only when public/music5.mp3 is missing, so the death
       screen is never silent even with no audio files installed. */
    gameoverTune(){
      [110,98,87,82].forEach((f,i)=>tone(f,f*.985,1.2,'triangle',.13,i*.62));
      [440,392,330,262,247,220].forEach((f,i)=>tone(f,f,.5,'square',.085,.18+i*.44));
      tone(165,55,2.2,'sawtooth',.1,2.5);
      nz(1.6,.16,420,2.6);
    }
  };

  /* ═════════ background music ═════════
     One track per stage. Switch at the stage banner in the same browser
     gesture as PLAY for stage 1. Pause the outgoing file immediately, including
     any pending play() promise, so tracks never overlap on a stage change or
     carry through to the results screen. Music and SFX remain independent. */
  const MUSIC_SRC={1:'/music1.mp3',2:'/music2.mp3',3:'/music3.mp3',
                   boss:'/music4.mp3',over:'/music5.mp3'};
  const MUS={els:{},dead:{},key:null,playing:false};
  const musTarget=()=>(MUS.playing&&CFG.music)?clamp(CFG.vol,0,100)/100:0;
  const musicMissing=()=>Object.keys(MUSIC_SRC).every(k=>MUS.dead[k]);
  function trackEl(key){
    if(MUS.dead[key])return null;
    if(MUS.els[key])return MUS.els[key];
    const src=MUSIC_SRC[key];if(!src)return null;
    const a=new Audio(src);
    a.loop=(key!=='over');
    a.preload='auto';a.volume=0;
    on(a,'error',()=>{if(destroyed)return;MUS.dead[key]=true;delete MUS.els[key];applyCfg()});
    MUS.els[key]=a;return a;
  }
  function musicPreload(){for(const k in MUSIC_SRC)trackEl(k)}
  const trackKeyFor=stage=>stage>=BOSS_STAGE?'boss':String(((stage-1)%NORMAL_STAGES)+1);
  function pauseTrack(a){
    a.pause();a.volume=0;
    try{a.currentTime=0}catch(e){}
  }
  function playTrack(a){
    if(!a||a._tiPending||!a.paused)return;
    let p;
    try{p=a.play()}catch(e){return}
    if(p&&p.then){
      a._tiPending=true;
      p.catch(()=>{}).finally(()=>{
        a._tiPending=false;
        // A slow play() may resolve after a stage switch or result screen.
        if(destroyed||MUS.els[MUS.key]!==a||!MUS.playing||!CFG.music)pauseTrack(a);
      });
    }
  }
  function musicStop(){
    MUS.key=null;
    for(const a of Object.values(MUS.els))pauseTrack(a);
  }
  function musicSwitch(key,rewind){
    if(MUS.key===key&&!rewind)return;
    musicStop();
    MUS.key=key;
    const a=trackEl(key);if(!a)return;
    // Sound begins at the banner, not after a timer or silent preload.
    a.volume=musTarget();
    if(MUS.playing&&CFG.music&&CFG.vol)playTrack(a);
  }
  function musicSyncStage(){
    const key=trackKeyFor(G.stage);
    if(MUS.key!==key)musicSwitch(key,true);
  }
  function musicSet(on,rewind){
    MUS.playing=!!on;
    if(!on||!CFG.music||!CFG.vol){
      for(const a of Object.values(MUS.els)){a.pause();a.volume=0}
      return;
    }
    const a=trackEl(MUS.key);if(!a)return;
    if(rewind){try{a.currentTime=0}catch(e){}}
    a.volume=musTarget();
    playTrack(a);
  }
  function musicTick(dt){
    const a=trackEl(MUS.key);
    if(a&&MUS.playing&&CFG.music){
      const target=musTarget();
      a.volume=clamp(a.volume+(target-a.volume)*Math.min(1,dt*8),0,1);
      if(!target&&!a.paused)a.pause();
    }
  }

  /* ═════════ words ═════════ */
  const DEFAULT_BANK={
  1:"ion arc rig hex jet orb pod ray fin cog dust null void beam claw core dock warp flux rust bolt gale halo iron kiln lace mesh volt scan grid hull side vary neon soot ash rim gate lamp duct wire vent coil moss bark owl fog pine oak den moth clay".split(' '),
  2:"plasma vector thrust cipher photon oxygen airlock reactor breach signal shield decode engine helmet cosmic lander mantle nebula quartz rescue silica tundra vacuum xenon zenith basalt cavern dredge girder hollow lantern thicket bramble rafter cellar attic".split(' '),
  3:"gravity antenna asteroid magnetic starship quantum radiator satellite telemetry astronaut corridor detector filament hydrogen isotope junction keystone luminous membrane nitrogen orbital particle radiation spectrum turbine scaffold chandelier staircase undergrowth".split(' '),
  4:"acceleration bioluminescent centrifugal decompression electromagnet fortification gravitational hyperspatial interstellar kaleidoscopic magnetosphere navigational photosynthesis reconnaissance".split(' ')};
  /* boss round — every entry is 20+ characters */
  const DEFAULT_BOSS="electroencephalography counterrevolutionaries deinstitutionalization institutionalization internationalization compartmentalization indistinguishability incomprehensibilities uncharacteristically electrocardiographic otorhinolaryngologist neuropsychopharmacology spectrophotometrically crystallographically magnetohydrodynamics immunoelectrophoresis hydrochlorofluorocarbon psychopharmacological antidisestablishmentarianism overintellectualizing disproportionateness photojournalistically incomprehensibleness electrophysiological counterproductiveness paleoanthropological".split(' ');
  // Missing or empty tiers used to feed undefined into word selection after an
  // admin disabled a pack. Fall back per tier, not only for the entire bank.
  const usable = (words) => Array.isArray(words)
    ? words.filter(w => typeof w === 'string' && /^[a-z]+$/.test(w)) : [];
  const BANK = Object.fromEntries(Object.entries(DEFAULT_BANK).map(([tier, fallback]) => {
    const words = usable(opts.words?.tiers?.[tier]);
    return [tier, words.length ? words : fallback];
  }));
  let BOSSBANK = usable(opts.words?.boss);
  if (!BOSSBANK || !BOSSBANK.length) BOSSBANK = DEFAULT_BOSS;

  function wordFor(n,kind){
    if(kind==='boss')return pick(BOSSBANK);
    if(kind==='child')return Math.random()<.72?pick(BANK[1]):pick(BANK[2]);
    const L=CFG.len,step=Math.min(n,10)/10,r=Math.random();let tier;
    if(L===0)tier=r<.78-step*.22?1:2;
    else if(L===2)tier=r<.45+step*.2?3:(r<.86?2:4);
    else tier=r<.42-step*.28?1:(r<.86-step*.16?2:3);
    return pick(BANK[tier]||BANK[2]);
  }
  function freshWord(n,kind){
    const live=G.aliens.filter(a=>!a.dying&&!a.dead);
    const used=live.map(a=>a.word),heads=new Set(used.map(w=>w[0]));
    let fb=null;
    for(let i=0;i<40;i++){const w=wordFor(n,kind);
      if(used.indexOf(w)>=0)continue;fb=fb||w;if(!heads.has(w[0]))return w}
    return fb||wordFor(n,kind);
  }

  /* ═════════ settings ═════════ */
  const CFG={diff:0,len:1,strict:0,sway:1,scan:1,snd:1,music:1,vol:45};   // EASY is the default now
  /* CFG.diff is an index; the leaderboard stores the name, so old rows with no
     difficulty recorded stay distinguishable from real EASY runs. */
  const DIFF_NAME=['EASY','NORMAL','HARD'];
  /* dmg = damage per melee hit. Easy takes 12, so you survive 8 hits, not 5. */
  const DIFF=[{sp:.52,gap:2.15,dmg:12},{sp:.82,gap:1.4,dmg:20},{sp:1.08,gap:1.05,dmg:20}];
  const MELEE_GAP=[2.1,1.15,.85]; // seconds between repeat hits once an alien is in your face
  const SWAY=[.45,1,1.7];
  /* ── tuning dials ───────────────────────────────────────────────────
     share of every wave that spawns as a SPEED alien (easy/normal/hard) */
  const RUNNER_RATIO=[.22,.75,1];
  /* speed-alien multiplier vs a normal alien, per difficulty */
  const RUNNER_MUL=[[1.85,2.15],[2.53,2.99],[2.53,2.99]];
  /* wave size and how many bodies may be alive at once, per difficulty */
  const WAVE_MUL=[.65,1,1.15];
  const LIVE_CAP_MAX=[4,6,7];
  /* growth curve is capped so late rounds stay typeable with 100% runners */
  const rampFor=t=>1+Math.min(t-1,12)*.04;
  /* ── run layout ────────────────────────────────────────────────────
     ONE round, made of four stages:
        stage 1  ROOKIE FACTORY
        stage 2  BLACKPINE FOREST
        stage 3  HOLLOWAY MANSION
        stage 4  AVERAGEREAPER - the final boss, and the end of the run
     One fight per stage, so a full demo run is four fights.

     There are only three maps, so stage 4 wraps back to the Factory.
     That is deliberate: it keeps stage 3 and stage 4 looking different. */
  const TOTAL_ROUNDS=1;
  const NORMAL_STAGES=3;              // one stage per map
  const BOSS_STAGE=NORMAL_STAGES+1;   // stage 4 is the boss and nothing else
  const TOTAL_STAGES=BOSS_STAGE;      // 4 stages in the round
  const TOTAL_BOSSES=1;
  const BOSS_SUMMON_EVERY=3;     // seconds between automatic summons
  const BOSS_FIRST_SUMMON=1.2;   // first one comes early, or a fast typist sees no brood at all
  const BOSS_CHILDREN=[1,2,3];   // spawned per AUTOMATIC summon, by difficulty
  const BOSS_TYPO_CHILDREN=[2,3,4]; // spawned INSTANTLY on every mistyped key, by difficulty
  const BOSS_PLATES=[1,1,1];     // one long word kills him on every difficulty
  const CHILD_CAP=[4,7,9];       // live children allowed on screen at once
  const BOSS_SCALE=1.95;         // boss sprite height vs a normal alien
  const BOSS_SPAWN_Z=20;         // boss walks in from closer than a grunt
  const BOSS_INTRO_HOLD=1;       // seconds the arrival banner holds before its 1s fade
  const BOSS_INTRO=1.9;          // banner is clear at 2.0s; he fades in over .42s after this,
                                 // so his word tag lands at 2.32s with nothing on top of it
  const TYPO_SPAWN_CD=.6;        // min seconds between typo-triggered summons
  const EMERGE_T=.75;            // ground-burst animation length
  function applyCfg(){
    if(destroyed)return;
    host.querySelectorAll('.seg').forEach(s=>s.querySelectorAll('button')
      .forEach(b=>b.classList.toggle('on',+b.dataset.v===CFG[s.dataset.set])));
    $('fx').classList.toggle('noscan',!CFG.scan);
    A.on=!!CFG.snd;
    const quiet=!CFG.music||!CFG.vol;
    $('mSfx').classList.toggle('off',!CFG.snd);
    $('mMusic').classList.toggle('off',quiet);
    const noFiles=musicMissing();
    $('mMusic').classList.toggle('gone',noFiles);
    $('mMusic').title=noFiles?'no music files in public/':(quiet?'Music off':'Music on \u00b7 '+CFG.vol);
    $('mSfx').title=CFG.snd?'Game sound on':'Game sound off';
    // both sliders show the same number and the same filled track
    const fill='linear-gradient(90deg,#5f8a34 0 '+CFG.vol+'%,#101a0d '+CFG.vol+'% 100%)';
    for(const id of['vol','volS']){const el=$(id);if(!el)continue;
      el.value=CFG.vol;el.style.background=fill;el.disabled=noFiles}
    $('volN').textContent=CFG.vol;$('volSN').textContent=CFG.vol;
    // turning music back on mid-run picks the track straight back up
    if(CFG.music&&MUS.playing)musicSet(true,false);
  }
  /* one entry point so the HUD slider, the settings slider and the mute button
     can never drift out of sync */
  function setVol(v){
    CFG.vol=clamp(Math.round(+v||0),0,100);
    if(CFG.vol>0&&!CFG.music)CFG.music=1;      // dragging up un-mutes
    applyCfg();
  }
  for(const id of['vol','volS']){const el=$(id);
    if(el)on(el,'input',e=>setVol(e.target.value))}
  host.querySelectorAll('.seg').forEach(s=>on(s,'click',e=>{
    const b=e.target.closest('button');if(!b||!s.dataset.set)return;
    CFG[s.dataset.set]=+b.dataset.v;applyCfg();SND.ui()}));
  $('mSfx').onclick=()=>{CFG.snd=CFG.snd?0:1;applyCfg();if(CFG.snd)SND.ui()};
  $('mMusic').onclick=()=>{
    if(CFG.music&&CFG.vol)CFG.music=0;
    else{CFG.music=1;if(!CFG.vol)CFG.vol=45}   // un-muting a zeroed slider gives it a level back
    applyCfg();SND.ui()};

  /* ═════════ world / path ═════════ */
  const SEG=4,HW=3.5,GY=-1.62,WT=3.7;
  let FOGD=36,FOGC=[6,8,10];
  const cam={z:0,x:0,y:0,yaw:0,roll:0,bob:0,yawPrev:0};
  let PATH={a1:5,f1:.035,p1:0,a2:2,f2:.09,p2:0};
  function newPath(seed){const r=mulberry(seed);
    PATH={a1:(3.2+r()*4.2)*SWAY[CFG.sway],f1:.026+r()*.018,p1:r()*6.283,
          a2:(1.2+r()*1.8)*SWAY[CFG.sway],f2:.062+r()*.05,p2:r()*6.283}}
  const pathX=z=>PATH.a1*Math.sin(z*PATH.f1+PATH.p1)+PATH.a2*Math.sin(z*PATH.f2+PATH.p2);
  const pathDX=z=>PATH.a1*PATH.f1*Math.cos(z*PATH.f1+PATH.p1)+PATH.a2*PATH.f2*Math.cos(z*PATH.f2+PATH.p2);

  function P(lx,y,z){
    const wx=pathX(z)+lx,dx=wx-cam.x,dz=z-cam.z;
    const c=Math.cos(cam.yaw),s=Math.sin(cam.yaw);
    const rz=dz*c+dx*s;if(rz<=.1)return null;
    const rx=dx*c-dz*s,sc=CAMV.focal/rz;
    return{x:CAMV.scx+rx*sc,y:CAMV.shz-(y-cam.y)*sc,s:sc,dz:rz};
  }
  function fog(c,dz){const f=Math.pow(clamp(dz/FOGD,0,1),.85);
    return'rgb('+(c[0]*(1-f)+FOGC[0]*f|0)+','+(c[1]*(1-f)+FOGC[1]*f|0)+','+(c[2]*(1-f)+FOGC[2]*f|0)+')'}
  function poly(pts,fill){if(pts.some(p=>!p))return;
    sx.beginPath();sx.moveTo(pts[0].x,pts[0].y);
    for(let i=1;i<pts.length;i++)sx.lineTo(pts[i].x,pts[i].y);
    sx.closePath();sx.fillStyle=fill;sx.fill()}
  const wallRect=(sd,z0,z1,y0,y1,c,dz)=>poly([P(sd*HW,y0,z0),P(sd*HW,y1,z0),P(sd*HW,y1,z1),P(sd*HW,y0,z1)],fog(c,dz));
  const wallRectAt=(x,z0,z1,y0,y1,c,dz)=>poly([P(x,y0,z0),P(x,y1,z0),P(x,y1,z1),P(x,y0,z1)],fog(c,dz));
  const planeRect=(y,x0,x1,z0,z1,c,dz)=>poly([P(x0,y,z0),P(x1,y,z0),P(x1,y,z1),P(x0,y,z1)],fog(c,dz));
  function billboard(x,z,w,h,y0,col,dz){
    const b=P(x,y0,z);if(!b)return null;
    const hw=w*b.s*.5,top=b.y-h*b.s;
    sx.fillStyle=fog(col,dz);sx.fillRect(b.x-hw,top,Math.max(1,hw*2),Math.max(1,b.y-top));
    return b;
  }

  /* ═════════ biomes ═════════ */
  const BIOMES=[
  { id:'factory', name:'ROOKIE FACTORY', fogc:[7,9,11], fogd:38, ceil:true, sky:'inside',
    draw(i,z0,z1,dz,d){
      planeRect(GY,-HW,HW,z0,z1,[40,43,42],dz);
      planeRect(GY+.004,-HW+.2,-HW+.9,z0,z1,[132,110,26],dz);      // hazard stripe
      planeRect(GY+.004,HW-.9,HW-.2,z0,z1,[132,110,26],dz);
      planeRect(WT,-HW,HW,z0,z1,[22,25,26],dz);                     // ceiling
      for(const sd of[-1,1]){
        wallRect(sd,z0,z1,GY,WT,[54,58,56],dz);
        for(let k=0;k<8;k++)wallRect(sd,z0+k*.5,z0+k*.5+.12,GY,WT,[44,48,46],dz); // ribs
        wallRect(sd,z0,z1,GY,GY+.7,[36,38,37],dz);
        wallRect(sd,z0,z1,GY+2.55,GY+2.75,[86,74,32],dz);           // yellow line
      }
      if(d.a<.30){const s=d.sd,a=z0+.7,b=z0+3.1;                    // roller door
        wallRect(s,a-.12,b+.12,GY,GY+2.7,[30,32,31],dz);
        for(let k=0;k<7;k++)wallRect(s,a,b,GY+k*.37,GY+k*.37+.30,[k%2?66:58,k%2?70:62,k%2?68:60],dz);}
      if(d.b<.34){const s=-d.sd,a=z0+1.4;                           // pipes
        wallRect(s,a,a+2.2,GY+2.9,GY+3.1,[62,66,64],dz);
        wallRect(s,a,a+2.2,GY+3.2,GY+3.34,[52,56,54],dz);}
      if(d.c<.22){const s=d.sd2,a=z0+2.2;                           // control panel
        wallRect(s,a,a+1.2,GY+1.1,GY+2.1,[40,44,48],dz);
        const bl=Math.sin(G.t*6+i)>0?1:.3;
        wallRect(s,a+.2,a+.4,GY+1.7,GY+1.85,[40*bl+20,220*bl,90*bl],dz*.5);
        wallRect(s,a+.55,a+.75,GY+1.7,GY+1.85,[220*bl,80*bl,40*bl],dz*.5);}
      if(i%7===2){                                                   // overhead gantry
        planeRect(WT-.35,-HW,HW,z0+1,z0+2.4,[30,33,32],dz);
        planeRect(WT-1.1,-HW,-HW+.4,z0+1,z0+2.4,[26,28,27],dz);
        planeRect(WT-1.1,HW-.4,HW,z0+1,z0+2.4,[26,28,27],dz);}
      if(d.e<.30){const s=d.sd,bx=s*(HW-.8);                        // crates / barrels
        for(let k=0;k<d.n;k++){const cz=z0+.6+k*1.1,h=.6+((i+k)%3)*.24;
          poly([P(bx-.5,GY,cz),P(bx-.5,GY+h,cz),P(bx+.5,GY+h,cz),P(bx+.5,GY,cz)],fog([70,62,40],dz));
          poly([P(bx-.5,GY+h,cz),P(bx-.5,GY+h,cz+.9),P(bx+.5,GY+h,cz+.9),P(bx+.5,GY+h,cz)],fog([86,76,50],dz));}}
      if(i%3===1)lamp(d.sd,z0+2,[210,225,255],.55,dz);
      if(d.f<.16)sideOpening(d.sd2,z0+1.2,z0+3.2,dz);
    }},
  { id:'forest', name:'BLACKPINE FOREST', fogc:[5,9,8], fogd:30, ceil:false, sky:'night',
    draw(i,z0,z1,dz,d){
      planeRect(GY,-HW-6,HW+6,z0,z1,[26,30,24],dz);
      planeRect(GY+.004,-1.5,1.5,z0,z1,[38,36,28],dz);              // dirt trail
      if(d.a<.5)planeRect(GY+.008,-.6+d.a*2,-.1+d.a*2,z0+.4,z0+1.6,[30,38,26],dz);
      // trunk walls
      const r=mulberry(i*7919);
      for(let k=0;k<7;k++){
        const side=k%2?1:-1,off=HW-.2+r()*5.5,tz=z0+r()*SEG;
        const tw=.32+r()*.55,th=5.5+r()*4;
        billboard(side*off,tz,tw,th,GY,[22+r()*10,24+r()*10,20+r()*8],dz);
        if(r()<.5){ // canopy blob
          const b=P(side*off,GY+th*.85,tz);
          if(b){sx.fillStyle=fog([16,24,18],dz);sx.beginPath();
            sx.ellipse(b.x,b.y,Math.max(2,tw*7*b.s),Math.max(2,tw*4*b.s),0,0,6.283);sx.fill()}}
      }
      if(d.b<.35){ // fallen log across the side
        const s=d.sd,bx=s*(HW-.4);
        poly([P(bx-.35,GY,z0+1),P(bx-.35,GY+.5,z0+1),P(bx+.35,GY+.5,z0+3),P(bx+.35,GY,z0+3)],fog([34,30,24],dz));}
      if(d.c<.4){ // ferns
        const s=d.sd2;
        for(let k=0;k<3;k++){const fx=s*(1.8+k*.5),fz=z0+.5+k*1.1;
          const b=P(fx,GY,fz);if(b){sx.fillStyle=fog([20,34,22],dz);
            sx.beginPath();sx.moveTo(b.x,b.y);sx.lineTo(b.x-b.s*.28,b.y-b.s*.5);
            sx.lineTo(b.x+b.s*.28,b.y-b.s*.5);sx.closePath();sx.fill()}}}
      if(d.e<.18){ // eyes in the dark
        const s=d.sd,b=P(s*(HW+2.5),GY+1.1,z0+2);
        if(b&&b.dz>8){const k=(Math.sin(G.t*1.7+i)>.3)?1:0;
          if(k){sx.fillStyle='rgba(200,240,120,.75)';
            sx.fillRect(b.x-b.s*.09,b.y,Math.max(1,b.s*.05),Math.max(1,b.s*.03));
            sx.fillRect(b.x+b.s*.04,b.y,Math.max(1,b.s*.05),Math.max(1,b.s*.03))}}}
      if(i%5===2){ // moon shaft
        const b=P(d.sd*1.2,GY,z0+2);
        if(b&&b.dz<FOGD){const al=clamp(1-b.dz/FOGD,0,1)*.16;
          const g=sx.createLinearGradient(b.x,b.y-b.s*5,b.x,b.y);
          g.addColorStop(0,'rgba(150,190,210,0)');g.addColorStop(1,'rgba(150,190,210,'+al+')');
          sx.fillStyle=g;sx.beginPath();sx.moveTo(b.x-b.s*.25,b.y-b.s*5);sx.lineTo(b.x+b.s*.25,b.y-b.s*5);
          sx.lineTo(b.x+b.s*1.2,b.y);sx.lineTo(b.x-b.s*1.2,b.y);sx.closePath();sx.fill()}}
      // ground mist
      const m=P(0,GY+.28,z0+2);
      if(m&&m.dz<FOGD){sx.globalAlpha=clamp(1-m.dz/FOGD,0,1)*.22;
        sx.fillStyle='#9fc0b4';sx.beginPath();
        sx.ellipse(m.x,m.y,m.s*5,Math.max(1,m.s*.32),0,0,6.283);sx.fill();sx.globalAlpha=1}
    }},
  { id:'mansion', name:'HOLLOWAY MANSION', fogc:[10,6,5], fogd:30, ceil:true, sky:'inside',
    draw(i,z0,z1,dz,d){
      planeRect(GY,-HW,HW,z0,z1,[62,44,30],dz);                     // floorboards
      for(let k=-3;k<=3;k++)planeRect(GY+.004,k*1.1,k*1.1+.06,z0,z1,[44,31,21],dz);
      planeRect(GY+.008,-1.25,1.25,z0,z1,[86,26,28],dz);            // carpet runner
      planeRect(GY+.012,-1.05,-.95,z0,z1,[150,120,60],dz);
      planeRect(GY+.012,.95,1.05,z0,z1,[150,120,60],dz);
      planeRect(WT,-HW,HW,z0,z1,[30,22,18],dz);                     // ceiling
      planeRect(WT-.03,-HW,HW,z0+1.8,z0+2.1,[46,34,26],dz);         // ceiling beam
      for(const sd of[-1,1]){
        wallRect(sd,z0,z1,GY,WT,[74,52,38],dz);                     // wallpaper
        for(let k=0;k<10;k++)wallRect(sd,z0+k*.4,z0+k*.4+.09,GY+1.5,WT,[64,44,32],dz);
        wallRect(sd,z0,z1,GY,GY+1.5,[52,34,24],dz);                 // wainscot
        wallRect(sd,z0,z1,GY+1.5,GY+1.62,[92,68,44],dz);            // chair rail
        wallRect(sd,z0,z1,WT-.3,WT,[46,32,24],dz);                  // crown
      }
      if(d.a<.34){const s=d.sd,a=z0+.9,b=z0+2.5;                    // door
        wallRect(s,a-.14,b+.14,GY,GY+2.6,[96,70,46],dz);
        wallRect(s,a,b,GY,GY+2.4,[58,38,26],dz);
        wallRect(s,a+.15,a+.72,GY+1.35,GY+2.2,[70,48,32],dz);
        wallRect(s,a+.88,a+1.45,GY+1.35,GY+2.2,[70,48,32],dz);
        wallRect(s,a+1.5,a+1.62,GY+1.15,GY+1.3,[190,160,80],dz*.6);}
      if(d.b<.42){const s=-d.sd,a=z0+1.2;                           // portrait
        wallRect(s,a,a+1.1,GY+1.8,GY+3.0,[128,96,44],dz*.75);
        wallRect(s,a+.12,a+.98,GY+1.92,GY+2.88,[26,22,20],dz);
        wallRect(s,a+.4,a+.7,GY+2.35,GY+2.7,[52,44,40],dz);}
      if(d.c<.2){const s=d.sd2,a=z0+2.6;                            // side table
        poly([P(s*(HW-.55)-.4,GY,a),P(s*(HW-.55)-.4,GY+.9,a),P(s*(HW-.55)+.4,GY+.9,a+.8),P(s*(HW-.55)+.4,GY,a+.8)],fog([54,36,24],dz));}
      if(i%4===1){ // chandelier
        const b=P(0,WT-.9,z0+2);
        if(b&&b.dz<FOGD){const fl=.75+.25*Math.sin(G.t*9+i*2);
          sx.fillStyle=fog([40,30,22],dz);sx.fillRect(b.x-1,b.y-b.s*.8,2,b.s*.8);
          const g=sx.createRadialGradient(b.x,b.y,1,b.x,b.y,b.s*1.4);
          const al=clamp(1-b.dz/FOGD,0,1)*.5*fl;
          g.addColorStop(0,'rgba(255,208,130,'+al+')');g.addColorStop(1,'rgba(255,208,130,0)');
          sx.fillStyle=g;sx.beginPath();sx.arc(b.x,b.y,b.s*1.4,0,6.283);sx.fill();
          sx.fillStyle='rgba(255,226,170,'+(.8*fl)+')';
          sx.beginPath();sx.ellipse(b.x,b.y,Math.max(1,b.s*.16),Math.max(1,b.s*.10),0,0,6.283);sx.fill()}}
      if(i%3===2)lamp(d.sd,z0+1.6,[255,190,110],.75,dz);
      if(d.f<.14)sideOpening(d.sd2,z0+1.2,z0+3.2,dz);
    }}
  ];
  function lamp(sd,lz,col,pw,dz){
    wallRect(sd,lz,lz+.32,GY+2.85,GY+3.15,[70,66,56],dz*.45);
    const c=P(sd*(HW-1.2),GY+.02,lz+.16);
    if(!c||c.dz>FOGD)return;
    const rr=c.s*1.6,al=clamp(1-c.dz/FOGD,0,1)*pw*.5;
    const g=sx.createRadialGradient(c.x,c.y,1,c.x,c.y,rr);
    g.addColorStop(0,'rgba('+col[0]+','+col[1]+','+col[2]+','+al+')');
    g.addColorStop(1,'rgba('+col[0]+','+col[1]+','+col[2]+',0)');
    sx.fillStyle=g;sx.beginPath();sx.ellipse(c.x,c.y,rr,rr*.34,0,0,6.283);sx.fill();
  }
  function sideOpening(sd,z0,z1,dz){
    wallRect(sd,z0,z1,GY,GY+2.9,[8,9,10],dz*.9);
    wallRect(sd,z0-.14,z0,GY,GY+3.0,[70,66,58],dz);
    wallRect(sd,z1,z1+.14,GY,GY+3.0,[70,66,58],dz);
  }
  function segData(i){
    const r=mulberry((i*2654435761^0x9e37)>>>0);
    return{a:r(),b:r(),c:r(),e:r(),f:r(),
      sd:r()<.5?-1:1,sd2:r()<.5?-1:1,n:1+((r()*3)|0),h:r()};
  }

  /* ═════════ menu skyline ═════════ */
  let SKY=null;
  function buildSkyline(){
    const c=document.createElement('canvas');c.width=SW;c.height=SH;const g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,0,SH*.8);
    gr.addColorStop(0,'#0a1018');gr.addColorStop(1,'#1a2028');g.fillStyle=gr;g.fillRect(0,0,SW,SH);
    const r=mulberry(90210);
    for(let layer=0;layer<3;layer++){
      const base=SH*(.52+layer*.09),shade=['#161d24','#1d252c','#242c33'][layer];
      let x=-20;
      while(x<SW+20){
        const w=12+r()*46,h=30+r()*(80-layer*14);
        g.fillStyle=shade;g.fillRect(x|0,(base-h)|0,w|0,(SH-base+h)|0);
        if(layer>0){g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x|0,(base-h)|0,2,h|0)}
        const wc=['#3c4a3a','#4a4a34','#2f4048'][(r()*3)|0];
        for(let wy=base-h+6;wy<base-4;wy+=7)for(let wx=x+3;wx<x+w-4;wx+=6)
          if(r()<.22){g.fillStyle=wc;g.globalAlpha=.5+r()*.5;g.fillRect(wx|0,wy|0,2,3);g.globalAlpha=1}
        if(r()<.18){g.fillStyle='#7d2020';g.fillRect((x+w*.3)|0,(base-h-8)|0,3,8)}
        x+=w+2+r()*10;
      }
    }
    SKY=c;
  }

  /* ═════════ state ═════════ */
  const G={
    state:'menu',t:0,stage:1,sector:1,total:0,
    hp:100,score:0,combo:0,bestCombo:0,kills:0,bosses:0,
    aliens:[],beams:[],parts:[],target:null,typed:0,
    spawnLeft:0,spawnT:0,liveCap:3,clearT:0,stopZ:0,
    shake:0,hurt:0,flash:0,recoil:0,blackout:0,pendingStage:0,
    correct:0,wrong:0,fightTime:0,runTime:0,sessionBest:0,prev:'fight',
    boss:null,bossTimer:0,bossIn:0,summonQ:[],bubble:'',bubbleT:0,typoCd:0,won:false,
    hackCd:0,hacked:false
  };
  const biome=()=>BIOMES[(G.stage-1)%BIOMES.length];
  /* openRun=true is the ONLY thing that should open a Supabase run. Quitting to the
     menu also resets state, and firing onStart there opened an IN_PROGRESS row
     that nothing ever completed. */
  function reset(openRun){
    Object.assign(G,{stage:1,sector:1,total:0,hp:100,score:0,combo:0,bestCombo:0,kills:0,bosses:0,
      aliens:[],beams:[],parts:[],target:null,typed:0,spawnLeft:0,spawnT:0,liveCap:3,clearT:0,
      stopZ:0,shake:0,hurt:0,flash:0,recoil:0,blackout:0,pendingStage:0,
      correct:0,wrong:0,fightTime:0,runTime:0,
      boss:null,bossTimer:0,bossIn:0,summonQ:[],bubble:'',bubbleT:0,typoCd:0,won:false,
      hackCd:0,hacked:false});
    cam.z=0;cam.x=0;cam.y=0;cam.yaw=0;cam.roll=0;cam.bob=0;
    newPath(1337);applyBiome();
    if (openRun && typeof opts.onStart === 'function') opts.onStart();
  }
  function applyBiome(){const b=biome();FOGC=b.fogc;FOGD=b.fogd}

  function objective(main,sub,hold){
    const o=$('objective');o.innerHTML=main+(sub?'<small>'+sub+'</small>':'');
    o.style.transition='none';o.style.opacity='1';
    requestAnimationFrame(()=>{o.style.transition='opacity 1s ease '+(hold||1.1)+'s';o.style.opacity='0'});
  }
  const FIGHTS_PER_STAGE=1;           // one fight per stage keeps the demo short
  /* Stage BOSS_STAGE *is* the boss: a single fight that ends the run. */
  const isBossStage=()=>G.stage>=BOSS_STAGE;
  function locLabel(){
    return 'R1/'+TOTAL_ROUNDS+' · S'+G.stage+'/'+TOTAL_STAGES+' · '+biome().name
      +(isBossStage()?' · BOSS':'');
  }
  function beginWalk(newStage){
    // The stage banner marks the music boundary. Stage 1 is switched from the
    // PLAY click; later stages switch when their banner appears.
    musicSwitch(trackKeyFor(G.stage),true);
    G.state='walk';
    G.stopZ=cam.z+(G.total===0?15:22);
    if(newStage){G.blackout=1;G.pendingStage=1}
    else $('hLoc').textContent=locLabel();
  }
  function beginFight(){
    G.state='fight';G.total++;
    musicSyncStage();                 // keep this stage track running through CONTACT
    G.boss=null;G.summonQ.length=0;G.bubbleT=0;G.bossTimer=0;G.typoCd=0;G.bossIn=0;
    if(isBossStage()){
      G.spawnLeft=0;
      G.liveCap=CHILD_CAP[CFG.diff]+2;
      // He does NOT spawn here. His word tag would render straight underneath the
      // arrival banner. He walks out of the dark once the text is gone.
      G.bossIn=BOSS_INTRO;
      objective('AVERAGEREAPER','FINAL STAGE',BOSS_INTRO_HOLD);
      SND.boss();
    }else{
      G.spawnLeft=Math.max(2,Math.round(Math.min(3+Math.floor((G.total-1)*1.2),14)*WAVE_MUL[CFG.diff]));
      G.liveCap=Math.min(3+Math.floor(G.total/2),LIVE_CAP_MAX[CFG.diff]);
      G.spawnT=.45;
      objective('CONTACT',G.spawnLeft+' HOSTILES',.7);
      SND.sector();
    }
  }
  function clearFight(){
    G.clearT=0;
    const wasBoss=isBossStage();
    G.hp=Math.min(100,G.hp+(wasBoss?35:20));
    G.score+=90*G.total+(wasBoss?400*G.stage:0);
    syncHUD(); // Also refresh bonuses immediately when the admin assist ends a fight.
    if(wasBoss){finish(true);return}     // the boss stage ends the run
    G.sector++;
    let newStage=false;
    if(G.sector>FIGHTS_PER_STAGE){
      G.sector=1;G.stage++;
      if(G.stage>TOTAL_STAGES){finish(true);return}
      newStage=true;
    }
    if(newStage&&G.stage>=BOSS_STAGE){objective('FINAL STAGE','AVERAGEREAPER AWAITS',1.4);SND.stage()}
    else if(newStage){objective('STAGE '+G.stage+' / '+TOTAL_STAGES,BIOMES[(G.stage-1)%BIOMES.length].name,1.4);SND.stage()}
    else             {objective('AREA CLEAR','MOVE UP',.9)}
    beginWalk(newStage);
  }

  /* ═════════ aliens ═════════ */
  const LANES=[-2.5,-1.25,0,1.25,2.5];
  const SPAWNZ=34,MINGAP=8;
  function bestLane(){
    let bi=-1,bg=-1;
    for(let i=0;i<LANES.length;i++){
      let gap=999;
      for(const a of G.aliens){if(a.dead)continue;
        if(Math.abs(a.lane-i)<=1){const g=(cam.z+SPAWNZ)-a.z;if(g<gap)gap=g}}
      if(gap>bg){bg=gap;bi=i}
    }
    return bg>=MINGAP?bi:-1;
  }
  /* How far in front of the camera an attacker is allowed to stop.
     The old value was a flat 1.8, which threw wide-lane aliens completely off
     the sides of the screen while they carried on hitting you. These bounds are
     derived from the projection so the whole sprite always fits the viewport,
     at any aspect ratio. */
  function stopDistFor(scale){
    const f=CAMV.focal,big=scale>1.5;
    const byFeet =f/(SH*.330);                      // feet stay above the bottom edge
    const byHead =f*(2.22*scale-1.62)/(SH*.435);    // crown stays below the top edge
    const byWidth=Math.min(f*.851*scale/(SW*.19),big?16:12); // don't fill the frame
    return Math.max(byFeet,byHead,byWidth,big?9.6:5.2);
  }
  /* widest thing on the sprite: swung arms, or the boss cloak and spikes */
  const spriteHalf=(a,s)=>1.85*(a.hscale||1)*.46*(a.boss?.78:.70)*s;
  /* same measurement in world units, for corridor containment */
  const spriteHalfW=a=>1.85*(a.hscale||1)*.46*(a.boss?.78:.70);
  /* the furthest an alien's CENTRE may sit from the path line without any part of
     it poking through a wall. Walls live at ±HW in path-local x, in every biome. */
  const laneLimit=a=>Math.max(.3,HW-spriteHalfW(a)-.12);
  const stopZOf=a=>stopDistFor(a.hscale||1)+(a.zJit||0);
  /* Keep an alien inside the tube, and only then keep it on screen.
     nx is its preferred lane as a fraction of the corridor half-width, -1..1.
     The old version steered toward a SCREEN column, which at 10-20 units out
     works out to 5-7 world units off the path line — straight through the wall.
     Order matters here: walk to the lane, clamp to the walls, and if the corridor
     has bent the alien off the viewport pull it back INWARD only. Nothing in this
     function can ever move an alien outward past HW. */
  function steer(a,dt,force){
    const lim=laneLimit(a);
    const want=clamp(a.nx||0,-1,1)*lim;
    a.x+=(want-a.x)*Math.min(1,dt*(force?3.4:1.8));
    a.x=clamp(a.x,-lim,lim);
    const p=P(a.x,GY,a.z);if(!p)return;
    const per=1/Math.max(p.s,.001);                 // screen px -> world units
    const half=Math.min(SW*.45,spriteHalf(a,p.s)+SW*.02);
    const over=p.x<half?half-p.x:(p.x>SW-half?SW-half-p.x:0);
    if(over)a.x=clamp(a.x+over*per,-lim,lim);
  }
  function laneNear(z){
    let bi=0,bs=-1;
    for(let i=0;i<LANES.length;i++){
      let d=999;
      for(const a of G.aliens){if(a.dead||a.boss)continue;
        if(Math.abs(a.lane-i)<=1)d=Math.min(d,Math.abs(a.z-z))}
      if(d>bs){bs=d;bi=i}
    }
    return bi;
  }
  function spawnAlien(runner,o){
    o=o||{};
    const li=o.lane!=null?o.lane:bestLane();if(li<0)return false;
    const baseSp=rnd(.85,1.15)*DIFF[CFG.diff].sp*rampFor(G.total);
    const RM=RUNNER_MUL[CFG.diff];
    G.aliens.push({lane:li,x:clamp(LANES[li]+rnd(-.16,.16),-2.6,2.6),
      z:o.zAbs!=null?o.zAbs:cam.z+SPAWNZ+rnd(0,2),
      word:freshWord(G.total,o.child?'child':'normal'),
      boss:false,runner:!!runner,child:!!o.child,hscale:1,
      sp:runner?baseSp*rnd(RM[0],RM[1]):baseSp,
      nx:((li-2)/2)*.82+rnd(-.06,.06),zJit:rnd(0,1.2),
      ph:Math.random()*6.28,hit:0,dying:0,dead:false,
      fade:o.emerge?0:1,emerge:o.emerge?0:1,raise:0,
      melee:false,hitCd:0,slam:0,pal:(Math.random()*4)|0});
    return true;
  }
  /* ── AverageReaper ── */
  function spawnBoss(){
    const b={lane:2,x:0,z:cam.z+BOSS_SPAWN_Z,word:freshWord(G.total,'boss'),
      boss:true,runner:false,child:false,hscale:BOSS_SCALE,
      sp:DIFF[CFG.diff].sp*(1+Math.min(G.total-1,10)*.03)*.55, // always the slowest thing on screen
      nx:0,zJit:0,ph:Math.random()*6.28,hit:0,dying:0,dead:false,
      fade:1,emerge:1,raise:0,melee:false,hitCd:0,slam:0,pal:0,
      plates:BOSS_PLATES[CFG.diff],platesMax:BOSS_PLATES[CFG.diff]};
    G.aliens.push(b);G.boss=b;G.bossTimer=BOSS_FIRST_SUMMON;
  }
  const liveChildren=()=>G.aliens.filter(a=>a.child&&!a.dead&&!a.dying).length;
  function bossSummon(n,instant){
    const b=G.boss;if(!b||b.dying||b.dead||b.fade>0)return false;
    n=Math.min(n==null?BOSS_CHILDREN[CFG.diff]:n,
               Math.max(0,CHILD_CAP[CFG.diff]-liveChildren()-G.summonQ.length));
    if(n<=0)return false;
    b.raise=1;G.bubble=instant?'PUNISH':pick(['WAKE UP','EMERGE']);G.bubbleT=1.7;
    SND.summon();
    const d0=instant?.05:.4,step=instant?.09:.17;
    for(let i=0;i<n;i++)G.summonQ.push(d0+i*step); // they claw out one after another
    return true;
  }
  function emergeChild(){
    const z=cam.z+rnd(17,26);
    spawnAlien(Math.random()<RUNNER_RATIO[CFG.diff],{lane:laneNear(z),zAbs:z,child:true,emerge:true});
    const a=G.aliens[G.aliens.length-1];
    if(a)dust(a,14);
  }
  function dust(a,n){
    const p=P(a.x,GY+.1,a.z);if(!p)return;
    for(let i=0;i<n;i++){const ang=-Math.PI/2+rnd(-1.1,1.1),sp=rnd(30,150)*SC*.4;
      G.parts.push({x:p.x*SC,y:p.y*SC,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,g:340,
        t:0,life:rnd(.25,.7),c:i%3?'#5a4a34':'#7d6a4c',r:rnd(2,4)*SC*.45})}
  }

  /* ═════════ typing ═════════ */
  function acquire(ch){
    let best=null;
    for(const a of G.aliens){if(a.dying||a.dead||a.fade>0||a.emerge<1)continue;
      if(a.word[0]===ch&&(!best||a.z<best.z))best=a}
    if(best){G.target=best;G.typed=0;SND.lock();return true}
    return false;
  }
  function shoot(a){const p=P(a.x,GY+1.5,a.z);if(!p)return;
    G.beams.push({x:p.x*SC,y:p.y*SC,t:0});G.recoil=1;SND.zap()}
  function typeKey(ch){
    if(G.state!=='fight')return;
    if(!G.target){if(!acquire(ch))return}
    const a=G.target;
    if(!a||a.dead||a.dying){G.target=null;G.typed=0;return}
    if(a.word[G.typed]===ch){
      G.typed++;G.correct++;a.hit=1;shoot(a);
      if(G.typed>=a.word.length){
        G.target=null;G.typed=0;
        G.combo++;G.bestCombo=Math.max(G.bestCombo,G.combo);
        G.score+=Math.round(a.word.length*10*(1+Math.min(G.combo,25)*.1)*(a.boss?3.5:1));
        SND.kill();
        if(a.boss&&a.plates>1){           // plate cracked — he staggers and keeps coming
          a.plates--;a.hit=1;a.slam=0;a.z+=1.4;
          a.word=freshWord(G.total,'boss');
          G.shake=Math.max(G.shake,14);G.flash=.5;burst(a,false);
        }else{
          a.dying=.001;G.kills++;
          if(a.boss){
            // He dies alone. Everything he already pulled out of the ground stays
            // alive and still has to be typed down before the sector clears.
            G.boss=null;G.bosses++;G.summonQ.length=0;G.bubbleT=0;
            G.score+=600*G.stage;G.flash=1;G.shake=Math.max(G.shake,26);
            SND.stage();
          }
        }
      }
    }else miss();
  }
  function miss(){
    G.wrong++;G.combo=0;G.shake=Math.max(G.shake,4);SND.typo();
    const e=$('accBox');e.classList.remove('bad');void e.offsetWidth;e.classList.add('bad');
    if(CFG.strict){G.target=null;G.typed=0}
    // every mistake in a boss round hands him 2 / 3 / 4 more bodies, right now.
    // The automatic 3s clock is deliberately NOT reset — a mistake must never buy
    // you a breather from the next scheduled wave.
    if(G.boss&&G.typoCd<=0&&bossSummon(BOSS_TYPO_CHILDREN[CFG.diff],true))G.typoCd=TYPO_SPAWN_CD;
  }

  /* ═════════ admin demo assist ("HACK") ═════════
     Wipes everything alive and ends the current fight on the spot, so a live
     demo can reach the boss without typing through three rounds first.

     It is worth ZERO points on purpose. The score a hacked run submits stays
     inside RunService's ceiling, so the server still validates it honestly and
     a demo can never outrank a real player. The 1.2s cooldown also keeps a
     four-round skip above the server's 3-second minimum-duration check.

     opts.isAdmin only hides the button. It is not a security control - the
     real guarantee is that the hack cannot manufacture score. */
  const HACK_CD=1.2;
  const hackBtn=$('hack');
  const showHack=v=>{if(hackBtn)hackBtn.classList.toggle('hide',!(v&&opts.isAdmin))};
  function hackClear(){
    if(!opts.isAdmin||G.state!=='fight'||G.hackCd>0)return;
    G.hackCd=HACK_CD;G.hacked=true;
    for(const a of G.aliens){
      if(a.dead)continue;
      burst(a,false);
      if(a.boss)G.bosses++;
      G.kills++;a.dead=true;              // no score: see the note above
    }
    G.aliens.length=0;
    G.boss=null;G.summonQ.length=0;G.spawnLeft=0;G.bossIn=0;G.bubbleT=0;
    G.target=null;G.typed=0;
    G.flash=1;G.shake=Math.max(G.shake,20);
    SND.kill();SND.stage();
    clearFight();
  }
  if(hackBtn)on(hackBtn,'click',e=>{e.preventDefault();hackClear()});

  /* ═════════ input ═════════ */
  on(window,'keydown',e=>{
    if(e.key==='F9'){e.preventDefault();hackClear();return}   // same thing, keyboard
    if(e.key==='Escape'){
      if(G.state==='fight'||G.state==='walk')pause(true);
      else if(G.state==='pause')pause(false);
      return;
    }
    if(G.state==='menu'||G.state==='pause'||G.state==='over'||G.state==='settings'||G.state==='exit'){
      const items=[...host.querySelectorAll('.screen:not(.hide) .item')];
      if(!items.length)return;
      let i=items.findIndex(b=>b.classList.contains('sel'));
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();
        i=(i<0?0:i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;
        items.forEach(b=>b.classList.remove('sel'));items[i].classList.add('sel');SND.ui();
      }else if(e.key==='Enter'&&i>=0)items[i].click();
      return;
    }
    if(G.state!=='fight')return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='Backspace'){e.preventDefault();G.target=null;G.typed=0;return}
    if(e.key===' ')e.preventDefault();
    if(e.key.length===1){const c=e.key.toLowerCase();if(c>='a'&&c<='z')typeKey(c)}
  });
  on($('catch'),'input',()=>{const v=$('catch').value.toLowerCase();$('catch').value='';
    for(const c of v)if(c>='a'&&c<='z')typeKey(c)});
  on(window,'pointerdown',e=>{
    // dragging the volume slider on a phone must not yank focus to the key catcher
    if(e.target&&e.target.closest&&e.target.closest('.hVol,#snd'))return;
    if(G.state==='fight'&&/Mobi|Android/i.test(navigator.userAgent))$('catch').focus()});

  /* ═════════ screens ═════════ */
  const SCR={menu:$('sMenu'),settings:$('sSettings'),pause:$('sPause'),over:$('sOver'),exit:$('sExit')};
  const show=n=>{for(const k in SCR)SCR[k].classList.toggle('hide',k!==n)};
  const hideAll=()=>{for(const k in SCR)SCR[k].classList.add('hide')};
  function pause(on){
    if(on){G.prev=G.state;G.state='pause';show('pause');musicSet(false)}
    else{G.state=G.prev||'fight';hideAll();$('snd').classList.add('game');musicSet(true,false)}
  }
  on(host,'click',e=>{
    const b=e.target.closest('[data-go]');if(!b)return;SND.ui();ac();
    const go=b.dataset.go;
    if(go==='play'){reset(true);hideAll();$('hud').classList.add('on');$('snd').classList.add('game');
      showHack(true);
      document.body.classList.add('ti-running');
      objective('STAGE 1','ROOKIE FACTORY',1.3);SND.stage();
      beginWalk(false);musicSet(true,false)}
    else if(go==='settings'){G.state='settings';show('settings')}
    else if(go==='menu'){G.state='menu';show('menu');$('hud').classList.remove('on');
      $('snd').classList.remove('game');showHack(false);musicSet(false);musicStop();
      document.body.classList.remove('ti-running');reset(false)}
    else if(go==='resume')pause(false);
    else if(go==='exit'){musicSet(false);document.body.classList.add('off');
      later(()=>{document.body.classList.remove('off');G.state='exit';show('exit')},520)}
  });
  const mmss=t=>{const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+(s<10?'0':'')+s};
  function rankOf(won){
    const p=(won?30:0)+Math.min(40,wpm()*.7)+Math.max(0,acc()-60)*.75;
    return p>=95?'S':p>=80?'A':p>=62?'B':p>=45?'C':'D';
  }
  function finish(won){
    G.won=!!won;G.state='over';
    showHack(false);
    document.body.classList.remove('ti-running');   // navbar becomes usable again
    musicStop();                         // never carry a stage track onto results
    if(won){
      musicSet(false);                   // victory: results are silent
      SND.win();
    }else{
      SND.dead();
      if(!MUS.dead.over&&CFG.music&&CFG.vol){
        musicSwitch('over',true);musicSet(true,false);  // public/music5.mp3, no delay
      }else{
        musicSet(false);SND.gameoverTune();              // no file: synth cue
      }
    }
    G.sessionBest=Math.max(G.sessionBest,G.score);
    const cleared=won?TOTAL_STAGES:G.stage-1;
    $('overTitle').textContent=won?'YOU BEAT THE GAME':'YOU WERE OVERRUN';
    $('fScore').textContent=G.score;
    $('fRound').textContent=cleared+'/'+TOTAL_STAGES;
    $('fKills').textContent=G.kills;
    $('fBoss').textContent=G.bosses+'/'+TOTAL_BOSSES;
    $('fWpm').textContent=wpm();
    $('fAcc').textContent=acc()+'%';
    $('fCombo').textContent=G.bestCombo;
    $('fTime').textContent=mmss(G.runTime);
    $('fRank').textContent=rankOf(won);
    $('bestLine').textContent=(won?'ALL '+TOTAL_STAGES+' STAGES CLEARED — ':'BEST THIS SESSION — ')
      +G.sessionBest+'  ·  '+(DIFF_NAME[CFG.diff]||'EASY')
      +(G.hacked?'  ·  ADMIN ASSIST USED':'');
    $('hud').classList.remove('on');$('snd').classList.remove('game');
    show('over');
    if (typeof opts.onFinish === 'function') {
      opts.onFinish({
        score: G.score, kills: G.kills, bosses: G.bosses, bestCombo: G.bestCombo,
        wpm: wpm(), accuracy: acc(), stageReached: G.stage, roundsCleared: cleared,
        rank: rankOf(won), durationSec: Math.round(G.runTime), won: G.won,
        difficulty: DIFF_NAME[CFG.diff] || 'EASY',
        hacked: G.hacked,          // Play.jsx maps this to the assisted field
      });
    }
  }
  const gameOver=()=>finish(false);
  const wpm=()=>G.fightTime>2?Math.round((G.correct/5)/(G.fightTime/60)):0;
  const acc=()=>{const t=G.correct+G.wrong;return t?Math.round(G.correct/t*100):100};
  async function saveBest(){ /* handled by the Supabase API, see finish() */ }
  G.sessionBest = Number(opts.initialBest) || 0;

  /* ═════════ update ═════════ */
  let stepT=0;
  function update(dt){
    G.t+=dt;
    G.hackCd=Math.max(0,G.hackCd-dt);
    G.shake*=Math.pow(.003,dt);
    G.hurt=Math.max(0,G.hurt-dt*1.6);
    G.flash=Math.max(0,G.flash-dt*3.4);
    G.recoil=Math.max(0,G.recoil-dt*7);
    for(const b of G.beams){b.t+=dt*7;if(b.t>=1)b.done=true}
    G.beams=G.beams.filter(b=>!b.done);
    for(const p of G.parts){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt}
    G.parts=G.parts.filter(p=>p.t<p.life);

    if(G.state!=='walk'&&G.state!=='fight')return;
    G.runTime+=dt;

    /* camera follows the path */
    cam.x=pathX(cam.z);
    const yawT=Math.atan(pathDX(cam.z));
    cam.yawPrev=cam.yaw;
    cam.yaw+=(yawT-cam.yaw)*Math.min(1,dt*6);

    if(G.state==='walk'){
      if(G.blackout>0){
        G.blackout-=dt*1.6;
        if(G.pendingStage&&G.blackout<=.5){G.pendingStage=0;applyBiome();
          newPath((G.stage*7919+13)>>>0);$('hLoc').textContent=locLabel()}
        if(G.blackout<0)G.blackout=0;
      }
      const remain=G.stopZ-cam.z,v=clamp(remain*.85,1.5,5.4);
      cam.z+=v*dt;cam.bob+=dt*v*1.5;
      cam.y=Math.abs(Math.sin(cam.bob))*.055-.02;
      const yawRate=(cam.yaw-cam.yawPrev)/Math.max(dt,.0001);
      cam.roll+=(clamp(-yawRate*.85,-.075,.075)-cam.roll)*Math.min(1,dt*4);
      stepT-=dt*v*.55;if(stepT<=0){stepT=1;SND.step()}
      if(remain<.25){cam.z=G.stopZ;beginFight()}
      return;
    }

    /* fight */
    if(G.bossIn<=0)G.fightTime+=dt;   // boss intro is dead air, keep it out of WPM
    cam.roll+=(0-cam.roll)*Math.min(1,dt*5);
    cam.y+=(0-cam.y)*Math.min(1,dt*4);
    cam.bob+=dt*.7;cam.y+=Math.sin(cam.bob*1.6)*.0016;

    G.typoCd=Math.max(0,G.typoCd-dt);
    G.bubbleT=Math.max(0,G.bubbleT-dt);

    const live=G.aliens.filter(a=>!a.dead&&!a.dying).length;
    if(G.spawnLeft>0&&live<G.liveCap){
      G.spawnT-=dt;
      if(G.spawnT<=0){
        if(spawnAlien(Math.random()<RUNNER_RATIO[CFG.diff])){
          G.spawnLeft--;
          G.spawnT=DIFF[CFG.diff].gap*rnd(.75,1.3)/(1+Math.min(G.total,14)*.03);
        }else G.spawnT=.3;
      }
    }

    /* boss arrival: banner first, then he steps out of the fog */
    if(G.bossIn>0){
      G.bossIn-=dt;
      const k=1-clamp(G.bossIn/BOSS_INTRO,0,1);
      G.shake=Math.max(G.shake,.8+k*2.4);      // footsteps closing in — delete this line for silence
      if(G.bossIn<=0){G.bossIn=0;spawnBoss()}
    }

    /* boss: automatic summon every BOSS_SUMMON_EVERY seconds, timed from his arrival */
    if(G.boss&&!G.boss.dying&&!G.boss.dead){
      G.bossTimer-=dt;
      // blocked by the child cap: wait a beat and try again, don't hammer the
      // cap so that every kill is instantly replaced
      if(G.bossTimer<=0)G.bossTimer=bossSummon()?BOSS_SUMMON_EVERY:1;
    }
    for(let i=G.summonQ.length-1;i>=0;i--){
      G.summonQ[i]-=dt;
      if(G.summonQ[i]<=0){G.summonQ.splice(i,1);emergeChild()}
    }

    for(const a of G.aliens){
      if(a.raise>0)a.raise=Math.max(0,a.raise-dt*.85);
      if(a.dying){a.dying+=dt;if(a.dying>.13){a.dead=true;burst(a,false)}continue}
      if(a.emerge<1){                       // clawing out of the ground: not yet a threat
        a.emerge=Math.min(1,a.emerge+dt/EMERGE_T);a.ph+=dt*3;
        if(a.emerge>=1){dust(a,10);SND.emerge()}
        continue;
      }
      if(a.fade>0){a.fade=Math.max(0,a.fade-dt*2.4);continue}
      a.hit=Math.max(0,a.hit-dt*5);
      a.slam=Math.max(0,(a.slam||0)-dt*4);
      if(a.melee){
        a.ph+=dt*2.2;
        const sz=stopZOf(a);                // re-assert on resize so it stays on screen
        if(Math.abs(a.z-cam.z-sz)>.1)a.z+=(cam.z+sz-a.z)*Math.min(1,dt*3);
        steer(a,dt,1);
        a.hitCd-=dt;
        if(a.hitCd<=0){
          a.hitCd=MELEE_GAP[CFG.diff]*(a.boss?1.3:1);
          const dmg=DIFF[CFG.diff].dmg*(a.boss?1.5:(a.child?.75:1));
          G.hp-=dmg;G.combo=0;G.hurt=1;G.shake=Math.max(G.shake,a.boss?22:16);
          SND.hurt();burst(a,true);a.slam=1;
          if(G.hp<=0){G.hp=0;syncHUD();gameOver();return}
        }
        continue;
      }
      a.z-=a.sp*dt;a.ph+=dt*(a.runner?7.2:(a.boss?2.1:3.4));
      steer(a,dt,0);
      const sz=stopZOf(a);
      if(a.z-cam.z<=sz){a.z=cam.z+sz;a.melee=true;a.hitCd=.55}
    }
    G.aliens=G.aliens.filter(a=>!a.dead);
    if(G.boss&&(G.boss.dead||G.boss.dying))G.boss=null;
    if(G.bossIn<=0&&G.spawnLeft===0&&G.summonQ.length===0&&G.aliens.length===0){
      G.clearT+=dt;if(G.clearT>1.1)clearFight();
    }else G.clearT=0;
    syncHUD();
  }
  function burst(a,red){
    const p=P(a.x,GY+.9,a.z);if(!p)return;
    const n=red?18:30,col=red?'#ff4444':'#8dff5c';
    for(let i=0;i<n;i++){const ang=Math.random()*6.283,sp=rnd(40,300)*SC*.4;
      G.parts.push({x:p.x*SC,y:p.y*SC,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-70,g:420,
        t:0,life:rnd(.3,.85),c:col,r:rnd(2,5)*SC*.45})}
    if(!red)G.flash=.6;
  }
  function syncHUD(){
    $('hScore').textContent=G.score;
    $('hAcc').textContent=acc();
    $('hHp').textContent=Math.max(0,Math.round(G.hp));
    $('hpBox').classList.toggle('low',G.hp<=40);
    $('hCombo').textContent='COMBO x'+(1+Math.min(G.combo,25));
    if(hackBtn)hackBtn.classList.toggle('cool',G.hackCd>0);
  }

  /* ═════════ scene ═════════ */
  function drawBackdrop(){
    const b=biome();
    if(b.sky==='night'){
      const g=sx.createLinearGradient(0,0,0,SH*.7);
      g.addColorStop(0,'#04070c');g.addColorStop(1,'#0a1310');sx.fillStyle=g;sx.fillRect(0,0,SW,SH);
      const r=mulberry(555);
      for(let i=0;i<70;i++){const x=r()*SW,y=r()*SH*.55;
        sx.globalAlpha=.2+r()*.5;sx.fillStyle='#cfe3d8';sx.fillRect(x|0,y|0,1,1)}
      sx.globalAlpha=1;
      sx.fillStyle='rgba(200,220,210,.16)';sx.beginPath();
      sx.arc(SW*.72,SH*.16,SH*.07,0,6.283);sx.fill();
    }else{
      sx.fillStyle='rgb('+FOGC[0]+','+FOGC[1]+','+FOGC[2]+')';sx.fillRect(0,0,SW,SH);
    }
  }
  function drawScene(){
    sx.clearRect(0,0,SW,SH);
    drawBackdrop();
    const b=biome();
    const i0=Math.floor(cam.z/SEG)-1,i1=i0+Math.ceil(FOGD*1.15/SEG)+2;
    for(let i=i1;i>=i0;i--){
      const z0=i*SEG,z1=z0+SEG,dz=Math.max(.5,(z0+z1)/2-cam.z);
      if(dz>FOGD*1.2)continue;
      b.draw(i,z0,z1,dz,segData(i));
    }
    const list=G.aliens.slice().sort((a,b2)=>b2.z-a.z);
    for(const a of list)drawAlien(a);
  }
  const ALIEN_PAL=[
    {b:[34,44,32],h:[54,66,48]},   // mossy green
    {b:[46,42,20],h:[70,64,30]},   // sickly yellow-olive
    {b:[26,32,46],h:[42,50,70]},   // blue-violet
    {b:[44,26,20],h:[68,42,32]}    // rust brown
  ];
  const BOSS_PAL={b:[26,48,96],h:[44,76,142]};   // AverageReaper — deep blue
  const RUNNER_PAL={b:[56,24,10],h:[90,40,16]};
  function drawAlien(a){
    const b=P(a.x,GY,a.z);if(!b)return;
    const s=b.s,scale=a.hscale||1,h=1.85*s*scale,w=h*.46;
    const vis=clamp(1-b.dz/(FOGD*1.05),0,1);
    if(vis<=.02)return;
    const em=a.emerge==null?1:a.emerge;
    const melee=!!a.melee,slam=a.slam||0,running=!!a.runner&&!melee;
    const raise=a.boss?clamp((a.raise||0)*1.5,0,1):0;
    const step=Math.sin(a.ph),step2=Math.cos(a.ph);
    const bob=running?Math.abs(step)*h*.07:(melee?0:Math.abs(step)*h*.018);
    const stretch=running?1+Math.abs(step)*.05:1;

    sx.save();sx.translate(b.x,b.y);
    if(a.fade>0)sx.globalAlpha=1-a.fade;

    if(em<1){
      // broken ground it is climbing out of
      sx.fillStyle='rgba(40,32,23,.95)';
      sx.beginPath();sx.ellipse(0,0,w*(.72+em*.5),Math.max(1,h*.055),0,0,6.283);sx.fill();
      sx.fillStyle='rgba(0,0,0,.6)';
      sx.beginPath();sx.ellipse(0,-h*.012,w*(.46+em*.3),Math.max(1,h*.032),0,0,6.283);sx.fill();
      sx.beginPath();sx.rect(-w*4,-h*2.6,w*8,h*2.6);sx.clip();  // nothing shows below the floor
      sx.translate(0,(1-em)*h*1.06);
    }else{
      sx.fillStyle='rgba(0,0,0,.5)';sx.beginPath();sx.ellipse(0,0,w*.55,h*.05,0,0,6.283);sx.fill();
    }

    sx.save();sx.translate(0,-bob);sx.scale(1/stretch,stretch);

    const pal=a.boss?BOSS_PAL:(a.runner?RUNNER_PAL:ALIEN_PAL[a.pal||0]);
    const hitLit=a.hit>0||a.dying,atkLit=!hitLit&&slam>.35;
    let body,head;
    if(hitLit){body='#eaffd8';head='#ffffff'}
    else if(atkLit){body='#ff8a68';head='#ffb494'}
    else{
      body='rgb('+(pal.b[0]+vis*26|0)+','+(pal.b[1]+vis*26|0)+','+(pal.b[2]+vis*26|0)+')';
      head='rgb('+(pal.h[0]+vis*30|0)+','+(pal.h[1]+vis*30|0)+','+(pal.h[2]+vis*30|0)+')';
    }

    // legs — real alternating stride, lifted on the forward swing
    const hipY=-h*.42;
    let legSw,legLift;
    if(melee){legSw=w*.04*Math.sin(a.ph);legLift=0}
    else if(running){legSw=w*.30*step;legLift=h*.20}
    else{legSw=w*.15*step;legLift=h*.08}
    const lFootX=-w*.13+legSw,lFootY=melee?0:-Math.max(0,step)*legLift;
    const rFootX= w*.13-legSw,rFootY=melee?0:-Math.max(0,-step)*legLift;
    sx.strokeStyle=body;sx.lineWidth=Math.max(1.6,w*.15);sx.lineCap='round';
    sx.beginPath();sx.moveTo(-w*.13,hipY);sx.lineTo(lFootX,lFootY);sx.stroke();
    sx.beginPath();sx.moveTo( w*.13,hipY);sx.lineTo(rFootX,rFootY);sx.stroke();

    // boss cloak — a wider silhouette behind the torso
    if(a.boss){
      sx.fillStyle=hitLit?'#dff2ff':'rgb('+(pal.b[0]*.6|0)+','+(pal.b[1]*.6|0)+','+(pal.b[2]*.72|0)+')';
      sx.beginPath();sx.moveTo(-w*.30,-h*.78);sx.lineTo(-w*.72,-h*.06);
      sx.lineTo(w*.72,-h*.06);sx.lineTo(w*.30,-h*.78);sx.closePath();sx.fill();
    }

    // torso
    sx.fillStyle=body;
    sx.beginPath();sx.moveTo(-w*.30,-h*.40);sx.lineTo(-w*.22,-h*.76);
    sx.lineTo(w*.22,-h*.76);sx.lineTo(w*.30,-h*.40);sx.closePath();sx.fill();

    // arms — ready stance, forward slam when attacking, overhead on a summon
    const shY=-h*.72;
    let lArmX,lArmY,rArmX,rArmY;
    if(melee){
      const sway=Math.sin(a.ph)*h*.04,thrust=slam;
      lArmX=-w*.55-thrust*w*.22;lArmY=shY-h*.18+sway+thrust*h*.34;
      rArmX= w*.55+thrust*w*.22;rArmY=shY-h*.18-sway+thrust*h*.34;
    }else{
      const armSw=(running?w*.26:w*.14)*step2;
      lArmX=-w*.40-armSw;lArmY=shY+h*.28-Math.abs(step2)*h*.04;
      rArmX= w*.40+armSw;rArmY=shY+h*.28-Math.abs(step2)*h*.04;
    }
    if(raise>0){                       // "WAKE UP" — hands to the sky
      const tx=w*.66,ty=shY-h*.60-Math.sin(G.t*9)*h*.02;
      lArmX+=(-tx-lArmX)*raise;lArmY+=(ty-lArmY)*raise;
      rArmX+=( tx-rArmX)*raise;rArmY+=(ty-rArmY)*raise;
    }
    sx.strokeStyle=body;sx.lineWidth=Math.max(1.4,w*.12);
    sx.beginPath();sx.moveTo(-w*.22,shY);sx.lineTo(lArmX,lArmY);sx.stroke();
    sx.beginPath();sx.moveTo( w*.22,shY);sx.lineTo(rArmX,rArmY);sx.stroke();
    sx.fillStyle=body;
    sx.beginPath();sx.arc(lArmX,lArmY,Math.max(1,w*.065),0,6.283);sx.fill();
    sx.beginPath();sx.arc(rArmX,rArmY,Math.max(1,w*.065),0,6.283);sx.fill();
    if(raise>.3&&h>18){                // charge held between the palms
      const cx=0,cy=(lArmY+rArmY)/2-h*.02,rr=w*.55*raise;
      const g=sx.createRadialGradient(cx,cy,1,cx,cy,rr);
      g.addColorStop(0,'rgba(200,240,255,'+(.75*raise)+')');
      g.addColorStop(.4,'rgba(90,190,255,'+(.5*raise)+')');
      g.addColorStop(1,'rgba(40,110,255,0)');
      sx.fillStyle=g;sx.beginPath();sx.arc(cx,cy,rr,0,6.283);sx.fill();
    }

    // head — elongated cranium, big glowing eyes
    sx.fillStyle=head;
    sx.beginPath();sx.ellipse(0,-h*.86+step2*h*.008,w*.34,h*.17,0,0,6.283);sx.fill();
    sx.beginPath();sx.ellipse(0,-h*1.00+step2*h*.008,w*.22,h*.13,0,0,6.283);sx.fill();
    if(h>16){
      const eyeCol=hitLit?'#ffffff':(a.boss?'rgba(140,225,255,.98)':(a.runner?'rgba(255,190,90,.95)':'rgba(150,255,120,.9)'));
      if(a.boss&&!hitLit){             // blue eye-glow
        const gl=.5+.3*Math.sin(G.t*4)+raise*.4;
        for(const ex of[-w*.15,w*.15]){
          const g=sx.createRadialGradient(ex,-h*.90,1,ex,-h*.90,w*.42);
          g.addColorStop(0,'rgba(120,215,255,'+(.55*gl)+')');
          g.addColorStop(1,'rgba(60,140,255,0)');
          sx.fillStyle=g;sx.beginPath();sx.arc(ex,-h*.90,w*.42,0,6.283);sx.fill();
        }
      }
      sx.fillStyle=eyeCol;
      sx.beginPath();sx.ellipse(-w*.15,-h*.90,w*.11,h*.06,-.3,0,6.283);sx.fill();
      sx.beginPath();sx.ellipse( w*.15,-h*.90,w*.11,h*.06,.3,0,6.283);sx.fill();
      if(!hitLit){sx.fillStyle=a.boss?'#04121e':'#05070a';
        sx.beginPath();sx.ellipse(-w*.15,-h*.90,w*.045,h*.028,-.3,0,6.283);sx.fill();
        sx.beginPath();sx.ellipse( w*.15,-h*.90,w*.045,h*.028,.3,0,6.283);sx.fill()}
    }

    // boss detailing: shoulder spikes, crest light, pulsing aura
    if(a.boss&&h>20){
      sx.fillStyle=body;
      sx.beginPath();sx.moveTo(-w*.30,shY+h*.02);sx.lineTo(-w*.52,shY-h*.22);sx.lineTo(-w*.18,shY-h*.02);sx.closePath();sx.fill();
      sx.beginPath();sx.moveTo( w*.30,shY+h*.02);sx.lineTo( w*.52,shY-h*.22);sx.lineTo( w*.18,shY-h*.02);sx.closePath();sx.fill();
      sx.fillStyle='#6fd0ff';sx.fillRect(-w*.05,-h*1.16,Math.max(1,w*.1),h*.09);
      const auraA=.18+.12*Math.sin(G.t*6)+raise*.35;
      sx.strokeStyle='rgba(90,190,255,'+auraA+')';sx.lineWidth=Math.max(1,w*.07);
      sx.beginPath();sx.ellipse(0,-h*.01,w*(.66+raise*.25),h*.11,0,0,6.283);sx.stroke();
    }

    // runner motion streaks
    if(running&&h>12){
      sx.strokeStyle='rgba(255,150,70,.4)';sx.lineWidth=Math.max(1,w*.08);
      const trail=w*.5;
      sx.beginPath();sx.moveTo(-w*.20,-h*.10);sx.lineTo(-w*.20-trail,-h*.06);sx.stroke();
      sx.beginPath();sx.moveTo( w*.20,-h*.10);sx.lineTo( w*.20+trail,-h*.06);sx.stroke();
    }

    sx.restore();sx.restore();
  }

  /* ═════════ word tags with anti-overlap ═════════ */
  function tagHits(placed,x,y,w,h){
    for(const r of placed)
      if(x<r.x+r.w+4&&x+w+4>r.x&&y<r.y+r.h+3&&y+h+3>r.y)return true;
    return false;
  }
  function drawWords(tc){
    const list=G.aliens.filter(a=>!a.dying&&!a.dead&&a.fade<=0&&a.emerge>=1).sort((p,q)=>p.z-q.z);
    const placed=[];
    tc.save();
    for(const a of list){
      const headY=GY+1.85*(a.hscale||1)+.34;
      const p=P(a.x,headY,a.z);if(!p)continue;
      const vis=clamp(1-p.dz/(FOGD*.95),0,1);if(vis<=.06)continue;
      const isT=G.target===a;
      const fnt=n=>n+'px "Silkscreen",ui-monospace,monospace';
      let fs=clamp(p.s*(a.boss?.26:.30)*SC,16,a.boss?32:34);
      tc.font=fnt(fs);
      let tw=tc.measureText(a.word).width;
      if(tw+fs*.68>W-16){                       // long boss words must still fit the tube
        fs=Math.max(12,fs*(W-16)/(tw+fs*.68)*.98);tc.font=fnt(fs);tw=tc.measureText(a.word).width;
      }
      const padx=fs*.34,pady=fs*.32,bw=tw+padx*2,bh=fs+pady;
      const bx=clamp(p.x*SC-bw/2,4,Math.max(4,W-bw-4));
      const by0=p.y*SC-bh,anchorX=p.x*SC,anchorY=p.y*SC;
      // look for a free slot above the head, then below — never off the top edge
      let by=null;
      for(let k=0;k<6&&by===null;k++){const c=by0-k*(bh+5);
        if(c<4)break;if(!tagHits(placed,bx,c,bw,bh))by=c}
      for(let k=1;k<6&&by===null;k++){const c=by0+k*(bh+5);
        if(c+bh>H-4)break;if(!tagHits(placed,bx,c,bw,bh))by=c}
      if(by===null)by=clamp(by0,4,Math.max(4,H-bh-4));
      placed.push({x:bx,y:by,w:bw,h:bh});
      tc.globalAlpha=.78+vis*.22;
      // leader line when the tag was displaced
      if(Math.abs(anchorY-(by+bh))>3){
        tc.strokeStyle=isT?'rgba(121,255,77,.75)':(a.boss?'rgba(140,225,255,.6)':'rgba(190,210,180,.45)');
        tc.lineWidth=Math.max(1,SC*.4);
        tc.beginPath();tc.moveTo(bx+bw/2,by+bh<anchorY?by+bh:by);tc.lineTo(anchorX,anchorY);tc.stroke();
      }
      tc.fillStyle=isT?'rgba(9,26,5,.97)':(a.boss?'rgba(5,16,38,.97)':(a.melee?'rgba(38,8,6,.97)':'rgba(5,8,7,.96)'));
      tc.fillRect(bx,by,bw,bh);
      tc.strokeStyle=isT?'rgba(121,255,77,1)':(a.boss?'rgba(140,225,255,.95)':(a.melee?'rgba(255,105,85,.95)':'rgba(168,190,158,.62)'));
      tc.lineWidth=Math.max(1,SC*.5);tc.strokeRect(bx,by,bw,bh);
      if(isT){
        const k=fs*.42;tc.strokeStyle='#79ff4d';tc.lineWidth=Math.max(1.5,SC*.7);tc.beginPath();
        tc.moveTo(bx,by+k);tc.lineTo(bx,by);tc.lineTo(bx+k,by);
        tc.moveTo(bx+bw-k,by);tc.lineTo(bx+bw,by);tc.lineTo(bx+bw,by+k);
        tc.moveTo(bx+bw,by+bh-k);tc.lineTo(bx+bw,by+bh);tc.lineTo(bx+bw-k,by+bh);
        tc.moveTo(bx+k,by+bh);tc.lineTo(bx,by+bh);tc.lineTo(bx,by+bh-k);
        tc.stroke();
      }
      if(a.boss){                                // nameplate
        const nf=Math.max(8,fs*.40);
        tc.font=nf+'px "Press Start 2P",ui-monospace,monospace';
        const nw=tc.measureText('AVERAGEREAPER').width;
        const nx=clamp(bx+bw/2-nw/2,4,Math.max(4,W-nw-4));
        const ny=by-nf*.65<nf+4?by+bh+nf*1.2:by-nf*.65;
        tc.textAlign='left';tc.textBaseline='alphabetic';
        tc.fillStyle='rgba(120,215,255,.92)';tc.fillText('AVERAGEREAPER',nx,ny);
        const pw=nf*.55,pg=nf*.28;                // remaining armour plates
        for(let k=0;k<(a.platesMax||1);k++){
          const px=nx+nw+nf*.6+k*(pw+pg);
          tc.fillStyle=k<(a.plates||1)?'rgba(120,215,255,.95)':'rgba(120,215,255,.22)';
          tc.fillRect(px,ny-nf*.78,pw,nf*.78);
        }
        tc.font=fnt(fs);
      }
      tc.textAlign='left';tc.textBaseline='middle';
      let x=bx+padx;const ty=by+bh/2;
      for(let i=0;i<a.word.length;i++){
        const ch=a.word[i],cw=tc.measureText(ch).width;
        if(isT&&i===G.typed){tc.fillStyle='rgba(121,255,77,.30)';
          tc.fillRect(x-fs*.06,ty-fs*.60,cw+fs*.12,fs*1.2)}
        if(isT&&i<G.typed)tc.fillStyle='rgba(104,196,72,.95)';
        else if(isT&&i===G.typed)tc.fillStyle='#79ff4d';
        else tc.fillStyle=isT?'#ffffff':(a.boss?'#eaf8ff':'#f4faf0');
        tc.fillText(ch,x,ty);x+=cw;
      }
    }
    tc.restore();
    drawBubble(tc);
  }
  /* the little "WAKE UP" bark over the boss's head */
  function drawBubble(tc){
    const b=G.boss;
    if(!(G.bubbleT>0)||!b||b.dead||b.dying||b.fade>0)return;
    const p=P(b.x,GY+1.85*(b.hscale||1)+1.15,b.z);if(!p)return;
    const fs=clamp(p.s*.20*SC,10,20);
    tc.save();
    tc.font=fs+'px "Press Start 2P",ui-monospace,monospace';
    const t=G.bubble||'EMERGE',tw=tc.measureText(t).width;
    const pad=fs*.7,bw=tw+pad*2,bh=fs+pad*1.3;
    const bx=clamp(p.x*SC-bw/2,6,Math.max(6,W-bw-6));
    const by=clamp(p.y*SC-bh,6,Math.max(6,H-bh-6));
    const pop=clamp((1.7-G.bubbleT)*7,0,1);
    tc.globalAlpha=clamp(G.bubbleT,0,1)*pop;
    tc.fillStyle='rgba(8,22,44,.94)';tc.fillRect(bx,by,bw,bh);
    tc.beginPath();tc.moveTo(bx+bw*.40,by+bh);tc.lineTo(bx+bw*.50,by+bh+fs*.6);
    tc.lineTo(bx+bw*.60,by+bh);tc.closePath();tc.fill();
    tc.strokeStyle='rgba(120,215,255,.95)';tc.lineWidth=Math.max(1.5,SC*.6);
    tc.strokeRect(bx,by,bw,bh);
    tc.fillStyle='#cfeeff';tc.textAlign='center';tc.textBaseline='middle';
    tc.fillText(t,bx+bw/2,by+bh/2+1);
    tc.restore();
  }
  function drawBeams(){
    const ox=W/2-6*SC,oy=H+10*SC;
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const b of G.beams){
      const k=1-b.t,wide=(2.2+k*3.4)*SC*.6;
      ctx.strokeStyle='rgba(70,220,60,'+(.35*k)+')';ctx.lineWidth=wide*3;
      ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.strokeStyle='rgba(121,255,77,'+(.75*k)+')';ctx.lineWidth=wide;
      ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.strokeStyle='rgba(240,255,225,'+(.9*k)+')';ctx.lineWidth=wide*.32;
      ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(b.x,b.y);ctx.stroke();
      const r=26*SC*.55*(.4+b.t*1.5);
      const g=ctx.createRadialGradient(b.x,b.y,1,b.x,b.y,r);
      g.addColorStop(0,'rgba(215,255,190,'+(.85*k)+')');
      g.addColorStop(.35,'rgba(121,255,77,'+(.55*k)+')');
      g.addColorStop(1,'rgba(60,200,40,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,r,0,6.283);ctx.fill();
    }
    ctx.restore();
  }
  function drawParts(){
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const p of G.parts){ctx.globalAlpha=Math.max(0,1-p.t/p.life);ctx.fillStyle=p.c;
      ctx.fillRect(p.x-p.r/2,p.y-p.r/2,p.r,p.r)}
    ctx.restore();ctx.globalAlpha=1;
  }
  function drawWeapon(){
    const bob=Math.sin(cam.bob*2)*6*SC*.3;
    const w=W*.16,h=H*.16,x=W/2-w*.55,y=H-h*.42+bob+G.recoil*14*SC*.4;
    ctx.save();
    ctx.fillStyle='#0a0d0b';ctx.fillRect(x,y,w,h);
    ctx.fillStyle='#141a15';ctx.fillRect(x+w*.12,y-h*.16,w*.5,h*.2);
    ctx.fillStyle='rgba(121,255,77,'+(.15+G.recoil*.6)+')';ctx.fillRect(x+w*.18,y-h*.10,w*.36,h*.05);
    ctx.restore();
  }

  /* ═════════ menu scene ═════════ */
  function drawMenuScene(){
    sx.clearRect(0,0,SW,SH);
    if(SKY)sx.drawImage(SKY,0,0,SW,SH);
    const r=mulberry(4242);
    sx.strokeStyle='#080c10';sx.lineWidth=1;
    for(let k=0;k<5;k++){
      const x=(k+.5)*SW/5+Math.sin(k*2.1)*10;
      sx.fillStyle='#0a0e12';sx.fillRect(x|0,SH*.30,2,SH*.62);sx.fillRect((x-6)|0,(SH*.34)|0,14,2);
      sx.beginPath();sx.moveTo(x,SH*.36);sx.quadraticCurveTo(x+SW/10,SH*.44,x+SW/5,SH*.36);sx.stroke();
    }
    for(let k=0;k<3;k++){
      const x=SW*(.14+k*.34);
      sx.fillStyle='#0a0e12';sx.fillRect(x|0,SH*.55,2,SH*.4);
      sx.fillStyle='#e8c268';sx.globalAlpha=.55+Math.sin(G.t*3+k)*.06;
      sx.fillRect((x-1)|0,(SH*.55)|0,4,3);sx.globalAlpha=1;
      const g=sx.createRadialGradient(x,SH*.56,1,x,SH*.56,26);
      g.addColorStop(0,'rgba(232,194,104,.28)');g.addColorStop(1,'rgba(232,194,104,0)');
      sx.fillStyle=g;sx.fillRect(x-26,SH*.56-26,52,52);
    }
    const bl=.7+.3*Math.sin(G.t*11)*(Math.sin(G.t*2)>.2?1:0);
    sx.fillStyle='rgba(150,20,20,'+(.55*bl)+')';sx.fillRect(SW*.03,SH*.06,SW*.10,SH*.11);
    sx.fillStyle='rgba(255,70,70,'+(.85*bl)+')';sx.fillRect(SW*.045,SH*.08,SW*.07,SH*.06);
    sx.fillStyle='#0c1114';sx.fillRect(0,SH*.735,SW,SH*.02);
    sx.fillStyle='#39424a';for(let x=0;x<SW;x+=6)sx.fillRect(x,SH*.728,3,1);
    sx.fillStyle='rgba(4,6,9,.72)';sx.fillRect(0,SH*.755,SW,SH*.245);
    for(let k=0;k<4;k++){const x=SW*(.10+k*.26);
      sx.fillStyle='#070a0d';sx.fillRect(x|0,(SH*.80)|0,2,SH*.2);sx.fillRect((x-7)|0,(SH*.80)|0,16,2)}
    sx.strokeStyle='rgba(150,175,190,.16)';sx.lineWidth=1;
    for(let k=0;k<70;k++){const rx=(r()*SW+G.t*22)%SW,ry=(r()*SH+G.t*260)%SH;
      sx.beginPath();sx.moveTo(rx,ry);sx.lineTo(rx-1.5,ry+7);sx.stroke()}
  }

  /* ═════════ frame ═════════ */
  function render(){
    ctx.clearRect(0,0,W,H);
    uctx.clearRect(0,0,W,H);
    const inGame=(G.state==='fight'||G.state==='walk'||G.state==='pause');
    if(inGame)drawScene();else drawMenuScene();
    const sh=G.shake*SC*.5;
    // one shake offset, shared by both layers, or the tags drift off their aliens
    const ox=sh>.2?rnd(-sh,sh):0,oy=sh>.2?rnd(-sh,sh):0;
    const roll=Math.abs(cam.roll)>.0005&&inGame;
    const camXform=c=>{c.save();c.translate(W/2,H/2);
      if(roll){c.rotate(cam.roll);c.scale(1.10,1.10)}
      c.translate(ox-W/2,oy-H/2)};
    camXform(ctx);
    ctx.drawImage(scene,0,0,W,H);
    if(inGame){drawParts();drawBeams();drawWeapon()}
    ctx.restore();
    if(inGame){camXform(uctx);drawWords(uctx);uctx.restore()}
    if(G.flash>0){ctx.fillStyle='rgba(150,255,120,'+(G.flash*.10)+')';ctx.fillRect(0,0,W,H)}
    if(G.hurt>0){
      const g=ctx.createRadialGradient(W/2,H/2,H*.18,W/2,H/2,H*.85);
      g.addColorStop(0,'rgba(255,20,20,0)');g.addColorStop(1,'rgba(255,20,20,'+(G.hurt*.62)+')');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    }
    if(G.blackout>0){
      const k=1-Math.abs(G.blackout-.5)*2;
      ctx.fillStyle='rgba(0,0,0,'+clamp(k*1.3,0,1)+')';ctx.fillRect(0,0,W,H);
    }
  }
  let last=performance.now(),flickT=0;
  function frame(now){
    if(destroyed)return;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    update(dt);musicTick(dt);render();
    flickT-=dt;
    if(flickT<=0){flickT=rnd(.6,3.4);const f=$('flicker');
      f.style.opacity=String(rnd(.02,.07));later(()=>f.style.opacity='0',60)}
    rafId=requestAnimationFrame(frame);
  }
  musicPreload();
  document.body.classList.add('ti-game');
  resize();applyCfg();syncHUD();newPath(1337);applyBiome();rafId=requestAnimationFrame(frame);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      timers.forEach(clearTimeout);
      timers.clear();
      _off.forEach((f) => f());
      try { musicSet(false); } catch (e) { /* audio may never have started */ }
      musicStop();
      for (const audio of Object.values(MUS.els)) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      if (A.c && A.c.state !== 'closed') A.c.close().catch(() => {});
      document.body.classList.remove('ti-game', 'ti-running', 'off');
      host.innerHTML = "";
    },
  };
}
