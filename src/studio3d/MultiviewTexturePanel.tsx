import React,{useEffect,useRef,useState} from 'react';
import type * as THREE from 'three';
import { captureProjection,projectViews,VIEW_NAMES,type ViewName,type ProjectionCapture,type ProjectionResult } from './multiviewProjection';
import { Automatic1111Provider } from './textureAiProvider';
import { layerDefaults,readArtwork,downloadTextureFile,type TextureCanvasSession,type TextureDocument,type TextureLayer } from './textureCanvasEngine';
const button='rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40';
interface Props{root:THREE.Object3D;session:TextureCanvasSession;doc:TextureDocument;disabled:boolean;onAdd:(layer:TextureLayer)=>void;onError:(message:string)=>void;}
export function MultiviewTexturePanel({root,session,doc,disabled,onAdd,onError}:Props){
  const [open,setOpen]=useState(false);
  const [capture,setCapture]=useState<{data:ProjectionCapture;doc:TextureDocument}|null>(null);
  const [images,setImages]=useState<Partial<Record<ViewName,string>>>({});
  const [selected,setSelected]=useState<ViewName>('Front');
  const [running,setRunning]=useState(false);
  const [status,setStatus]=useState('');
  const [preview,setPreview]=useState<{result:ProjectionResult;doc:TextureDocument}|null>(null);
  const [origin,setOrigin]=useState('http://127.0.0.1:7860');
  const [prompt,setPrompt]=useState('');
  const abortRef=useRef<AbortController|null>(null);
  const alive=useRef(true);
  const latest=useRef(doc);latest.current=doc;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;abortRef.current?.abort();};},[]);
  const stale=!!capture&&capture.doc!==doc;
  const execute=async(work:(signal:AbortSignal)=>Promise<void>)=>{
    if(running||disabled)return;
    const controller=new AbortController();abortRef.current=controller;setRunning(true);setStatus('');
    try{await work(controller.signal);}
    catch(e){if(alive.current){setStatus(controller.signal.aborted?'Canceled.':'');if(!controller.signal.aborted)onError(e instanceof Error?e.message:String(e));}}
    finally{if(abortRef.current===controller)abortRef.current=null;if(alive.current)setRunning(false);}
  };
  const captureNow=()=>execute(async signal=>{
    setStatus('Capturing six aligned orthographic guides…');setPreview(null);setCapture(null);setImages({});
    const data=await captureProjection(root,session.paintMaterial,session.output,signal);
    if(alive.current&&!signal.aborted){setCapture({data,doc});setStatus('Guides ready. Upload aligned square views or generate reference variations.');}
  });
  const frame=capture?.data.frames.find(f=>f.name===selected);
  const addImage=async(file?:File)=>{
    if(!file||running||disabled||stale)return;
    await execute(async signal=>{
      const image=await readArtwork(file);signal.throwIfAborted();
      if(image.width!==image.height)throw new Error('Keep the exact square framing of the view guide.');
      if(alive.current){setImages(previous=>({...previous,[selected]:image.url}));setPreview(null);}
    });
  };
  const generate=()=>execute(async signal=>{
    if(!frame||stale||!prompt.trim())return;
    setStatus('Requesting aligned '+selected+' variation from local server…');setPreview(null);
    const provider=new Automatic1111Provider(origin);
    const result=await provider.generate({mode:'reference',prompt,width:capture!.data.size,height:capture!.data.size,reference:frame.guide,viewDirection:selected},signal);
    if(alive.current&&!signal.aborted){setImages(previous=>({...previous,[selected]:result.image}));setStatus('View generated. Check silhouette and alignment before projection.');}
  });
  const project=()=>execute(async signal=>{
    if(!capture||stale)return;
    setStatus('Projecting visible surfaces and padding UV seams…');setPreview(null);
    const result=await projectViews(capture.data,images,signal);
    if(alive.current&&!signal.aborted){setPreview({result,doc});setStatus('Projection ready for review. Uncovered and conflicting UV pixels keep the original texture.');}
  });
  const accept=()=>{
    if(!preview||preview.doc!==latest.current||disabled||running||doc.layers.length>=64)return;
    onAdd({...layerDefaults('360° view projection'),kind:'image',image:preview.result.image,x:0,y:0,width:doc.width,height:doc.height,rotation:0,flipX:false,flipY:false});
    setPreview(null);setCapture(null);setImages({});setStatus('Projection added as an editable artwork layer.');
  };
  const downloadGuide=async()=>{
    if(!frame)return;
    const blob=await (await fetch(frame.guide)).blob();downloadTextureFile(blob,selected.toLowerCase()+'-guide.png');
  };
  return <div className="rounded border border-white/10 p-2 space-y-2 text-[10px]">
    <button className={button+' w-full'} onClick={()=>setOpen(v=>!v)}>{open?'Hide 360° projection':'360° Texture Projection'}</button>
    {open&&<>
      <p className="text-neutral-400">Six orthographic views → one editable UV layer. Static meshes only. Repeated UVs, transparent geometry and mismatched view silhouettes can reduce quality.</p>
      <button className={button+' w-full'} disabled={running||disabled} onClick={()=>void captureNow()}>{capture?'Recapture model views':'Capture six model views'}</button>
      {running&&<button className={button} onClick={()=>abortRef.current?.abort()}>Cancel</button>}
      {stale&&<p className="text-amber-300">Texture changed. Recapture before projecting.</p>}
      {capture&&<>
        <div className="grid grid-cols-2 gap-1">{VIEW_NAMES.map(name=><button key={name} disabled={running} className={button+(selected===name?' border-sky-400 text-sky-300':'')} onClick={()=>setSelected(name)}>{images[name]?'● ':''}{name}</button>)}</div>
        {frame&&<div className="grid grid-cols-2 gap-1">
          <div><span>Guide</span><img className="w-full rounded bg-neutral-800" src={frame.guide} alt={selected+' guide'}/></div>
          <div><span>Replacement</span>{images[selected]?<img className="w-full rounded bg-neutral-800" src={images[selected]} alt={selected+' replacement'}/>:<div className="aspect-square rounded bg-neutral-800"/>}</div>
        </div>}
        <div className="flex flex-wrap gap-1">
          <button className={button} disabled={running} onClick={()=>void downloadGuide()}>Guide PNG</button>
          <label className={button+' cursor-pointer'}>Upload view<input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" disabled={running||disabled||stale} onChange={e=>{void addImage(e.target.files?.[0]);e.target.value='';}}/></label>
          <button className={button} disabled={running||!images[selected]} onClick={()=>{setImages(prev=>{const next={...prev};delete next[selected];return next;});setPreview(null);}}>Remove</button>
        </div>
        <details><summary className="cursor-pointer text-sky-300">Optional AI view variation</summary>
          <label className="block">Local API<input className="w-full bg-neutral-900 p-1" value={origin} disabled={running} onChange={e=>setOrigin(e.target.value)}/></label>
          <textarea className="w-full bg-neutral-900 p-1" rows={3} maxLength={2000} placeholder="Same model, new surface material…" value={prompt} disabled={running} onChange={e=>setPrompt(e.target.value)}/>
          <button className={button+' w-full'} disabled={running||disabled||stale||!prompt.trim()} onClick={()=>void generate()}>Generate {selected} view</button>
          <p className="text-neutral-500">Sends the selected guide and prompt to your localhost diffusion API. Individual views are not jointly generated; review alignment and seams.</p>
        </details>
        <button className={button+' w-full border-sky-500/40'} disabled={running||disabled||stale||!Object.keys(images).length} onClick={()=>void project()}>Project {Object.keys(images).length} / 6 views</button>
      </>}
      {status&&<p role="status" className="text-sky-300">{status}</p>}
      {preview&&<>
        <img src={preview.result.image} className="w-full rounded bg-neutral-800" alt="Projected UV texture preview"/>
        <p>{Math.round(preview.result.coverage*100)}% UV coverage · {preview.result.ambiguous} conflicting texels skipped</p>
        <div className="flex gap-1"><button className={button} disabled={running||disabled||preview.doc!==doc||doc.layers.length>=64} onClick={accept}>Accept layer</button><button className={button} onClick={()=>setPreview(null)}>Discard</button></div>
      </>}
    </>}
  </div>;
}
