import * as THREE from 'three';

export type SeparationMode='materials'|'connected'|'sharp';
const MAX_TRIANGLES=50000,MAX_PARTS=64,MAX_UV_TRIANGLES=4096;
export type Face={indices:[number,number,number];slot:number};
export function meshFrom(root:THREE.Object3D,id:string):THREE.Mesh{
  const mesh=root.getObjectByProperty('uuid',id);
  if(!(mesh instanceof THREE.Mesh)||mesh instanceof THREE.SkinnedMesh||mesh instanceof THREE.InstancedMesh||mesh.morphTargetInfluences?.length||Object.keys(mesh.geometry.morphAttributes).length)throw new Error('Select a static mesh. Skinned, instanced and morph-target meshes are not supported by geometry tools.');
  if(mesh.geometry.getAttribute('skinIndex')||mesh.geometry.getAttribute('skinWeight'))throw new Error('Skin attributes are not supported by geometry tools.');
  return mesh;
}
export function faces(mesh:THREE.Mesh):Face[]{
  const geo=mesh.geometry,pos=geo.getAttribute('position'),index=geo.index,count=index?.count??pos?.count??0;
  if(!pos||pos.itemSize!==3||!count||count%3||count/3>MAX_TRIANGLES)throw new Error('Mesh requires valid triangle geometry with at most 50,000 triangles.');
  if(geo.drawRange.start!==0||geo.drawRange.count<count)throw new Error('Partial draw ranges are not supported.');
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const slots=new Int32Array(count/3);slots.fill(-1);
  const groups=Array.isArray(mesh.material)?geo.groups:[{start:0,count,materialIndex:0}];
  for(const group of groups){
    const slot=group.materialIndex??0;
    if(!mats[slot]||group.start%3||group.count%3||group.start<0||group.start+group.count>count)throw new Error('Invalid geometry material group.');
    for(let i=group.start/3;i<(group.start+group.count)/3;i++){if(slots[i]!==-1)throw new Error('Overlapping geometry groups are not supported.');slots[i]=slot;}
  }
  if(slots.some(s=>s<0))throw new Error('Geometry has uncovered material groups.');
  return Array.from(slots,(slot,i)=>{
    const indices=[0,1,2].map(j=>index?index.getX(i*3+j):i*3+j) as Face['indices'];
    if(indices.some(n=>!Number.isInteger(n)||n<0||n>=pos.count))throw new Error('Invalid mesh vertex index.');
    return {indices,slot};
  });
}
export function disposeUnused(root:THREE.Object3D,geometry:THREE.BufferGeometry){
  let used=false;root.traverse(node=>{if(node instanceof THREE.Mesh&&node.geometry===geometry)used=true;});if(!used)geometry.dispose();
}
function copyAttribute(attribute:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,indices:number[]):THREE.BufferAttribute{
  // Copy raw integer values as well as floats, preserving normalized attributes.
  const interleaved=attribute instanceof THREE.InterleavedBufferAttribute;
  const array=interleaved?attribute.data.array:attribute.array;
  const stride=interleaved?attribute.data.stride:attribute.itemSize,offset=interleaved?attribute.offset:0;
  if(attribute instanceof THREE.Float16BufferAttribute)throw new Error('Float16 vertex attributes are not supported.');
  const ctor=array.constructor as {new(length:number):typeof array};
  const result=new ctor(indices.length*attribute.itemSize);
  for(let i=0;i<indices.length;i++)for(let j=0;j<attribute.itemSize;j++)result[i*attribute.itemSize+j]=array[indices[i]*stride+offset+j];
  const copy=new THREE.BufferAttribute(result,attribute.itemSize,attribute.normalized);copy.name=attribute.name;return copy;
}
export function buildGeometry(source:THREE.BufferGeometry,selected:Face[],nonindexed=false):THREE.BufferGeometry{
  const output=new THREE.BufferGeometry(),indices:number[]=[],remap=new Map<number,number>(),outIndex:number[]=[];
  try{
    for(const face of selected)for(const index of face.indices){
      if(nonindexed)indices.push(index);else{let next=remap.get(index);if(next===undefined){next=indices.length;remap.set(index,next);indices.push(index);}outIndex.push(next);}
    }
    for(const [name,attribute] of Object.entries(source.attributes)){
      if(attribute.count!==source.getAttribute('position').count||attribute instanceof THREE.InstancedBufferAttribute)throw new Error('Unsupported vertex attribute: '+name);
      output.setAttribute(name,copyAttribute(attribute,indices));
    }
    if(!nonindexed)output.setIndex(outIndex);
    output.name=source.name;output.userData=structuredClone(source.userData);
    output.computeBoundingBox();output.computeBoundingSphere();return output;
  }catch(e){output.dispose();throw e;}
}
export function assignGroups(geo:THREE.BufferGeometry,selected:Face[]){
  let start=0,slot=selected[0].slot;
  for(let i=1;i<=selected.length;i++)if(i===selected.length||selected[i].slot!==slot){geo.addGroup(start*3,(i-start)*3,slot);start=i;slot=selected[i]?.slot??0;}
}
export function generateMeshUV(root:THREE.Object3D,nodeId:string,retainOriginal=false):{triangles:number;materialIds:string[];grid:number}{
  const mesh=meshFrom(root,nodeId),source=mesh.geometry;
  if(source.getAttribute('uv'))throw new Error('This mesh already has UV0. Existing UVs are never overwritten.');
  const selected=faces(mesh);
  if(selected.length>MAX_UV_TRIANGLES)throw new Error('Automatic triangle atlas supports up to 4,096 triangles. Simplify the mesh or use a dedicated UV unwrapper.');
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const material of materials)for(const value of Object.values(material))if(value instanceof THREE.Texture&&value.channel===0)throw new Error('A texture already relies on missing UV0. Repair the original UV mapping externally to preserve its appearance.');
  const output=buildGeometry(source,selected,true);
  const grid=Math.ceil(Math.sqrt(selected.length)),uvs=new Float32Array(selected.length*6);
  const pos=source.getAttribute('position'),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  const padding=Math.min(.18,Math.max(.06,grid/1024*2));
  try{
    for(let i=0;i<selected.length;i++){
      const face=selected[i];a.fromBufferAttribute(pos,face.indices[0]);b.fromBufferAttribute(pos,face.indices[1]);c.fromBufferAttribute(pos,face.indices[2]);
      ab.subVectors(b,a);ac.subVectors(c,a);
      const length=ab.length(),area=ab.clone().cross(ac).length();
      if(length<1e-10||area<1e-12)throw new Error('Degenerate triangle prevents safe UV generation.');
      const x=ac.dot(ab)/length,y=area/length;
      const minX=Math.min(0,x),maxX=Math.max(length,x),span=Math.max(maxX-minX,y);
      const scale=(1-2*padding)/span;
      const col=i%grid,row=Math.floor(i/grid);
      const points=[[0,0],[length,0],[x,y]];
      for(let j=0;j<3;j++){uvs[i*6+j*2]=(col+padding+(points[j][0]-minX)*scale)/grid;uvs[i*6+j*2+1]=(row+padding+points[j][1]*scale)/grid;}
    }
    output.setAttribute('uv',new THREE.BufferAttribute(uvs,2));assignGroups(output,selected);
    // A new atlas must not silently share artwork with unrelated meshes.
    const isolated=materials.map(material=>{
      let shared=false;root.traverse(node=>{if(node instanceof THREE.Mesh&&node!==mesh&&(Array.isArray(node.material)?node.material:[node.material]).includes(material))shared=true;});
      if(!shared)return material;
      const clone=material.clone();clone.name=(material.name||'Material')+' — '+(mesh.name||'UV atlas');return clone;
    });
    mesh.geometry=output;mesh.material=Array.isArray(mesh.material)?isolated:isolated[0];if(!retainOriginal)disposeUnused(root,source);
    return {triangles:selected.length,materialIds:isolated.map(m=>m.uuid),grid};
  }catch(e){output.dispose();throw e;}
}
function connectedParts(selected:Face[],source:THREE.BufferGeometry):Face[][]{
  const parent=selected.map((_,i)=>i),find=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const seen=new Map<string,number>();
  // Exact position weld also finds connectivity on non-indexed meshes and UV seams.
  // Coincident shells can be joined by this method; this is not semantic segmentation.
  const pos=source.getAttribute('position');
  selected.forEach((face,i)=>{
    for(const index of face.indices){
      const key=pos.getX(index)+','+pos.getY(index)+','+pos.getZ(index);
      const other=seen.get(key);if(other!==undefined)parent[find(i)]=find(other);else seen.set(key,i);
    }
  });
  const parts=new Map<number,Face[]>();selected.forEach((face,i)=>{const key=find(i),part=parts.get(key)??[];part.push(face);parts.set(key,part);});return [...parts.values()];
}
function sharpParts(selected:Face[],source:THREE.BufferGeometry,angle:number):Face[][]{
  if(!Number.isFinite(angle)||angle<1||angle>179)throw new Error('Sharp separation angle must be between 1 and 179 degrees.');
  const pos=source.getAttribute('position'),parent=selected.map((_,i)=>i),find=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const edges=new Map<string,number[]>(),normals:THREE.Vector3[]=[];
  const key=(i:number)=>[pos.getX(i),pos.getY(i),pos.getZ(i)].join(',');
  selected.forEach((f,i)=>{
    const [a,b,c]=f.indices.map(j=>new THREE.Vector3().fromBufferAttribute(pos,j));
    const normal=b.sub(a).cross(c.sub(a));if(normal.lengthSq()<1e-20)throw new Error('Degenerate triangle prevents sharp-edge analysis.');normals.push(normal.normalize());
    for(let j=0;j<3;j++){const p=key(f.indices[j]),q=key(f.indices[(j+1)%3]),edge=p<q?p+'|'+q:q+'|'+p;const list=edges.get(edge)??[];list.push(i);edges.set(edge,list);}
  });
  const threshold=Math.cos(angle*Math.PI/180);
  for(const adjacent of edges.values())if(adjacent.length===2){const [a,b]=adjacent;if(selected[a].slot===selected[b].slot&&normals[a].dot(normals[b])>=threshold)parent[find(a)]=find(b);}
  const groups=new Map<number,Face[]>();selected.forEach((face,i)=>{const id=find(i),group=groups.get(id)??[];group.push(face);groups.set(id,group);});
  return [...groups.values()];
}
export function separateMesh(root:THREE.Object3D,nodeId:string,mode:SeparationMode|'manual',retainOriginal=false,angle=45,manualFaces:readonly number[]=[]):{parts:THREE.Mesh[];triangles:number}{
  const mesh=meshFrom(root,nodeId),source=mesh.geometry,selected=faces(mesh);
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  let chunks:Face[][];
  if(mode==='materials'){const map=new Map<number,Face[]>();for(const face of selected){const part=map.get(face.slot)??[];part.push(face);map.set(face.slot,part);}chunks=[...map.values()];}
  else if(mode==='connected')chunks=connectedParts(selected,source);
  else if(mode==='sharp')chunks=sharpParts(selected,source,angle);
  else if(mode==='manual'){
    const chosen=new Set(manualFaces);if(!chosen.size||chosen.size>=selected.length||[...chosen].some(i=>!Number.isInteger(i)||i<0||i>=selected.length))throw new Error('Select a nonempty proper subset of mesh faces.');
    chunks=[selected.filter((_,i)=>!chosen.has(i)),selected.filter((_,i)=>chosen.has(i))];
  }
  else throw new Error('Unknown separation mode.');
  if(chunks.length<2)throw new Error('No separate parts found for this mode.');
  if(chunks.length>MAX_PARTS)throw new Error('Separation would create more than 64 parts.');
  const prepared:{geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[]}[]=[];
  try{
    for(const chunk of chunks){
      const slots=[...new Set(chunk.map(face=>face.slot))],geo=buildGeometry(source,chunk);
      const mapped=chunk.map(face=>({...face,slot:slots.indexOf(face.slot)}));assignGroups(geo,mapped);
      const partMaterials=slots.map(slot=>{const m=materials[slot];if(mode!=='manual'||prepared.length===0)return m;const clone=m.clone();clone.name=(m.name||'Material')+' — selected region';return clone;});
      prepared.push({geometry:geo,material:partMaterials.length===1?partMaterials[0]:partMaterials});
    }
  }catch(e){prepared.forEach(p=>p.geometry.dispose());throw e;}
  // Keep original mesh as transform/animation anchor; children use identity transforms.
  const originalName=mesh.name||'Mesh',parts:THREE.Mesh[]=[mesh];
  mesh.geometry=prepared[0].geometry;mesh.material=prepared[0].material;
  for(let i=1;i<prepared.length;i++){
    const part=new THREE.Mesh(prepared[i].geometry,prepared[i].material);
    part.name=originalName+' — part '+(i+1)+' '+part.uuid.slice(0,8);
    part.castShadow=mesh.castShadow;part.receiveShadow=mesh.receiveShadow;part.frustumCulled=mesh.frustumCulled;part.renderOrder=mesh.renderOrder;part.layers.mask=mesh.layers.mask;
    mesh.add(part);parts.push(part);
  }
  if(!retainOriginal)disposeUnused(root,source);return {parts,triangles:selected.length};
}
