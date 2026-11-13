import { TextureCanvasSession, parseTextureDocument, type TextureDocument } from './textureCanvasEngine';
import type { MaterialEntry } from './glbTextureSwapper';

export interface SurfaceBinding { materialIndex:number; materialName:string; document:TextureDocument }
export interface SurfaceWorkspaceData { documents?:SurfaceBinding[]; materialIndex:number; materialName:string; document:TextureDocument }
export const MAX_SURFACES=8;
export const MAX_CANVAS_BYTES=320*1024*1024;
export function surfaceBindings(data:SurfaceWorkspaceData):SurfaceBinding[]{
  const entries=data.documents??[{materialIndex:data.materialIndex,materialName:data.materialName,document:data.document}];
  if(!Array.isArray(entries)||!entries.length||entries.length>MAX_SURFACES)throw new Error('Invalid surface workspace document count.');
  const seen=new Set<number>();
  let bytes=0;
  return entries.map(entry=>{
    if(!Number.isInteger(entry.materialIndex)||entry.materialIndex<0||seen.has(entry.materialIndex)||typeof entry.materialName!=='string')throw new Error('Invalid or duplicate material binding.');
    seen.add(entry.materialIndex);
    const document=parseTextureDocument(JSON.stringify(entry.document));
    if(document.material!==entry.materialName)throw new Error('Surface material name mismatch.');
    bytes+=document.width*document.height*4*5;
    if(bytes>MAX_CANVAS_BYTES)throw new Error('Saved workspace exceeds the canvas memory budget.');
    return {...entry,document};
  });
}
type Entry={session:TextureCanvasSession;document:TextureDocument;materialIndex:number;materialName:string};
export class SurfaceWorkspace{
  private entries=new Map<string,Entry>();
  get size(){return this.entries.size;}
  get bytes(){return [...this.entries.values()].reduce((sum,e)=>sum+e.document.width*e.document.height*4*5,0);}
  get(id:string){return this.entries.get(id);}
  getBySession(session:TextureCanvasSession){return [...this.entries.values()].find(e=>e.session===session);}
  private checkBudget(width:number,height:number){
    if(this.size>=MAX_SURFACES||this.bytes+width*height*4*5>MAX_CANVAS_BYTES)throw new Error('Active texture canvases exceed the memory budget. Save the project and reduce texture resolution before adding more surfaces.');
  }
  open(materials:MaterialEntry[],index:number):Entry{
    const material=materials[index];if(!material)throw new Error('Material not found.');
    const prior=this.entries.get(material.id);if(prior)return prior;
    const image=material.material.map?.image;
    this.checkBudget(image?.naturalWidth||image?.width||1024,image?.naturalHeight||image?.height||1024);
    const session=new TextureCanvasSession(material.material,material.name);
    const entry={session,document:session.initial,materialIndex:index,materialName:material.name};
    this.entries.set(material.id,entry);return entry;
  }
  update(session:TextureCanvasSession,document:TextureDocument):boolean{
    const entry=this.getBySession(session);if(!entry||entry.document===document)return false;
    entry.document=document;return true;
  }
  bindings():SurfaceBinding[]{return [...this.entries.values()].map(({materialIndex,materialName,document})=>({materialIndex,materialName,document}));}
  async reopen(materials:MaterialEntry[],data:SurfaceWorkspaceData):Promise<Entry>{
    if(this.size)throw new Error('Workspace must be empty before reopening.');
    try{
      const bindings=surfaceBindings(data);
      for(const binding of bindings){
        const material=materials[binding.materialIndex];
        if(!material||material.name!==binding.materialName)throw new Error('Saved material binding does not match the source GLB.');
        const entry=this.open(materials,binding.materialIndex);
        await entry.session.restoreSavedBase(binding.document);
        entry.document=binding.document;
        if(!await entry.session.render(entry.document))throw new Error('Could not render restored surface.');
      }
      const active=materials[data.materialIndex];
      const result=active&&this.get(active.id);
      if(!result)throw new Error('Saved active surface missing.');
      return result;
    }catch(e){this.restoreAll();throw e;}
  }
  showOriginal(value:boolean){for(const {session} of this.entries.values())session.showOriginal(value);}
  restoreAll(){for(const {session} of this.entries.values())session.restore();this.entries.clear();}
}
