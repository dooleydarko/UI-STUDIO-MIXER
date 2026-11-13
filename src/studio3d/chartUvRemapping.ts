import * as THREE from 'three';
import { meshFrom,faces,buildGeometry,assignGroups,disposeUnused } from './geometrySurfaceTools';
import type { ChartAtlas,ChartRequest } from './chartAtlasKernel';

export type ChartResolution=512|1024|2048;
export interface ChartRemapResult{charts:number;triangles:number;width:number;height:number;materialId:string;channel:number;coverage:number}
function workerAtlas(input:ChartRequest,signal:AbortSignal):Promise<ChartAtlas>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(signal.reason);return;}
    const worker=new Worker(new URL('./chartAtlas.worker.ts',import.meta.url),{type:'module'});
    const finish=()=>{clearTimeout(timer);worker.terminate();signal.removeEventListener('abort',abort);};
    const abort=()=>{finish();reject(signal.reason??new Error('Unwrap canceled.'));};
    const timer=setTimeout(()=>{finish();reject(new Error('Chart generation exceeded its 90-second budget.'));},90000);
    signal.addEventListener('abort',abort,{once:true});
    worker.onmessage=e=>{finish();e.data?.ok?resolve(e.data.result):reject(new Error(e.data?.error??'Chart worker failed.'));};
    worker.onerror=e=>{finish();reject(new Error(e.message||'Could not load the local chart engine.'));};
    worker.postMessage(input,[input.positions.buffer,input.indices.buffer]);
  });
}
function canvas(width:number,height:number){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
function context(c:HTMLCanvasElement){const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas unavailable.');return ctx;}
const yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
async function bakeMap(original:THREE.BufferGeometry,indices:number[],atlas:ChartAtlas,map:THREE.Texture|null,resolution:ChartResolution,signal:AbortSignal){
  const ratio=Math.min(1,resolution/Math.max(atlas.width,atlas.height)),w=Math.max(1,Math.round(atlas.width*ratio)),h=Math.max(1,Math.round(atlas.height*ratio));
  const result=canvas(w,h),ctx=context(result),data=ctx.createImageData(w,h),occupied=new Uint8Array(w*h);
  let source:ImageData|undefined,oldUV:THREE.BufferAttribute|THREE.InterleavedBufferAttribute|undefined;
  if(map){
    const image=map.image,iw=image?.naturalWidth||image?.width,ih=image?.naturalHeight||image?.height;
    if(map instanceof THREE.DataTexture||map instanceof THREE.CompressedTexture||map instanceof THREE.VideoTexture||map.mapping!==THREE.UVMapping||!iw||!ih||Math.max(iw,ih)>4096)throw new Error('Base texture must be a readable image of at most 4096px.');
    oldUV=original.getAttribute(map.channel?'uv'+map.channel:'uv');
    if(!oldUV||oldUV.itemSize!==2)throw new Error('Original base map has no usable UV coordinates.');
    const c=canvas(iw,ih),s=context(c);s.drawImage(image,0,0,iw,ih);source=s.getImageData(0,0,iw,ih);c.width=c.height=1;
    if(map.matrixAutoUpdate)map.updateMatrix();
  }
  let remaining=40000000,covered=0;
  const uv=new THREE.Vector2(),sample=(x:number,y:number,k:number)=>source!.data[(Math.min(source!.height-1,Math.max(0,y))*source!.width+Math.min(source!.width-1,Math.max(0,x)))*4+k];
  for(let i=0;i<indices.length;i+=3){
    if(i%768===0){signal.throwIfAborted();await yieldTask();}
    const ax=atlas.uv[i*2]*w,ay=atlas.uv[i*2+1]*h,bx=atlas.uv[(i+1)*2]*w,by=atlas.uv[(i+1)*2+1]*h,cx=atlas.uv[(i+2)*2]*w,cy=atlas.uv[(i+2)*2+1]*h;
    const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    if(Math.abs(den)<1e-9)throw new Error('Atlas contains a degenerate UV triangle.');
    const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx)));
    const y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));
    remaining-=(x1-x0+1)*(y1-y0+1);if(remaining<0)throw new Error('Texture bake raster budget exceeded.');
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const a=((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/den,b=((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/den,c=1-a-b;
      if(a< -1e-6||b< -1e-6||c< -1e-6)continue;
      const index=y*w+x,offset=index*4;
      // Adjacent faces can share a boundary sample; reject overlapping interiors.
      const interior=Math.min(a,b,c)>1e-5;
      if(occupied[index]===2&&interior)throw new Error('Chart atlas has overlapping UV interiors. No changes applied.');
      if(!occupied[index])covered++;
      occupied[index]=interior?2:Math.max(occupied[index],1);
      if(source&&oldUV&&map){
        uv.set(oldUV.getX(indices[i])*a+oldUV.getX(indices[i+1])*b+oldUV.getX(indices[i+2])*c,oldUV.getY(indices[i])*a+oldUV.getY(indices[i+1])*b+oldUV.getY(indices[i+2])*c);map.transformUv(uv);
        const sx=uv.x*source.width-.5,sy=uv.y*source.height-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
        for(let k=0;k<4;k++)data.data[offset+k]=Math.round(sample(ix,iy,k)*(1-fx)*(1-fy)+sample(ix+1,iy,k)*fx*(1-fy)+sample(ix,iy+1,k)*(1-fx)*fy+sample(ix+1,iy+1,k)*fx*fy);
      }else data.data.fill(255,offset,offset+4);
    }
  }
  if(!covered)throw new Error('Chart atlas has no rasterized coverage.');
  // Dilate into unused atlas space only, including alpha; preserve occupied transparent texels.
  for(let pass=0;pass<4;pass++){
    signal.throwIfAborted();await yieldTask();
    const before=new Uint8Array(occupied);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x;if(before[i])continue;
      let from=-1;
      if(x>0&&before[i-1])from=i-1;else if(x+1<w&&before[i+1])from=i+1;else if(y>0&&before[i-w])from=i-w;else if(y+1<h&&before[i+w])from=i+w;
      if(from>=0){data.data.copyWithin(i*4,from*4,from*4+4);occupied[i]=1;}
    }
  }
  ctx.putImageData(data,0,0);return {canvas:result,width:w,height:h,coverage:covered/(w*h)};
}
/** Bake only base color onto a new independent atlas; retain original coordinates and all other PBR maps. */
export async function unwrapChartUV(root:THREE.Object3D,nodeId:string,resolution:ChartResolution,signal:AbortSignal,retainOriginal=false):Promise<ChartRemapResult>{
  if(![512,1024,2048].includes(resolution))throw new Error('Unsupported atlas resolution.');
  const mesh=meshFrom(root,nodeId),source=mesh.geometry,selected=faces(mesh),old=mesh.material;
  if(Array.isArray(old)||!(old instanceof THREE.MeshStandardMaterial))throw new Error('Select a single PBR material mesh. Split material groups first.');
  if(selected.length>25000)throw new Error('Chart unwrap is limited to 25,000 triangles.');
  const channel=source.getAttribute('uv')?1:0;
  const attribute=channel?'uv1':'uv';
  if(source.getAttribute(attribute))throw new Error('The spare UV1 channel is already occupied. Existing UV sets are never overwritten.');
  for(const value of Object.values(old))if(value instanceof THREE.Texture&&value.channel===channel)throw new Error('An existing texture uses the target UV channel. Repair missing UVs or free a channel externally.');
  const indices=selected.flatMap(f=>f.indices),positions=new Float32Array(indices.length*3),pos=source.getAttribute('position');
  indices.forEach((index,i)=>{positions[i*3]=pos.getX(index);positions[i*3+1]=pos.getY(index);positions[i*3+2]=pos.getZ(index);});
  if(positions.some(n=>!Number.isFinite(n)))throw new Error('Mesh contains invalid positions.');
  const atlas=await workerAtlas({positions,indices:Uint32Array.from(indices,(_,i)=>i),resolution},signal);
  signal.throwIfAborted();
  const baked=await bakeMap(source,indices,atlas,old.map,resolution,signal);
  let output:THREE.BufferGeometry|undefined,material:THREE.MeshStandardMaterial|undefined,texture:THREE.CanvasTexture|undefined;
  try{
    signal.throwIfAborted();
    if(mesh.geometry!==source||mesh.material!==old||!root.getObjectByProperty('uuid',nodeId))throw new Error('Source mesh changed during chart generation.');
    output=buildGeometry(source,selected,true);output.setAttribute(attribute,new THREE.BufferAttribute(atlas.uv,2));assignGroups(output,selected);
    material=old.clone();material.name=(old.name||'Material')+' — Chart UV';
    texture=new THREE.CanvasTexture(baked.canvas);texture.name='Chart remapped base color';texture.channel=channel;texture.flipY=false;texture.colorSpace=old.map?.colorSpace??THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.needsUpdate=true;
    material.map=texture;material.needsUpdate=true;
    mesh.geometry=output;mesh.material=material;if(!retainOriginal)disposeUnused(root,source);
    // Dispose the replaced material/texture only if not shared elsewhere.
    let materialUsed=false,textureUsed=false;
    root.traverse(node=>{if(node instanceof THREE.Mesh)for(const m of Array.isArray(node.material)?node.material:[node.material]){if(m===old)materialUsed=true;if(old.map&&Object.values(m).includes(old.map))textureUsed=true;}});
    if(!retainOriginal){if(!materialUsed)old.dispose();if(old.map&&!textureUsed)old.map.dispose();}
    return {charts:atlas.charts,triangles:selected.length,width:baked.width,height:baked.height,materialId:material.uuid,channel,coverage:baked.coverage};
  }catch(e){output?.dispose();material?.dispose();texture?.dispose();baked.canvas.width=baked.canvas.height=1;throw e;}
}
