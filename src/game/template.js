/* The game engine owns this DOM subtree. React mounts an empty host div
   and the engine injects this markup once, then drives it imperatively at
   60 fps. Re-rendering a HUD through React every frame would be wasteful. */
export const GAME_TEMPLATE = `
<div id="frame"><div id="tube">
  <canvas id="game"></canvas>
  <div id="fx"></div>
  <canvas id="ui"></canvas>
  <div id="flicker"></div>

  <div id="hud">
    <div class="hScore">Score: <span id="hScore">0</span></div>
    <div class="hVol"><span class="ic">♬</span>
      <input id="vol" class="vslider" type="range" min="0" max="100" step="5" value="45"
             aria-label="Music volume"><span class="num" id="volN">45</span></div>
    <div class="hAcc" id="accBox">Accuracy: <span id="hAcc">100</span>%</div>
    <div class="hHp" id="hpBox">♥ HP: <span id="hHp">100</span></div>
    <div class="hLoc" id="hLoc">R1/1 · S1/4 · ROOKIE FACTORY</div>
    <div class="hCombo" id="hCombo">COMBO x1</div>
  </div>
  <div id="objective"></div>
  <div id="snd">
    <button id="mMusic" title="Music on/off">♬</button>
    <button id="mSfx" title="Game sound on/off">♪</button>
  </div>
  <button id="hack" class="hide" title="Admin only · clear this fight instantly (F9)">⚡ HACK</button>

  <div class="screen" id="sMenu">
    <div style="margin-top:auto"></div>
    <h1>TYPE INVADERS</h1>
    <div class="tag">RELOADED</div>
    <div class="menu">
      <button class="item" data-go="play">PLAY</button>
      <button class="item" data-go="settings">SETTINGS</button>
      <button class="item" data-go="exit">EXIT</button>
    </div>
    <div style="margin-top:auto"></div>
    <div class="note">Instruction : Type Words quickly To Kill Aliens <br>1 round · 4 stages · AVERAGEREAPER waits in stage 4</div>
    <div class="note">Created By Chinmay Deepak Chandavar &nbsp;·&nbsp; <kbd>esc</kbd> pause</div>
  </div>

  <div class="screen dim hide" id="sSettings">
    <h2>SETTINGS</h2>
    <div class="rows">
      <div class="row"><div class="lbl">DIFFICULTY<i>speed aliens · damage · boss brood — easy is the default</i></div>
        <div class="seg" data-set="diff"><button data-v="0">EASY</button><button data-v="1">NORMAL</button><button data-v="2">HARD</button></div></div>
      <div class="row"><div class="lbl">WORD LENGTH<i>longer words are worth more</i></div>
        <div class="seg" data-set="len"><button data-v="0">SHORT</button><button data-v="1">MIXED</button><button data-v="2">LONG</button></div></div>
      <div class="row"><div class="lbl">STRICT TYPOS<i>a wrong key drops your target lock</i></div>
        <div class="seg" data-set="strict"><button data-v="0">OFF</button><button data-v="1">ON</button></div></div>
      <div class="row"><div class="lbl">PATH SWAY<i>how much the corridor turns as you walk</i></div>
        <div class="seg" data-set="sway"><button data-v="0">LOW</button><button data-v="1">NORMAL</button><button data-v="2">HIGH</button></div></div>
      <div class="row"><div class="lbl">SCANLINES<i>crt overlay</i></div>
        <div class="seg" data-set="scan"><button data-v="0">OFF</button><button data-v="1">ON</button></div></div>
      <div class="row"><div class="lbl">GAME SOUND<i>zaps, hits, alien noise</i></div>
        <div class="seg" data-set="snd"><button data-v="0">OFF</button><button data-v="1">ON</button></div></div>
      <div class="row"><div class="lbl">MUSIC<i>background track — plays while you are in a run</i></div>
        <div class="seg" data-set="music"><button data-v="0">OFF</button><button data-v="1">ON</button></div></div>
      <div class="row"><div class="lbl">MUSIC VOLUME<i>0 – 100, also on the HUD under your score</i></div>
        <div class="seg"><input id="volS" class="vslider" type="range" min="0" max="100" step="5" value="45"
          aria-label="Music volume"><span class="num" id="volSN" style="margin-left:8px">45</span></div></div>
    </div>
    <div class="menu"><button class="item" data-go="menu">BACK</button></div>
  </div>

  <div class="screen dim hide" id="sPause">
    <h2>PAUSED</h2>
    <div class="menu"><button class="item" data-go="resume">RESUME</button><button class="item" data-go="menu">QUIT</button></div>
  </div>

  <div class="screen dim hide" id="sOver">
    <h2 id="overTitle">YOU WERE OVERRUN</h2>
    <div class="stats">
      <div><span>SCORE</span><b id="fScore">0</b></div>
      <div><span>STAGES</span><b id="fRound">0/4</b></div>
      <div><span>KILLS</span><b id="fKills">0</b></div>
      <div><span>BOSSES</span><b id="fBoss">0/1</b></div>
      <div><span>SPEED</span><b id="fWpm">0</b></div>
      <div><span>ACCURACY</span><b id="fAcc">0%</b></div>
      <div><span>BEST COMBO</span><b id="fCombo">0</b></div>
      <div><span>TIME</span><b id="fTime">0:00</b></div>
      <div><span>RANK</span><b id="fRank">—</b></div>
    </div>
    <div class="note" id="bestLine">BEST THIS SESSION — 0</div>
    <div class="menu"><button class="item" data-go="play">RETRY</button><button class="item" data-go="menu">MAIN MENU</button></div>
  </div>

  <div class="screen hide" id="sExit" style="background:#000">
    <div class="note" style="color:#3d4d2c">SIGNAL TERMINATED</div>
    <div class="menu"><button class="item" data-go="menu">REBOOT</button></div>
  </div>

  <input id="catch" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
</div></div>

`;
