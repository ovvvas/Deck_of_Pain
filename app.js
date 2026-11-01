(() => {
  "use strict";
  const SUITS = [
    {key:"hearts",name:"Hearts",symbol:"♥",color:"red"},
    {key:"diamonds",name:"Diamonds",symbol:"♦",color:"red"},
    {key:"clubs",name:"Clubs",symbol:"♣",color:"black"},
    {key:"spades",name:"Spades",symbol:"♠",color:"black"}
  ];
  const EXERCISES = ["Push-ups","Bodyweight Squats","Mountain Climbers (per leg)","Burpees","Reverse Lunges","Plank Shoulder Taps","High Knees","Glute Bridges","Jumping Jacks","Bicycle Crunches","Pike Push-ups","Alternating V-ups"];
  const DEFAULTS = {hearts:"Push-ups",diamonds:"Bodyweight Squats",clubs:"Mountain Climbers (per leg)",spades:"Burpees"};
  const PRESETS = {
    full:{...DEFAULTS},
    upper:{hearts:"Push-ups",diamonds:"Plank Shoulder Taps",clubs:"Pike Push-ups",spades:"Bicycle Crunches"},
    legs:{hearts:"Bodyweight Squats",diamonds:"Reverse Lunges",clubs:"Glute Bridges",spades:"High Knees"}
  };
  const PRESET_NAMES = {full:"Full Body",upper:"Upper Body",legs:"Leg Burner"};
  const $ = id => document.getElementById(id);
  const state = {mode:1,assignments:{...DEFAULTS},players:[],paused:false,sound:false,lastSetup:null,history:load("dop-history",[]),completed:[],runId:0};
  let toastTimer;
  let dialogResolver = null;
  function appConfirm(title,message,confirmLabel="YES, CONTINUE"){
    $("dialog-title").textContent=title;
    $("dialog-message").textContent=message;
    $("dialog-confirm").textContent=confirmLabel;
    $("app-dialog").classList.remove("hidden");
    return new Promise(resolve=>{dialogResolver=resolve;});
  }
  function closeDialog(result){
    $("app-dialog").classList.add("hidden");
    if(dialogResolver){dialogResolver(result);dialogResolver=null;}
  }
  $("dialog-cancel").addEventListener("click",()=>closeDialog(false));
  $("dialog-confirm").addEventListener("click",()=>closeDialog(true));
  $("app-dialog").addEventListener("click",e=>{if(e.target===$("app-dialog"))closeDialog(false)});
  function load(key,fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}}
  function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{showToast("Storage unavailable in this browser")}}
  function showToast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2200)}
  function renderSuitSelectors(){
    $("suit-selectors").innerHTML=SUITS.map(s=>`<div class="suit-card"><label><span class="suit-symbol ${s.color==="red"?"red-suit":""}">${s.symbol}</span>${s.name.toUpperCase()}</label><select data-suit="${s.key}" aria-label="${s.name} exercise">${EXERCISES.map(e=>`<option ${state.assignments[s.key]===e?"selected":""}>${e}</option>`).join("")}</select></div>`).join("");
    $("suit-selectors").querySelectorAll("select").forEach(el=>el.addEventListener("change",e=>{state.assignments[e.target.dataset.suit]=e.target.value}));
  }
  function rankValue(rank){if(rank==="A")return 11;if(["J","Q","K"].includes(rank))return 10;return Number(rank)}
  function makeDeck(){const ranks=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];return SUITS.flatMap(s=>ranks.map(rank=>({suit:s.key,symbol:s.symbol,color:s.color,rank,reps:rankValue(rank)})))}
  function shuffle(deck){for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}return deck}
  function createPlayer(index){
    return {id:index+1,name:`PLAYER ${index+1}`,deck:shuffle(makeDeck()),drawn:0,reps:0,startedAt:null,elapsed:0,running:false,finished:false,abandoned:false,current:null,breakdown:{hearts:0,diamonds:0,clubs:0,spades:0},pausedAt:null};
  }
  function formatTime(ms){const total=Math.floor(ms/1000),m=Math.floor(total/60),s=total%60;return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
  function elapsed(p){return p.elapsed+(p.running&&p.startedAt?Date.now()-p.startedAt:0)}
  function startPlayer(p){if(!p.startedAt&&!p.elapsed){p.startedAt=Date.now();p.running=true}}
  function pausePlayer(p){if(p.running){p.elapsed=elapsed(p);p.running=false;p.startedAt=null}}
  function resumePlayer(p){if(!p.finished&&!p.running&&p.elapsed>0){p.startedAt=Date.now();p.running=true}}
  function drawCard(id){
    const p=state.players.find(x=>x.id===id);if(!p||p.finished||state.paused||p.drawn>=52||(p.elapsed>0&&!p.running))return;
    startPlayer(p);p.current=p.deck[p.drawn++];p.reps+=p.current.reps;p.breakdown[p.current.suit]+=p.current.reps;
    if(p.drawn===52){p.finished=true;pausePlayer(p);state.completed.push(p.id);if(state.mode===1||state.players.every(x=>x.finished)){showSummary();return}}
    renderPlayers();if(state.sound)beep();
  }
  function beep(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=520;g.gain.value=.035;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.065);o.onended=()=>c.close()}catch{}}

  /* Panels are built once per workout, then only the changed parts are patched.
     This keeps the page, the other player and the buttons from re-rendering on every card. */
  function panelShell(p){
    return `<article class="player-panel enter" data-player="${p.id}">
      <div class="paused-overlay hidden">PAUSED</div>
      <div class="player-head"><div class="player-name"></div><div class="player-stats">
        <div class="stat"><strong class="t-time"></strong><small>TIME</small></div>
        <div class="stat"><strong><span class="t-left"></span><small> / 52</small></strong><small>CARDS LEFT</small></div>
        <div class="stat"><strong class="t-reps"></strong><small>REPS</small></div>
      </div></div>
      <div class="draw-zone">
        <div class="playing-card back" aria-label="Face down card"></div>
        <div class="card-detail">
          <div class="exercise-label"></div>
          <div class="exercise-name"></div>
          <div class="rep-count"><span class="n"></span> <small></small></div>
        </div>
      </div>
      <div class="player-controls">
        <button class="draw-btn" data-action="draw" data-id="${p.id}"></button>
        <button class="control-btn" data-action="pause" data-id="${p.id}"></button>
        <button class="control-btn" data-action="abandon" data-id="${p.id}">✕ ABANDON</button>
      </div>
    </article>`;
  }
  /* Reserve three lines at the CSS size, then shrink the text until it fits: the slot never changes size. */
  function fitName(el){
    el.style.fontSize="";el.style.height="";
    const cs=getComputedStyle(el),fs=parseFloat(cs.fontSize),lh=parseFloat(cs.lineHeight)||fs*.98,H=Math.ceil(lh*3);
    el.style.height=H+"px";
    let s=fs;
    while((el.scrollHeight>H+1||el.scrollWidth>el.clientWidth+1)&&s>14){s-=1;el.style.fontSize=s+"px"}
  }
  function fitAll(){document.querySelectorAll(".exercise-name").forEach(fitName)}
  let resizeTimer;window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fitAll,120)});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitAll);
  function updatePanel(el,p){
    if(!el)return;
    const q=sel=>el.querySelector(sel);
    const c=p.current,s=c&&SUITS.find(x=>x.key===c.suit),isRed=c&&c.color==="red";
    el.classList.toggle("winner",p.finished&&!p.abandoned&&state.mode===2);
    el.classList.toggle("abandoned",p.abandoned);
    q(".paused-overlay").classList.toggle("hidden",!(state.paused&&!p.finished));
    q(".player-name").innerHTML=p.name+(p.abandoned?' <span style="color:var(--red)">✕ ABANDONED</span>':p.finished?' <span style="color:var(--green)">✓ COMPLETE</span>':"");
    q(".t-time").textContent=formatTime(elapsed(p));
    q(".t-left").textContent=52-p.drawn;
    q(".t-reps").textContent=p.reps;
    const card=q(".playing-card"),key=c?`${c.rank}-${c.suit}-${p.drawn}`:"";
    if(key!==(card.dataset.key||"")){
      card.dataset.key=key;
      if(c){
        card.classList.remove("back","deploy");
        card.innerHTML=`<span class="card-corner ${isRed?"red-suit":""}">${c.rank}<br>${c.symbol}</span><div class="card-center ${isRed?"red-suit":""}">${c.symbol}</div><span class="card-corner bottom ${isRed?"red-suit":""}">${c.rank}<br>${c.symbol}</span>`;
        card.setAttribute("aria-label",`${c.rank} of ${s.name}`);
        void card.offsetWidth;card.classList.add("deploy");
      }
    }
    q(".exercise-label").textContent=c?"CURRENT CARD / "+s.name.toUpperCase():"READY WHEN YOU ARE";
    const nameEl=q(".exercise-name"),nameTxt=c?state.assignments[c.suit].toUpperCase():"DRAW YOUR FIRST CARD";
    if(nameEl.textContent!==nameTxt){nameEl.textContent=nameTxt;fitName(nameEl)}
    q(".rep-count .n").textContent=c?c.reps:"—";
    q(".rep-count small").textContent="REPS";
    const started=Boolean(p.startedAt||p.elapsed);
    const draw=q('[data-action="draw"]');
    draw.disabled=p.finished||state.paused||(started&&!p.running);
    draw.textContent=p.abandoned?"DECK ABANDONED":p.finished?"DECK COMPLETE":c?"NEXT CARD →":"DRAW FIRST CARD →";
    const pz=q('[data-action="pause"]');pz.disabled=p.finished||!started;pz.textContent=p.running||!started?"PAUSE":"RESUME";
    q('[data-action="abandon"]').disabled=p.finished;
  }
  function renderPlayers(){
    const box=$("players");
    box.classList.toggle("dual",state.mode===2);
    if(box.dataset.run!==String(state.runId)){
      box.dataset.run=String(state.runId);
      box.innerHTML=state.players.map(panelShell).join("");
      box.querySelectorAll(".player-panel").forEach(el=>el.addEventListener("animationend",e=>{if(e.animationName==="panel-lock")el.classList.remove("enter")}));
    }
    state.players.forEach(p=>updatePanel(box.querySelector(`[data-player="${p.id}"]`),p));
  }
  function beginWorkout(){
    state.lastSetup={mode:state.mode,assignments:{...state.assignments}};
    state.players=Array.from({length:state.mode},(_,i)=>createPlayer(i));state.paused=false;state.completed=[];state.runId++;
    $("setup-screen").classList.add("hidden");$("summary-screen").classList.add("hidden");$("game-screen").classList.remove("hidden");
    $("game-title").textContent=state.mode===2?"VERSUS / TWO INDEPENDENT DECKS":"WORKOUT IN PROGRESS";
    $("pause-all").textContent="PAUSE";renderPlayers();
  }
  function showSummary(){
    $("game-screen").classList.add("hidden");$("summary-screen").classList.remove("hidden");
    const allAb=state.players.every(p=>p.abandoned),sum=$("summary-screen");
    sum.querySelector(".eyebrow").textContent=allAb?"DECK ABANDONED":"DECK CLEARED";
    sum.querySelector("h1").innerHTML=allAb?"<em>DECK</em> ABANDONED.":"<em>WORK</em> COMPLETE.";
    sum.querySelector(".lede").textContent=allAb?"Come back when you're ready.":"You showed up. That's the win.";
    const sorted=state.players.slice().sort((a,b)=>(a.abandoned-b.abandoned)||(elapsed(a)-elapsed(b)));
    $("summary-content").innerHTML=sorted.map(p=>{
      const n=p.name+(p.abandoned?" (ABANDONED)":"");
      const stats=[[formatTime(elapsed(p)),"TIME"],[p.reps,"TOTAL REPS"],[`${p.drawn} / 52`,"CARDS"],[`${Math.round(p.drawn/52*100)}%`,"COMPLETION"]]
        .map(([v,l])=>`<div class="summary-card"><strong>${v}</strong><span>${n} / ${l}</span></div>`).join("");
      const suits=SUITS.map(s=>`<div class="summary-card suit-sum"><strong><i class="${s.color==="red"?"red-suit":""}">${s.symbol}</i> ${p.breakdown[s.key]}</strong><span>${state.lastSetup.assignments[s.key].toUpperCase()}</span></div>`).join("");
      return stats+suits;
    }).join("");
    $("save-history").disabled=false;$("save-history").textContent="SAVE TO HISTORY";renderHistory();
  }
  function renderHistory(){
    const history=state.history.slice(0,5);
    $("history-list").innerHTML=history.length?`<div class="eyebrow">RECENT WORKOUTS</div>`+history.map(h=>`<div class="history-item"><span>${new Date(h.date).toLocaleString()}</span><b>${h.players.map(p=>`${p.name}: ${p.time} / ${p.reps} reps`).join(" · ")}</b></div>`).join(""):"";
  }
  function saveHistory(){
    const entry={date:new Date().toISOString(),players:state.players.map(p=>({name:p.name,time:formatTime(elapsed(p)),reps:p.reps,breakdown:p.breakdown}))};
    state.history.unshift(entry);state.history=state.history.slice(0,30);persist("dop-history",state.history);$("save-history").disabled=true;$("save-history").textContent="SAVED ✓";renderHistory();showToast("Workout saved on this device");
  }
  async function abandon(id){
    const accepted=await appConfirm("ABANDON THIS DECK?","Your current workout progress will be lost. Do you want to abandon this deck?","ABANDON DECK");
    if(!accepted)return;
    if(state.mode===2){const p=state.players.find(x=>x.id===id);if(p&&!p.finished){p.abandoned=true;p.finished=true;pausePlayer(p)}if(state.players.every(x=>x.finished))showSummary();else renderPlayers()}
    else{$("game-screen").classList.add("hidden");$("setup-screen").classList.remove("hidden")}
  }
  document.querySelectorAll(".mode-btn").forEach(btn=>btn.addEventListener("click",()=>{state.mode=Number(btn.dataset.mode);document.querySelectorAll(".mode-btn").forEach(b=>{const active=b===btn;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active))})}));
  document.querySelectorAll(".preset-btn").forEach(btn=>btn.addEventListener("click",()=>{state.assignments={...PRESETS[btn.dataset.preset]};renderSuitSelectors();showToast(`${PRESET_NAMES[btn.dataset.preset]} loadout loaded`)}));
  $("start-btn").addEventListener("click",beginWorkout);
  $("players").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;const id=Number(b.dataset.id),p=state.players.find(x=>x.id===id);if(!p)return;
    if(b.dataset.action==="draw"){drawCard(id);b.blur()}
    if(b.dataset.action==="pause"){if(p.running)pausePlayer(p);else resumePlayer(p);renderPlayers()}
    if(b.dataset.action==="abandon")abandon(id);
  });
  $("pause-all").addEventListener("click",()=>{state.paused=!state.paused;state.players.forEach(p=>state.paused?pausePlayer(p):resumePlayer(p));$("pause-all").textContent=state.paused?"RESUME ALL":"PAUSE";renderPlayers()});
  $("back-setup").addEventListener("click",async()=>{const accepted=await appConfirm("BACK TO SETUP?","Leaving now will discard this workout's current progress.","GO BACK TO SETUP");if(accepted){state.players.forEach(p=>pausePlayer(p));$("game-screen").classList.add("hidden");$("setup-screen").classList.remove("hidden")}});
  $("save-history").addEventListener("click",saveHistory);
  $("restart-btn").addEventListener("click",()=>{if(state.lastSetup){state.mode=state.lastSetup.mode;state.assignments={...state.lastSetup.assignments};renderSuitSelectors();beginWorkout()}});
  $("new-setup").addEventListener("click",()=>{$("summary-screen").classList.add("hidden");$("setup-screen").classList.remove("hidden")});
  $("sound-toggle").addEventListener("click",()=>{state.sound=!state.sound;$("sound-toggle").setAttribute("aria-pressed",String(state.sound));$("sound-toggle").style.color=state.sound?"var(--red)":"";showToast(state.sound?"Sound enabled":"Sound muted")});
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&!$("app-dialog").classList.contains("hidden")){closeDialog(false);return}
    if(!$("app-dialog").classList.contains("hidden"))return;
    if(e.code==="Space"&&e.target.tagName!=="BUTTON"&&e.target.tagName!=="SELECT"){e.preventDefault()}
    if($("game-screen").classList.contains("hidden")||e.repeat)return;
    if(state.mode===1&&(e.code==="Space"||e.key.toLowerCase()==="w")){e.preventDefault();drawCard(1)}
    if(state.mode===2){if(e.key.toLowerCase()==="w"||e.code==="Space"){e.preventDefault();drawCard(1)}if(e.key==="Enter"){e.preventDefault();drawCard(2)}}
  });
  document.addEventListener("keyup",e=>{if(e.code==="Space"&&!$("game-screen").classList.contains("hidden")&&$("app-dialog").classList.contains("hidden"))e.preventDefault()});
  setInterval(()=>{if(!$("game-screen").classList.contains("hidden")){document.querySelectorAll(".player-panel").forEach(el=>{const p=state.players.find(x=>x.id===Number(el.dataset.player));const timer=el.querySelector(".stat strong");if(p&&timer)timer.textContent=formatTime(elapsed(p))})}},500);
  function updateOnline(){const online=navigator.onLine;$("offline-status").textContent=online?"● ONLINE":"● OFFLINE";$("offline-status").classList.toggle("offline",!online)}
  window.addEventListener("online",updateOnline);window.addEventListener("offline",updateOnline);updateOnline();
  if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}))}
  renderSuitSelectors();renderHistory();
})();
