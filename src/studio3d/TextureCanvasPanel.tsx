import React, { useEffect, useRef, useState } from 'react';
import { TextureCanvasSession, type TextureDocument, type TextureLayer, type Point, type LayerBlend, layerDefaults, moveLayer, addStroke, addMaskStroke, createClonePatch, readArtwork, parseTextureDocument, downloadTextureFile } from './textureCanvasEngine';

import type { SurfaceHistory } from './surfaceWorkspace';
import type { UVGuide } from './surfaceEditing';
import type { SurfacePaintTarget } from './Viewport3D';
import { exportTexturePsd, importTexturePsd } from './texturePsd';
import { TextureAiPanel } from './TextureAiPanel';

const button='rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40';
const field='w-full rounded-lg bg-neutral-900 p-1.5 text-xs';
type Tool='move'|'brush'|'eraser'|'clone';
interface Props { session: TextureCanvasSession; initialDocument?:TextureDocument; initialHistory?:SurfaceHistory; onHistory:(history:SurfaceHistory)=>void; onDocument:(doc:TextureDocument)=>void; onRequestUVGuide:()=>UVGuide; onClose:()=>void; onReady:(ready:boolean)=>void; onError:(message:string)=>void; onPaintTarget:(target:SurfacePaintTarget|null)=>void; busy:boolean; }
export function TextureCanvasPanel({session,initialDocument,initialHistory,onHistory,onDocument,onRequestUVGuide,onClose,onReady,onError,onPaintTarget,busy}:Props) {
  const [doc,setDoc]=useState<TextureDocument>(initialDocument??session.initial);
  const [selected,setSelected]=useState(initialDocument?.layers[initialDocument.layers.length-1]?.id??'');
  const [tool,setTool]=useState<Tool>('move');
  const [maskMode,setMaskMode]=useState(false);
  const [cloneAnchor,setCloneAnchor]=useState<Point|null>(null);
  const [uvGuide,setUVGuide]=useState<UVGuide|null>(null);
  const guideCanvas=useRef<HTMLCanvasElement>(null);
  const maskPreview=useRef<HTMLCanvasElement>(null);
  const [color,setColor]=useState('#ffffff');
  const [size,setSize]=useState(24);
  const [brushOpacity,setBrushOpacity]=useState(100);
  const [zoom,setZoom]=useState(1);
  const [original,setOriginal]=useState(false);
  const [pending,setPending]=useState(false);
  const [loading,setLoading]=useState(false);
  const [compatibility,setCompatibility]=useState('');
  const [history,setHistory]=useState<SurfaceHistory>(initialHistory??{past:[],future:[]});
  const view=useRef<HTMLCanvasElement>(null);
  const alive=useRef(true);
  const gesture=useRef<{start:Point;points:Point[];layer:string;tool:Tool}|null>(null);
  const layer=doc.layers.find(l=>l.id===selected);
  const commit=(next:TextureDocument)=>{ if(next===doc)return; setHistory(h=>({past:[...h.past.slice(-19),doc],future:[]}));setDoc(next); };
  const patch=(id:string,update:Partial<TextureLayer>)=>commit({...doc,layers:doc.layers.map(l=>l.id===id?{...l,...update} as TextureLayer:l)});
  const edit=(update:Partial<TextureLayer>)=>{if(layer&&!layer.locked)patch(layer.id,update);};
  const undo=()=>{const last=history.past[history.past.length-1];if(!last)return;setHistory({past:history.past.slice(0,-1),future:[doc,...history.future]});setDoc(last);};
  const redo=()=>{const next=history.future[0];if(!next)return;setHistory({past:[...history.past,doc],future:history.future.slice(1)});setDoc(next);};
  const add=(next:TextureLayer)=>{if(doc.layers.length>=64){onError('Maximum 64 layers.');return;}commit({...doc,layers:[...doc.layers,next]});setSelected(next.id);setMaskMode(false);};
  useEffect(()=>{
    if(!layer || (!maskMode && layer.kind!=='paint') || layer.locked || !layer.visible || (tool==='move'||tool==='clone') || original || pending || loading || busy || !session.supports3DPaint) {onPaintTarget(null);return;}
    const target:SurfacePaintTarget={material:session.paintMaterial,onStroke:segments=>{
      let next=doc.layers;
      for(const segment of segments) next=(maskMode?addMaskStroke:addStroke)(next,layer.id,{points:segment.map(p=>({x:p.x*doc.width,y:p.y*doc.height})),color,size,opacity:brushOpacity/100,erase:tool==='eraser'});
      commit({...doc,layers:next});
    }};
    onPaintTarget(target);
    return()=>onPaintTarget(null);
  },[doc,layer,tool,original,pending,loading,busy,session,color,size,brushOpacity,onPaintTarget,maskMode]);
  const saveDocument=()=>downloadTextureFile(new Blob([JSON.stringify(doc)],{type:'application/json'}),'surface.texture.json');
  useEffect(()=>{onDocument(doc);},[doc,onDocument]);
  useEffect(()=>{onHistory(history);},[history,onHistory]);
  useEffect(()=>{if(maskMode&&layer&&maskPreview.current)void session.drawMaskPreview(layer,maskPreview.current).catch(e=>onError(e instanceof Error?e.message:String(e)));},[maskMode,layer,session,onError]);
  useEffect(()=>{const c=guideCanvas.current,ctx=c?.getContext('2d');if(!c||!ctx||!uvGuide)return;ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='rgba(75,215,255,.85)';ctx.lineWidth=Math.max(1,c.width/1000);ctx.beginPath();for(const [x,y,x2,y2] of uvGuide.segments){ctx.moveTo(x*c.width,y*c.height);ctx.lineTo(x2*c.width,y2*c.height);}ctx.stroke();},[uvGuide,doc.width,doc.height]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    let canceled=false;setPending(true);onReady(false);
    session.render(doc).then(rendered=>{
      if(!canceled&&rendered){const c=view.current;const ctx=c?.getContext('2d');if(c&&ctx){ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(session.output,0,0);}setPending(false);onReady(!original&&!loading);}
    }).catch(e=>{if(!canceled){setPending(false);onReady(false);onError(e instanceof Error?e.message:String(e));}});
    return()=>{canceled=true;};
  },[doc,session,original,loading,onReady,onError]);
  useEffect(()=>{session.showOriginal(original);},[session,original]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(busy||loading)return;
      if(e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select')||e.target.isContentEditable))return;
      const cmd=e.metaKey||e.ctrlKey,k=e.key.toLowerCase();
      if(cmd&&k==='z'){e.preventDefault();e.stopImmediatePropagation();e.shiftKey?redo():undo();}
      else if(cmd&&k==='s'){e.preventDefault();e.stopImmediatePropagation();saveDocument();}
      else if(!cmd&&['v','b','e','s'].includes(k)){setTool(k==='v'?'move':k==='b'?'brush':k==='e'?'eraser':'clone');if(k==='s')setMaskMode(false);}
    };
    window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
  },[doc,history,busy,loading]);
  const importArtwork=async(file?:File)=>{
    if(!file||loading||busy)return;setLoading(true);
    try{const a=await readArtwork(file);if(!alive.current)return;const scale=Math.min(1,doc.width/a.width,doc.height/a.height);const w=a.width*scale,h=a.height*scale;
      add({...layerDefaults(file.name),kind:'image',image:a.url,x:(doc.width-w)/2,y:(doc.height-h)/2,width:w,height:h,rotation:0,flipX:false,flipY:false});setTool('move');
    }catch(e){if(alive.current)onError(e instanceof Error?e.message:String(e));}finally{if(alive.current)setLoading(false);}
  };
  const openDocument=async(file?:File)=>{
    if(!file||loading||busy)return;setLoading(true);
    try{if(file.size>100*1024*1024)throw new Error('Texture document exceeds 100 MB.');const next=parseTextureDocument(await file.text());
      if(next.width!==doc.width||next.height!==doc.height||next.base!==session.initial.base)throw new Error('Document does not match the original selected texture. Open the original model and material.');
      if(alive.current){commit(next);setSelected(next.layers[next.layers.length-1]?.id??'');}
    }catch(e){if(alive.current)onError(e instanceof Error?e.message:String(e));}finally{if(alive.current)setLoading(false);}
  };
  const cleanMask=async()=>{
    if(!layer||loading||pending||busy)return;
    setLoading(true);setCompatibility('');
    try{
      await new Promise(resolve=>window.setTimeout(resolve,20));
      const patch=await session.cleanMaskedRegion(doc,layer.id);
      if(alive.current){add({...layerDefaults('Local surface cleanup'),kind:'image',...patch,rotation:0,flipX:false,flipY:false});setTool('move');setCompatibility('Local cleanup patch added. It samples surrounding colors, not an AI model; refine textured areas with Clone Stamp.');}
    }catch(e){if(alive.current)onError(e instanceof Error?e.message:String(e));}finally{if(alive.current)setLoading(false);}
  };
  const exportPsd=async()=>{
    if(loading||pending||busy)return;setLoading(true);setCompatibility('');
    try{const blob=await exportTexturePsd(session,doc);if(alive.current){downloadTextureFile(blob,'surface.psd');setCompatibility('Exported layered PSD. Save the native layer document too to retain brush history and original artwork transforms.');}}
    catch(e){if(alive.current)onError(e instanceof Error?e.message:String(e));}finally{if(alive.current)setLoading(false);}
  };
  const openPsd=async(file?:File)=>{
    if(!file||loading||busy)return;setLoading(true);setCompatibility('');
    try{const result=await importTexturePsd(file,session.initial);if(alive.current&&window.confirm(result.report+' Replace the current canvas layer stack? Undo is available.')){commit(result.document);setSelected(result.document.layers[result.document.layers.length-1]?.id??'');setMaskMode(false);setCompatibility(result.report);}}
    catch(e){if(alive.current)onError(e instanceof Error?e.message:String(e));}finally{if(alive.current)setLoading(false);}
  };
  const point=(e:React.PointerEvent<HTMLCanvasElement>):Point=>{const r=e.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(doc.width,(e.clientX-r.left)*doc.width/r.width)),y:Math.max(0,Math.min(doc.height,(e.clientY-r.top)*doc.height/r.height))};};
  const start=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    if(original||pending||loading||busy||e.button!==0)return;
    if(tool==='clone'){
      if(e.altKey){setCloneAnchor(point(e));return;}
      if(!cloneAnchor){onError('Option/Alt-click the texture to set a clone source first.');return;}
      e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);gesture.current={start:p,points:[p],layer:'',tool};return;
    }
    if(!layer||layer.locked||!layer.visible)return;
    if(tool==='move'&&layer.kind!=='image'||tool!=='move'&&!maskMode&&layer.kind!=='paint')return;
    e.currentTarget.setPointerCapture(e.pointerId);const p=point(e);gesture.current={start:p,points:[p],layer:layer.id,tool};
  };
  const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    const g=gesture.current;if(!g)return;const p=point(e);if(g.points.length<10000)g.points.push(p);
    if(g.tool==='brush'&&!maskMode){const c=e.currentTarget.getContext('2d');if(c){c.save();c.strokeStyle=color;c.lineWidth=size;c.lineCap='round';c.globalAlpha=brushOpacity/100;c.beginPath();const prev=g.points[g.points.length-2]??p;c.moveTo(prev.x,prev.y);c.lineTo(p.x,p.y);c.stroke();c.restore();}}
  };
  const end=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    const g=gesture.current;gesture.current=null;if(!g)return;
    if(g.tool==='clone'&&cloneAnchor){try{const image=createClonePatch(session.output,g.points,cloneAnchor,size);add({...layerDefaults('Clone cleanup'),kind:'image',image,x:0,y:0,width:doc.width,height:doc.height,rotation:0,flipX:false,flipY:false,opacity:brushOpacity/100});}catch(e){onError(e instanceof Error?e.message:String(e));}return;}
    if(!layer||layer.id!==g.layer)return;
    const p=point(e);
    if(g.tool==='move'&&layer.kind==='image')edit({x:layer.x+p.x-g.start.x,y:layer.y+p.y-g.start.y});
    else if(maskMode||layer.kind==='paint')commit({...doc,layers:(maskMode?addMaskStroke:addStroke)(doc.layers,layer.id,{points:g.points,color,size,opacity:brushOpacity/100,erase:g.tool==='eraser'})});
  };
  const numeric=(label:string,value:number,update:(v:number)=>void,min?:number,max?:number)=><label className="block text-[10px] text-neutral-400">{label}<input className={field} type="number" value={Math.round(value*100)/100} min={min} max={max} disabled={layer?.locked||loading} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))update(Math.max(min??-100000,Math.min(max??100000,n)));}}/></label>;
  return <div className={"flex h-full min-h-0 flex-col bg-[#101012] text-neutral-100 "+(busy?"pointer-events-none opacity-60":"")}>
    <header className="flex flex-wrap items-center gap-1.5 border-b border-white/10 p-2 text-xs">
      <strong className="mr-auto">2D Texture Canvas · {doc.width} × {doc.height}</strong>
      <button className={button} onClick={undo} disabled={!history.past.length||loading}>Undo</button><button className={button} onClick={redo} disabled={!history.future.length||loading}>Redo</button>
      <button className={button} onClick={()=>setOriginal(v=>!v)}>{original?'Show edited 3D':'Show original 3D'}</button>
      <button className={button} onClick={saveDocument} disabled={loading}>Save layers</button>
      <label className={button+' cursor-pointer'}>Open layers<input type="file" className="hidden" accept=".json" disabled={loading} onChange={e=>{void openDocument(e.currentTarget.files?.[0]);e.currentTarget.value='';}}/></label>
      <button className={button} disabled={pending||loading||busy} onClick={()=>void exportPsd()}>Export PSD</button>
      <label className={button+' cursor-pointer'}>Import PSD<input type="file" className="hidden" accept=".psd" disabled={loading||busy} onChange={e=>{void openPsd(e.currentTarget.files?.[0]);e.currentTarget.value='';}}/></label>
      <button className={button} disabled={pending||loading} onClick={()=>session.output.toBlob(b=>{if(b)downloadTextureFile(b,'texture.png');},'image/png')}>PNG</button>
      <button className={button} onClick={onClose}>Close / restore</button>
    </header>
    {compatibility&&<div role="status" className="border-b border-white/10 px-2 py-1 text-[10px] text-sky-300">{compatibility}</div>}
    <div className="flex min-h-0 flex-1">
      <div className="flex w-12 shrink-0 flex-col gap-1 border-r border-white/10 p-1">
        {(['move','brush','eraser','clone'] as const).map(t=><button key={t} title={t} aria-pressed={tool===t} className={button+(tool===t?' border-sky-500 text-sky-300':'')} onClick={()=>{setTool(t);if(t==='clone')setMaskMode(false);}}>{t==='move'?'V':t==='brush'?'B':t==='eraser'?'E':'S'}</button>)}
        <input title="Brush color" type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-full"/>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2 text-[10px]">
          <label>Brush {size}px <input type="range" min="1" max="200" value={size} onChange={e=>setSize(Number(e.target.value))}/></label>
          <label>Flow {brushOpacity}% <input type="range" min="1" max="100" value={brushOpacity} onChange={e=>setBrushOpacity(Number(e.target.value))}/></label>
          <label>Zoom <select value={zoom} onChange={e=>setZoom(Number(e.target.value))} className="bg-neutral-900"><option value={.5}>50%</option><option value={1}>Fit</option><option value={2}>200%</option><option value={4}>400%</option></select></label>
          <button className={button} onClick={()=>setUVGuide(g=>g?null:onRequestUVGuide())}>{uvGuide?'Hide UV':'Show UV'}</button>{uvGuide&&<button className={button} onClick={()=>guideCanvas.current?.toBlob(b=>{if(b)downloadTextureFile(b,'uv-guide.png');},'image/png')}>UV PNG</button>}
          {uvGuide?.truncated&&<span>Partial guide · edge limit reached</span>}{tool==='clone'&&<span>{cloneAnchor?'Clone source set':'Option-click source'}</span>}{pending&&<span>Compositing…</span>}
        </div>
        <div className="flex-1 min-h-0 overflow-auto bg-[#18181b] p-3" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void importArtwork(e.dataTransfer.files[0]);}}>
          <div style={{position:"relative",width:zoom===1?"100%":(zoom*100)+"%"}}><canvas ref={view} width={doc.width} height={doc.height} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{gesture.current=null;view.current?.getContext('2d')?.drawImage(session.output,0,0);}} style={{width:'100%',display:'block',height:'auto',touchAction:'none',backgroundColor:'#666',backgroundImage:'repeating-conic-gradient(#888 0% 25%, #666 0% 50%)',backgroundSize:'20px 20px',cursor:tool==='move'?'move':'crosshair'}}/>{maskMode&&layer&&<canvas ref={maskPreview} width={doc.width} height={doc.height} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>}{uvGuide&&<canvas ref={guideCanvas} width={doc.width} height={doc.height} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>}</div>
          <p className="mt-2 text-[10px] text-neutral-400">Select artwork to drag, or a paint layer to draw on either canvas or 3D surface (UV0/UV1). Mask editing works on any unlocked layer. Clone stamp (S) copies a sampled texture area to a new cleanup layer. Switch to Move to orbit. Shared UVs share edits. Drop an image to add artwork.</p>
        </div>
      </div>
      <aside className="w-48 shrink-0 overflow-auto border-l border-white/10 p-2 space-y-2">
        <h3 className="font-semibold text-xs">Layers</h3>
        <div className="flex flex-wrap gap-1">
          <button className={button} disabled={loading} onClick={()=>add({...layerDefaults('Gray Out'),kind:'gray',color:'#b0b0b0'})}>Gray Out</button>
          <button className={button} disabled={loading} onClick={()=>{add({...layerDefaults('Paint'),kind:'paint',strokes:[]});setTool('brush');}}>Paint</button>
          <button className={button} disabled={loading||doc.layers.length>=64} onClick={()=>{add({...layerDefaults('Cleanup selection'),kind:'paint',strokes:[]});setMaskMode(true);setTool('eraser');setCompatibility('Paint over unwanted graphics with E in mask mode, then click Clean masked area. Use a small selection.');}}>Cleanup mask</button>
          <label className={button+' cursor-pointer'}>Artwork<input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" disabled={loading} onChange={e=>{void importArtwork(e.currentTarget.files?.[0]);e.currentTarget.value='';}}/></label>
        </div>
        {[...doc.layers].reverse().map(l=><div key={l.id} className={'flex items-center gap-1 rounded border p-1 text-xs '+(l.id===selected?'border-sky-500/60 bg-sky-500/10':'border-white/10')}>
          <button title="Toggle visibility" disabled={loading} onClick={()=>patch(l.id,{visible:!l.visible})}>{l.visible?'●':'○'}</button><button className="min-w-0 flex-1 truncate text-left" onClick={()=>{setSelected(l.id);setMaskMode(false);}}>{l.name}</button><button title="Lock layer" disabled={loading} onClick={()=>patch(l.id,{locked:!l.locked})}>{l.locked?'🔒':'🔓'}</button>
        </div>)}
        <div className="rounded border border-white/10 p-2 text-[10px] text-neutral-400">🔒 Original base color</div>
        {layer&&<div className="space-y-2 border-t border-white/10 pt-2">
          <input aria-label="Layer name" className={field} value={layer.name} disabled={layer.locked||loading} onChange={e=>edit({name:e.target.value})}/>
          <div className="flex flex-wrap gap-1">
            <button className={button} disabled={layer.locked||loading} onClick={()=>commit({...doc,layers:moveLayer(doc.layers,layer.id,1)})}>↑</button><button className={button} disabled={layer.locked||loading} onClick={()=>commit({...doc,layers:moveLayer(doc.layers,layer.id,-1)})}>↓</button>
            <button className={button} disabled={loading} onClick={()=>add({...layer,id:crypto.randomUUID(),name:layer.name+' copy',locked:false})}>Copy</button>
            <button className={button} disabled={layer.locked||loading} onClick={()=>{commit({...doc,layers:doc.layers.filter(l=>l.id!==layer.id)});setSelected('');}}>Delete</button>
          </div>
          <label className="block text-[10px]">Opacity {Math.round(layer.opacity*100)}%<input className="w-full" type="range" min="0" max="100" disabled={layer.locked||loading} value={layer.opacity*100} onChange={e=>edit({opacity:Number(e.target.value)/100})}/></label>
          <label className="block text-[10px]">Blend mode<select className={field} disabled={layer.locked||loading} value={layer.blend??'normal'} onChange={e=>edit({blend:e.target.value as LayerBlend})}><option value="normal">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option></select></label>
          <div className="rounded border border-white/10 p-1.5 space-y-1 text-[10px]">
            <strong>Layer mask</strong>
            <button className={button+" w-full "+(maskMode?'border-sky-500 text-sky-300':'')} disabled={layer.locked||loading} onClick={()=>{setMaskMode(v=>!v);setTool(maskMode?'move':'eraser');}}>{maskMode?'Exit mask editing':'Edit mask'}</button>
            {maskMode&&<p className="text-neutral-400">E hides · B reveals on 2D or 3D.</p>}
            {(layer.mask?.length||layer.maskImage)&&<button className={button+' w-full'} disabled={loading||pending} onClick={()=>void cleanMask()}>Clean masked area (local)</button>}
            {(!!layer.mask?.length||!!layer.maskImage)&&<div className="flex gap-1"><button className={button} disabled={layer.locked||loading} onClick={()=>edit({maskEnabled:layer.maskEnabled===false})}>{layer.maskEnabled===false?'Enable':'Disable'}</button><button className={button} disabled={layer.locked||loading} onClick={()=>{if(window.confirm('Clear the layer mask?'))edit({mask:[],maskImage:undefined,maskEnabled:true});}}>Clear</button></div>}
          </div>
          {layer.kind==='gray'&&<input type="color" aria-label="Gray color" disabled={layer.locked||loading} value={layer.color} onChange={e=>edit({color:e.target.value})}/>}
          {layer.kind==='image'&&<><div className="grid grid-cols-2 gap-1">{numeric('X',layer.x,v=>edit({x:v}))}{numeric('Y',layer.y,v=>edit({y:v}))}{numeric('Width',layer.width,v=>edit({width:v}),1,16384)}{numeric('Height',layer.height,v=>edit({height:v}),1,16384)}{numeric('Rotation',layer.rotation,v=>edit({rotation:v}),-360,360)}</div><div className="flex gap-1"><button className={button} disabled={layer.locked||loading} onClick={()=>edit({flipX:!layer.flipX})}>Flip X</button><button className={button} disabled={layer.locked||loading} onClick={()=>edit({flipY:!layer.flipY})}>Flip Y</button></div></>}
        </div>}
        <TextureAiPanel session={session} doc={doc} selectedLayer={layer} disabled={busy||pending||loading||original} onAdd={add} onError={onError}/>
        <p className="text-[10px] text-neutral-500">Save layers separately before closing. PSD contains editable raster layers. PNG and GLB exports are flattened. Original alpha is preserved; shared UVs/materials share edits.</p>
      </aside>
    </div>
  </div>;
}
