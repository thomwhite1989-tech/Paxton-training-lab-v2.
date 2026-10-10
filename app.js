(()=>{'use strict';
const $=id=>document.getElementById(id), buttons=[...document.querySelectorAll('[data-pin]')], byPin=Object.fromEntries(buttons.map(b=>[b.dataset.pin,b]));
const example=[['psu+','acuP+'],['psu-','acuP-'],['reader+','acuR+'],['reader-','acuR-'],['readerD0','acuD0'],['readerD1','acuD1'],['rteC','exitG'],['rteN','exit'],['psu+','relayNC'],['relayC','glassN'],['glassC','fireN'],['fireC','lock+'],['lock-','psu-']];
let selectedWire=null,fitScale=1,wires=[],mode='wire',first=null,red=null,black=null,fire=false,glass=false,rte=false,cardUntil=0,relay=false,version=0;
const valid=new Set(Object.keys(byPin));
const wireKey=(a,b)=>[a,b].sort().join('~');
function join(g,a,b){g[a].add(b);g[b].add(a)}
function reachable(g,start){const seen=new Set([start]),todo=[start];while(todo.length){const a=todo.pop();for(const b of g[a]||[]){if(!seen.has(b)){seen.add(b);todo.push(b)}}}return seen}
function graph(relayState){const g=Object.fromEntries([...valid].map(p=>[p,new Set()]));for(const [a,b] of wires)join(g,a,b);
const fault=$('fault').value;
if(!glass&&fault!=='glass')join(g,'glassC','glassN');else if(glass)join(g,'glassC','glassO');
if(!fire&&fault!=='fire')join(g,'fireC','fireN');else if(fire)join(g,'fireC','fireO');
join(g,'rteC',rte?'rteN':'rteX');join(g,'relayC',relayState?'relayNO':'relayNC');
const p=reachable(g,'psu+'),n=reachable(g,'psu-');const supply=fault!=='psu';const acu=supply&&p.has('acuP+')&&n.has('acuP-')&&!p.has('psu-');
if(acu){join(g,'acuP+','acuR+');join(g,'acuP-','acuR-');join(g,'acuP-','exitG');join(g,'acuP-','contactG')}
return {g,acu,supply};}
function state(){let s=graph(relay);const fault=$('fault').value;
const plus=reachable(s.g,'psu+'),minus=reachable(s.g,'psu-');
const reader=s.acu&&fault!=='reader'&&plus.has('reader+')&&minus.has('reader-')&&reachable(s.g,'readerD0').has('acuD0')&&reachable(s.g,'readerD1').has('acuD1');
const exit=s.acu&&rte&&reachable(s.g,'exit').has('exitG');
const active=Date.now()<cardUntil;
const nextRelay=s.acu&&fault!=='relay'&&(active||exit);
if(nextRelay!==relay){relay=nextRelay;s=graph(relay)}
const p=reachable(s.g,'psu+'),n=reachable(s.g,'psu-');const short=p.has('psu-');
function voltage(pin){if(!pin||!s.supply||short)return null;const positive=p.has(pin),negative=n.has(pin);if(positive&&negative)return null;if(positive)return 12;if(negative)return 0;return null}
const lockP=voltage('lock+'),lockN=voltage('lock-');const lock=lockP!==null&&lockN!==null&&lockP-lockN>=10&&fault!=='cable';
$('acuState').textContent=s.acu?'ACU powered':'ACU unpowered';$('readerState').textContent=reader?'Reader online':'Reader offline';$('led').classList.toggle('on',s.acu);$('relayState').textContent='Relay COM ↔ '+(relay?'NO':'NC');$('rteState').textContent=rte?'COM ↔ NO':'COM ↔ NC';$('fireState').textContent=fire?'ACTIVE':'NORMAL';$('glassState').textContent=glass?'ACTIVE':'NORMAL';$('lockArt').textContent=lock?'🔒':'🔓';$('lockState').textContent=lock?'Energised · 12.0 V':'Released · 0.0 V';$('timer').textContent='Card timer '+(Math.max(0,cardUntil-Date.now())/1000).toFixed(1)+'s';
const r=voltage(red),b=voltage(black);$('reading').textContent=r===null||b===null?'—.— V':(r-b).toFixed(1)+' V';$('probeState').textContent='RED '+(red||'—')+' | BLACK '+(black||'—');$('status').textContent=navigator.onLine?'Ready':'Offline';
if(short)$('message').textContent='SHORT CIRCUIT — simulated supply disabled';else if(!s.acu)$('message').textContent='Check PSU and ACU power terminals';else if(!reader)$('message').textContent='ACU powered — check reader power and data wiring';else $('message').textContent=active?'Valid card — relay operated':'Reader ready — present card or press RTE';
return {reader,acu:s.acu};}
function save(){try{localStorage.setItem('paxton-v21-wires',JSON.stringify(wires))}catch{}}
function render(){if(selectedWire&&!wires.some(w=>wireKey(...w)===selectedWire))selectedWire=null;save();$('count').textContent=wires.length+' wires';const list=$('wireList');list.replaceChildren();for(const [a,b] of wires){const btn=document.createElement('button');btn.textContent=a+' ↔ '+b;btn.classList.toggle('trace-selected',selectedWire===wireKey(a,b));btn.addEventListener('click',()=>{if(mode==='remove')remove(a,b);else{selectedWire=selectedWire===wireKey(a,b)?null:wireKey(a,b);render()}});list.append(btn)}draw();state()}
function add(a,b){if(a!==b&&valid.has(a)&&valid.has(b)&&!wires.some(w=>wireKey(...w)===wireKey(a,b))){wires.push([a,b]);render()}}
function remove(a,b){wires=wires.filter(w=>wireKey(...w)!==wireKey(a,b));render()}
function draw(){const svg=$('wires'),bench=$('bench'),rect=bench.getBoundingClientRect(),scale=fitScale;svg.setAttribute('viewBox',`0 0 ${bench.offsetWidth} ${bench.offsetHeight}`);svg.replaceChildren();svg.classList.toggle('interactive',mode==='trace'||mode==='remove');buttons.forEach(b=>b.classList.remove('trace-end'));for(const [a,b] of wires){const A=byPin[a].getBoundingClientRect(),B=byPin[b].getBoundingClientRect();const x1=(A.left+A.width/2-rect.left)/scale,y1=(A.top+A.height/2-rect.top)/scale,x2=(B.left+B.width/2-rect.left)/scale,y2=(B.top+B.height/2-rect.top)/scale;const selected=wireKey(a,b)===selectedWire;if(selected){byPin[a].classList.add('trace-end');byPin[b].classList.add('trace-end')}
const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`);path.setAttribute('fill','none');path.setAttribute('stroke',a.includes('+')||b.includes('+')?'#f34b4b':a.includes('-')||b.includes('-')?'#e7e7e7':'#52a9ef');path.setAttribute('stroke-width',selected?'8':'4');path.setAttribute('stroke-linecap','round');path.setAttribute('opacity',selectedWire&&!selected?'0.19':'1');path.style.pointerEvents=mode==='remove'||mode==='trace'?'stroke':'none';path.addEventListener('click',()=>{if(mode==='remove')remove(a,b);else if(mode==='trace'){selectedWire=selectedWire===wireKey(a,b)?null:wireKey(a,b);render()}});svg.append(path)} }
function fit(scaleOverride){const view=$('viewport'),bench=$('bench');bench.style.zoom='1';const baseW=bench.offsetWidth,baseH=bench.offsetHeight;const scale=scaleOverride||Math.min((view.clientWidth-8)/baseW,(view.clientHeight-8)/baseH);fitScale=Math.max(.28,Math.min(1.6,scale));bench.style.zoom=String(fitScale);requestAnimationFrame(draw)}
function setMode(m){mode=m;first=null;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===m));buttons.forEach(b=>b.classList.remove('marked'));$('hint').textContent={wire:'Tap two terminals to connect a cable.',remove:'Tap a cable to remove it. Tap a terminal to remove its first cable.',trace:'Tap a cable to highlight both ends. Tap again to clear.',red:'RED probe selected. Tap a terminal.',black:'BLACK probe selected. Tap a terminal.'}[m];draw()}
buttons.forEach(btn=>btn.addEventListener('click',()=>{const p=btn.dataset.pin;if(mode==='red'){red=p;state()}else if(mode==='black'){black=p;state()}else if(mode==='wire'){if(!first){first=p;btn.classList.add('marked');$('hint').textContent='Selected '+p+' — tap the destination terminal.'}else{const prev=first;first=null;buttons.forEach(b=>b.classList.remove('marked'));add(prev,p);$('hint').textContent='Tap two terminals to connect a cable.'}}else if(mode==='remove'){const w=wires.find(w=>w.includes(p));if(w)remove(...w)}else if(mode==='trace'){const w=wires.find(w=>w.includes(p));if(w){selectedWire=wireKey(...w);render()}}}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('example').addEventListener('click',()=>{wires=example.map(w=>[...w]);render()});$('clear').addEventListener('click',()=>{wires=[];render()});$('reset').addEventListener('click',()=>{fire=false;glass=false;rte=false;cardUntil=0;relay=false;$('fault').value='none';state()});
$('card').addEventListener('click',()=>{const s=state();if(s.reader){cardUntil=Date.now()+3000;state()}else $('message').textContent='Reader offline — load/check circuit first'});
const rteButton=$('rte');rteButton.addEventListener('pointerdown',e=>{rte=true;try{rteButton.setPointerCapture(e.pointerId)}catch{}state()});for(const ev of ['pointerup','pointercancel','lostpointercapture'])rteButton.addEventListener(ev,()=>{rte=false;state()});rteButton.addEventListener('click',()=>{rte=true;state();setTimeout(()=>{rte=false;state()},400)});
$('glass').addEventListener('click',()=>{glass=true;state()});$('glassReset').addEventListener('click',()=>{glass=false;state()});$('fire').addEventListener('click',()=>{fire=true;state()});$('fireReset').addEventListener('click',()=>{fire=false;state()});$('fault').addEventListener('change',state);
try{const old=JSON.parse(localStorage.getItem('paxton-v21-wires'));if(Array.isArray(old))wires=old.filter(w=>Array.isArray(w)&&w.length===2&&valid.has(w[0])&&valid.has(w[1]))}catch{}
$('fit').addEventListener('click',()=>fit());$('zoomIn').addEventListener('click',()=>fit(fitScale*1.2));$('zoomOut').addEventListener('click',()=>fit(fitScale/1.2));window.addEventListener('resize',()=>fit());window.addEventListener('orientationchange',()=>setTimeout(()=>fit(),250));setInterval(state,100);render();setTimeout(()=>fit(),100);
})();
