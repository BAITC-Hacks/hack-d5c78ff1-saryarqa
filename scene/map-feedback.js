/** Illustrative policy miniatures. Never computes scores or intermediate outcomes. */
import { policyArt, effectArt } from '../game/art.js';
const NS = 'http://www.w3.org/2000/svg';
const NAMES = { M1:'Автобусы', M2:'Светофоры', M3:'ЛРТ', M4:'Парк', M5:'Чистое топливо', M6:'Озеленение', M7:'Школа', M8:'Поликлиника', M9:'Спорт', M10:'Освещение', M11:'Переходы', M12:'Обращения', M13:'Тепло и вода', M14:'Аварийные службы' };
const DISTRICTS = {esil:'Есиль',almaty:'Алматы',saryarka:'Сарыарка',baikonur:'Байконур',nura:'Нура',saraishyk:'Сарайшық'};
const C = { cream:'#faf6e9', stone:'#d9d7bf', shade:'#b9b9a4', edge:'#638070', green:'#548768', leaf:'#83ac76', cyan:'#71b6ba', dark:'#315f62', gold:'#d4ad60', road:'#a4aca0' };
const node = (tag, attributes = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [key,value] of Object.entries(attributes)) n.setAttribute(key,String(value));
  if (text !== undefined) n.textContent = text;
  return n;
};
const add = (g, tag, attrs, text) => g.appendChild(node(tag,attrs,text));
const path = (g,d,fill,attrs={}) => add(g,'path',{d,fill,...attrs});
const rect = (g,x,y,width,height,fill,rx=0,attrs={}) => add(g,'rect',{x,y,width,height,fill,rx,...attrs});
const circle = (g,cx,cy,r,fill,attrs={}) => add(g,'circle',{cx,cy,r,fill,...attrs});
const line = (g,x1,y1,x2,y2,stroke=C.edge,w=1.5,attrs={}) => add(g,'line',{x1,y1,x2,y2,stroke,'stroke-width':w,'stroke-linecap':'round',...attrs});
const clamp = n => Math.min(1,Math.max(0,Number.isFinite(n)?n:0));

function tree(g,x,y,s=1) {
  const t = add(g,'g',{transform:`translate(${x} ${y}) scale(${s})`,class:'map-feedback-tree'});
  line(t,0,1,0,-13,'#967e58',2);
  circle(t,0,-16,7,C.green); circle(t,-4,-13,5,C.leaf); circle(t,4,-16,4,'#a1bb80');
}
function building(g,x,y,w,h,accent=C.cyan) {
  rect(g,x,y-h,w,h,C.cream,1);
  path(g,`M${x+w},${y-h}l6,-4v${h}l-6,4Z`,C.shade);
  path(g,`M${x},${y-h}l6,-4h${w}l-6,4Z`,accent);
  for(let col=0;col<3;col++) rect(g,x+3+col*(w-5)/3,y-h+5,3,5,C.cyan,0.5);
  rect(g,x+w/2-2,y-8,4,8,C.dark,0.5);
}
function lamp(g,x,y) {
  path(g,`M${x-12},${y}l12,-26 12,26Z`,'#f4d678',{class:'map-feedback-light',opacity:.35});
  line(g,x,y,x,y-28,C.dark,2); line(g,x,y-28,x+7,y-28,C.dark,2);
  rect(g,x+3,y-29,7,3,C.gold,1);
}
function bus(g,x,y,train=false) {
  const moving = add(g,'g',{class:'map-feedback-vehicle'});
  rect(moving,x,y-12,train?38:27,12,train?C.cream:C.dark,3);
  rect(moving,x+3,y-10,train?30:19,5,C.cyan,1);
  for(const dx of [5,train?31:21]) circle(moving,x+dx,y+1,2.7,'#526558');
  return moving;
}

function miniature(id) {
  const g = node('g',{class:'map-feedback-object'});
  add(g,'ellipse',{cx:0,cy:3,rx:31,ry:10,fill:'#3257461b'});
  switch(id) {
    case 'M1':
      path(g,'M-35,3 27,-10 37,-2 -25,12Z',C.road);
      line(g,-28,7,31,-5,C.cream,1,{'stroke-dasharray':'5 4'}); bus(g,-18,0);
      line(g,24,-8,24,-28); rect(g,20,-29,9,8,C.cyan,1); break;
    case 'M2':
      path(g,'M-30,-5h60v12h-60Z',C.road);
      for(const x of [-17,18]) {
        line(g,x,5,x,-25,C.dark,2); rect(g,x-4,-29,8,17,C.dark,2);
        circle(g,x,-25,2,'#d58f70'); circle(g,x,-19,2,'#a3cf8e',{class:'map-feedback-signal'});
      }
      path(g,'M-2,-15q7,-8 14,0m-11,-4q4,-4 8,0','none',{stroke:C.cyan,'stroke-width':1.5}); break;
    case 'M3':
      line(g,-32,7,33,-6,C.shade,8); line(g,-32,5,33,-8,C.dark,1);
      line(g,-24,8,-24,-4,C.shade,3); line(g,24,-1,24,-11,C.shade,3);
      bus(g,-22,-5,true); line(g,-6,-19,-2,-25,C.dark); line(g,-2,-25,7,-23,C.dark); break;
    case 'M4':
      add(g,'ellipse',{cx:0,cy:0,rx:30,ry:12,fill:'#b4c999'});
      path(g,'M-23,7q20,-17 45,-10','none',{stroke:C.cream,'stroke-width':4});
      tree(g,-16,-1); tree(g,5,-9,1.1); tree(g,22,2,.85);
      rect(g,-7,2,12,3,C.gold,1); line(g,-5,5,-5,8); line(g,3,5,3,8); break;
    case 'M5':
      building(g,-19,3,25,20,C.gold); rect(g,-13,-28,5,10,C.stone,1);
      path(g,'M18,0C6,-9 24,-12 21,-26C36,-10 32,0 18,0Z',C.cyan);
      path(g,'M20,-3q-4,-7 3,-13q5,9 -3,13Z',C.cream); break;
    case 'M6':
      path(g,'M-31,4 23,-8 32,0 -22,12Z','#b6cba4');
      for(const [x,y] of [[-23,2],[-11,-1],[1,-4],[13,-7],[25,-10]]) tree(g,x,y,.8);
      break;
    case 'M7':
      building(g,-26,3,43,24,C.gold); rect(g,-17,-11,7,6,C.cyan,1); rect(g,4,-11,7,6,C.cyan,1);
      line(g,-2,-26,-2,-39,C.edge); path(g,'M-2,-39h12l-3,4 3,4H-2Z',C.gold);
      path(g,'M-30,7q10,-7 20,0','none',{stroke:'#cb9475','stroke-width':2}); break;
    case 'M8':
      building(g,-22,3,36,26,C.cyan);
      rect(g,-8,-21,10,3,'#d3917c',.5); rect(g,-4.5,-24.5,3,10,'#d3917c',.5);
      tree(g,25,0,.7); break;
    case 'M9':
      path(g,'M-29,0 16,-11 32,2 -14,14Z','#87b0a1',{stroke:C.cream,'stroke-width':1});
      path(g,'M-24,1 15,-8 26,2 -13,11Z','none',{stroke:C.cream,'stroke-width':1});
      add(g,'ellipse',{cx:0,cy:2,rx:7,ry:3,fill:'none',stroke:C.cream});
      line(g,24,-1,24,-20,C.dark); rect(g,19,-23,10,7,C.cream,1);
      add(g,'ellipse',{cx:22,cy:-14,rx:4,ry:1.5,fill:'none',stroke:C.gold}); break;
    case 'M10':
      path(g,'M-32,4 26,-8 35,1 -23,13Z',C.road); lamp(g,-18,4); lamp(g,20,-3);
      rect(g,-14,-24,8,4,C.cream,1); circle(g,-8,-22,1.5,C.dark); break;
    case 'M11':
      path(g,'M-32,-5h64v16h-64Z',C.road);
      for(let x=-16;x<17;x+=7) rect(g,x,-4,4,14,C.cream,0.5);
      lamp(g,-26,0); line(g,26,1,26,-24); rect(g,21,-25,10,10,C.cyan,1);
      path(g,'M23,-17l3,-5 3,5Z',C.cream); break;
    case 'M12':
      building(g,-23,5,30,21,C.cyan);
      rect(g,15,-28,15,27,C.dark,3); rect(g,17,-25,11,19,C.cream,1);
      path(g,'M19,-16l3,3 5,-6','none',{stroke:C.green,'stroke-width':2});
      path(g,'M-4,-27q8,-9 16,0m-13,-4q5,-5 10,0','none',{stroke:C.cyan,'stroke-width':1.5,class:'map-feedback-wind'}); break;
    case 'M13':
      building(g,-23,-1,20,21,C.stone);
      path(g,'M-31,6H0V-7H29','none',{stroke:C.dark,'stroke-width':6,'stroke-linejoin':'round'});
      path(g,'M-31,6H0V-7H29','none',{stroke:C.cyan,'stroke-width':3,'stroke-dasharray':'5 4',class:'map-feedback-flow'});
      circle(g,0,6,4,C.gold); line(g,-3,6,3,6,C.cream); break;
    case 'M14':
      rect(g,-22,-14,27,17,C.cream,2); path(g,'M5,-10h11l7,8v5H5Z',C.gold);
      rect(g,8,-8,7,6,C.cyan,1); circle(g,-15,5,4,C.dark); circle(g,15,5,4,C.dark);
      rect(g,-6,-17,7,3,C.cyan,1,{class:'map-feedback-signal'});
      line(g,-17,-8,-8,-1,C.dark,2); circle(g,-17,-8,3,C.dark); circle(g,-8,-1,3,C.dark); break;
  }
  return g;
}

/** Parent owns the animation clock; this module starts no timers/listeners. */
export function createMapFeedback({layer,regions=[],anchors=new Map()}) {
  const root = add(layer,'g',{class:'map-feedback', 'pointer-events':'none', 'aria-hidden':'true'});
  const records = new Map();
  const validRegions = new Map(regions.map(r=>[r.regionId,r]));
  const failedArt = new Set();
  let destroyed=false, mode='baseline', rendered=0;
  const anchorFor = id => (anchors instanceof Map?anchors.get(id):anchors[id]) || validRegions.get(id)?.labelAnchor;
  function makeRegion(id) {
    const leader=add(root,'path',{class:'map-feedback-leader',fill:'none',stroke:C.edge,'stroke-width':1,'stroke-dasharray':'3 4',opacity:.6});
    const group = add(root,'g',{'data-feedback-region':id});
    const ambient = add(group,'g',{class:'map-feedback-ambient'});
    const haze = add(ambient,'g',{class:'map-feedback-haze'});
    for(const [cx,cy,rx,ry] of [[-25,-18,33,10],[12,-29,32,9],[29,-13,29,8]]) add(haze,'ellipse',{cx,cy,rx,ry,fill:'#aab3a5'});
    const wind = add(ambient,'g',{class:'map-feedback-wind',fill:'none',stroke:C.cyan,'stroke-width':1.7,'stroke-linecap':'round'});
    path(wind,'M-52,-33h32q12,0 12,-6t-9,-2M-38,-24h75q11,0 11,6t-9,2M3,-42h25q8,0 8,-5','none');
    const grove = add(ambient,'g',{}); tree(grove,-49,8,.75); tree(grove,48,-5,.85);
    const lighting=add(ambient,'g',{}); lamp(lighting,-43,9); lamp(lighting,43,1);
    const tradeoff=add(group,'g',{class:'map-feedback-tradeoff'});
    const tradeoffArt=effectArt('negative-tradeoff');
    if(tradeoffArt) add(tradeoff,'image',{href:tradeoffArt.href,x:44,y:14,width:18,height:18});
    const caption = add(group,'text',{class:'map-feedback-caption',x:0,y:39,'text-anchor':'middle'});
    const objects = new Map();
    const record={group,leader,ambient,haze,wind,grove,lighting,tradeoff,caption,objects}; records.set(id,record); return record;
  }
  function render({camera,width=1000,height=700,seconds=0,reducedMotion=false,visualState}={}) {
    if(destroyed || !camera?.project) return;
    mode = ['preview','result'].includes(visualState?.mode)?visualState.mode:'baseline';
    root.setAttribute('data-mode',mode); root.setAttribute('data-reduced-motion',String(reducedMotion));
    const shown = new Set(), occupied=[]; rendered=0;
    for(const region of mode==='baseline'?[]:visualState?.regions || []) {
      if(!validRegions.has(region.regionId)) continue;
      const anchor=anchorFor(region.regionId); if(!anchor) continue;
      const measures=(region.measures||[]).filter(m=>Object.hasOwn(NAMES,m.id)).slice(0,5);
      if(!measures.length) continue;
      shown.add(region.regionId);
      const r=records.get(region.regionId)||makeRegion(region.regionId);
      const [x,y]=camera.project(anchor), compact=width<520, scale=compact?.67:.82;
      const cols=measures.length>2?3:measures.length, rows=Math.ceil(measures.length/cols);
      const halfWidth=Math.max(165,cols*78)*scale/2, top=(48+(rows-1)*65)*scale, bottom=44*scale;
      const visible=x>=-40&&x<=width+40&&y>=-40&&y<=height+40;
      // A short leader preserves the true geographic target when nearby district
      // illustrations need space. Atmospheric changes stay at the source anchor.
      let best=null;
      for(const dy of [0,-75,75,-140,140,-205,205]) for(const dx of [0,-85,85,-165,165]) {
        const px=Math.max(halfWidth+8,Math.min(width-halfWidth-8,x+dx));
        const py=Math.max(88+top,Math.min(height-80-bottom,y-24+dy));
        const box={left:px-halfWidth,right:px+halfWidth,top:py-top,bottom:py+bottom};
        const overlap=occupied.reduce((total,b)=>total+Math.max(0,Math.min(box.right,b.right)-Math.max(box.left,b.left))*Math.max(0,Math.min(box.bottom,b.bottom)-Math.max(box.top,b.top)),0);
        const cost=overlap*100+Math.hypot(px-x,py-(y-24));
        if(!best||cost<best.cost) best={px,py,box,cost};
      }
      if(visible) occupied.push(best.box);
      r.group.setAttribute('transform',`translate(${best.px} ${best.py}) scale(${scale})`);
      r.group.setAttribute('display',visible?'':'none');
      r.leader.setAttribute('display',visible?'':'none');
      r.leader.setAttribute('d',`M${x},${y}L${best.px},${best.py+bottom-9}`);
      r.ambient.setAttribute('transform',`translate(${(x-best.px)/scale} ${(y-24-best.py)/scale})`);
      r.caption.textContent=`${DISTRICTS[region.regionId]||region.regionId} · ${mode==='preview'?'Предпросмотр':'Сценарий'}`;
      const ids=new Set(measures.map(m=>m.id));
      for(const [id,item] of r.objects) if(!ids.has(id)){item.group.remove();r.objects.delete(id);}
      measures.forEach((measure,index)=>{
        let item=r.objects.get(measure.id);
        if(!item){
          const group=add(r.group,'g',{class:'map-feedback-measure','data-measure':measure.id});
          const title=add(group,'title',{});
          const base=add(group,'ellipse',{cx:0,cy:2,rx:31,ry:9,fill:'none',stroke:C.gold,'stroke-width':1.2,'stroke-dasharray':'3 3',class:'map-feedback-foundation'});
          const drawing=add(group,'g',{class:'map-feedback-object'});
          const art=policyArt(measure.id,'object');
          if(art && !failedArt.has(art.href)) {
            const s=70/Math.max(art.width,art.height);
            const image=add(drawing,'image',{href:art.href,x:-art.anchor[0]*s,y:-art.anchor[1]*s,width:art.width*s,height:art.height*s,preserveAspectRatio:'xMidYMid meet','data-policy-art':measure.id});
            image.onerror=()=>{if(destroyed||records.get(region.regionId)!==r||r.objects.get(measure.id)?.drawing!==drawing)return;failedArt.add(art.href);image.onerror=null;image.remove();drawing.appendChild(miniature(measure.id));};
          } else drawing.appendChild(miniature(measure.id));
          const label=add(group,'text',{class:'map-feedback-label',x:0,y:22,'text-anchor':'middle'},NAMES[measure.id]);
          item={group,drawing,base,title,label};r.objects.set(measure.id,item);
        }
        const cols=measures.length>2?3:measures.length;
        const row=Math.floor(index/cols), col=index%cols, rowCount=Math.min(cols,measures.length-row*cols);
        item.group.setAttribute('transform',`translate(${(col-(rowCount-1)/2)*78} ${row*-65})`);
        const progress=mode==='preview'?1:clamp(measure.progress ?? (measure.phase==='active'?1:0));
        const build=mode==='preview'?1:.3+progress*.7;
        item.drawing.setAttribute('transform',`scale(1 ${build})`);
        item.drawing.setAttribute('opacity',mode==='preview'?.8:.4+progress*.6);
        item.base.setAttribute('opacity',mode==='preview'||progress<1?'1':'0');
        item.group.setAttribute('data-phase',measure.phase||'queued');
        item.title.textContent=`${NAMES[measure.id]} · ${mode==='preview'?'Предпросмотр':'Сценарий'} · иллюстрация`;
        rendered++;
      });
      const air=measures.some(m=>['M3','M4','M5','M6','M13'].includes(m.id));
      const green=measures.some(m=>['M4','M6'].includes(m.id));
      const progress=mode==='preview'?.65:Math.max(...measures.map(m=>clamp(m.progress ?? (m.phase==='active'?1:0))));
      const airDelta=region.effects?.E2;
      const illustrative=mode==='preview';
      const improvesAir=air && (illustrative||(Number.isFinite(airDelta)&&airDelta>0));
      r.haze.setAttribute('opacity',improvesAir?String((1-progress)*.5):'0');
      r.wind.setAttribute('opacity',improvesAir?String(.2+progress*.65):'0');
      r.grove.setAttribute('opacity',green&&(illustrative||region.effects?.E1>0)?String(mode==='preview'?.8:.3+progress*.7):'0');
      r.grove.setAttribute('transform',`scale(1 ${.65+progress*.35})`);
      const safety=measures.some(m=>['M10','M11'].includes(m.id));
      r.lighting.setAttribute('opacity',safety&&(illustrative||region.effects?.B1>0||region.effects?.B2>0)?String(.25+progress*.75):'0');
      r.tradeoff.setAttribute('display',Object.values(region.effects||{}).some(delta=>Number.isFinite(delta)&&delta<0)?'':'none');
      // The supplied clock is intentionally the only time source; pause remains stable.
      r.wind.setAttribute('transform',`translate(${reducedMotion?0:Math.sin(seconds*.9)*3} 0)`);
    }
    for(const [id,r] of records) if(!shown.has(id)){r.group.remove();r.leader.remove();records.delete(id);}
  }
  return {render,destroy(){if(destroyed)return;destroyed=true;root.remove();records.clear();},getDiagnostics(){return {mode,regions:records.size,measures:rendered,destroyed,missingAssetIds:[...failedArt]};}};
}
