import * as THREE from 'three';
import { faces,meshFrom } from './geometrySurfaceTools';
export interface FaceSelection{meshId:string;geometryId:string;indices:number[]}
export function toggleFace(selection:FaceSelection|null,mesh:THREE.Mesh,index:number,add:boolean):FaceSelection{
  if(!Number.isInteger(index)||index<0||index>=Math.floor((mesh.geometry.index?.count??mesh.geometry.getAttribute('position')?.count??0)/3))throw new Error('Invalid face index.');
  const same=selection?.meshId===mesh.uuid&&selection.geometryId===mesh.geometry.uuid;
  const next=new Set(add&&same?selection.indices:[]);
  if(add&&next.has(index))next.delete(index);else next.add(index);
  if(next.size>50000)throw new Error('Face selection limit reached.');
  return {meshId:mesh.uuid,geometryId:mesh.geometry.uuid,indices:[...next].sort((a,b)=>a-b)};
}
export function faceRegionGeometry(mesh:THREE.Mesh,selection:FaceSelection):THREE.BufferGeometry{
  const source=mesh.geometry,position=source.getAttribute('position'),values:number[]=[];
  if(selection.geometryId!==source.uuid||selection.meshId!==mesh.uuid)throw new Error('Selection no longer matches mesh.');
  for(const face of selection.indices)for(let j=0;j<3;j++){
    const i=source.index?source.index.getX(face*3+j):face*3+j;
    if(i<0||i>=position.count)throw new Error('Invalid face selection.');
    values.push(position.getX(i),position.getY(i),position.getZ(i));
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(values,3));return result;
}
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function context(c:HTMLCanvasElement){const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas unavailable.');return ctx;}
export function createFaceRegionMask(root:THREE.Object3D,selection:FaceSelection,material:THREE.MeshStandardMaterial,width:number,height:number):{image:string;coverage:number;conflicts:number}{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16777216)throw new Error('Unsupported mask dimensions.');
  const mesh=meshFrom(root,selection.meshId);
  if(mesh.geometry.uuid!==selection.geometryId||!selection.indices.length)throw new Error('Select faces on the current mesh first.');
  const map=material.map,channel=map?.channel??0;
  if(channel>1)throw new Error('Face masks support UV0 and UV1.');
  if(map?.matrixAutoUpdate)map.updateMatrix();
  const chosen=new Set(selection.indices),on=canvas(width,height),off=canvas(width,height),a=context(on),b=context(off);
  const uv=new THREE.Vector2();let triangles=0,matched=0;
  root.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    const mats=Array.isArray(node.material)?node.material:[node.material];if(!mats.includes(material))return;
    // Reject unsupported geometry even on other material users rather than leak artwork.
    meshFrom(root,node.uuid);
    const geo=node.geometry,attr=geo.getAttribute(channel?'uv'+channel:'uv');
    if(!attr)throw new Error('A shared material mesh lacks usable UVs.');
    const list=faces(node);
    for(let index=0;index<list.length;index++){
      const f=list[index];if(mats[f.slot]!==material)continue;
      if(++triangles>50000)throw new Error('Face mask exceeds the 50,000-triangle budget.');
      const selected=node===mesh&&chosen.has(index),ctx=selected?a:b;
      if(selected)matched++;
      ctx.fillStyle='#ffffff';ctx.beginPath();
      f.indices.forEach((v,j)=>{
        uv.fromBufferAttribute(attr,v);
        if(map){uv.applyMatrix3(map.matrix);if(map.flipY)uv.y=1-uv.y;}
        if(uv.x<-.0001||uv.x>1.0001||uv.y<-.0001||uv.y>1.0001)throw new Error('Face masks require a single unwrapped texture tile; generate an independent chart atlas first.');
        const x=Math.max(0,Math.min(1,uv.x))*width,y=Math.max(0,Math.min(1,uv.y))*height;
        if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });ctx.closePath();ctx.fill();
    }
  });
  if(!matched)throw new Error('Selected faces do not use the active material.');
  const included=a.getImageData(0,0,width,height),excluded=b.getImageData(0,0,width,height);
  let coverage=0,conflicts=0;
  for(let i=3;i<included.data.length;i+=4){if(included.data[i]){if(excluded.data[i]>8){included.data[i]=0;conflicts++;}else coverage++;}}
  if(!coverage)throw new Error('Selected UVs overlap other faces or have no visible mask pixels. Separate the region and unwrap independent UVs first.');
  a.putImageData(included,0,0);const image=on.toDataURL('image/png');on.width=on.height=off.width=off.height=1;
  return {image,coverage,conflicts};
}
