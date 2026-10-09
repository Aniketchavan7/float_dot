const data = await window.regionPicker.load();
document.querySelector('#snapshot').src = data.image;
const box = document.querySelector('#selection');
let start = null, finished = false;
const point = e => ({x:Math.max(0,Math.min(innerWidth,e.clientX)),y:Math.max(0,Math.min(innerHeight,e.clientY))});
const rect = p => ({x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),width:Math.abs(start.x-p.x),height:Math.abs(start.y-p.y)});
function finish(region) { if (finished) return; finished = true; window.regionPicker.finish({id:data.id,region}).catch(() => window.close()); }
document.addEventListener('pointerdown',e => { if (e.button !== 0) return; start = point(e); document.body.setPointerCapture(e.pointerId); box.hidden = false; });
document.addEventListener('pointermove',e => {
  if (!start) return; const r = rect(point(e));
  Object.assign(box.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});
});
document.addEventListener('pointerup',e => {
  if (!start) return; const r = rect(point(e));
  if (r.width < 10 || r.height < 10) { start=null; box.hidden=true; document.querySelector('#instructions').textContent='Select an area at least 10×10 pixels · Escape cancels'; return; }
  // Convert actual selector viewport coordinates to display DIP coordinates.
  finish({x:r.x*data.width/innerWidth,y:r.y*data.height/innerHeight,width:r.width*data.width/innerWidth,height:r.height*data.height/innerHeight});
});
document.addEventListener('keydown',e => {
  if (e.key==='Escape') finish(null);
  if (e.key==='Enter') finish({x:0,y:0,width:data.width,height:data.height});
});
