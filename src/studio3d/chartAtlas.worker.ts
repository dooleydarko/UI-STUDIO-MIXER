import {computeChartAtlas,type ChartRequest} from './chartAtlasKernel';
self.addEventListener('message',async(event:MessageEvent<ChartRequest>)=>{
  try{const result=await computeChartAtlas(event.data);self.postMessage({ok:true,result});}
  catch(e){self.postMessage({ok:false,error:e instanceof Error?e.message:String(e)});}
});
