import * as THREE from 'three';

export interface SurfaceEntry {
  id: string;
  name: string;
  depth: number;
  kind: string;
  materials: string[];
  uvSets: string[];
  groups: number;
}

/** Read-only hierarchy; imported node transforms and geometry are never rebuilt. */
export function inspectSurfaces(root: THREE.Object3D): SurfaceEntry[] {
  const entries: SurfaceEntry[] = [];
  function visit(node: THREE.Object3D, depth: number) {
    const mesh = node instanceof THREE.Mesh ? node : undefined;
    entries.push({ id: node.uuid, name: node.name || node.type, depth, kind: node.type,
      materials: mesh ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => m.uuid) : [],
      uvSets: mesh ? Object.keys(mesh.geometry.attributes).filter(k => /^uv\d*$/.test(k)) : [],
      groups: mesh?.geometry.groups.length ?? 0 });
    node.children.forEach(child => visit(child, depth + 1));
  }
  visit(root, 0);
  return entries;
}

export function neutralizePixels(data: Uint8ClampedArray, rgb: readonly number[], strength: number): void {
  const amount = Math.max(0, Math.min(1, strength));
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) data[i+c] = Math.round(data[i+c] * (1-amount) + rgb[c] * amount);
    // Never change alpha: preserve cutouts, opacity and alpha blending.
  }
}

type Original = { map: THREE.Texture | null; color: THREE.Color; generated: THREE.Texture | null };
export class GrayOutSession {
  private originals = new Map<THREE.MeshStandardMaterial, Original>();
  get active() { return this.originals.size > 0; }

  apply(materials: THREE.MeshStandardMaterial[], hex: string, strength: number): void {
    if (!/^#[0-9a-f]{6}$/i.test(hex) || !Number.isFinite(strength)) throw new Error('Invalid neutral color or strength.');
    const amount = Math.max(0, Math.min(1, strength));
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
    const target = new THREE.Color(hex);
    // Prepare all replacements before modifying any material, so errors are atomic.
    const prepared: { material: THREE.MeshStandardMaterial; original: Original; next: THREE.Texture | null; color: THREE.Color }[] = [];
    try {
      for (const material of new Set(materials)) {
        const original = this.originals.get(material) ?? { map: material.map, color: material.color.clone(), generated: null };
        let next: THREE.Texture | null = original.map;
        let color = original.color.clone().lerp(target, amount);
        if (original.map && amount > 0) {
          const image = original.map.image;
          const width = image?.naturalWidth || image?.videoWidth || image?.width;
          const height = image?.naturalHeight || image?.videoHeight || image?.height;
          if (!width || !height || width > 8192 || height > 8192 || width * height > 16777216 || original.map instanceof THREE.DataTexture || original.map instanceof THREE.CompressedTexture)
            throw new Error('Base-color image is unsupported or too large for Gray Out. Use a compatible image or optimize first.');
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Canvas unavailable.');
          ctx.drawImage(image, 0, 0, width, height);
          const pixels = ctx.getImageData(0, 0, width, height);
          neutralizePixels(pixels.data, rgb, amount);
          ctx.putImageData(pixels, 0, 0);
          next = original.map.clone();
          next.source = new THREE.Source(canvas);
          next.needsUpdate = true;
          color = original.color.clone().lerp(new THREE.Color(0xffffff), amount);
        }
        prepared.push({ material, original, next, color });
      }
    } catch (error) {
      for (const p of prepared) if (p.next && p.next !== p.original.map) p.next.dispose();
      throw error;
    }
    // Restore targets removed from the selected scope.
    const selected = new Set(materials);
    for (const material of [...this.originals.keys()]) if (!selected.has(material)) this.restore(material);
    for (const { material, original, next, color } of prepared) {
      original.generated?.dispose();
      original.generated = next !== original.map ? next : null;
      this.originals.set(material, original);
      material.map = next;
      material.color.copy(color);
      material.needsUpdate = true;
    }
  }

  private restore(material: THREE.MeshStandardMaterial): void {
    const original = this.originals.get(material);
    if (!original) return;
    material.map = original.map;
    material.color.copy(original.color);
    material.needsUpdate = true;
    original.generated?.dispose();
    this.originals.delete(material);
  }

  restoreAll(): void {
    for (const material of [...this.originals.keys()]) this.restore(material);
  }
}

export interface UVGuide { segments:number[][]; truncated:boolean }
/** UV edges for the selected material slots only. Shared UVs remain shared. */
export function collectUVGuide(root:THREE.Object3D,material:THREE.MeshStandardMaterial,limit=12000):UVGuide{
  const segments:number[][]=[];let truncated=false;
  const map=material.map,channel=map?.channel??0;
  if(map?.matrixAutoUpdate)map.updateMatrix();
  const seen=new Set<string>();
  const a=new THREE.Vector2(),b=new THREE.Vector2(),c=new THREE.Vector2();
  root.traverse(node=>{
    if(!(node instanceof THREE.Mesh)||truncated)return;
    const geo=node.geometry,uv=geo.getAttribute(channel?'uv'+channel:'uv');
    if(!uv)return;
    const slots=Array.isArray(node.material)?node.material:[node.material];
    if(!slots.includes(material))return;
    const count=geo.index?.count??uv.count;
    const groups=Array.isArray(node.material)?geo.groups.filter((g:{start:number;count:number;materialIndex?:number})=>slots[g.materialIndex??0]===material):[{start:0,count}];
    const index=(i:number)=>geo.index?geo.index.getX(i):i;
    const point=(p:THREE.Vector2,i:number)=>{p.fromBufferAttribute(uv,index(i));if(map)map.transformUv(p);};
    const edge=(p:THREE.Vector2,q:THREE.Vector2)=>{
      const first=p.x.toFixed(5)+','+p.y.toFixed(5),second=q.x.toFixed(5)+','+q.y.toFixed(5),key=first<second?first+'|'+second:second+'|'+first;
      if(seen.has(key))return;
      if(segments.length>=limit){truncated=true;return;}
      seen.add(key);segments.push([p.x,p.y,q.x,q.y]);
    };
    for(const g of groups){
      for(let i=g.start;i+2<Math.min(count,g.start+g.count)&&!truncated;i+=3){point(a,i);point(b,i+1);point(c,i+2);edge(a,b);edge(b,c);edge(c,a);}
      if(truncated)break;
    }
  });
  return {segments,truncated};
}
export function isolateMeshMaterial(root:THREE.Object3D,nodeId:string,materialId:string):THREE.MeshStandardMaterial{
  const node=root.getObjectByProperty('uuid',nodeId);
  if(!(node instanceof THREE.Mesh))throw new Error('Select an imported mesh.');
  const slots=Array.isArray(node.material)?node.material:[node.material];
  const material=slots.find(m=>m.uuid===materialId);
  if(!(material instanceof THREE.MeshStandardMaterial))throw new Error('Selected PBR material not found on this mesh.');
  const isolated=material.clone();
  isolated.name=(material.name||'Material')+' — '+(node.name||'isolated mesh');
  node.material=Array.isArray(node.material)?slots.map(m=>m===material?isolated:m):isolated;
  return isolated;
}
