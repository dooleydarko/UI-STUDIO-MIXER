import * as THREE from 'three';

export type Point = { x: number; y: number };
export type Stroke = { points: Point[]; color: string; size: number; opacity: number; erase: boolean };
export type LayerBlend = 'normal' | 'multiply' | 'screen' | 'overlay';
type Common = { id: string; name: string; visible: boolean; locked: boolean; opacity: number; blend?: LayerBlend; mask?: Stroke[]; maskImage?: string; maskEnabled?: boolean };
export type TextureLayer = Common & (
  | { kind: 'gray'; color: string }
  | { kind: 'image'; image: string; x: number; y: number; width: number; height: number; rotation: number; flipX: boolean; flipY: boolean }
  | { kind: 'paint'; strokes: Stroke[] }
);
export interface TextureDocument {
  version: 1; material: string; width: number; height: number;
  base: string; layers: TextureLayer[];
}
export function layerDefaults(name: string): Common {
  return { id: crypto.randomUUID(), name, visible: true, locked: false, opacity: 1, blend: 'normal' };
}
export function moveLayer(layers: TextureLayer[], id: string, delta: number): TextureLayer[] {
  const i = layers.findIndex(l => l.id === id), j = i + delta;
  if (i < 0 || j < 0 || j >= layers.length) return layers;
  const next = [...layers]; [next[i], next[j]] = [next[j], next[i]]; return next;
}
export function addStroke(layers: TextureLayer[], id: string, stroke: Stroke): TextureLayer[] {
  return layers.map(l => l.id === id && l.kind === 'paint' && !l.locked ? { ...l, strokes: [...l.strokes, stroke] } : l);
}
export function addMaskStroke(layers: TextureLayer[], id: string, stroke: Stroke): TextureLayer[] {
  return layers.map(l => l.id===id && !l.locked ? {...l,mask:[...(l.mask??[]),stroke],maskEnabled:true} : l);
}
export function blendPixels(dest: Uint8ClampedArray, src: Uint8ClampedArray, mode: Exclude<LayerBlend,'normal'>, opacity:number): void {
  for (let i=0;i<dest.length;i+=4) {
    if (!dest[i+3] || !src[i+3]) continue;
    const a=src[i+3]/255*opacity;
    for (let c=0;c<3;c++) {
      const b=dest[i+c]/255, t=src[i+c]/255;
      const blended=mode==='multiply'?b*t:mode==='screen'?1-(1-b)*(1-t):b<=.5?2*b*t:1-2*(1-b)*(1-t);
      dest[i+c]=Math.round((b+(blended-b)*a)*255);
    }
  }
}
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, mask=false): void {
  if(!stroke.points.length)return;
  ctx.save();ctx.globalAlpha=stroke.opacity;ctx.globalCompositeOperation=stroke.erase?'destination-out':'source-over';
  ctx.strokeStyle=mask?'#ffffff':stroke.color;ctx.fillStyle=mask?'#ffffff':stroke.color;ctx.lineWidth=stroke.size;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();
  if(stroke.points.length===1){ctx.arc(stroke.points[0].x,stroke.points[0].y,stroke.size/2,0,Math.PI*2);ctx.fill();}
  else{ctx.moveTo(stroke.points[0].x,stroke.points[0].y);for(const p of stroke.points.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();}
  ctx.restore();
}
function drawLayer(ctx:CanvasRenderingContext2D,layer:TextureLayer,w:number,h:number,images:Map<string,HTMLImageElement>):void {
  ctx.clearRect(0,0,w,h);ctx.save();
  if(layer.kind==='gray'){ctx.fillStyle=layer.color;ctx.fillRect(0,0,w,h);}
  else if(layer.kind==='image'){
    const image=images.get(layer.image);
    if(image){ctx.translate(layer.x+layer.width/2,layer.y+layer.height/2);ctx.rotate(layer.rotation*Math.PI/180);ctx.scale(layer.flipX?-1:1,layer.flipY?-1:1);ctx.drawImage(image,-layer.width/2,-layer.height/2,layer.width,layer.height);}
  }else for(const stroke of layer.strokes)drawStroke(ctx,stroke);
  ctx.restore();
}
function drawMask(ctx:CanvasRenderingContext2D,layer:TextureLayer,w:number,h:number,images:Map<string,HTMLImageElement>):void {
  ctx.clearRect(0,0,w,h);
  const image=layer.maskImage?images.get(layer.maskImage):undefined;
  if(image)ctx.drawImage(image,0,0,w,h);else{ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);}
  for(const stroke of layer.mask??[])drawStroke(ctx,stroke,true);
}
function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = width; c.height = height; return c;
}
function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d'); if (!ctx) throw new Error('2D canvas unavailable.'); return ctx;
}
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Unable to decode image.')); image.src = url; });
}
export async function readArtwork(file: File): Promise<{ url: string; width: number; height: number }> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20*1024*1024) throw new Error('Choose PNG, JPEG or WebP up to 20 MB.');
  const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to read artwork.')); reader.readAsDataURL(file); });
  const img = await loadImage(url);
  if (Math.max(img.width,img.height) > 4096) throw new Error('Artwork exceeds 4096 pixels per side.');
  return { url, width: img.width, height: img.height };
}
/** Clone from a fixed composite into a new transparent raster layer. */
export function createClonePatch(source:HTMLCanvasElement,points:Point[],anchor:Point,diameter:number):string{
  if(!points.length)throw new Error('Draw a clone stroke first.');
  const patch=canvas(source.width,source.height),ctx=context(patch),r=Math.max(1,diameter/2);
  const dx=anchor.x-points[0].x,dy=anchor.y-points[0].y;
  let count=0;
  const stamp=(p:Point)=>{
    if(count++>=1500)return;
    ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.clip();
    ctx.drawImage(source,p.x+dx-r,p.y+dy-r,r*2,r*2,p.x-r,p.y-r,r*2,r*2);ctx.restore();
  };
  stamp(points[0]);
  for(let i=1;i<points.length&&count<1500;i++){
    const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/Math.max(1,r*.5)));
    for(let j=1;j<=steps&&count<1500;j++)stamp({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps});
  }
  const url=patch.toDataURL('image/png');patch.width=patch.height=1;return url;
}
export function downloadTextureFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function parseTextureDocument(raw: string): TextureDocument {
  const d = JSON.parse(raw);
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  const image = (v: unknown) => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(v);
  const opacity = (v: unknown) => finite(v) && Number(v) >= 0 && Number(v) <= 1;
  if (d?.version !== 1 || typeof d.material !== 'string' || !Number.isInteger(d.width) || !Number.isInteger(d.height) || d.width < 1 || d.height < 1 || Math.max(d.width,d.height)>4096 || !image(d.base) || !Array.isArray(d.layers) || d.layers.length>64) throw new Error('Unsupported texture document.');
  const validStrokes=(strokes: unknown): boolean => Array.isArray(strokes) && strokes.length<=5000 && !strokes.some((s: Stroke) => !s || !color(s.color) || !finite(s.size) || s.size<=0 || s.size>4096 || !opacity(s.opacity) || typeof s.erase!=='boolean' || !Array.isArray(s.points) || s.points.length>10000 || s.points.some(p=>!p || !finite(p.x)||!finite(p.y)));
  const ids = new Set<string>();
  for (const l of d.layers) {
    if (!l || typeof l.id !== 'string' || ids.has(l.id) || typeof l.name !== 'string' || typeof l.visible !== 'boolean' || typeof l.locked !== 'boolean' || !opacity(l.opacity)) throw new Error('Invalid layer.');
    if(l.blend!==undefined && !['normal','multiply','screen','overlay'].includes(l.blend))throw new Error('Invalid layer blend mode.');
    if(l.maskImage!==undefined&&!image(l.maskImage))throw new Error('Invalid raster mask.');
    if(l.mask!==undefined && !validStrokes(l.mask) || l.maskEnabled!==undefined && typeof l.maskEnabled!=='boolean')throw new Error('Invalid layer mask.');
    ids.add(l.id);
    if (l.kind === 'gray') { if (!color(l.color)) throw new Error('Invalid gray adjustment.'); }
    else if (l.kind === 'image') {
      if (!image(l.image) || ![l.x,l.y,l.width,l.height,l.rotation].every(finite) || l.width<=0 || l.height<=0 || l.width>16384 || l.height>16384 || typeof l.flipX!=='boolean' || typeof l.flipY!=='boolean') throw new Error('Invalid artwork layer.');
    } else if (l.kind === 'paint') {
      if (!validStrokes(l.strokes)) throw new Error('Invalid paint layer.');
    } else throw new Error('Unsupported layer type.');
  }
  return d as TextureDocument;
}
export class TextureCanvasSession {
  readonly output: HTMLCanvasElement;
  readonly initial: TextureDocument;
  private base: HTMLCanvasElement;
  private scratch: HTMLCanvasElement;
  private maskCanvas: HTMLCanvasElement | null = null;
  private originalMap: THREE.Texture | null;
  private originalColor: THREE.Color;
  private texture: THREE.Texture;
  private images = new Map<string, HTMLImageElement>();
  private disposed = false;
  private renderId = 0;
  constructor(private material: THREE.MeshStandardMaterial, name: string) {
    this.originalMap = material.map; this.originalColor = material.color.clone();
    const map = this.originalMap, image = map?.image;
    const width = map ? image?.naturalWidth || image?.width : 1024;
    const height = map ? image?.naturalHeight || image?.height : 1024;
    if (!width || !height || Math.max(width,height)>4096 || map instanceof THREE.DataTexture || map instanceof THREE.CompressedTexture) throw new Error('Unsupported texture or dimensions above 4096px.');
    this.base = canvas(width,height); this.scratch = canvas(width,height); this.output = canvas(width,height);
    const ctx = context(this.base);
    if (map) {
      ctx.drawImage(image,0,0,width,height);
      // Bake the material tint in linear RGB, retaining the original alpha.
      const pixels = ctx.getImageData(0,0,width,height);
      const channels = [material.color.r, material.color.g, material.color.b];
      const srgb = map.colorSpace === THREE.SRGBColorSpace;
      const tables=channels.map(channel=>Array.from({length:256},(_,i)=>{
        const s=i/255, linear=srgb?(s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)):s;
        const value=linear*channel;return Math.round(255*(value<=.0031308?12.92*value:1.055*Math.pow(value,1/2.4)-.055));
      }));
      for(let i=0;i<pixels.data.length;i+=4)for(let k=0;k<3;k++)pixels.data[i+k]=tables[k][pixels.data[i+k]];
      ctx.putImageData(pixels,0,0);
    } else { ctx.fillStyle='#'+material.color.getHexString(); ctx.fillRect(0,0,width,height); }
    this.initial = { version:1, material:name, width,height,base:this.base.toDataURL('image/png'),layers:[] };
    this.texture = map ? map.clone() : new THREE.CanvasTexture(this.output);
    this.texture.source = new THREE.Source(this.output); this.texture.colorSpace=THREE.SRGBColorSpace;
    if (!map) this.texture.flipY=false;
    context(this.output).drawImage(this.base,0,0);
    this.texture.needsUpdate=true; material.map=this.texture; material.color.set(0xffffff); material.needsUpdate=true;
  }
  async restoreSavedBase(doc:TextureDocument):Promise<void>{
    if(doc.width!==this.initial.width||doc.height!==this.initial.height||doc.material!==this.initial.material)throw new Error('Saved texture document binding does not match the original material.');
    if(doc.base===this.initial.base)return;
    const image=await loadImage(doc.base);
    if(this.disposed||image.width!==doc.width||image.height!==doc.height)throw new Error('Saved texture base dimensions do not match.');
    const ctx=context(this.base);ctx.clearRect(0,0,doc.width,doc.height);ctx.drawImage(image,0,0);
    this.initial.base=doc.base;
  }
  get paintMaterial(): THREE.MeshStandardMaterial { return this.material; }
  get supports3DPaint(): boolean { return this.texture.channel <= 1; }
  async render(doc: TextureDocument): Promise<boolean> {
    if (this.disposed) return false;
    const id=++this.renderId;
    const needed=new Set(doc.layers.flatMap(l=>[...(l.kind==='image'?[l.image]:[]),...(l.maskImage?[l.maskImage]:[])]));
    for (const url of this.images.keys()) if (!needed.has(url)) this.images.delete(url);
    const decoded=await Promise.all([...needed].filter(url=>!this.images.has(url)).map(async url=>[url,await loadImage(url)] as const));
    if (this.disposed || id!==this.renderId) return false;
    decoded.forEach(([url,image])=>this.images.set(url,image));
    const {width:w,height:h}=doc, ctx=context(this.output), scratch=context(this.scratch);
    ctx.clearRect(0,0,w,h); ctx.drawImage(this.base,0,0);
    for (const layer of doc.layers) {
      if (!layer.visible || layer.opacity===0) continue;
      drawLayer(scratch,layer,w,h,this.images);
      if(layer.maskEnabled!==false && (layer.mask?.length||layer.maskImage)){
        this.maskCanvas??=canvas(w,h);drawMask(context(this.maskCanvas),layer,w,h,this.images);
        scratch.save();scratch.globalCompositeOperation='destination-in';scratch.drawImage(this.maskCanvas,0,0);scratch.restore();
      }
      if(layer.blend && layer.blend!=='normal'){
        const dest=ctx.getImageData(0,0,w,h), source=scratch.getImageData(0,0,w,h);
        blendPixels(dest.data,source.data,layer.blend,layer.opacity);ctx.putImageData(dest,0,0);
      }else{ctx.save();ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=layer.opacity;ctx.drawImage(this.scratch,0,0);ctx.restore();}
    }
    this.texture.needsUpdate=true; return true;
  }
  /** Deterministic local fill, not an AI model. Produces an editable patch
   * from the hidden region of a layer mask, sampling surrounding base color. */
  async cleanMaskedRegion(doc:TextureDocument,layerId:string):Promise<{image:string;x:number;y:number;width:number;height:number}>{
    const layer=doc.layers.find(l=>l.id===layerId);
    if(!layer||(!layer.mask?.length&&!layer.maskImage))throw new Error('Paint a layer mask over the unwanted region first.');
    const w=doc.width,h=doc.height,mask=canvas(w,h),mc=context(mask);
    try{
      const images=new Map<string,HTMLImageElement>();
      if(layer.maskImage)images.set(layer.maskImage,this.images.get(layer.maskImage)??await loadImage(layer.maskImage));
      drawMask(mc,layer,w,h,images);
      const md=mc.getImageData(0,0,w,h).data;
      let x0=w,y0=h,x1=-1,y1=-1;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(md[(y*w+x)*4+3]<250){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
      if(x1<0)throw new Error('Mask has no hidden area. Use Eraser in mask mode to select the region.');
      x0=Math.max(0,x0-3);y0=Math.max(0,y0-3);x1=Math.min(w-1,x1+3);y1=Math.min(h-1,y1+3);
      const cw=x1-x0+1,ch=y1-y0+1,n=cw*ch;
      if(n>1048576)throw new Error('Cleanup selection is too large. Select smaller regions (up to about one megapixel).');
      const source=context(this.output).getImageData(x0,y0,cw,ch).data;
      const target=new Uint8Array(n),visited=new Uint8Array(n),queue=new Int32Array(n);
      const colors=new Uint8ClampedArray(source);let head=0,tail=0,affected=0;
      for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
        const p=y*cw+x,m=255-md[((y+y0)*w+x+x0)*4+3];
        target[p]=source[p*4+3]?m:0;
        if(target[p]>5)affected++;
        else if(source[p*4+3]){visited[p]=1;queue[tail++]=p;}
      }
      if(!affected||!tail)throw new Error('Cleanup needs visible surrounding texture. Make a smaller mask.');
      const neighbors=(p:number)=>{const x=p%cw,y=Math.floor(p/cw),out:number[]=[];if(x>0)out.push(p-1);if(x<cw-1)out.push(p+1);if(y>0)out.push(p-cw);if(y<ch-1)out.push(p+cw);return out;};
      while(head<tail){
        const p=queue[head++];
        for(const q of neighbors(p)){if(visited[q]||target[q]<=5)continue;visited[q]=1;queue[tail++]=q;for(let k=0;k<3;k++)colors[q*4+k]=colors[p*4+k];}
      }
      // A few bounded diffusion passes soften hard nearest-neighbor seams.
      for(let pass=0;pass<3;pass++){
        const next=new Uint8ClampedArray(colors);
        for(let p=0;p<n;p++)if(target[p]>5&&visited[p]){
          const ns=neighbors(p).filter(q=>visited[q]);if(!ns.length)continue;
          for(let k=0;k<3;k++)next[p*4+k]=Math.round(ns.reduce((sum,q)=>sum+colors[q*4+k],0)/ns.length);
        }
        colors.set(next);
      }
      const patch=canvas(cw,ch),pc=context(patch),result=pc.createImageData(cw,ch);
      for(let p=0;p<n;p++)if(target[p]>5&&visited[p]){for(let k=0;k<3;k++)result.data[p*4+k]=colors[p*4+k];result.data[p*4+3]=target[p];}
      pc.putImageData(result,0,0);const image=patch.toDataURL('image/png');patch.width=patch.height=1;
      return {image,x:x0,y:y0,width:cw,height:ch};
    }finally{mask.width=mask.height=1;}
  }
  async rasterLayers(doc:TextureDocument):Promise<{base:HTMLCanvasElement;layers:{layer:TextureLayer;image:HTMLCanvasElement;mask?:HTMLCanvasElement}[]}> {
    const {width:w,height:h}=doc;
    const count=1+doc.layers.length+doc.layers.filter(l=>l.mask?.length||l.maskImage).length;
    if(w*h*4*count>160*1024*1024)throw new Error('PSD raster export exceeds the 160 MB working budget. Reduce layer count or texture dimensions.');
    const images=new Map<string,HTMLImageElement>();
    for(const url of new Set(doc.layers.flatMap(l=>[...(l.kind==='image'?[l.image]:[]),...(l.maskImage?[l.maskImage]:[])])))images.set(url,this.images.get(url)??await loadImage(url));
    const base=canvas(w,h);context(base).drawImage(this.base,0,0);
    const layers=doc.layers.map(layer=>{
      const image=canvas(w,h);drawLayer(context(image),layer,w,h,images);
      if(!layer.mask?.length&&!layer.maskImage)return {layer,image};
      const mask=canvas(w,h),ctx=context(mask);drawMask(ctx,layer,w,h,images);
      // PSD user masks are grayscale, while the native editor uses alpha.
      const pixels=ctx.getImageData(0,0,w,h);
      for(let i=0;i<pixels.data.length;i+=4){const a=pixels.data[i+3];pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=a;pixels.data[i+3]=255;}
      ctx.putImageData(pixels,0,0);return {layer,image,mask};
    });
    return {base,layers};
  }
  showOriginal(show: boolean): void {
    if (this.disposed) return;
    this.material.map=show?this.originalMap:this.texture;
    this.material.color.copy(show?this.originalColor:new THREE.Color(0xffffff)); this.material.needsUpdate=true;
  }
  restore(): void {
    if (this.disposed) return;
    this.showOriginal(true); this.disposed=true; this.renderId++; this.texture.dispose(); this.images.clear();
    if(this.maskCanvas){this.maskCanvas.width=this.maskCanvas.height=1;this.maskCanvas=null;}
    this.scratch.width=this.scratch.height=1; this.output.width=this.output.height=1; this.base.width=this.base.height=1;
  }
}
