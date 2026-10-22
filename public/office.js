// The room and characters are drawn locally; no image downloads or animation library.
export const staff = [
  { id: 'manager', name: 'Milo', role: 'Team manager', color: '#a6d6a0', shirt: '#718caf', hair: '#493c4a', skin: '#f1c6a3', x: 148, line: 'Let’s turn that idea into a plan.', prompt: 'Create a coordinated Instagram and email campaign for ' },
  { id: 'instagram', name: 'Luna', role: 'Instagram creative', color: '#c8b2ed', shirt: '#a07ccc', hair: '#573a62', skin: '#f4c8ac', x: 367, line: 'A little color. A great story.', prompt: 'Create an Instagram-led campaign with a compelling caption and visual direction for ' },
  { id: 'email', name: 'Kai', role: 'Email writer', color: '#f2cd86', shirt: '#d4954e', hair: '#533b2c', skin: '#b77a55', x: 586, line: 'Finding just the right words.', prompt: 'Create a campaign with an especially strong email subject and body for ' },
  { id: 'reviewer', name: 'Nova', role: 'Quality reviewer', color: '#8ecbd2', shirt: '#4b9f9b', hair: '#293e46', skin: '#e8b38e', x: 805, line: 'Every detail deserves a second look.', prompt: 'Create a clear, factual Instagram and email campaign, checking every claim against my brand details, for ' },
];

export function officeMarkup() {
  return `<section class="pixel-office" aria-label="Interactive AI staff office">
    <div class="office-toolbar"><div><span class="office-led"></span> THE LITTLE BIG OFFICE <span class="office-floor">/ FLOOR 01</span></div><button id="motion-toggle" type="button" aria-pressed="false">Ⅱ Pause motion</button></div>
    <div class="office-viewport"><canvas id="office-scene" width="960" height="520" aria-hidden="true"></canvas><div class="office-characters">${staff.map(s=>`<button class="office-person" data-agent="${s.id}" aria-label="Meet ${s.name}, ${s.role}" aria-pressed="false"><span class="person-name">${s.name}<span>↗</span></span></button>`).join('')}</div><div class="office-hint">✦ Click a character. Meet your team.</div></div>
    <div class="office-bottom"><span><span class="office-led"></span> 4 CHARACTERS · 1 BIG IDEA</span><span id="office-state">Roaming the office</span><span class="office-key">CLICK TO INTERACT ↗</span></div>
  </section>
  <section class="agent-inspector" aria-label="Selected worker" aria-live="polite"><div class="agent-mini" id="agent-mini">✦</div><div class="agent-intro"><p class="eyebrow" id="agent-role">YOUR NEXT GREAT COLLABORATOR</p><h2 id="agent-name">Good things start with a hello.</h2><p id="agent-line">Pick someone in the office to see what they do.</p></div><div class="agent-controls"><span id="agent-mode">No campaign running</span><button class="button primary" id="assign-agent" disabled>Choose a teammate ↗</button></div></section>`;
}

export function mountOffice({ hasJob, onAssign }) {
  const canvas = document.querySelector('#office-scene');
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, selected = null, previewUntil = 0, previous = 0, animationClock = 0, frame, disposed = false;
  const people = staff.map((s, index) => ({ ...s, px: s.x, py: 278, goal: 0, moving: false, clock: index * 2, path: [], pause: index * 1.2 }));
  const routes = [[148, 300], [367, 300], [586, 300], [805, 300], [810, 380], [568, 330], [380, 330], [148, 300]];
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function text(value, x, y, color = '#697669', size = 10) { ctx.fillStyle = color; ctx.font = `bold ${size}px monospace`; ctx.fillText(value, x, y); }
  function plant(x, y, large = false) {
    const n = large ? 1.5 : 1;
    rect(x - 9*n, y - 16*n, 18*n, 17*n, '#976a50'); rect(x - 12*n, y - 19*n, 24*n, 5*n, '#be8d65');
    rect(x - 2*n, y - 51*n, 4*n, 32*n, '#658659'); rect(x - 16*n, y - 42*n, 15*n, 10*n, '#698f63');
    rect(x + 1*n, y - 50*n, 14*n, 11*n, '#91b779'); rect(x - 11*n, y - 60*n, 11*n, 16*n, '#7ca56c');
    rect(x + 1*n, y - 32*n, 15*n, 8*n, '#577a57');
  }
  function desk(x, label, color, tick, active) {
    rect(x - 75, 207, 156, 18, '#b78e67'); rect(x - 75, 166, 156, 47, '#dfb78b');
    rect(x - 75, 166, 156, 5, '#f3cea0'); rect(x - 69, 225, 8, 19, '#89725c'); rect(x + 62, 225, 8, 19, '#89725c');
    rect(x - 26, 139, 57, 36, '#3c4b4f'); rect(x - 22, 143, 49, 26, '#b8d7c2');
    rect(x - 3, 174, 9, 8, '#52605b'); rect(x - 14, 181, 32, 4, '#657568');
    rect(x - 19, 191, 46, 12, '#84958a'); rect(x - 16, 194, 40, 2, '#cbd4c0'); rect(x - 16, 199, 40, 2, '#cbd4c0');
    rect(x + 44, 189, 10, 12, color); rect(x + 53, 191, 4, 7, '#c9a47b');
    rect(x - 57, 190, 20, 14, '#f6e8c8'); rect(x - 53, 193, 12, 2, '#d3b988');
    rect(x - 26, 237, 54, 9, '#657e6d'); rect(x - 24, 246, 50, 12, '#577562'); rect(x - 3, 258, 6, 18, '#52675b');
    rect(x - 16, 274, 34, 4, '#52675b');
    for (let row = 0; row < 3; row++) rect(x - 16, 148 + row*6, active ? (12 + ((Math.floor(tick*3) + row*7) % 23)) : 25-row*5, 2, active ? '#527e75' : '#82ad9e');
    text(label, x - 63, 125, '#727c71', 9);
    if (active) { rect(x + 65, 164, 5, 5, Math.floor(tick*2)%2 ? color : '#7e9372'); }
  }
  function room(tick, busy) {
    rect(0, 0, 960, 520, '#d9e4d5');
    // Back wall, tall windows, and a tiny city outside.
    rect(24, 27, 912, 441, '#879989'); rect(32, 33, 896, 115, '#e7e7d4');
    rect(32, 141, 896, 9, '#c5cab5');
    for (const x of [67, 411, 752]) {
      rect(x, 49, 136, 73, '#b6c1af'); rect(x+5, 54, 126, 61, '#a9cecc');
      rect(x+8, 92, 20, 23, '#91b3b1'); rect(x+34, 82, 25, 33, '#87aca9'); rect(x+67, 96, 18, 19, '#91b3b1'); rect(x+93, 75, 28, 40, '#95b7b2');
      rect(x+65, 54, 5, 61, '#e7e8d7'); rect(x+5, 83, 126, 4, '#e7e8d7'); rect(x-4, 118, 144, 7, '#f8f1d9');
    }
    // Wood planks.
    rect(32, 150, 896, 309, '#d9c4a0');
    for (let y=150;y<460;y+=24) { rect(32,y,896,2,'#ccb48e'); for(let x=32+((y/24)%2)*45;x<928;x+=90)rect(x,y,1,24,'#cfb893'); }
    rect(32, 459, 896, 13, '#a48d6e'); rect(24, 472, 912, 9, '#758877');
    rect(24, 150, 8, 322, '#b5b79d'); rect(928, 150, 8, 322, '#b5b79d');
    // Wall clock and notice board.
    rect(253,55,90,56,'#b39370');rect(258,60,80,46,'#d4c4a0');
    rect(264,67,23,24,'#faf1ce');rect(294,70,32,21,'#c1cda5');rect(268,72,14,2,'#9a9d7c');rect(298,76,22,2,'#7b9775');
    rect(639,62,43,37,'#758978');rect(644,67,33,27,'#f4f0d7');rect(659,71,3,11,'#73826b');rect(660,79,9,3,'#73826b');
    // Rug, lounge, and a little coffee corner.
    rect(63,332,284,106,'#b1bf9e');rect(70,339,270,92,'#c5d0af');
    for(let y=344;y<430;y+=10)rect(75,y,260,1,'#b7c59f');
    rect(83,343,137,59,'#6e927c');rect(83,338,137,13,'#89aa8a');rect(77,348,15,55,'#83a285');rect(213,348,15,55,'#83a285');
    rect(95,355,51,24,'#a4baa0');rect(153,355,51,24,'#a4baa0');rect(91,402,8,8,'#7c795e');rect(208,402,8,8,'#7c795e');
    rect(250,359,67,38,'#bc986e');rect(247,354,73,34,'#ebcca0');rect(254,362,19,14,'#f6edcf');rect(285,362,9,11,'#789b87');
    text('IDEA CORNER',96,423,'#7d8e70',9);
    // Shared table.
    rect(440,367,211,56,'#b49b78');rect(435,360,221,48,'#e9d2aa');rect(445,364,201,4,'#f5e1bc');
    for(const x of [467,574]) { rect(x,343,44,10,'#7d9d91');rect(x,419,44,10,'#7d9d91'); }
    rect(523,376,37,21,'#f4edce');rect(528,381,25,2,'#b7be9d');rect(528,387,18,2,'#b7be9d'); plant(615,393);
    text('A PLACE FOR BIG IDEAS',467,450,'#8d8268',9);
    // Coffee bar and bookshelf.
    rect(743,346,147,80,'#b99772');rect(737,337,159,13,'#f1d8af');rect(750,358,61,58,'#cab28e');rect(817,358,65,58,'#cab28e');
    rect(765,300,48,37,'#4b5d5a');rect(770,305,38,8,'#82998d');rect(777,316,24,18,'#2d4443');rect(783,324,12,10,'#f7e3be');
    rect(838,322,13,15,'#a4b985');rect(856,322,13,15,'#a4b985');text('COFFEE + CURIOSITY',746,445,'#8d8268',9);
    plant(61,270,true);plant(899,270,true);plant(889,146);plant(58,146);
    people.forEach(p=>desk(p.x,p.role.toUpperCase(),p.color,tick,busy || (selected===p.id && tick<previewUntil)));
    text('AGENT WORKER HQ',383,503,'#758c76',11);
    rect(360,493,6,6,'#8da482');rect(593,493,6,6,'#8da482');
  }
  function person(p, tick, busy) {
    const work = !p.moving && (busy || (selected===p.id && tick<previewUntil));
    const bob = !paused && p.moving ? Math.floor(Math.sin(tick*13)*2) : 0;
    const x = Math.round(p.px)-24, y = Math.round(p.py)-68+bob, k=3;
    const r=(a,b,w,h,c)=>rect(x+a*k,y+b*k,w*k,h*k,c);
    rect(x+2,y+65,46,6,'#b5ac8c');
    // Pixel silhouette, hair, face, shirt, and moving feet.
    r(4,0,8,1,p.hair);r(3,1,10,5,p.hair);r(4,4,8,5,p.skin);r(3,4,1,2,p.skin);r(12,4,1,2,p.skin);
    r(5,5,1,1,'#343d37');r(10,5,1,1,'#343d37');r(7,7,2,1,'#ba856e');r(6,9,4,1,p.skin);
    r(3,10,10,7,p.shirt);r(3,10,2,2,p.color);r(11,10,2,2,p.color);r(7,10,2,6,p.color);
    if(p.id==='instagram'){r(2,2,2,8,p.hair);r(12,2,2,9,p.hair);r(12,2,2,2,'#e5b9ca');}
    if(p.id==='reviewer'){r(4,5,4,2,'#304e55');r(9,5,3,2,'#304e55');r(5,5,2,1,'#bad4ca');r(9,5,2,1,'#bad4ca');}
    const swing=!paused&&Math.sin(tick*13)>0;
    if(work){r(1,13,3,2,p.shirt);r(12,13,3,2,p.shirt);r(1,12+(swing?0:1),2,2,p.skin);r(13,12+(swing?1:0),2,2,p.skin);}
    else{r(1,11,2,5,p.shirt);r(13,11,2,5,p.shirt);r(1,16+(p.moving&&swing?1:0),2,2,p.skin);r(13,16+(p.moving&&!swing?1:0),2,2,p.skin);}
    r(4,17,8,2,'#445968');r(4,19,3,3,'#445968');r(9,19,3,3,'#445968');
    r(3,22+(p.moving&&swing?0:1),4,1,'#35444d');r(9,22+(p.moving&&!swing?0:1),4,1,'#35444d');
    if(selected===p.id){const float=paused?0:Math.round(Math.sin(tick*3)*2);rect(p.px-6,y-16+float,12,4,p.color);rect(p.px-3,y-12+float,6,4,p.color);}
    if(work){rect(x+39,y-12,17,12,'#f4f2da');for(let a=0;a<3;a++)rect(x+42+a*4,y-6,2,2,Math.floor(tick*4)%3===a?'#5f8061':'#abb699');}
    const button=canvas.parentElement.querySelector(`[data-agent="${p.id}"]`);
    button.style.left=`${p.px/9.6}%`;button.style.top=`${(p.py-27)/5.2}%`;
  }
  function goToDesk(p){if(paused){p.px=p.x;p.py=251;p.path=[];return;}p.path=[[p.px,300],[p.x,300],[p.x,251]];}
  function updatePanel() {
    const busy=hasJob(),s=staff.find(p=>p.id===selected);
    document.querySelector('#office-state').textContent=busy?'Campaign in progress':selected?'Meeting your teammate':paused?'Office paused':'Roaming the office';
    document.querySelector('#agent-mode').textContent=busy?'● Campaign in progress':s?(animationClock<previewUntil?'Animation preview · no task started':'Ready for your brief'):'No campaign running';
    if(!s)return;
    document.querySelector('#agent-role').textContent=s.role;
    document.querySelector('#agent-name').textContent=`Say hello to ${s.name}.`;
    document.querySelector('#agent-line').textContent=s.line;
    document.querySelector('#agent-mini').textContent=s.name.slice(0,1);
    document.querySelector('#agent-mini').style.background=s.color;
    const assign=document.querySelector('#assign-agent');assign.disabled=false;assign.textContent=`Give ${s.name} a brief ↗`;
  }
  function select(id) {
    selected=id;previewUntil=animationClock+9;
    people.forEach(p=>{if(p.id===id)goToDesk(p);});
    canvas.parentElement.querySelectorAll('[data-agent]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.agent===id)));
    updatePanel();
  }
  const buttons=Array.from(canvas.parentElement.querySelectorAll('[data-agent]'));
  const listeners=buttons.map(button=>{const listener=()=>select(button.dataset.agent);button.addEventListener('click',listener);return listener;});
  const motionButton=document.querySelector('#motion-toggle');
  const motionLabel=()=>{motionButton.textContent=paused?'▶ Resume motion':'Ⅱ Pause motion';motionButton.setAttribute('aria-pressed',String(paused));};
  motionButton.onclick=()=>{paused=!paused;motionLabel();updatePanel();};motionLabel();
  const onReduced=()=>{paused=reduced.matches;motionLabel();};reduced.addEventListener('change',onReduced);
  document.querySelector('#assign-agent').onclick=()=>{const s=staff.find(p=>p.id===selected);if(s)onAssign(s);};
  let wasBusy=false,lastMode='';
  function animate(now) {
    if(disposed)return;
    const delta=Math.min((now-previous)/1000||0,.04);previous=now;
    if(!paused&&!document.hidden)animationClock+=delta;
    const tick=animationClock;
    const busy=hasJob();
    if(busy&&!wasBusy)people.forEach(goToDesk);
    wasBusy=busy;
    for(const p of people){
      const atWork=busy||selected===p.id;
      if(!paused&&!document.hidden){
        if(!p.path.length&&!atWork){p.pause-=delta;if(p.pause<=0){p.goal=(p.goal+1)%routes.length;const point=routes[(p.goal+staff.findIndex(s=>s.id===p.id)*2)%routes.length];p.path=[[p.px,300],[point[0],300],[...point]];p.pause=3+p.goal%3;}}
        while(p.path.length&&Math.hypot(p.path[0][0]-p.px,p.path[0][1]-p.py)<2){[p.px,p.py]=p.path.shift();}
        p.moving=p.path.length>0;
        if(p.moving){const [gx,gy]=p.path[0],dist=Math.hypot(gx-p.px,gy-p.py),step=Math.min(delta*49,dist);p.px+=(gx-p.px)/dist*step;p.py+=(gy-p.py)/dist*step;}
      }else p.moving=false;
    }
    room(tick,busy);[...people].sort((a,b)=>a.py-b.py).forEach(p=>person(p,tick,busy));
    const mode=busy?'busy':selected&&tick<previewUntil?'preview':selected?'ready':paused?'paused':'idle';
    if(mode!==lastMode){lastMode=mode;updatePanel();if(mode==='ready')document.querySelector('#agent-mode').textContent='Ready for your brief';}
    frame=requestAnimationFrame(animate);
  }
  frame=requestAnimationFrame(animate);
  return ()=>{disposed=true;cancelAnimationFrame(frame);buttons.forEach((b,i)=>b.removeEventListener('click',listeners[i]));reduced.removeEventListener('change',onReduced);};
}
