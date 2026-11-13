import * as THREE from 'three';

export const VIEW_NAMES=['Front','Back','Left','Right','Top','Bottom'] as const;
export type ViewName=typeof VIEW_NAMES[number];
type V3=[number,number,number];type V2=[number,number];
type Triangle={p:[V3,V3,V3];uv?:[V2,V2,V2];normal:V3};
type Frame={name:ViewName;direction:V3;right:V3;up:V3;depth:Float32Array;guide:string};
export interface ProjectionCapture{frames:Frame[];triangles:Triangle[];center:V3;radius:number;size:number;width:number;height:number}
export interface ProjectionResult{image:string;coverage:number;ambiguous:number;covered:number;total:number}
const directions:Record<ViewName,V3>={Front:[0,0,1],Back:[0,0,-1],Left:[-1,0,0],Right:[1,0,0],Top:[0,1,0],Bottom:[0,-1,0]};
const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:V3):V3=>{const l=Math.hypot(...a);return l?[a[0]/l,a[1]/l,a[2]/l]:[0,0,0];};
const mix=(p:[V3,V3,V3],a:number,b:number,c:number):V3=>[p[0][0]*a+p[1][0]*b+p[2][0]*c,p[0][1]*a+p[1][1]*b+p[2][1]*c,p[0][2]*a+p[1][2]*b+p[2][2]*c];
function makeCanvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function ctx(c:HTMLCanvasElement){const v=c.getContext('2d',{willReadFrequently:true});if(!v)throw new Error('Canvas unavailable.');return v;}
const yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function raster(points:[V2,V2,V2],w:number,h:number,visit:(x:number,y:number,a:number,b:number,c:number)=>void,budget:{remaining:number}){
  const [p,q,r]=points,den=(q[1]-r[1])*(p[0]-r[0])+(r[0]-q[0])*(p[1]-r[1]);
  if(Math.abs(den)<1e-8)return;
  const x0=Math.max(0,Math.floor(Math.min(p[0],q[0],r[0]))),x1=Math.min(w-1,Math.ceil(Math.max(p[0],q[0],r[0])));
  const y0=Math.max(0,Math.floor(Math.min(p[1],q[1],r[1]))),y1=Math.min(h-1,Math.ceil(Math.max(p[1],q[1],r[1])));
  budget.remaining-=Math.max(0,x1-x0+1)*Math.max(0,y1-y0+1);
  if(budget.remaining<0)throw new Error('Projection raster budget exceeded. Use a lower-poly model or a smaller view size.');
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const a=((q[1]-r[1])*(x+.5-r[0])+(r[0]-q[0])*(y+.5-r[1]))/den;
    const b=((r[1]-p[1])*(x+.5-r[0])+(p[0]-r[0])*(y+.5-r[1]))/den,c=1-a-b;
    if(a>=-1e-6&&b>=-1e-6&&c>=-1e-6)visit(x,y,a,b,c);
  }
}
function projected(p:V3,frame:Pick<Frame,'direction'|'right'|'up'>,center:V3,radius:number,size:number):V3{
  const v=sub(p,center);return [(dot(v,frame.right)/(2*radius)+.5)*size,(.5-dot(v,frame.up)/(2*radius))*size,dot(v,frame.direction)];
}
function collect(root:THREE.Object3D,material:THREE.MeshStandardMaterial){
  root.updateWorldMatrix(true,true);
  const triangles:Triangle[]=[];
  const bounds=new THREE.Box3(),position=new THREE.Vector3(),uv=new THREE.Vector2();
  const map=material.map,channel=map?.channel??0;
  if(map?.matrixAutoUpdate)map.updateMatrix();
  let unsupported=false;
  root.traverseVisible(node=>{
    if(!(node instanceof THREE.Mesh))return;
    if(node instanceof THREE.SkinnedMesh||node instanceof THREE.InstancedMesh||node.morphTargetInfluences?.some(v=>v!==0)){unsupported=true;return;}
    const geo=node.geometry,positions=geo.getAttribute('position'),uvs=geo.getAttribute(channel?'uv'+channel:'uv');
    if(!positions)return;
    const count=geo.index?.count??positions.count;
    const mats=Array.isArray(node.material)?node.material:[node.material];
    const groups=Array.isArray(node.material)?geo.groups:[{start:0,count,materialIndex:0}];
    const index=(i:number)=>geo.index?geo.index.getX(i):i;
    for(const group of groups){
      const mat=mats[group.materialIndex??0];if(!mat||!mat.visible)continue;
      const selected=mat===material;
      if(selected&&!uvs)throw new Error('Selected surface has no usable UV coordinates.');
      const start=Math.max(group.start,geo.drawRange.start),end=Math.min(count,group.start+group.count,geo.drawRange.start+geo.drawRange.count);
      for(let i=start;i+2<end;i+=3){
        if(triangles.length>=50000)throw new Error('360° projection is limited to 50,000 visible triangles in this version.');
        const p=[0,1,2].map(j=>{position.fromBufferAttribute(positions,index(i+j)).applyMatrix4(node.matrixWorld);bounds.expandByPoint(position);return position.toArray() as V3;}) as [V3,V3,V3];
        const normal=unit(cross(sub(p[1],p[0]),sub(p[2],p[0])));
        if(!Math.hypot(...normal))continue;
        let coords:Triangle['uv'];
        if(selected)coords=[0,1,2].map(j=>{
          uv.fromBufferAttribute(uvs!,index(i+j));
          if(map){uv.applyMatrix3(map.matrix);if(map.flipY)uv.y=1-uv.y;}
          if(uv.x<-.0001||uv.x>1.0001||uv.y<-.0001||uv.y>1.0001)throw new Error('Projection requires UVs within one texture tile. Repeating/wrapped UVs are not supported.');
          return [Math.max(0,Math.min(1,uv.x)),Math.max(0,Math.min(1,uv.y))] as V2;
        }) as [V2,V2,V2];
        triangles.push({p,normal,uv:coords});
      }
    }
  });
  if(unsupported)throw new Error('Projection supports static meshes only; skinned, instanced or actively morphed geometry is not supported.');
  if(!triangles.some(t=>t.uv)||bounds.isEmpty())throw new Error('No visible selected UV triangles.');
  const center=bounds.getCenter(new THREE.Vector3()).toArray() as V3;
  const radius=Math.max(.0001,bounds.getSize(new THREE.Vector3()).length()*.55);
  return {triangles,center,radius};
}
export async function captureProjection(root:THREE.Object3D,material:THREE.MeshStandardMaterial,source:HTMLCanvasElement,signal:AbortSignal,size=512):Promise<ProjectionCapture>{
  if(!Number.isInteger(size)||size<32||size>512)throw new Error('View size must be 32–512 pixels.');
  const {triangles,center,radius}=collect(root,material);
  const scale=Math.min(1,1024/Math.max(source.width,source.height)),width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));
  const sample=makeCanvas(width,height);ctx(sample).drawImage(source,0,0,width,height);
  const pixels=ctx(sample).getImageData(0,0,width,height).data;sample.width=sample.height=1;
  const frames:Frame[]=[];
  for(const name of VIEW_NAMES){
    signal.throwIfAborted();await yieldTask();
    const direction=directions[name],up0:V3=name==='Top'?[0,0,-1]:name==='Bottom'?[0,0,1]:[0,1,0];
    const right=unit(cross(up0,direction)),up=unit(cross(direction,right));
    const axes={direction,right,up};
    const depth=new Float32Array(size*size);depth.fill(-Infinity);
    const canvas=makeCanvas(size,size),context=ctx(canvas),data=context.createImageData(size,size);
    const budget={remaining:15000000};
    for(const t of triangles){
      const p=t.p.map(v=>projected(v,axes,center,radius,size)) as [V3,V3,V3];
      raster(p.map(v=>[v[0],v[1]]) as [V2,V2,V2],size,size,(x,y,a,b,c)=>{
        const index=y*size+x,z=p[0][2]*a+p[1][2]*b+p[2][2]*c;if(z<=depth[index])return;
        let red=90,green=90,blue=90;
        if(t.uv){
          const u=t.uv[0][0]*a+t.uv[1][0]*b+t.uv[2][0]*c,v=t.uv[0][1]*a+t.uv[1][1]*b+t.uv[2][1]*c;
          const i=(Math.min(height-1,Math.floor(v*height))*width+Math.min(width-1,Math.floor(u*width)))*4;
          // Alpha cutouts are not treated as geometric holes.
          red=pixels[i];green=pixels[i+1];blue=pixels[i+2];
        }
        depth[index]=z;data.data[index*4]=red;data.data[index*4+1]=green;data.data[index*4+2]=blue;data.data[index*4+3]=255;
      },budget);
    }
    context.putImageData(data,0,0);const guide=canvas.toDataURL('image/png');canvas.width=canvas.height=1;
    frames.push({name,...axes,depth,guide});
  }
  return {frames,triangles,center,radius,size,width,height};
}
async function readView(url:string,size:number){
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Invalid view image.'));img.src=url;});
  if(image.width!==image.height||image.width>4096)throw new Error('View images must be square and no larger than 4096px.');
  const c=makeCanvas(size,size),context=ctx(c);context.drawImage(image,0,0,size,size);const data=context.getImageData(0,0,size,size).data;c.width=c.height=1;return data;
}
export async function projectViews(capture:ProjectionCapture,images:Partial<Record<ViewName,string>>,signal:AbortSignal):Promise<ProjectionResult>{
  const {width:w,height:h,size,center,radius,triangles}=capture,n=w*h;
  const views=await Promise.all(capture.frames.filter(f=>images[f.name]).map(async frame=>({frame,pixels:await readView(images[frame.name]!,size)})));
  if(!views.length)throw new Error('Add at least one aligned view image.');
  const occupied=new Uint8Array(n),ambiguous=new Uint8Array(n),positions=new Float32Array(n*3),result=new Uint8ClampedArray(n*4);
  const budget={remaining:20000000},tolerance=radius/size*4;
  let processed=0;
  for(const t of triangles){
    if(!t.uv)continue;
    if(++processed%256===0){signal.throwIfAborted();await yieldTask();}
    const uv=t.uv.map(v=>[v[0]*w,v[1]*h]) as [V2,V2,V2];
    raster(uv,w,h,(x,y,a,b,c)=>{
      const i=y*w+x,p=mix(t.p,a,b,c);
      if(occupied[i]){
        const d=Math.hypot(p[0]-positions[i*3],p[1]-positions[i*3+1],p[2]-positions[i*3+2]);
        if(d>tolerance||ambiguous[i]){ambiguous[i]=1;result[i*4+3]=0;return;}
      }else{occupied[i]=1;positions.set(p,i*3);}
      let sum=0,r=0,g=0,bv=0;
      for(const {frame,pixels} of views){
        const facing=dot(t.normal,frame.direction);if(facing<.12)continue;
        const q=projected(p,frame,center,radius,size),vx=Math.floor(q[0]),vy=Math.floor(q[1]);
        if(vx<0||vy<0||vx>=size||vy>=size)continue;
        const vi=vy*size+vx;
        if(!Number.isFinite(frame.depth[vi])||Math.abs(frame.depth[vi]-q[2])>tolerance)continue;
        const weight=Math.pow(facing,4)*pixels[vi*4+3]/255;if(!weight)continue;
        sum+=weight;r+=pixels[vi*4]*weight;g+=pixels[vi*4+1]*weight;bv+=pixels[vi*4+2]*weight;
      }
      if(sum){result[i*4]=r/sum;result[i*4+1]=g/sum;result[i*4+2]=bv/sum;result[i*4+3]=255;}
    },budget);
  }
  signal.throwIfAborted();
  let total=0,covered=0,overlap=0;
  for(let i=0;i<n;i++)if(occupied[i]){total++;if(ambiguous[i])overlap++;else if(result[i*4+3])covered++;}
  if(!covered)throw new Error('No visible UV pixels matched the supplied views.');
  // Extend colors only outside UV islands by two texels; never fill occluded or ambiguous UVs.
  for(let pass=0;pass<2;pass++){
    const before=new Uint8ClampedArray(result);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x;if(occupied[i]||before[i*4+3])continue;
      const neighbors=[...(x?[i-1]:[]),...(x+1<w?[i+1]:[]),...(y?[i-w]:[]),...(y+1<h?[i+w]:[])];
      const k=neighbors.find(j=>before[j*4+3]);if(k!==undefined)result.set(before.subarray(k*4,k*4+4),i*4);
    }
  }
  const canvas=makeCanvas(w,h),context=ctx(canvas),data=context.createImageData(w,h);data.data.set(result);context.putImageData(data,0,0);
  const image=canvas.toDataURL('image/png');canvas.width=canvas.height=1;
  return {image,coverage:covered/Math.max(1,total),ambiguous:overlap,covered,total};
}
