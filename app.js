(()=>{'use strict';
const $=id=>document.getElementById(id), pins=[...document.querySelectorAll('[data-pin]')], known=new Set(pins.map(x=>x.dataset.pin));
const example=[['S+','P+'],['S-','P-'],['RD+','R+'],['RD-','R-'],['RC','GND'],['RN','EXIT'],['S+','NC'],['COM','BN'],['BC','FN'],['FC','K+'],['K-','S-']];
let wires=[],mode='wire',first=null,red=null,black=null,glass=false,fire=false,relayUntil=0,rteUntil=0;
const fault=$('fault');
const pair=(a,b)=>[a,b].sort().join('|');
function graph(extra=[]){const g=Object.fromEntries([...known].map(k=>[k,new Set()]));const join=(a,b)=>{if(g[a]&&g[b]){g[a].add(b);g[b].add(a)}};
for(const [a,b] of wires){if(fault.value==='cable'&&pair(a,b)===pair('FC','K+'))continue;join(a,b)}
for(const [a,b] of extra)join(a,b);
return {join,connected:(a,b)=>{if(!g[a]||!g[b])return false;const seen=new Set([a]),stack=[a];while(stack.length){const n=stack.pop();if(n===b)return true;for(const t of g[n])if(!seen.has(t)){seen.add(t);stack.push(t)}}return false}}}
function state(){const now=Date.now();let x=graph();const psu=fault.value!=='psu',acu=psu&&x.connected('P+','S+')&&x.connected('P-','S-');
let extra=[];if(acu)extra.push(['R+','P+'],['R-','P-'],['GND','P-']);
if(!glass&&fault.value!=='glass')extra.push(['BC','BN']);
if(!fire&&fault.value!=='fire')extra.push(['FC','FN']);
if(now<rteUntil)extra.push(['RC','RN']);
x=graph(extra);const reader=acu&&fault.value!=='reader'&&x.connected('RD+','S+')&&x.connected('RD-','S-');
const exit=acu&&now<rteUntil&&x.connected('EXIT','GND');const relay=acu&&fault.value!=='relay'&&(now<relayUntil||exit);
extra.push(relay?['COM','NO']:['COM','NC']);x=graph(extra);
const volts=p=>{if(!psu)return null;const positive=x.connected(p,'S+'),negative=x.connected(p,'S-');return positive&&!negative?12:negative&&!positive?0:null};
const p=volts('K+'),n=volts('K-'),locked=p!==null&&n!==null&&p-n>=10;
$('acuState').textContent=acu?'ACU powered · relay '+(relay?'NO':'NC'):'ACU off';$('readerState').textContent=reader?'Reader online':'Reader off';$('glassState').textContent=glass?'Activated':'Normal';$('fireState').textContent=fire?'Activated':'Normal';$('lockState').textContent=locked?'🔒 Energised (12 V)':'🔓 Released';
const vr=red?volts(red):null,vb=black?volts(black):null;$('reading').textContent=vr===null||vb===null?'—.— V':(vr-vb).toFixed(1)+' V';$('probes').textContent=`Red: ${red||'—'} | Black: ${black||'—'}`;
return {reader,acu,locked};}
function paint(){document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));pins.forEach(b=>{const p=b.dataset.pin;b.classList.toggle('selected',p===first);b.classList.toggle('probe-red',p===red);b.classList.toggle('probe-black',p===black)});$('count').textContent=wires.length;const list=$('wireList');list.replaceChildren();wires.forEach(([a,b])=>{const btn=document.createElement('button');btn.textContent=`${a} ↔ ${b}  ✕`;btn.addEventListener('click',()=>{wires=wires.filter(w=>pair(...w)!==pair(a,b));update()});list.appendChild(btn)});state()}
function update(){try{localStorage.setItem('paxton-v2-wires',JSON.stringify(wires))}catch{}paint()}
function hint(t){$('hint').textContent=t}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;first=null;hint({wire:'Tap two terminals to connect a wire.',remove:'Tap a terminal, then another terminal, to remove their wire. Or tap a wire in the list.',red:'Tap a terminal for the RED probe.',black:'Tap a terminal for the BLACK probe.'}[mode]);paint()}));
pins.forEach(b=>b.addEventListener('click',()=>{const p=b.dataset.pin;if(mode==='red')red=p;else if(mode==='black')black=p;else if(first===null){first=p;hint(`${p} selected — tap the other terminal.`)}else{const a=first;first=null;if(a!==p){if(mode==='wire'&&!wires.some(w=>pair(...w)===pair(a,p)))wires.push([a,p]);if(mode==='remove')wires=wires.filter(w=>pair(...w)!==pair(a,p))}hint(mode==='remove'?'Select two terminals to remove a wire.':'Select two terminals to connect a wire.');update()}paint()}));
$('load').addEventListener('click',()=>{wires=example.map(w=>[...w]);update();hint('Example circuit loaded. Test PSU voltage: red S+, black S−.')});$('clear').addEventListener('click',()=>{wires=[];update()});$('clearProbes').addEventListener('click',()=>{red=black=null;paint()});
$('card').addEventListener('click',()=>{if(state().reader){relayUntil=Date.now()+3000;hint('Card accepted: relay activated for 3 seconds.')}else hint('Reader offline: load circuit or check reader power.');state()});
$('rte').addEventListener('click',()=>{rteUntil=Date.now()+1000;hint('RTE pressed for one second.');state()});
$('glass').addEventListener('click',()=>{glass=true;state()});$('glassReset').addEventListener('click',()=>{glass=false;state()});$('fire').addEventListener('click',()=>{fire=true;state()});$('fireReset').addEventListener('click',()=>{fire=false;state()});
$('reset').addEventListener('click',()=>{glass=fire=false;relayUntil=rteUntil=0;fault.value='none';state()});fault.addEventListener('change',state);
try{const saved=JSON.parse(localStorage.getItem('paxton-v2-wires'));if(Array.isArray(saved))wires=saved.filter(w=>Array.isArray(w)&&w.length===2&&known.has(w[0])&&known.has(w[1]))}catch{}
paint();setInterval(state,100);
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline unavailable',e)));
})();
