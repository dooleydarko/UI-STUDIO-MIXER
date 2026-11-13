import type { Layer } from 'ag-psd';
import { type TextureCanvasSession, type TextureDocument, type TextureLayer, type LayerBlend, layerDefaults } from './textureCanvasEngine';
const BASE_NAME='Original base color (Studio Mixer)';
const MAX_BYTES=100*1024*1024;
const MAX_PIXELS=160*1024*1024/4;
const allowedBlends=new Set<string>(['normal','multiply','screen','overlay']);
function makeCanvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function ctx(c:HTMLCanvasElement){const result=c.getContext('2d');if(!result)throw new Error('Canvas unavailable.');return result;}

export async function exportTexturePsd(session:TextureCanvasSession,doc:TextureDocument):Promise<Blob>{
  const {writePsd}=await import('ag-psd');
  const {base,layers}=await session.rasterLayers(doc);
  try{
    const children:Layer[]=layers.slice().reverse().map(({layer,image,mask})=>({
      name:layer.name, canvas:image, left:0,top:0,opacity:layer.opacity,hidden:!layer.visible,
      blendMode:layer.blend??'normal',clipping:true,protected:{position:layer.locked,composite:layer.locked,transparency:layer.locked},
      ...(mask?{mask:{canvas:mask,top:0,left:0,defaultColor:255,disabled:layer.maskEnabled===false}}:{}),
    }));
    children.push({name:BASE_NAME,canvas:base,protected:{position:true,composite:true,transparency:true}});
    const bytes=writePsd({width:doc.width,height:doc.height,children,canvas:session.output},{trimImageData:false,noBackground:true});
    return new Blob([bytes],{type:'image/vnd.adobe.photoshop'});
  }finally{base.width=base.height=1;for(const item of layers){item.image.width=item.image.height=1;if(item.mask)item.mask.width=item.mask.height=1;}}
}
function specialFeatures(layer:Layer):string[]{
  const features:string[]=[];
  if(layer.children)features.push('group');
  if(layer.text)features.push('editable text');
  if(layer.adjustment)features.push('adjustment');
  if(layer.placedLayer)features.push('smart object');
  if(layer.vectorMask||layer.vectorFill||layer.vectorStroke)features.push('vector layer');
  if(layer.effects)features.push('layer effects');
  if(layer.realMask)features.push('secondary mask');
  if(layer.blendMode&&!allowedBlends.has(layer.blendMode))features.push('blend: '+layer.blendMode);
  if(layer.mask&&(layer.mask.positionRelativeToLayer||layer.mask.userMaskDensity!==undefined&&layer.mask.userMaskDensity!==1||!!layer.mask.userMaskFeather))features.push('advanced mask');
  return features;
}
function importMask(layer:Layer,w:number,h:number):string|undefined{
  const mask=layer.mask;
  if(!mask?.canvas)return undefined;
  const c=makeCanvas(w,h),context=ctx(c);
  const background=mask.defaultColor??0;
  context.fillStyle='rgb('+background+','+background+','+background+')';context.fillRect(0,0,w,h);
  context.drawImage(mask.canvas,mask.left??0,mask.top??0);
  const pixels=context.getImageData(0,0,w,h);
  for(let i=0;i<pixels.data.length;i+=4){const alpha=pixels.data[i];pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;pixels.data[i+3]=alpha;}
  context.putImageData(pixels,0,0);const url=c.toDataURL('image/png');c.width=c.height=1;return url;
}
export async function importTexturePsd(file:File,original:TextureDocument):Promise<{document:TextureDocument;report:string}>{
  if(file.size>MAX_BYTES)throw new Error('PSD exceeds 100 MB.');
  const bytes=await file.arrayBuffer();
  if(bytes.byteLength<26)throw new Error('Invalid PSD header.');
  const header=new DataView(bytes);
  if(header.getUint32(0)!==0x38425053||header.getUint16(4)!==1)throw new Error('Choose a standard PSD, not PSB.');
  const height=header.getUint32(14),width=header.getUint32(18),depth=header.getUint16(22),mode=header.getUint16(24);
  if(width!==original.width||height!==original.height)throw new Error('PSD must match selected texture dimensions: '+original.width+' × '+original.height+'.');
  if(depth!==8||mode!==3)throw new Error('Only 8-bit RGB PSD documents are supported.');
  const {readPsd}=await import('ag-psd');
  const psd=readPsd(bytes,{skipCompositeImageData:true,skipThumbnail:true,skipLinkedFilesData:true,throwForMissingFeatures:true,totalMemoryLimit:160*1024*1024});
  const layers=psd.children??[];
  if(!layers.length||layers.length>65)throw new Error('PSD must contain 1–65 root layers.');
  let rasterPixels=0;
  const problems:string[]=[];
  for(const l of layers){
    const unsupported=specialFeatures(l);
    if(!l.canvas||!l.canvas.width||!l.canvas.height)unsupported.push('no raster pixels');
    if(l.canvas&&(l.canvas.width>4096||l.canvas.height>4096))unsupported.push('oversized layer');
    if(l.mask&&!l.mask.canvas)unsupported.push('mask pixels unavailable');
    rasterPixels+=(l.canvas?.width??0)*(l.canvas?.height??0)+(l.mask?.canvas?width*height:0);
    if(unsupported.length)problems.push((l.name||'Unnamed layer')+': '+unsupported.join(', '));
  }
  if(rasterPixels>MAX_PIXELS)throw new Error('PSD exceeds the raster memory budget.');
  if(problems.length)throw new Error('PSD not imported. Unsupported features: '+problems.join('; '));
  const bottom=layers[layers.length-1];
  const roundTrip=bottom.name===BASE_NAME;
  if(roundTrip){
    if(bottom.canvas?.width!==width||bottom.canvas.height!==height||bottom.canvas.toDataURL('image/png')!==original.base||bottom.hidden||bottom.mask||(bottom.opacity??1)!==1)throw new Error('The locked Studio Mixer base was changed. Keep the original base untouched for this round-trip.');
    if(layers.slice(0,-1).some(l=>!l.clipping))throw new Error('Studio Mixer round-trip requires artwork layers clipped to the original base.');
  }else if(layers.some(l=>l.clipping))throw new Error('Custom Photoshop clipping stacks are not supported; import ordinary raster layers.');
  const editable=(roundTrip?layers.slice(0,-1):layers).reverse();
  if(editable.length>64)throw new Error('Maximum 64 editable layers.');
  const native:TextureLayer[]=editable.map(l=>{
    const image=l.canvas!;
    const maskImage=importMask(l,width,height);
    return {...layerDefaults(l.name||'PSD artwork'),kind:'image',image:image.toDataURL('image/png'),
      x:l.left??0,y:l.top??0,width:image.width,height:image.height,rotation:0,flipX:false,flipY:false,
      visible:!l.hidden,locked:!!(l.protected?.position||l.protected?.composite||l.protected?.transparency||l.transparencyProtected),
      opacity:l.opacity??1,blend:(l.blendMode??'normal') as LayerBlend,
      ...(maskImage?{maskImage,maskEnabled:!l.mask?.disabled}:{}),
    };
  });
  return {document:{...original,layers:native},report:'Imported '+native.length+' raster layers with supported masks, placement, opacity and blend modes. '+(roundTrip?'Original base verified.':'PSD layers are placed over the locked GLB base.')+' Photoshop raster layers are editable; native brush histories and original transform parameters remain in .texture.json documents.'};
}
