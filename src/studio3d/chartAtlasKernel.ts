import createXAtlas from 'xatlas-wasm';
export interface ChartRequest{positions:Float32Array;indices:Uint32Array;resolution:number}
export interface ChartAtlas{uv:Float32Array;width:number;height:number;charts:number}
export async function computeChartAtlas(input:ChartRequest):Promise<ChartAtlas>{
  const module=await createXAtlas(),atlas=module.createAtlas();
  try{
    const code=atlas.addMesh({positions:input.positions,indices:input.indices});
    if(code!==0)throw new Error('xatlas rejected input mesh: '+code);
    atlas.generate({maxIterations:2,useInputMeshUvs:false},{resolution:input.resolution,padding:4,bilinear:true,rotateCharts:true});
    if(atlas.atlasCount!==1||!atlas.width||!atlas.height||Math.max(atlas.width,atlas.height)>4096)throw new Error('Chart packing did not produce a single bounded atlas.');
    const mesh=atlas.getMesh(0);
    if(mesh.indices.length!==input.indices.length)throw new Error('Chart engine changed the face count.');
    const uv=new Float32Array(input.indices.length*2),seen=new Uint8Array(input.indices.length);
    // Input is one unique index per source triangle corner. xref is the authoritative
    // original corner, independent of the output vertex and triangle order.
    for(const index of mesh.indices){
      const v=mesh.vertices[index],corner=v?.xref;
      if(!v||!Number.isInteger(corner)||corner<0||corner>=seen.length||seen[corner]||v.atlasIndex!==0||v.chartIndex<0)throw new Error('Chart engine produced an invalid or unassigned source corner.');
      const u=v.uv[0]/atlas.width,t=v.uv[1]/atlas.height;
      if(!Number.isFinite(u)||!Number.isFinite(t)||u<0||u>1||t<0||t>1)throw new Error('Chart UV outside atlas bounds.');
      uv[corner*2]=u;uv[corner*2+1]=t;seen[corner]=1;
    }
    if(seen.some(v=>!v))throw new Error('Chart engine omitted a source corner.');
    return {uv,width:atlas.width,height:atlas.height,charts:mesh.chartCount};
  }finally{atlas.destroy();}
}
