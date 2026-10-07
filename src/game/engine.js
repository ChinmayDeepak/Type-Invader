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
    gameoverTune(){
      [110,98,87,82].forEach((f,i)=>tone(f,f*.985,1.2,'triangle',.13,i*.62));
      [440,392,330,262,247,220].forEach((f,i)=>tone(f,f,.5,'square',.085,.18+i*.44));
      tone(165,55,2.2,'sawtooth',.1,2.5);
      nz(1.6,.16,420,2.6);
    }
  };

  /* ═════════ background music ═════════ */
  const MUSIC_SRC={1:'/music1.mp3',2:'/music2.mp3',3:'/music3%20.mp3',boss:'/music4.mp3',over:'/music5.mp3'};
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
