export type TextureGenerationMode='generate'|'reference'|'inpaint';
export interface TextureGenerationRequest{
  mode:TextureGenerationMode; prompt:string; width:number; height:number;
  reference?:string; mask?:string; seed?:number; steps?:number;
}
export interface TextureGenerationResult{image:string;provider:string;seed:number|undefined}
export interface TextureProvider{
  id:string; supports360:boolean;
  generate(request:TextureGenerationRequest,signal:AbortSignal):Promise<TextureGenerationResult>;
}
const IMAGE=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export function localProviderOrigin(value:string):string{
  const url=new URL(value);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Use an HTTP loopback address, such as http://127.0.0.1:7860. Remote endpoints are not enabled.');
  return url.origin;
}
function checkImage(value:string|undefined,label:string){
  if(!value||value.length>28*1024*1024||!IMAGE.test(value))throw new Error(label+' must be an embedded PNG, JPEG or WebP below 20 MB.');
  return value;
}
export function generationSize(width:number,height:number):{width:number;height:number}{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw new Error('Invalid texture dimensions.');
  const scale=Math.min(1,1024/Math.max(width,height));
  return {width:Math.max(64,Math.round(width*scale/64)*64),height:Math.max(64,Math.round(height*scale/64)*64)};
}
export function generationPayload(request:TextureGenerationRequest):Record<string,unknown>{
  const prompt=request.prompt.trim();
  if(!prompt||prompt.length>2000)throw new Error('Enter a texture prompt of 1–2000 characters.');
  const {width,height}=generationSize(request.width,request.height);
  const seed=request.seed??-1,steps=request.steps??20;
  if(!Number.isInteger(seed)||seed< -1||seed>4294967295||!Number.isInteger(steps)||steps<1||steps>40)throw new Error('Invalid generation seed or steps.');
  const payload:Record<string,unknown>={prompt:'Flat UV texture sheet, seamless material texture, no perspective, no lighting baked into artwork. '+prompt,negative_prompt:'perspective, photograph of product, cast shadow, watermark',width,height,seed,steps,batch_size:1,n_iter:1,send_images:true,save_images:false,tiling:request.mode==='generate'};
  if(request.mode!=='generate'){payload.init_images=[checkImage(request.reference,'Reference')];payload.denoising_strength=request.mode==='inpaint'?.65:.45;}
  if(request.mode==='inpaint'){payload.mask=checkImage(request.mask,'Mask');payload.inpainting_mask_invert=0;payload.inpaint_full_res=false;payload.mask_blur=4;}
  return payload;
}
async function boundedJson(response:Response,signal:AbortSignal):Promise<any>{
  if(!response.body)throw new Error('Provider returned no response body.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,raw='';
  try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>30*1024*1024)throw new Error('AI response exceeds 30 MB.');raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();return JSON.parse(raw);}
  finally{await reader.cancel().catch(()=>{});}
}
function imageData(value:unknown):string{
  if(typeof value!=='string'||value.length>28*1024*1024)throw new Error('Provider did not return a supported image.');
  const data=value.startsWith('data:')?value:'data:image/'+(value.startsWith('/9j/')?'jpeg':value.startsWith('UklGR')?'webp':'png')+';base64,'+value;
  return checkImage(data,'Provider output');
}
export class Automatic1111Provider implements TextureProvider{
  readonly id='automatic1111-local';
  readonly supports360=false;
  private origin:string;
  constructor(origin:string,private requestFetch:typeof fetch=fetch){this.origin=localProviderOrigin(origin);}
  async generate(request:TextureGenerationRequest,signal:AbortSignal):Promise<TextureGenerationResult>{
    const payload=generationPayload(request);
    const route=request.mode==='generate'?'txt2img':'img2img';
    const timeout=new AbortController();
    const abort=()=>timeout.abort(signal.reason);
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>timeout.abort(new Error('Local provider request timed out.')),300000);
    try{
      const response=await this.requestFetch(this.origin+'/sdapi/v1/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:timeout.signal,credentials:'omit',redirect:'error'});
      if(!response.ok)throw new Error('Local AI server returned HTTP '+response.status+'. Check its API and CORS configuration.');
      const data=await boundedJson(response,timeout.signal);
      let seed:number|undefined;
      try{const info=typeof data.info==='string'?JSON.parse(data.info):data.info;if(Number.isInteger(info?.seed))seed=info.seed;}catch{}
      return {image:imageData(data.images?.[0]),provider:this.id,seed};
    }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
}
