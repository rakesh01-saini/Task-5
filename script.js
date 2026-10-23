
"use strict";

/* ==========================================================
   NEXUS ARCADE
   Six games, shared rendering system, isolated game state.
   ========================================================== */

// ======================== CONFIGURATION ====================
// Replace these with your real profile URLs when available.
const CONFIG = {
  github: "https://github.com/rakesh01-saini/",
  linkedin: "https://www.linkedin.com/in/rakesh-saini-9a9b872b5/",
  storageKey: "nexusArcadeSaveV4"
};

const $ = id => document.getElementById(id);
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const games = [
  {id:"galaxy",name:"Galaxy Defender",category:"Action",tag:"FEATURED",emoji:"🚀",glow:"#50f5ff",type:"SPACE SHOOTER",desc:"Defend the galaxy, destroy enemy waves and survive cosmic chaos.",controls:"ARROWS / WASD · SPACE TO FIRE",hint:"Destroy the required number of enemies. Avoid collisions.",fire:true},
  {id:"snake",name:"Neon Snake",category:"Arcade",tag:"CLASSIC",emoji:"🐍",glow:"#8affc1",type:"ARCADE CLASSIC",desc:"Grow your neon trail, collect energy and avoid your own tail.",controls:"ARROWS / WASD · SWIPE",hint:"Collect food to complete the level. Avoid walls and your tail."},
  {id:"pong",name:"Cyber Pong",category:"Arcade",tag:"REFLEX ARENA",emoji:"🏓",glow:"#a78bfa",type:"PADDLE DUEL",desc:"Challenge a CPU opponent in a fast-paced neon paddle duel.",controls:"W / S · ARROWS · TOUCH",hint:"Score against the CPU. First to seven points wins."},
  {id:"breakout",name:"Neon Breakout",category:"Arcade",tag:"SMASH IT",emoji:"🧱",glow:"#ff5fbd",type:"BRICK BREAKER",desc:"Smash neon bricks, control your paddle and keep the ball alive.",controls:"A / D · ARROWS · TOUCH",hint:"Clear every brick. Each new level adds a row of bricks."},
  {id:"asteroids",name:"Asteroid Drift",category:"Action",tag:"SURVIVAL",emoji:"☄️",glow:"#ffb86b",type:"ASTEROID SURVIVAL",desc:"Pilot through a dangerous asteroid field and blast space rocks.",controls:"ARROWS / WASD · SPACE TO SHOOT",hint:"Destroy asteroids, rotate with left/right and thrust forward.",fire:true},
  {id:"memory",name:"Memory Matrix",category:"Puzzle",tag:"BRAIN MODE",emoji:"🧠",glow:"#ffd66b",type:"NEON MEMORY",desc:"Flip neon tiles, discover matching pairs and improve your memory.",controls:"CLICK OR TAP THE CARDS",hint:"Match all pairs. Complete higher levels with more pairs."}
];

const freshSave = () => ({
  xp:0, played:0, bests:{}, unlocked:{}, recent:[],
  sound:true, endless:{}
});

function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "{}");
    const base = freshSave();
    return {
      ...base, ...raw,
      bests: raw.bests && typeof raw.bests === "object" ? raw.bests : {},
      unlocked: raw.unlocked && typeof raw.unlocked === "object" ? raw.unlocked : {},
      recent: Array.isArray(raw.recent) ? raw.recent : [],
      endless: raw.endless && typeof raw.endless === "object" ? raw.endless : {}
    };
  } catch {
    return freshSave();
  }
}

let save = loadSave();
let soundOn = save.sound !== false;
let audioCtx = null;
let currentId = null;
let game = null;
let mode = "hub";
let raf = 0;
let lastTime = 0;
let keys = new Set();
let pointerDown = false;
let pointerX = W / 2;
let pointerY = H / 2;
let toastTimer = 0;
let filter = "All";
let sessionMode = "campaign";
let touchStart = null;

const rand = (a,b) => Math.random() * (b-a) + a;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const fmt = n => Math.floor(Number(n) || 0).toLocaleString("en-US");
const bestScore = id => Number(save.bests[id] || 0);
const levelFor = id => Math.max(1, Number(save.unlocked[id] || 1));
const playerRank = () => Math.floor(save.xp / 250) + 1;

function persist() {
  save.sound = soundOn;
  try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(save)); }
  catch { toast("Storage unavailable. Progress may not persist."); }
}

function beep(freq=440, duration=.06, type="sine", volume=.025) {
  if (!soundOn) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch {}
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
}

// ======================== DASHBOARD ========================

function achievementData() {
  return [
    {icon:"🎮",title:"First Contact",goal:"Play your first game",ok:save.played>=1},
    {icon:"⚡",title:"Rising Star",goal:"Earn 250 XP",ok:save.xp>=250},
    {icon:"🏆",title:"High Scorer",goal:"Score 100 in a game",ok:Object.values(save.bests).some(n=>Number(n)>=100)},
    {icon:"🌌",title:"Galaxy Pilot",goal:"Launch Galaxy Defender",ok:levelFor("galaxy")>1 || save.recent.includes("galaxy")},
    {icon:"🧩",title:"Mind Hacker",goal:"Launch Memory Matrix",ok:levelFor("memory")>1 || save.recent.includes("memory")},
    {icon:"👑",title:"Arcade Veteran",goal:"Play 10 sessions",ok:save.played>=10}
  ];
}

function renderDashboard() {
  $("topLevel").textContent = String(playerRank()).padStart(2,"0");
  $("topXP").textContent = fmt(save.xp);
  $("statXP").innerHTML = `${fmt(save.xp)} <em>XP</em>`;
  $("statPlayed").textContent = fmt(save.played);
  $("statBest").textContent = fmt(Math.max(0,...Object.values(save.bests).map(Number)));
  const achievements = achievementData();
  $("statAchievements").innerHTML = `${achievements.filter(a=>a.ok).length} <em>/ 6</em>`;
  $("soundToggle").textContent = soundOn ? "♫" : "♪";
  $("soundToggle").title = soundOn ? "Mute sound" : "Enable sound";

  renderGames();
  $("achievementGrid").replaceChildren();

  achievements.forEach(a => {
    const el = document.createElement("article");
    el.className = "achievement" + (a.ok ? "" : " locked");
    const icon = document.createElement("div");
    icon.className = "ach-icon";
    icon.textContent = a.icon;
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = a.title;
    const desc = document.createElement("small");
    desc.textContent = a.ok ? "Achievement unlocked" : a.goal;
    info.append(title,desc);
    el.append(icon,info);
    $("achievementGrid").append(el);
  });
}

function renderGames() {
  const query = $("gameSearch").value.trim().toLowerCase();
  const sort = $("gameSort").value;
  let list = games.filter(g =>
    (filter === "All" || g.category === filter) &&
    `${g.name} ${g.desc} ${g.category} ${g.type}`.toLowerCase().includes(query)
  );

  if (sort === "az") list.sort((a,b)=>a.name.localeCompare(b.name));
  if (sort === "recent") {
    list.sort((a,b)=>{
      const ai=save.recent.indexOf(a.id), bi=save.recent.indexOf(b.id);
      return (ai<0?999:ai)-(bi<0?999:bi);
    });
  }
  if (sort === "best") list.sort((a,b)=>bestScore(b.id)-bestScore(a.id));

  $("gamesGrid").replaceChildren();
  $("clearSearch").hidden = !query;
  $("gameCount").textContent = `${String(list.length).padStart(2,"0")} GAMES`;
  $("emptyState").hidden = list.length > 0;

  list.forEach(g => {
    const card = document.createElement("article");
    card.className = "game-card";

    const art = document.createElement("div");
    art.className = "game-art";
    art.style.setProperty("--glow",g.glow);
    const tag = document.createElement("span");
    tag.className = "game-tag";
    tag.textContent = g.tag;
    const emoji = document.createElement("span");
    emoji.className = "game-emoji";
    emoji.textContent = g.emoji;
    art.append(tag,emoji);

    const info = document.createElement("div");
    info.className = "game-info";
    const row = document.createElement("div");
    row.className = "game-title-row";
    const title = document.createElement("div");
    title.className = "game-title";
    title.textContent = g.name;
    const best = document.createElement("span");
    best.className = "best";
    best.textContent = `BEST ${fmt(bestScore(g.id))}`;
    row.append(title,best);

    const desc = document.createElement("p");
    desc.className = "game-desc";
    desc.textContent = g.desc;

    const bottom = document.createElement("div");
    bottom.className = "game-bottom";
    const type = document.createElement("span");
    type.className = "game-type";
    type.textContent = g.type;
    const play = document.createElement("button");
    play.className = "play-btn";
    play.textContent = "PLAY NOW ↗";
    play.addEventListener("click",()=>startGame(g.id,"campaign"));
    bottom.append(type,play);

    const progress = document.createElement("div");
    progress.className = "game-progress";
    progress.textContent = `UNLOCKED LEVEL ${String(levelFor(g.id)).padStart(2,"0")}`;

    info.append(row,desc,bottom,progress);
    card.append(art,info);
    $("gamesGrid").append(card);
  });
}

function setFilter(value) {
  filter = value;
  document.querySelectorAll(".filter").forEach(b => {
    const active = b.dataset.filter === value;
    b.classList.toggle("active",active);
    b.setAttribute("aria-pressed",String(active));
  });
  renderGames();
}

$("filters").addEventListener("click",e=>{
  const button = e.target.closest("[data-filter]");
  if (button) setFilter(button.dataset.filter);
});
$("gameSearch").addEventListener("input",renderGames);
$("gameSort").addEventListener("change",renderGames);
$("clearSearch").addEventListener("click",()=>{
  $("gameSearch").value="";
  renderGames();
  $("gameSearch").focus();
});
$("resetFilters").addEventListener("click",()=>{
  $("gameSearch").value="";
  $("gameSort").value="featured";
  setFilter("All");
});
$("soundToggle").addEventListener("click",()=>{
  soundOn=!soundOn;
  persist();
  renderDashboard();
  beep(600,.06);
});
$("homeBrand").addEventListener("click",e=>{
  e.preventDefault();
  if (currentId) showHub();
  else window.scrollTo({top:0,behavior:"smooth"});
});

function configureProfileLink(id,url) {
  const el=$(id);
  const valid = /^https:\/\/(github\.com|www\.linkedin\.com)\/[^/]+\/?$/i.test(url)
    && !url.includes("YOUR_");
  if (valid) {
    el.href=url;
    el.target="_blank";
    el.rel="noopener noreferrer";
  } else {
    el.href="#aboutDeveloper";
    el.removeAttribute("target");
    el.addEventListener("click",e=>{
      e.preventDefault();
      toast("Add your real profile URL in CONFIG inside script.js.");
    });
  }
}
configureProfileLink("githubLink",CONFIG.github);
configureProfileLink("linkedinLink",CONFIG.linkedin);

// ======================== NAVIGATION ========================

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf=0;
  lastTime=0;
}

function clearInputs() {
  keys.clear();
  pointerDown=false;
  document.querySelectorAll(".mobile-controls button").forEach(b=>b.classList.remove("pressed"));
}

function showHub() {
  stopLoop();
  mode="hub";
  currentId=null;
  game=null;
  clearInputs();
  $("gameScreen").classList.remove("active");
  $("gameScreen").setAttribute("aria-hidden","true");
  $("dashboard").style.display="";
  document.body.classList.remove("game-open");
  $("overlay").classList.remove("show");
  $("mobileControls").replaceChildren();
  $("mobileControls").classList.remove("visible");
  $("livesStat").hidden=false;
  renderDashboard();
  window.scrollTo({top:0,behavior:"auto"});
}

function startGame(id,chosenMode="campaign",levelOverride=null) {
  const def=games.find(g=>g.id===id);
  if (!def) return;

  stopLoop();
  clearInputs();
  currentId=id;
  sessionMode=chosenMode;
  mode="playing";

  const startLevel=levelOverride || (chosenMode==="endless" ? 1 : levelFor(id));
  game=createGame(id,startLevel,chosenMode);
  game.level=startLevel;
  game.runAwarded=false;

  $("dashboard").style.display="none";
  $("gameScreen").classList.add("active");
  $("gameScreen").setAttribute("aria-hidden","false");
  document.body.classList.add("game-open");
  $("activeGameName").textContent=def.name+(chosenMode==="endless"?" · ENDLESS":"");
  $("activeGameMeta").textContent=def.controls;
  $("gameHint").textContent=def.hint;
  $("overlay").classList.remove("show");
  $("pauseBtn").innerHTML="Ⅱ <span>Pause</span>";
  $("livesStat").hidden=!Number.isFinite(game.lives);
  buildMobileControls(def);
  updateHUD();
  resizeCanvas();
  drawGame();
  lastTime=performance.now();
  raf=requestAnimationFrame(loop);

  save.played++;
  save.recent=[id,...save.recent.filter(v=>v!==id)].slice(0,6);
  persist();
  renderDashboard();
  beep(520,.07,"triangle");
  canvas.focus({preventScroll:true});
}

function buildMobileControls(def) {
  const box=$("mobileControls");
  box.replaceChildren();
  box.classList.toggle("visible",def.id!=="memory");

  let controls=[];
  if (def.id==="galaxy") controls=[
    ["ArrowLeft","◀"],["ArrowUp","▲"],["ArrowDown","▼"],["ArrowRight","▶"],["Space","FIRE","fire"]
  ];
  if (def.id==="asteroids") controls=[
    ["ArrowLeft","↶"],["ArrowUp","▲"],["ArrowDown","▼"],["ArrowRight","↷"],["Space","FIRE","fire"]
  ];
  if (def.id==="snake") controls=[
    ["ArrowLeft","◀"],["ArrowUp","▲"],["ArrowDown","▼"],["ArrowRight","▶"]
  ];
  if (def.id==="pong") controls=[
    ["ArrowUp","▲"],["ArrowDown","▼"]
  ];
  if (def.id==="breakout") controls=[
    ["ArrowLeft","◀"],["ArrowRight","▶"]
  ];

  controls.forEach(([key,label,cls])=>{
    const button=document.createElement("button");
    button.type="button";
    button.textContent=label;
    button.dataset.key=key;
    button.setAttribute("aria-label",label==="FIRE"?"Fire weapon":label);
    if (cls) button.classList.add(cls);

    const down=e=>{
      e.preventDefault();
      if(mode!=="playing")return;
      keys.add(key);
      button.classList.add("pressed");
      if(currentId==="snake") setSnakeDirection(key);
    };
    const up=e=>{
      e.preventDefault();
      keys.delete(key);
      button.classList.remove("pressed");
    };

    button.addEventListener("pointerdown",down);
    button.addEventListener("pointerup",up);
    button.addEventListener("pointercancel",up);
    button.addEventListener("lostpointercapture",up);
    button.addEventListener("contextmenu",e=>e.preventDefault());
    box.append(button);
  });
}

// ======================== TOOLBAR / OVERLAYS =================

function showOverlay(type,title,message,actions) {
  mode=type;
  stopLoop();
  clearInputs();
  $("overlayEyebrow").textContent=type==="paused"?"TAKE A BREATHER":"NEXUS ARCADE";
  $("overlayTitle").textContent=title;
  $("overlayText").textContent=message;
  $("overlayActions").replaceChildren();

  actions.forEach(action=>{
    const b=document.createElement("button");
    b.className=action.primary?"play-btn":"secondary-btn";
    b.textContent=action.label;
    b.addEventListener("click",action.run);
    $("overlayActions").append(b);
  });
  $("overlay").classList.add("show");
}

function pauseGame() {
  if(mode==="playing") {
    showOverlay("paused","GAME PAUSED","Your progress is safe. Resume when you're ready.",[
      {label:"RESUME GAME",primary:true,run:resumeGame},
      {label:"↻ Restart",run:restartGame},
      {label:"← Hub",run:showHub}
    ]);
    $("pauseBtn").innerHTML="▶ <span>Resume</span>";
  } else if(mode==="paused") resumeGame();
}

function resumeGame() {
  if(mode!=="paused")return;
  mode="playing";
  $("overlay").classList.remove("show");
  $("pauseBtn").innerHTML="Ⅱ <span>Pause</span>";
  lastTime=performance.now();
  raf=requestAnimationFrame(loop);
}

function restartGame() {
  if(currentId)startGame(currentId,sessionMode,game?.level||1);
}

function backToHub() {
  showHub();
}

$("backBtn").addEventListener("click",backToHub);
$("closeBtn").addEventListener("click",backToHub);
$("pauseBtn").addEventListener("click",pauseGame);
$("restartBtn").addEventListener("click",restartGame);
$("overlayRestart").addEventListener("click",restartGame);
$("overlayBack").addEventListener("click",showHub);
$("overlayMain").addEventListener("click",()=>{
  if(mode==="paused")resumeGame();
  else if(mode==="over")restartGame();
});

function finishRun(won,message="") {
  if(!game || !["playing"].includes(mode))return;

  const completedLevel=game.level;
  const score=Math.floor(game.score||0);
  const oldBest=bestScore(currentId);
  const isNewBest=score>oldBest;

  if(isNewBest)save.bests[currentId]=score;

  let earned=Math.max(5,Math.floor(score/5)+(won?30:0));
  if(sessionMode==="endless")earned=Math.max(5,Math.floor(score/8));
  save.xp+=earned;
  game.runAwarded=true;
  game.lastResult={won,score,earned};

  if(won && sessionMode==="campaign") {
    save.unlocked[currentId]=Math.max(levelFor(currentId),completedLevel+1);
  }
  persist();
  renderDashboard();
  updateHUD();

  if(won && sessionMode==="campaign") {
    showOverlay("over","LEVEL COMPLETED",`${message} Level ${completedLevel} cleared! Score: ${fmt(score)}. +${earned} XP.`,[
      {label:"NEXT LEVEL →",primary:true,run:()=>startGame(currentId,"campaign",completedLevel+1)},
      {label:"↻ Replay Level",run:()=>startGame(currentId,"campaign",completedLevel)},
      {label:"← Back to Hub",run:showHub}
    ]);
  } else {
    showOverlay("over",won?"VICTORY!":"GAME OVER",`${message} Score: ${fmt(score)}. ${isNewBest?"NEW PERSONAL BEST! ":""}+${earned} XP.`,[
      {label:"PLAY AGAIN",primary:true,run:restartGame},
      {label:"ENDLESS MODE",run:()=>startGame(currentId,"endless",1)},
      {label:"← Back to Hub",run:showHub}
    ]);
  }
  beep(won?760:180,.22,"sawtooth",.025);
}

function updateHUD() {
  if(!game)return;
  $("liveScore").textContent=fmt(game.score);
  $("liveLevel").textContent=String(game.level);
  $("liveLives").textContent=Number.isFinite(game.lives)?String(game.lives):"∞";
}

// ======================== GAME FACTORIES ====================

function createGame(id,level,playMode) {
  const g={id,level,score:0,time:0,mode:playMode};
  const difficulty=playMode==="endless"?1:level;

  if(id==="galaxy") Object.assign(g,{
    player:{x:W/2,y:H-70,r:15,speed:330},bullets:[],enemies:[],particles:[],
    powerups:[],spawn:.5,fire:0,lives:3,invuln:1,kills:0,
    target:playMode==="endless"?Infinity:8+level*3
  });

  if(id==="snake") {
    g.cols=30;g.rows=17;
    g.cell=1;
    g.snake=[{x:8,y:8},{x:7,y:8},{x:6,y:8}];
    g.dir={x:1,y:0};g.nextDir={x:1,y:0};
    g.food={x:20,y:8};g.tick=0;
    g.tickRate=Math.max(.055,.145-(level-1)*.007);
    g.target=playMode==="endless"?Infinity:4+level*2;
    placeFood(g);
  }

  if(id==="pong") Object.assign(g,{
    ball:{x:W/2,y:H/2,vx:300,vy:rand(-150,150),r:9},
    p1:{y:H/2-50,h:100},p2:{y:H/2-50,h:100},
    points:[0,0],lives:Infinity,target:7
  });

  if(id==="breakout") {
    g.paddle={x:W/2,y:H-38,w:125,h:13};
    g.ball={x:W/2,y:H-65,vx:210+level*10,vy:-260-level*8,r:8};
    g.lives=3;
    g.rows=Math.min(9,4+level);
    g.cols=10;
    g.bricks=[];
    const colors=["#50f5ff","#a78bfa","#ff5fbd","#ffd66b","#8affc1"];
    const bw=75,gap=10,total=g.cols*bw+(g.cols-1)*gap,ox=(W-total)/2;
    for(let r=0;r<g.rows;r++)for(let c=0;c<g.cols;c++){
      g.bricks.push({
        x:ox+c*(bw+gap),y:65+r*25,w:bw,h:17,
        alive:true,color:colors[r%colors.length],
        hp:level>=4&&r%3===0?2:1
      });
    }
  }

  if(id==="asteroids") {
    Object.assign(g,{
      player:{x:W/2,y:H/2,a:-Math.PI/2,vx:0,vy:0,r:13},
      bullets:[],rocks:[],particles:[],fire:0,invuln:1.5,lives:3,kills:0,
      target:playMode==="endless"?Infinity:6+level*3,spawn:1
    });
    for(let i=0;i<Math.min(12,4+level);i++){
      spawnRock(g,rand(0,W),rand(0,H),rand(21,32),2);
    }
  }

  if(id==="memory") {
    g.pairs=playMode==="endless"?8:Math.min(12,5+level);
    const symbols=["✦","☄","☾","⚡","✧","♜","❖","☀","♢","✺","☯","✹"];
    const chosen=symbols.slice(0,g.pairs);
    g.deck=[...chosen,...chosen].sort(()=>Math.random()-.5).map((v,i)=>({
      v,i,up:false,matched:false
    }));
    g.first=null;g.second=null;g.lock=false;g.moves=0;g.matches=0;
    g.mismatchAt=0;g.cardRects=[];
  }
  return g;
}

function placeFood(g) {
  let tries=0;
  do {
    g.food={x:Math.floor(rand(0,g.cols)),y:Math.floor(rand(0,g.rows))};
    tries++;
  } while(g.snake.some(s=>s.x===g.food.x&&s.y===g.food.y)&&tries<1000);
}

function spawnRock(g,x,y,r,size) {
  const a=rand(0,Math.PI*2),speed=rand(35,85)*(size===1?1.5:1);
  g.rocks.push({
    x,y,r,size,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
    a:rand(0,6),spin:rand(-1.4,1.4),dead:false
  });
}

function burst(g,x,y,color) {
  for(let i=0;i<8;i++){
    const a=rand(0,Math.PI*2),speed=rand(35,130);
    g.particles.push({
      x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
      life:rand(.2,.5),color
    });
  }
}

// ======================== MAIN LOOP =========================

function loop(now) {
  if(mode!=="playing"||!game)return;
  const dt=Math.min(.033,Math.max(0,(now-lastTime)/1000));
  lastTime=now;
  updateGame(dt);
  if(mode==="playing") {
    drawGame();
    updateHUD();
    raf=requestAnimationFrame(loop);
  }
}

function updateGame(dt) {
  const g=game;
  if(!g)return;
  g.time+=dt;
  switch(g.id) {
    case "galaxy":updateGalaxy(g,dt);break;
    case "snake":updateSnake(g,dt);break;
    case "pong":updatePong(g,dt);break;
    case "breakout":updateBreakout(g,dt);break;
    case "asteroids":updateAsteroids(g,dt);break;
    case "memory":updateMemory(g,dt);break;
  }
}

// ======================== GALAXY DEFENDER ===================

function updateGalaxy(g,dt) {
  const p=g.player;
  let dx=0,dy=0;
  if(keys.has("ArrowLeft")||keys.has("KeyA"))dx--;
  if(keys.has("ArrowRight")||keys.has("KeyD"))dx++;
  if(keys.has("ArrowUp")||keys.has("KeyW"))dy--;
  if(keys.has("ArrowDown")||keys.has("KeyS"))dy++;

  const length=Math.hypot(dx,dy)||1;
  p.x=clamp(p.x+dx/length*p.speed*dt,p.r,W-p.r);
  p.y=clamp(p.y+dy/length*p.speed*dt,65,H-p.r);

  g.fire-=dt;
  if((keys.has("Space")||keys.has("Enter")||pointerDown)&&g.fire<=0) {
    g.bullets.push({x:p.x,y:p.y-17,vy:-500});
    g.fire=.19;
    beep(680,.025,"square",.01);
  }

  g.spawn-=dt;
  if(g.spawn<=0) {
    const count=Math.min(4,1+Math.floor(g.level/2));
    for(let i=0;i<count;i++)g.enemies.push({
      x:rand(25,W-25),y:-rand(10,70),r:rand(12,18),
      speed:rand(70,105)+g.level*7,
      hp:g.level>=4&&Math.random()<.2?2:1,phase:rand(0,6)
    });
    g.spawn=Math.max(.28,.95-g.level*.045);
  }

  g.bullets.forEach(b=>b.y+=b.vy*dt);
  g.bullets=g.bullets.filter(b=>b.y>-20);
  g.enemies.forEach(e=>{
    e.y+=e.speed*dt;
    e.x+=Math.sin(g.time*2+e.phase)*28*dt;
  });

  for(const b of g.bullets) {
    if(b.dead)continue;
    for(const e of g.enemies) {
      if(!e.dead&&Math.hypot(b.x-e.x,b.y-e.y)<e.r+4) {
        b.dead=true;e.hp--;
        if(e.hp<=0) {
          e.dead=true;g.kills++;g.score+=10;
          burst(g,e.x,e.y,"#ff5fbd");
          if(Math.random()<.08)g.powerups.push({x:e.x,y:e.y,r:9});
        }
        break;
      }
    }
  }
  g.bullets=g.bullets.filter(b=>!b.dead);
  g.particles.forEach(p0=>{p0.x+=p0.vx*dt;p0.y+=p0.vy*dt;p0.life-=dt;});
  g.particles=g.particles.filter(p0=>p0.life>0);
  g.powerups.forEach(pu=>pu.y+=80*dt);

  for(const e of g.enemies) {
    if(e.dead)continue;
    if(e.y>H+20) {
      e.dead=true;g.lives--;
      if(g.lives<=0){finishRun(false,"Your ship was overwhelmed.");return;}
    } else if(g.invuln<=0&&Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r) {
      e.dead=true;g.lives--;g.invuln=.9;
      burst(g,p.x,p.y,"#50f5ff");
      if(g.lives<=0){finishRun(false,"Your ship was overwhelmed.");return;}
    }
  }
  g.enemies=g.enemies.filter(e=>!e.dead);
  g.invuln=Math.max(0,g.invuln-dt);
  g.powerups=g.powerups.filter(pu=>{
    if(Math.hypot(pu.x-p.x,pu.y-p.y)<pu.r+p.r) {
      g.lives=Math.min(5,g.lives+1);g.score+=15;return false;
    }
    return pu.y<H+20;
  });

  if(g.kills>=g.target&&sessionMode==="campaign") {
    finishRun(true,`You destroyed ${g.kills} enemies.`);
  }
}

// ======================== NEON SNAKE ========================

function setSnakeDirection(key) {
  if(!game||game.id!=="snake")return;
  const map={
    ArrowUp:{x:0,y:-1},KeyW:{x:0,y:-1},
    ArrowDown:{x:0,y:1},KeyS:{x:0,y:1},
    ArrowLeft:{x:-1,y:0},KeyA:{x:-1,y:0},
    ArrowRight:{x:1,y:0},KeyD:{x:1,y:0}
  };
  const d=map[key];
  if(d&&(d.x!==-game.dir.x||d.y!==-game.dir.y))game.nextDir=d;
}

function updateSnake(g,dt) {
  g.tick+=dt;
  if(g.tick<g.tickRate)return;
  g.tick-=g.tickRate;
  if(g.nextDir.x!==-g.dir.x||g.nextDir.y!==-g.dir.y)g.dir={...g.nextDir};

  const head={x:g.snake[0].x+g.dir.x,y:g.snake[0].y+g.dir.y};
  const eating=head.x===g.food.x&&head.y===g.food.y;
  const body=eating?g.snake:g.snake.slice(0,-1);

  if(head.x<0||head.x>=g.cols||head.y<0||head.y>=g.rows||
    body.some(s=>s.x===head.x&&s.y===head.y)) {
    finishRun(false,"Your neon trail collided.");return;
  }

  g.snake.unshift(head);
  if(eating) {
    g.score+=10;
    g.food={x:-1,y:-1};
    placeFood(g);
    beep(800,.06);
    if(sessionMode==="campaign"&&g.snake.length>=g.target+3) {
      finishRun(true,"Energy target reached.");return;
    }
    if(g.snake.length>=g.cols*g.rows-2)finishRun(true,"The matrix is yours.");
  } else g.snake.pop();
}

// ======================== CYBER PONG ========================

function resetPongBall(g,direction) {
  g.ball={x:W/2,y:H/2,vx:300*direction,vy:rand(-170,170),r:9};
}

function updatePong(g,dt) {
  const p=g.p1,b=g.ball;
  if(keys.has("ArrowUp")||keys.has("KeyW"))p.y-=400*dt;
  if(keys.has("ArrowDown")||keys.has("KeyS"))p.y+=400*dt;
  p.y=clamp(p.y,5,H-p.h-5);

  const delta=(b.y-g.p2.h/2)-g.p2.y;
  g.p2.y+=clamp(delta,-(230+g.level*8)*dt,(230+g.level*8)*dt);
  g.p2.y=clamp(g.p2.y,5,H-g.p2.h-5);

  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.y<b.r||b.y>H-b.r)b.vy*=-1;

  if(b.vx<0&&b.x-b.r<48&&b.x>25&&b.y>=p.y&&b.y<=p.y+p.h) {
    b.x=49+b.r;b.vx=Math.abs(b.vx)*1.04;
    b.vy+=((b.y-(p.y+p.h/2))/(p.h/2))*130;
    beep(440,.04);
  }
  if(b.vx>0&&b.x+b.r>W-48&&b.x<W-25&&b.y>=g.p2.y&&b.y<=g.p2.y+g.p2.h) {
    b.x=W-49-b.r;b.vx=-Math.abs(b.vx)*1.035;
    b.vy+=((b.y-(g.p2.y+g.p2.h/2))/(g.p2.h/2))*120;
    beep(520,.04);
  }

  if(b.x<0) {
    g.points[1]++;
    resetPongBall(g,1);
    if(g.points[1]>=7){finishRun(false,"The CPU won this round.");return;}
  }
  if(b.x>W) {
    g.points[0]++;
    g.score+=25;
    resetPongBall(g,-1);
    if(g.points[0]>=7){finishRun(true,`You beat the CPU ${g.points[0]}–${g.points[1]}.`);return;}
  }
}

// ======================== NEON BREAKOUT ====================

function updateBreakout(g,dt) {
  const p=g.paddle,b=g.ball;
  let moved=false;
  if(keys.has("ArrowLeft")||keys.has("KeyA")){p.x-=450*dt;moved=true;}
  if(keys.has("ArrowRight")||keys.has("KeyD")){p.x+=450*dt;moved=true;}
  if(pointerDown) {p.x=pointerX;moved=true;}
  p.x=clamp(p.x,p.w/2+8,W-p.w/2-8);

  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx);}
  if(b.x>W-b.r){b.x=W-b.r;b.vx=-Math.abs(b.vx);}
  if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy);}

  if(b.vy>0&&b.y+b.r>=p.y&&b.y-b.r<=p.y+p.h&&
    b.x>=p.x-p.w/2&&b.x<=p.x+p.w/2) {
    b.y=p.y-b.r;
    b.vy=-Math.abs(b.vy);
    b.vx+=((b.x-p.x)/(p.w/2))*150;
    beep(500,.035);
  }

  for(const br of g.bricks) {
    if(!br.alive)continue;
    if(b.x+b.r>br.x&&b.x-b.r<br.x+br.w&&
      b.y+b.r>br.y&&b.y-b.r<br.y+br.h) {
      br.hp--;
      if(br.hp<=0){br.alive=false;g.score+=10;}
      b.vy*=-1;
      beep(360,.03,"square",.015);
      break;
    }
  }

  if(!g.bricks.some(br=>br.alive)) {
    if(sessionMode==="campaign")finishRun(true,"All neon blocks destroyed!");
    else {
      g.level++;
      g.rows=Math.min(9,g.rows+1);
      const colors=["#50f5ff","#a78bfa","#ff5fbd","#ffd66b","#8affc1"];
      const bw=75,gap=10,total=g.cols*bw+(g.cols-1)*gap,ox=(W-total)/2;
      for(let r=0;r<g.rows;r++)for(let c=0;c<g.cols;c++) {
        g.bricks.push({x:ox+c*(bw+gap),y:65+r*25,w:bw,h:17,alive:true,color:colors[r%colors.length],hp:1});
      }
      b.x=p.x;b.y=p.y-20;b.vy=-Math.abs(b.vy)*1.08;
      toast("Wave cleared! Difficulty increased.");
    }
    return;
  }

  if(b.y>H+15) {
    g.lives--;
    if(g.lives<=0){finishRun(false,"The ball escaped.");return;}
    b.x=p.x;b.y=p.y-20;b.vx=210;b.vy=-260;
  }
}

// ======================== ASTEROID DRIFT ===================

function updateAsteroids(g,dt) {
  const p=g.player;
  if(keys.has("ArrowLeft")||keys.has("KeyA"))p.a-=3.6*dt;
  if(keys.has("ArrowRight")||keys.has("KeyD"))p.a+=3.6*dt;
  if(keys.has("ArrowUp")||keys.has("KeyW")) {
    p.vx+=Math.cos(p.a)*210*dt;
    p.vy+=Math.sin(p.a)*210*dt;
  }
  if(keys.has("ArrowDown")||keys.has("KeyS")) {
    p.vx-=Math.cos(p.a)*85*dt;
    p.vy-=Math.sin(p.a)*85*dt;
  }
  p.vx*=Math.pow(.987,dt*60);p.vy*=Math.pow(.987,dt*60);
  p.x=(p.x+p.vx*dt+W)%W;p.y=(p.y+p.vy*dt+H)%H;

  g.fire-=dt;
  if((keys.has("Space")||pointerDown)&&g.fire<=0) {
    g.bullets.push({
      x:p.x+Math.cos(p.a)*18,y:p.y+Math.sin(p.a)*18,
      vx:p.vx+Math.cos(p.a)*430,vy:p.vy+Math.sin(p.a)*430,life:1.3
    });
    g.fire=.17;
    beep(650,.025,"square",.01);
  }

  g.bullets.forEach(b=>{
    b.x=(b.x+b.vx*dt+W)%W;b.y=(b.y+b.vy*dt+H)%H;b.life-=dt;
  });
  g.bullets=g.bullets.filter(b=>b.life>0);
  g.rocks.forEach(r=>{
    r.x=(r.x+r.vx*dt+W)%W;r.y=(r.y+r.vy*dt+H)%H;r.a+=r.spin*dt;
  });

  for(const b of g.bullets) {
    if(b.life<=0)continue;
    for(const r of g.rocks) {
      if(r.dead)continue;
      if(Math.hypot(b.x-r.x,b.y-r.y)<r.r) {
        b.life=0;r.dead=true;g.kills++;
        g.score+=r.size===2?20:50;
        burst(g,r.x,r.y,"#ffb86b");
        if(r.size===2) {
          spawnRock(g,r.x,r.y,r.r*.55,1);
          spawnRock(g,r.x,r.y,r.r*.55,1);
        }
        break;
      }
    }
  }
  g.rocks=g.rocks.filter(r=>!r.dead);

  g.spawn-=dt;
  if(g.rocks.length===0) {
    g.score+=100;
    g.spawn=1;
    if(sessionMode==="campaign"&&g.kills>=g.target) {
      finishRun(true,"Asteroid field cleared.");return;
    }
  }
  if(g.spawn<=0&&g.rocks.length<16) {
    for(let i=0;i<Math.min(3,1+Math.floor(g.level/3));i++) {
      const x=Math.random()<.5?rand(0,W):Math.random()<.5?0:W;
      const y=Math.random()<.5?0:H;
      spawnRock(g,x,y,rand(22,34),2);
    }
    g.spawn=2.3;
  }

  g.invuln=Math.max(0,g.invuln-dt);
  if(g.invuln<=0&&g.rocks.some(r=>Math.hypot(r.x-p.x,r.y-p.y)<r.r+p.r)) {
    g.lives--;g.invuln=1.8;
    p.x=W/2;p.y=H/2;p.vx=0;p.vy=0;
    if(g.lives<=0)finishRun(false,"Your ship was lost in the asteroid field.");
  }
}

// ======================== MEMORY MATRIX =====================

function updateMemory(g) {
  if(g.second===null||g.second===undefined||g.time-g.mismatchAt<.75)return;
  const a=g.deck[g.first],b=g.deck[g.second];
  if(a&&!a.matched)a.up=false;
  if(b&&!b.matched)b.up=false;
  g.first=null;g.second=null;g.lock=false;
}

function memoryClick(g,x,y) {
  if(g.lock||mode!=="playing")return;
  const rect=g.cardRects.find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);
  if(!rect)return;
  const card=g.deck[rect.i];
  if(card.up||card.matched)return;

  card.up=true;
  beep(550,.04);
  if(g.first===null){g.first=rect.i;return;}

  g.second=rect.i;
  g.moves++;
  const a=g.deck[g.first],b=g.deck[g.second];
  if(a.v===b.v) {
    a.matched=b.matched=true;
    g.matches++;
    g.score+=20;
    g.first=null;g.second=null;
    beep(850,.08);
    if(g.matches===g.pairs)finishRun(true,`Matrix cleared in ${g.moves} moves.`);
  } else {
    g.lock=true;
    g.mismatchAt=g.time;
  }
}

// ======================== DRAWING HELPERS ===================

function background() {
  ctx.fillStyle="#080b18";
  ctx.fillRect(0,0,W,H);
  for(let i=0;i<75;i++) {
    const x=(i*127.13+21)%W,y=(i*71.73+13)%H;
    ctx.fillStyle=i%4===0?"#7cf5ff70":"#d8ddff45";
    ctx.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);
  }
}

function circle(x,y,r,color,glow=0) {
  ctx.save();
  ctx.fillStyle=color;
  if(glow){ctx.shadowBlur=glow;ctx.shadowColor=color;}
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function line(x1,y1,x2,y2,color,width=2) {
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();
}

function label(str,x,y,size=16,color="#f4f5ff",align="center") {
  ctx.save();
  ctx.fillStyle=color;ctx.font=`800 ${size}px system-ui`;
  ctx.textAlign=align;ctx.fillText(str,x,y);
  ctx.restore();
}

function roundRect(x,y,w,h,r,color,glow=0) {
  ctx.save();ctx.fillStyle=color;
  if(glow){ctx.shadowBlur=glow;ctx.shadowColor=color;}
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();ctx.restore();
}

function drawGame() {
  if(!game)return;
  background();
  switch(game.id) {
    case "galaxy":drawGalaxy(game);break;
    case "snake":drawSnake(game);break;
    case "pong":drawPong(game);break;
    case "breakout":drawBreakout(game);break;
    case "asteroids":drawAsteroids(game);break;
    case "memory":drawMemory(game);break;
  }
}

function drawGalaxy(g) {
  const p=g.player;
  const grad=ctx.createLinearGradient(0,H*.45,0,H);
  grad.addColorStop(0,"#080b18");grad.addColorStop(1,"#101a36");
  ctx.fillStyle=grad;ctx.fillRect(0,H*.45,W,H*.55);
  for(let i=0;i<7;i++){const y=(g.time*35+i*95)%H;line(0,y,W,y,"#8c9bff0a",1);}

  g.bullets.forEach(b=>roundRect(b.x-2,b.y-9,4,15,2,"#b7ffff",12));
  g.enemies.forEach(e=>{
    ctx.save();ctx.translate(e.x,e.y);
    ctx.shadowBlur=15;ctx.shadowColor="#ff5fbd";ctx.fillStyle="#ff5fbd";
    ctx.beginPath();ctx.moveTo(0,e.r);ctx.lineTo(e.r,e.r*.2);
    ctx.lineTo(e.r*.65,-e.r*.65);ctx.lineTo(-e.r*.65,-e.r*.65);
    ctx.lineTo(-e.r,e.r*.2);ctx.closePath();ctx.fill();
    ctx.restore();
  });
  g.powerups.forEach(pu=>circle(pu.x,pu.y,pu.r,"#8affc1",12));
  g.particles.forEach(p0=>circle(p0.x,p0.y,2,p0.color,4));

  if(g.invuln<=0||Math.floor(g.time*15)%2===0) {
    ctx.save();ctx.translate(p.x,p.y);
    ctx.shadowBlur=20;ctx.shadowColor="#50f5ff";ctx.fillStyle="#50f5ff";
    ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(16,15);ctx.lineTo(0,9);ctx.lineTo(-16,15);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  label("DESTROYED "+g.kills+(Number.isFinite(g.target)?"/"+g.target:""),20,28,13,"#50f5ff","left");
  label("♥ ".repeat(g.lives),W-20,28,14,"#ff7aa9","right");
}

function drawSnake(g) {
  const cw=W/g.cols,ch=H/g.rows;
  for(let x=0;x<=W;x+=cw)line(x,0,x,H,"#8affc10a",1);
  for(let y=0;y<=H;y+=ch)line(0,y,W,y,"#8affc10a",1);
  circle((g.food.x+.5)*cw,(g.food.y+.5)*ch,Math.min(cw,ch)*.32,"#ff5fbd",15);
  g.snake.forEach((s,i)=>roundRect(s.x*cw+1,s.y*ch+1,cw-2,ch-2,4,i===0?"#d4fff0":"#36db9a",i===0?12:4));
  label("LENGTH "+g.snake.length,18,27,13,"#8affc1","left");
  label("FOOD "+Math.max(0,g.snake.length-3)+(Number.isFinite(g.target)?"/"+g.target:""),W-18,27,12,"#50f5ff","right");
}

function drawPong(g) {
  for(let y=10;y<H;y+=27)line(W/2,y,W/2,y+13,"#a78bfa55",3);
  roundRect(28,g.p1.y,13,g.p1.h,5,"#50f5ff",16);
  roundRect(W-41,g.p2.y,13,g.p2.h,5,"#ff5fbd",16);
  circle(g.ball.x,g.ball.y,g.ball.r,"#fff",14);
  label(String(g.points[0]),W*.25,65,38,"#50f5ff");
  label(String(g.points[1]),W*.75,65,38,"#ff5fbd");
  label("FIRST TO 7",W/2,H-18,11,"#9299b8");
}

function drawBreakout(g) {
  g.bricks.forEach(br=>{
    if(!br.alive)return;
    roundRect(br.x,br.y,br.w,br.h,4,br.hp>1?"#ffffff":br.color,8);
  });
  roundRect(g.paddle.x-g.paddle.w/2,g.paddle.y,g.paddle.w,g.paddle.h,7,"#50f5ff",17);
  circle(g.ball.x,g.ball.y,g.ball.r,"#fff",13);
  label("LIVES "+g.lives,20,28,13,"#ff5fbd","left");
}

function drawAsteroids(g) {
  g.rocks.forEach(r=>{
    ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.a);
    ctx.strokeStyle="#ffb86b";ctx.lineWidth=2;
    ctx.shadowBlur=9;ctx.shadowColor="#ffb86b";
    ctx.beginPath();
    for(let i=0;i<9;i++) {
      const a=i/9*Math.PI*2,rr=r.r*(.76+.2*Math.sin(i*9+r.size));
      const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.stroke();ctx.restore();
  });
  g.bullets.forEach(b=>circle(b.x,b.y,3,"#fff",8));
  const p=g.player;
  if(g.invuln<=0||Math.floor(g.time*12)%2===0) {
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a+Math.PI/2);
    ctx.fillStyle="#50f5ff";ctx.shadowBlur=17;ctx.shadowColor="#50f5ff";
    ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(13,14);ctx.lineTo(0,8);ctx.lineTo(-13,14);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  label("DESTROYED "+g.kills+(Number.isFinite(g.target)?"/"+g.target:""),20,28,13,"#ffb86b","left");
  label("♥ ".repeat(g.lives),W-20,28,14,"#ff7aa9","right");
}

function drawMemory(g) {
  const cols=4,rows=Math.ceil(g.deck.length/cols),gap=10;
  const cw=Math.min(170,(W-55-gap*(cols-1))/cols);
  const ch=Math.min(108,(H-90-gap*(rows-1))/rows);
  const totalW=cols*cw+(cols-1)*gap,totalH=rows*ch+(rows-1)*gap;
  const ox=(W-totalW)/2,oy=(H-totalH)/2+10;
  g.cardRects=[];

  g.deck.forEach((c,i)=>{
    const x=ox+(i%cols)*(cw+gap),y=oy+Math.floor(i/cols)*(ch+gap);
    g.cardRects.push({x,y,w:cw,h:ch,i});
    roundRect(x,y,cw,ch,10,c.matched?"#12372e":c.up?"#1c2140":"#13182c",c.up?10:0);
    ctx.save();ctx.strokeStyle=c.matched?"#8affc1":c.up?"#50f5ff":"#535b86";
    ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(x,y,cw,ch,10);ctx.stroke();ctx.restore();
    label(c.up||c.matched?c.v:"✦",x+cw/2,y+ch/2+12,Math.min(38,cw*.28),c.matched?"#8affc1":c.up?"#50f5ff":"#717cae");
  });
  label("MOVES "+g.moves,W/2,25,13,"#50f5ff");
  label("MATCHED "+g.matches+"/"+g.pairs,W/2,H-14,12,"#a78bfa");
}

// ======================== POINTER & KEYBOARD ================

function pointerPosition(e) {
  const rect=canvas.getBoundingClientRect();
  return {
    x:clamp((e.clientX-rect.left)*W/rect.width,0,W),
    y:clamp((e.clientY-rect.top)*H/rect.height,0,H)
  };
}

canvas.addEventListener("pointerdown",e=>{
  if(mode!=="playing"||!game)return;
  e.preventDefault();
  pointerDown=true;
  const pos=pointerPosition(e);
  pointerX=pos.x;pointerY=pos.y;

  if(game.id==="memory") {
    memoryClick(game,pos.x,pos.y);
    return;
  }
  if(game.id==="pong")game.p1.y=clamp(pos.y-game.p1.h/2,0,H-game.p1.h);
  if(game.id==="breakout")game.paddle.x=pos.x;
  if(game.id==="galaxy") {
    game.player.x=pos.x;
    game.player.y=clamp(pos.y,65,H-20);
  }
  try{canvas.setPointerCapture(e.pointerId);}catch{}
});

canvas.addEventListener("pointermove",e=>{
  if(!game)return;
  const pos=pointerPosition(e);
  pointerX=pos.x;pointerY=pos.y;
  if(!pointerDown)return;
  if(game.id==="pong")game.p1.y=clamp(pos.y-game.p1.h/2,0,H-game.p1.h);
  if(game.id==="breakout")game.paddle.x=clamp(pos.x,game.paddle.w/2,W-game.paddle.w/2);
  if(game.id==="galaxy") {
    game.player.x=clamp(pos.x,20,W-20);
    game.player.y=clamp(pos.y,65,H-20);
  }
});
canvas.addEventListener("pointerup",()=>pointerDown=false);
canvas.addEventListener("pointercancel",()=>pointerDown=false);
canvas.addEventListener("lostpointercapture",()=>pointerDown=false);

document.addEventListener("keydown",e=>{
  const k=e.code;
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(k)) {
    if(currentId!=="memory")e.preventDefault();
  }
  if(k==="Escape") {
    if(mode==="playing")pauseGame();
    else if(mode==="paused")resumeGame();
    else if(mode==="over")showHub();
    return;
  }
  if(k==="KeyR"&&currentId) {
    if(mode==="playing"||mode==="paused")restartGame();
    return;
  }
  if(mode!=="playing"||!game)return;
  keys.add(k);
  if(game.id==="snake")setSnakeDirection(k);
});
document.addEventListener("keyup",e=>keys.delete(e.code));
window.addEventListener("blur",()=>{
  clearInputs();
  if(mode==="playing")pauseGame();
});
document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&mode==="playing")pauseGame();
});

// Swipe-to-turn support for Snake.
canvas.addEventListener("touchstart",e=>{
  if(currentId!=="snake"||!e.touches.length)return;
  touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
},{passive:true});

canvas.addEventListener("touchend",e=>{
  if(currentId!=="snake"||!touchStart||!e.changedTouches.length)return;
  const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>20) {
    if(Math.abs(dx)>Math.abs(dy))setSnakeDirection(dx>0?"ArrowRight":"ArrowLeft");
    else setSnakeDirection(dy>0?"ArrowDown":"ArrowUp");
  }
  touchStart=null;
},{passive:true});

// ======================== RESIZE & INITIALIZATION ===========

function resizeCanvas() {
  if(!$("gameScreen").classList.contains("active"))return;
  const wrap=$("canvasWrap");
  if(!wrap)return;
  const aw=Math.max(100,wrap.clientWidth);
  const ah=Math.max(100,wrap.clientHeight);
  const aspect=W/H;
  let cw=aw,ch=cw/aspect;
  if(ch>ah){ch=ah;cw=ch*aspect;}
  canvas.style.width=Math.floor(cw)+"px";
  canvas.style.height=Math.floor(ch)+"px";
}

window.addEventListener("resize",resizeCanvas);
window.addEventListener("orientationchange",()=>requestAnimationFrame(resizeCanvas));


if(CONFIG.github==="https://github.com/rakesh01-saini/") {
  $("profileNote").textContent="Set CONFIG.github and CONFIG.linkedin in script.js to your real profile URLs.";
} else if(CONFIG.linkedin==="https://www.linkedin.com/in/rakesh-saini-9a9b872b5/") {
  $("profileNote").textContent="Connect with the developer through the links above.";
}

renderDashboard();
