import * as THREE from 'three';

type MeshState={mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];children:THREE.Object3D[]};
type Snapshot=MeshState[];
type Entry={label:string;before:Snapshot;after:Snapshot};
function capture(root:THREE.Object3D):Snapshot{
  const result:Snapshot=[];
  root.traverse(node=>{if(node instanceof THREE.Mesh)result.push({mesh:node,geometry:node.geometry,material:Array.isArray(node.material)?[...node.material]:node.material,children:[...node.children]});});
  return result;
}
function resources(states:Snapshot){
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  for(const state of states){geometry.add(state.geometry);for(const mat of Array.isArray(state.material)?state.material:[state.material]){materials.add(mat);for(const value of Object.values(mat))if(value instanceof THREE.Texture)textures.add(value);}}
  return {geometry,materials,textures};
}
function bytes(snapshots:Snapshot[]){
  const all=resources(snapshots.flat());let total=0;
  for(const geo of all.geometry){const arrays=new Set<ArrayBufferLike>();for(const a of Object.values(geo.attributes)){const array=a instanceof THREE.InterleavedBufferAttribute?a.data.array:a.array;arrays.add(array.buffer);}if(geo.index)arrays.add(geo.index.array.buffer);for(const a of arrays)total+=a.byteLength;}
  for(const t of all.textures){const im=t.image,w=im?.width??0,h=im?.height??0;total+=w*h*4;}
  return total;
}
function apply(states:Snapshot){
  // Preserve original Object3D identity and animation bindings. Only structural
  // commands may run while history is active; never restore material scalar edits.
  for(const s of states){s.mesh.geometry=s.geometry;s.mesh.material=Array.isArray(s.material)?[...s.material]:s.material;}
  for(const s of states){
    for(const child of [...s.mesh.children])if(!s.children.includes(child))s.mesh.remove(child);
    for(const child of s.children)if(child.parent!==s.mesh)s.mesh.add(child);
    s.mesh.children.sort((a,b)=>s.children.indexOf(a)-s.children.indexOf(b));
  }
}
function disposeOrphans(root:THREE.Object3D,discarded:Snapshot[],retained:Snapshot[]){
  const active=resources([...capture(root),...retained.flat()]),old=resources(discarded.flat());
  for(const g of old.geometry)if(!active.geometry.has(g))g.dispose();
  for(const m of old.materials)if(!active.materials.has(m))m.dispose();
  for(const t of old.textures)if(!active.textures.has(t))t.dispose();
}
export class StructuralHistory{
  private past:Entry[]=[];private future:Entry[]=[];
  constructor(private root:THREE.Object3D,private maxEntries=8,private maxBytes=256*1024*1024){}
  get undoLabel(){return this.past.at(-1)?.label;}
  get redoLabel(){return this.future.at(-1)?.label;}
  begin(){return capture(this.root);}
  commit(label:string,before:Snapshot){
    const after=capture(this.root),discarded=this.future.flatMap(e=>[e.before,e.after]);this.future=[];
    this.past.push({label,before,after});
    while(this.past.length&&(this.past.length>this.maxEntries||bytes(this.past.flatMap(e=>[e.before,e.after]))>this.maxBytes)){
      const e=this.past.shift()!;discarded.push(e.before,e.after);
    }
    disposeOrphans(this.root,discarded,this.past.flatMap(e=>[e.before,e.after]));
  }
  undo(){const e=this.past.pop();if(!e)return false;apply(e.before);this.future.push(e);return true;}
  redo(){const e=this.future.pop();if(!e)return false;apply(e.after);this.past.push(e);return true;}
  clear(){const discarded=[...this.past,...this.future].flatMap(e=>[e.before,e.after]);this.past=[];this.future=[];disposeOrphans(this.root,discarded,[]);}
}
export function pickVisibleMesh(root:THREE.Object3D,raycaster:THREE.Raycaster):THREE.Intersection<THREE.Mesh>|undefined{
  root.updateWorldMatrix(true,true);
  return raycaster.intersectObject(root,true).find((hit):hit is THREE.Intersection<THREE.Mesh>=>{
    if(!(hit.object instanceof THREE.Mesh))return false;
    for(let node:THREE.Object3D|null=hit.object;node;node=node.parent)if(!node.visible)return false;
    const mat=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
    return !!mat?.visible;
  });
}
