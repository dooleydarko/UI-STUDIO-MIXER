import * as THREE from 'three';

export type Point = { x: number; y: number };
export type Stroke = { points: Point[]; color: string; size: number; opacity: number; erase: boolean };
type Common = { id: string; name: string; visible: boolean; locked: boolean; opacity: number };
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
  return { id: crypto.randomUUID(), name, visible: true, locked: false, opacity: 1 };
}
export function moveLayer(layers: TextureLayer[], id: string, delta: number): TextureLayer[] {
  const i = layers.findIndex(l => l.id === id), j = i + delta;
  if (i < 0 || j < 0 || j >= layers.length) return layers;
  const next = [...layers]; [next[i], next[j]] = [next[j], next[i]]; return next;
}
export function addStroke(layers: TextureLayer[], id: string, stroke: Stroke): TextureLayer[] {
  return layers.map(l => l.id === id && l.kind === 'paint' && !l.locked ? { ...l, strokes: [...l.strokes, stroke] } : l);
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
  const ids = new Set<string>();
  for (const l of d.layers) {
    if (!l || typeof l.id !== 'string' || ids.has(l.id) || typeof l.name !== 'string' || typeof l.visible !== 'boolean' || typeof l.locked !== 'boolean' || !opacity(l.opacity)) throw new Error('Invalid layer.');
    ids.add(l.id);
    if (l.kind === 'gray') { if (!color(l.color)) throw new Error('Invalid gray adjustment.'); }
    else if (l.kind === 'image') {
      if (!image(l.image) || ![l.x,l.y,l.width,l.height,l.rotation].every(finite) || l.width<=0 || l.height<=0 || l.width>16384 || l.height>16384 || typeof l.flipX!=='boolean' || typeof l.flipY!=='boolean') throw new Error('Invalid artwork layer.');
    } else if (l.kind === 'paint') {
      if (!Array.isArray(l.strokes) || l.strokes.length>5000 || l.strokes.some((s: Stroke) => !s || !color(s.color) || !finite(s.size) || s.size<=0 || s.size>4096 || !opacity(s.opacity) || typeof s.erase!=='boolean' || !Array.isArray(s.points) || s.points.length>10000 || s.points.some(p=>!p || !finite(p.x)||!finite(p.y)))) throw new Error('Invalid paint layer.');
    } else throw new Error('Unsupported layer type.');
  }
  return d as TextureDocument;
}
export class TextureCanvasSession {
  readonly output: HTMLCanvasElement;
  readonly initial: TextureDocument;
  private base: HTMLCanvasElement;
  private scratch: HTMLCanvasElement;
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
      for (let i=0;i<pixels.data.length;i+=4) for (let k=0;k<3;k++) {
        const s=pixels.data[i+k]/255;
        const linear=srgb?(s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)):s;
        const value=linear*channels[k];
        pixels.data[i+k]=Math.round(255*(value<=.0031308?12.92*value:1.055*Math.pow(value,1/2.4)-.055));
      }
      ctx.putImageData(pixels,0,0);
    } else { ctx.fillStyle='#'+material.color.getHexString(); ctx.fillRect(0,0,width,height); }
    this.initial = { version:1, material:name, width,height,base:this.base.toDataURL('image/png'),layers:[] };
    this.texture = map ? map.clone() : new THREE.CanvasTexture(this.output);
    this.texture.source = new THREE.Source(this.output); this.texture.colorSpace=THREE.SRGBColorSpace;
    if (!map) this.texture.flipY=false;
    context(this.output).drawImage(this.base,0,0);
    this.texture.needsUpdate=true; material.map=this.texture; material.color.set(0xffffff); material.needsUpdate=true;
  }
  get paintMaterial(): THREE.MeshStandardMaterial { return this.material; }
  get supports3DPaint(): boolean { return this.texture.channel <= 1; }
  async render(doc: TextureDocument): Promise<boolean> {
    if (this.disposed) return false;
    const id=++this.renderId;
    const needed=new Set(doc.layers.filter((l):l is Extract<TextureLayer,{kind:'image'}>=>l.kind==='image').map(l=>l.image));
    for (const url of this.images.keys()) if (!needed.has(url)) this.images.delete(url);
    const decoded=await Promise.all([...needed].filter(url=>!this.images.has(url)).map(async url=>[url,await loadImage(url)] as const));
    if (this.disposed || id!==this.renderId) return false;
    decoded.forEach(([url,image])=>this.images.set(url,image));
    const {width:w,height:h}=doc, ctx=context(this.output), scratch=context(this.scratch);
    ctx.clearRect(0,0,w,h); ctx.drawImage(this.base,0,0);
    for (const layer of doc.layers) {
      if (!layer.visible || layer.opacity===0) continue;
      ctx.save(); ctx.globalCompositeOperation='source-atop'; ctx.globalAlpha=layer.opacity;
      if (layer.kind==='gray') { ctx.fillStyle=layer.color; ctx.fillRect(0,0,w,h); }
      else if (layer.kind==='image') {
        const image=this.images.get(layer.image);
        if (image) {
          ctx.translate(layer.x+layer.width/2,layer.y+layer.height/2); ctx.rotate(layer.rotation*Math.PI/180);
          ctx.scale(layer.flipX?-1:1,layer.flipY?-1:1); ctx.drawImage(image,-layer.width/2,-layer.height/2,layer.width,layer.height);
        }
      } else {
        scratch.clearRect(0,0,w,h);
        for (const stroke of layer.strokes) {
          if (!stroke.points.length) continue;
          scratch.save(); scratch.globalAlpha=stroke.opacity; scratch.globalCompositeOperation=stroke.erase?'destination-out':'source-over';
          scratch.strokeStyle=stroke.color; scratch.fillStyle=stroke.color; scratch.lineWidth=stroke.size; scratch.lineCap='round'; scratch.lineJoin='round';
          scratch.beginPath(); scratch.moveTo(stroke.points[0].x,stroke.points[0].y);
          if (stroke.points.length===1) { scratch.arc(stroke.points[0].x,stroke.points[0].y,stroke.size/2,0,Math.PI*2); scratch.fill(); }
          else { for (const p of stroke.points.slice(1)) scratch.lineTo(p.x,p.y); scratch.stroke(); }
          scratch.restore();
        }
        ctx.drawImage(this.scratch,0,0);
      }
      ctx.restore();
    }
    this.texture.needsUpdate=true; return true;
  }
  showOriginal(show: boolean): void {
    if (this.disposed) return;
    this.material.map=show?this.originalMap:this.texture;
    this.material.color.copy(show?this.originalColor:new THREE.Color(0xffffff)); this.material.needsUpdate=true;
  }
  restore(): void {
    if (this.disposed) return;
    this.showOriginal(true); this.disposed=true; this.renderId++; this.texture.dispose(); this.images.clear();
    this.scratch.width=this.scratch.height=1; this.output.width=this.output.height=1; this.base.width=this.base.height=1;
  }
}
