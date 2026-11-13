import React,{useEffect,useRef,useState} from 'react';
import { Automatic1111Provider,generationSize,type TextureGenerationMode,type TextureGenerationResult } from './textureAiProvider';
import { type TextureCanvasSession,type TextureDocument,type TextureLayer,readArtwork,layerDefaults } from './textureCanvasEngine';
const button='rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40';
interface Props{session:TextureCanvasSession;doc:TextureDocument;selectedLayer?:TextureLayer;disabled:boolean;onAdd:(layer:TextureLayer)=>void;onError:(message:string)=>void}
export function TextureAiPanel({session,doc,selectedLayer,disabled,onAdd,onError}:Props){
  const [open,setOpen]=useState(false);
  const [origin,setOrigin]=useState('http://127.0.0.1:7860');
  const [mode,setMode]=useState<TextureGenerationMode>('generate');
  const [prompt,setPrompt]=useState('');
  const [reference,setReference]=useState<string>();
  const [running,setRunning]=useState(false);
  const [preview,setPreview]=useState<{result:TextureGenerationResult;source:TextureDocument;mask?:string}|null>(null);
  const [status,setStatus]=useState('');
  const controller=useRef<AbortController|null>(null);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
  const generate=async()=>{
    if(running||disabled||!prompt.trim())return;
    if(mode==='inpaint'&&(!selectedLayer||(!selectedLayer.mask?.length&&!selectedLayer.maskImage))){onError('Select a layer with a cleanup mask first.');return;}
    const request=new AbortController();controller.current=request;setRunning(true);setStatus('Preparing local AI request…');setPreview(null);
    try{
      const provider=new Automatic1111Provider(origin);
      const size=generationSize(doc.width,doc.height);
      let inputs:{reference?:string;mask?:string;layerMask?:string}={};
      if(mode!=='generate')inputs=await session.generationInputs(mode==='inpaint'?selectedLayer:undefined,size.width,size.height);
      if(mode==='reference'&&reference)inputs.reference=reference;
      request.signal.throwIfAborted();
      setStatus('Waiting for your local diffusion server…');
      const result=await provider.generate({mode,prompt,...size,reference:inputs.reference,mask:inputs.mask},request.signal);
      const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('AI output is not a valid image.'));img.src=result.image;});
      if(image.width>4096||image.height>4096)throw new Error('AI output exceeds the texture image limit.');
      if(alive.current&&!request.signal.aborted){setPreview({result,source:doc,mask:inputs.layerMask});setStatus('Preview ready. Accept to add a new editable layer.');}
    }catch(e){if(alive.current){setStatus(request.signal.aborted?'Request canceled locally. Server may still be processing.':'');if(!request.signal.aborted)onError(e instanceof Error?e.message:String(e));}}
    finally{if(controller.current===request)controller.current=null;if(alive.current)setRunning(false);}
  };
  const accept=()=>{
    if(!preview||preview.source!==doc||disabled||doc.layers.length>=64)return;
    onAdd({...layerDefaults('AI texture · '+(preview.result.seed??'generated')),kind:'image',image:preview.result.image,x:0,y:0,width:doc.width,height:doc.height,rotation:0,flipX:false,flipY:false,...(preview.mask?{maskImage:preview.mask,maskEnabled:true}:{})});
    setPreview(null);setStatus('Added editable AI texture layer. Original and physical material maps are unchanged.');
  };
  return <div className="rounded border border-white/10 p-2 space-y-2 text-[10px]">
    <button className={button+' w-full'} onClick={()=>setOpen(v=>!v)}>{open?'Hide AI texture':'AI Texture Studio'}</button>
    {open&&<>
      <p className="text-neutral-400">Optional local AUTOMATIC1111 server. No model is downloaded automatically. Single UV sheet generation only; this is not a 360° multiview engine.</p>
      <label className="block">Local API address<input className="w-full bg-neutral-900 p-1" value={origin} disabled={running} onChange={e=>setOrigin(e.target.value)}/></label>
      <label className="block">Mode<select className="w-full bg-neutral-900 p-1" value={mode} disabled={running} onChange={e=>setMode(e.target.value as TextureGenerationMode)}><option value="generate">Generate texture</option><option value="reference">Match reference / current texture</option><option value="inpaint">Reconstruct selected mask</option></select></label>
      {mode==='reference'&&<label className={button+' block cursor-pointer'}>{reference?'Replace reference':'Optional reference image'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={running} onChange={e=>{const file=e.target.files?.[0];if(file)void readArtwork(file).then(a=>{if(alive.current)setReference(a.url);}).catch(e=>onError(String(e)));e.currentTarget.value='';}}/></label>}
      <textarea className="w-full rounded bg-neutral-900 p-1" rows={4} maxLength={2000} value={prompt} disabled={running} placeholder="Describe the new surface or material…" onChange={e=>setPrompt(e.target.value)}/>
      <p className="text-neutral-500">Generate sends the prompt and any selected reference or texture/mask to your configured loopback server only.</p>
      <div className="flex gap-1"><button className={button} disabled={running||disabled||!prompt.trim()} onClick={()=>void generate()}>Generate</button>{running&&<button className={button} onClick={()=>controller.current?.abort()}>Cancel request</button>}</div>
      {status&&<p role="status" className="text-sky-300">{status}</p>}
      {preview&&<><img src={preview.result.image} alt="Generated texture preview" className="w-full rounded"/>{preview.source!==doc&&<p className="text-amber-300">Document changed. Regenerate before applying.</p>}<div className="flex gap-1"><button className={button} disabled={disabled||preview.source!==doc||doc.layers.length>=64} onClick={accept}>Accept layer</button><button className={button} onClick={()=>{setPreview(null);setStatus('Preview discarded.');}}>Discard</button></div></>}
    </>}
  </div>;
}
