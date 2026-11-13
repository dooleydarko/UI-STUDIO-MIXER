import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Product3DProject } from '../types';
import { Viewport3D, type SurfacePaintTarget } from './Viewport3D';
import { StructuralHistory } from './structuralHistory';
import { unwrapChartUV, type ChartResolution } from './chartUvRemapping';
import { generateMeshUV, separateMesh, type SeparationMode } from './geometrySurfaceTools';
import { GrayOutSession, inspectSurfaces, collectUVGuide, isolateMeshMaterial } from './surfaceEditing';
import { TextureCanvasSession, type TextureDocument } from './textureCanvasEngine';
import { SurfaceWorkspace, type SurfaceHistory } from './surfaceWorkspace';
import { TextureCanvasPanel } from './TextureCanvasPanel';
import { loadStudioModel, releaseStudioModel, type ImportedStudioModel } from './glbLoader';
import { inspectMaterials, MAP_CHANNELS, replaceMaterialMap, type MapChannel } from './glbTextureSwapper';
import { encodeSceneGlb, exportSceneToGlb } from './glbExporter';
import { listSavedModels, readSavedModel, removeSavedModel, saveModelSnapshot, saveSurfaceProject, saveSurfaceDraft, readSurfaceProject, type SurfaceProjectData, type SavedModelInfo } from './modelLibrary';
import { createLocalDracoLoader } from './localDraco';
import { PRODUCT_GLB_CATALOG, fetchCatalogModel, type ProductGlbAsset } from './productCatalog';
import { estimateModelBudget, recommendQuality, downscaleModelTextures, type QualityMode, type PreviewQuality } from './modelPerformance';

interface Props {
  project: Product3DProject;
  onExit: () => void;
  initialModelId?: string;
  onSendBack?: (info:SavedModelInfo) => void;
}

const button = 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-40';
const channelNames: Record<MapChannel, string> = {
  map: 'Base color / artwork', normalMap: 'Normal', roughnessMap: 'Roughness',
  metalnessMap: 'Metalness', emissiveMap: 'Emissive', aoMap: 'Ambient occlusion',
};

export function ImportedModelStudio({ project, onExit, initialModelId, onSendBack }: Props) {
  const [model, setModel] = useState<ImportedStudioModel | null>(null);
  const [savedModels, setSavedModels] = useState<SavedModelInfo[]>([]);
  const [savedId, setSavedId] = useState<string>();
  const [libraryStatus, setLibraryStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [downloadStatus, setDownloadStatus] = useState('');
  const downloadController = useRef<AbortController | null>(null);
  const current = useRef<ImportedStudioModel | null>(null);
  const mounted = useRef(false);
  const request = useRef(0);
  const action = useRef<THREE.AnimationAction | null>(null);
  const [clipIndex, setClipIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const lastUpdate = useRef(0);
  const [materialId, setMaterialId] = useState('');
  const graySession = useRef(new GrayOutSession());
  const [grayActive, setGrayActive] = useState(false);
  const canvasRef = useRef<TextureCanvasSession | null>(null);
  const workspace=useRef(new SurfaceWorkspace());
  const canvasOwner = useRef<ImportedStudioModel | null>(null);
  const sourceFileRef = useRef<File | null>(null);
  const sourceModified = useRef(false);
  const sourceSnapshot = useRef<File | null>(null);
  const surfaceId = useRef<string | undefined>();
  const canvasDoc = useRef<TextureDocument | null>(null);
  const [initialDocument, setInitialDocument] = useState<TextureDocument | undefined>();
  const [docRevision,setDocRevision]=useState(0);
  const lastPersisted=useRef<{document:TextureDocument;lighting:Product3DProject['state']['lighting']}|null>(null);
  const onCanvasDocument = useCallback((doc:TextureDocument)=>{const session=canvasRef.current;if(session&&workspace.current.update(session,doc)){canvasDoc.current=doc;setDocRevision(v=>v+1);}},[]);
  const onCanvasHistory=useCallback((history:SurfaceHistory)=>{const session=canvasRef.current;if(session)workspace.current.updateHistory(session,history);},[]);
  const [canvasSession, setCanvasSession] = useState<TextureCanvasSession | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [paintTarget, setPaintTarget] = useState<SurfacePaintTarget | null>(null);
  const [canvasMode, setCanvasMode] = useState<'split' | '2d' | '3d'>('split');
  const [grayScope, setGrayScope] = useState<'material' | 'object'>('material');
  const [grayColor, setGrayColor] = useState('#b0b0b0');
  const [grayStrength, setGrayStrength] = useState(100);
  const [hierarchyOpen, setHierarchyOpen] = useState(false);
  const [geometryNode,setGeometryNode]=useState('');
  const [pickMode,setPickMode]=useState(false);
  const [sharpAngle,setSharpAngle]=useState(45);
  const historyRef=useRef<StructuralHistory|null>(null);
  const [geometryStatus,setGeometryStatus]=useState('');
  const [chartResolution,setChartResolution]=useState<ChartResolution>(1024);
  const chartAbort=useRef<AbortController|null>(null);
  const [chartRunning,setChartRunning]=useState(false);
  useEffect(()=>()=>chartAbort.current?.abort(),[]);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rotation, setRotation] = useState(false);
  const [qualityMode, setQualityMode] = useState<QualityMode>('auto');
  const [adaptiveQuality, setAdaptiveQuality] = useState<PreviewQuality>('balanced');
  const frameSample = useRef({ seconds: 0, frames: 0 });
  const qualityModeRef = useRef<QualityMode>('auto');
  const [fps, setFps] = useState(0);
  const [optimizationNote, setOptimizationNote] = useState('');
  const budget = React.useMemo(() => model ? estimateModelBudget(model.scene) : null, [model, revision]);
  const effectiveQuality = qualityMode === 'auto' ? adaptiveQuality : qualityMode;
  useEffect(() => {
    qualityModeRef.current = qualityMode;
    if (qualityMode === 'auto' && budget) {
      const recommendation = recommendQuality(budget);
      setAdaptiveQuality(recommendation === 'high' ? 'balanced' : recommendation);
    }
    frameSample.current = { seconds: 0, frames: 0 };
  }, [qualityMode, budget]);
  const [lighting, setLighting] = useState(project.state.lighting);
  useEffect(()=>{
    const id=surfaceId.current,doc=canvasDoc.current;
    const bindings=workspace.current.bindings(),active=canvasRef.current&&workspace.current.getBySession(canvasRef.current);
    if(!id||!doc||!active||!canvasSession||!canvasReady||busy||lastPersisted.current?.document===doc&&lastPersisted.current?.lighting===lighting)return;
    let canceled=false;
    const timer=window.setTimeout(()=>{
      void saveSurfaceDraft(id,project.id,doc,lighting,{documents:bindings,materialIndex:active.materialIndex,materialName:active.materialName}).then(timestamp=>{
        if(!canceled&&mounted.current&&surfaceId.current===id){lastPersisted.current={document:doc,lighting};setLibraryStatus('Editable draft autosaved · '+new Date(timestamp).toLocaleTimeString()+' · save project to refresh baked GLB');}
      }).catch(e=>{if(!canceled&&mounted.current)setLibraryStatus('Draft autosave failed: '+(e instanceof Error?e.message:String(e)));});
    },1400);
    return()=>{canceled=true;window.clearTimeout(timer);};
  },[docRevision,lighting,canvasSession,canvasReady,busy,project.id]);
  const viewportProject = React.useMemo(() => ({
    ...project, state: { ...project.state, rotationActive: rotation, lighting }
  }), [project, rotation, lighting]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current++; downloadController.current?.abort(); current.current = null; action.current = null; };
  }, []);
  useEffect(() => () => { if (model) { if(canvasOwner.current===model){workspace.current.restoreAll(); canvasRef.current=null;canvasOwner.current=null;} graySession.current.restoreAll(); if(historyRef.current){historyRef.current.clear();historyRef.current=null;} releaseStudioModel(model); } }, [model]);
  useEffect(()=>{if(model)historyRef.current=new StructuralHistory(model.scene);},[model]);
  useEffect(() => { listSavedModels().then(items => { if (mounted.current) setSavedModels(items); }).catch(() => { if (mounted.current) setLibraryStatus('Local model library unavailable. Export GLB files instead.'); }); }, []);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || grayActive || canvasSession) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty, grayActive, canvasSession]);

  const selectClip = (source: ImportedStudioModel, index: number) => {
    source.mixer.stopAllAction();
    action.current = null;
    setClipIndex(index);
    setTime(0);
    setPlaying(false);
    const clip = source.clips[index];
    if (!clip) return;
    const next = source.mixer.clipAction(clip);
    next.reset().play();
    next.paused = true;
    source.mixer.update(0);
    action.current = next;
  };

  const importFile = async (file?: File, libraryId?: string, asset?: ProductGlbAsset, surface?:SurfaceProjectData) => {
    if ((!file && !asset) || busy || canvasRef.current) return;
    if ((dirty || grayActive) && !window.confirm('Discard unsaved model changes and Gray Out preview?')) return;
    const id = ++request.current;
    setBusy(true);
    setError('');
    try {
      let sourceFile = file;
      if (asset) {
        const controller = new AbortController();
        downloadController.current = controller;
        const timer = window.setTimeout(() => controller.abort(), 120000);
        setDownloadStatus('Downloading ' + asset.name + '…');
        try {
          sourceFile = await fetchCatalogModel(asset, controller.signal, (bytes, total) => {
            if (mounted.current) setDownloadStatus('Downloading ' + asset.name + ' · ' + (bytes / 1048576).toFixed(1) + ' MB' + (total ? ' / ' + (total / 1048576).toFixed(1) + ' MB' : ''));
          });
        } finally {
          window.clearTimeout(timer);
          downloadController.current = null;
          if (mounted.current) setDownloadStatus('');
        }
      }
      if (!mounted.current || id !== request.current || !sourceFile) return;
      const decoder = createLocalDracoLoader();
      const loaded = await loadStudioModel(sourceFile, decoder).finally(() => decoder.dispose());
      if (asset) {
        const credit = { name: asset.name, creator: asset.credit, license: asset.license, source: asset.source, note: asset.note, modificationNotice: 'May be modified in UI Studio Mixer; see source for original.' };
        loaded.scene.userData.productCatalogCredit = credit;
        // Keep attribution on an exported node even when the exporter flattens the scene root.
        const attributionNode = new THREE.Group();
        attributionNode.name = 'Product asset attribution';
        attributionNode.userData.productCatalogCredit = credit;
        loaded.scene.add(attributionNode);
      }
      if (!mounted.current || id !== request.current) { releaseStudioModel(loaded); return; }
      graySession.current.restoreAll();
      setGrayActive(false);
      current.current = loaded;
      workspace.current=new SurfaceWorkspace();setPickMode(false);setGeometryNode('');setGeometryStatus('');sourceFileRef.current=sourceFile; sourceModified.current=!!asset;sourceSnapshot.current=null;surfaceId.current=undefined;canvasDoc.current=null;lastPersisted.current=null;setInitialDocument(undefined);
      setOptimizationNote('');
      setSavedId(surface?undefined:libraryId);
      setDirty(!libraryId);
      setLibraryStatus('');
      setModel(loaded);
      if (asset) setCatalogOpen(false);
      setMaterialId(inspectMaterials(loaded.scene)[0]?.id ?? '');
      selectClip(loaded, loaded.clips.length ? 0 : -1);
      if(surface){
        const candidate=workspace.current;
        try{
          if(surface.projectId!==project.id)throw new Error('Saved surface belongs to another Product Studio project.');
          const entries=inspectMaterials(loaded.scene);
          const entry=await candidate.reopen(entries,surface);
          if(!mounted.current||id!==request.current){candidate.restoreAll();return;}
          const {session,document:doc}=entry;
          canvasRef.current=session;canvasOwner.current=loaded;canvasDoc.current=doc;surfaceId.current=libraryId;lastPersisted.current={document:doc,lighting:surface.lighting};
          sourceSnapshot.current=sourceFile;setInitialDocument(doc);setCanvasSession(session);setCanvasMode('split');setCanvasReady(false);
          setMaterialId(entries[entry.materialIndex].id);setLighting(surface.lighting);setLibraryOpen(false);
          setLibraryStatus('Reopened '+candidate.size+' editable material document(s) · source retained');
        }catch(e){candidate.restoreAll();if(mounted.current)setError('Could not reopen editable surfaces: '+(e instanceof Error?e.message:String(e))+' The original source is still open.');}
      }
    } catch (e) {
      if (mounted.current && id === request.current) setError(e instanceof Error && e.name === 'AbortError' ? 'Product download canceled or timed out.' : e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current && id === request.current) setBusy(false);
    }
  };

  const tick = useCallback((delta: number) => {
    const source = current.current;
    const active = action.current;
    if (source) {
      frameSample.current.seconds += delta;
      frameSample.current.frames++;
      if (frameSample.current.seconds >= 2) {
        const rate = Math.round(frameSample.current.frames / frameSample.current.seconds);
        setFps(rate);
        if (qualityModeRef.current === 'auto' && rate < 24) setAdaptiveQuality((q) => q === 'high' ? 'balanced' : 'eco');
        frameSample.current = { seconds: 0, frames: 0 };
      }
    }
    if (!source || !active || active.paused) return;
    source.mixer.update(delta);
    lastUpdate.current += delta;
    if (lastUpdate.current >= 0.1) { setTime(active.time); lastUpdate.current = 0; }
  }, []);

  const catalogItems = PRODUCT_GLB_CATALOG.filter(asset => (catalogCategory === 'All' || asset.category === catalogCategory) && (asset.name + ' ' + asset.category).toLowerCase().includes(catalogQuery.toLowerCase()));
  const modelCredit = React.useMemo(() => { let credit: { name: string; creator: string; license: string; source: string; note?: string } | undefined; model?.scene.traverse(node => { const value = node.userData.productCatalogCredit; if (value && typeof value.creator === 'string' && typeof value.license === 'string' && typeof value.source === 'string') credit = value; }); return credit; }, [model]);
  const materials = React.useMemo(() => model ? inspectMaterials(model.scene) : [], [model, revision]);
  const selected = materials.find((entry) => entry.id === materialId);
  const hierarchy = React.useMemo(() => model ? inspectSurfaces(model.scene) : [], [model, revision]);
  const isolateMaterial=(nodeId:string,id:string)=>{
    if(!model||busy||grayActive||canvasSession)return;
    const entry=materials.find(m=>m.id===id);
    if(!entry||entry.meshes.length<2)return;
    if(!window.confirm('Create an independent material instance on this mesh? The original file and other meshes stay unchanged.'))return;
    try{const history=historyRef.current,before=history?.begin();const isolated=isolateMeshMaterial(model.scene,nodeId,id);if(history&&before)history.commit('Isolate material',before);sourceModified.current=true;sourceSnapshot.current=null;setMaterialId(isolated.uuid);setDirty(true);setRevision(v=>v+1);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
  };
  const refreshGeometry=()=>{
    if(!model)return;
    let count=0,triangles=0;
    model.scene.traverse(node=>{if(node instanceof THREE.Mesh){count++;triangles+=Math.floor((node.geometry.index?.count??node.geometry.getAttribute('position')?.count??0)/3);}});
    model.meshCount=count;model.triangles=triangles;
    setSavedId(undefined);sourceModified.current=true;sourceSnapshot.current=null;setDirty(true);setRevision(v=>v+1);
  };
  const generateUV=()=>{
    if(!model||!geometryNode||busy||grayActive||canvasSession)return;
    if(!window.confirm('Create a new triangle UV atlas on this mesh? Existing UV0 and mapped materials are protected. Your source file is unchanged.'))return;
    setError('');setGeometryStatus('');
    try{
      const history=historyRef.current,before=history?.begin();const result=generateMeshUV(model.scene,geometryNode,!!history);if(history&&before)history.commit('Generate UV atlas',before);
      setMaterialId(result.materialIds[0]??'');refreshGeometry();
      setGeometryStatus('Created '+result.grid+' × '+result.grid+' triangle atlas for '+result.triangles+' faces. Open Texture Canvas to edit.');
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  };
  const unwrapCharts=async()=>{
    if(!model||!geometryNode||busy||grayActive||canvasSession)return;
    if(!window.confirm('Create a chart atlas and bake the existing base-color texture onto it? The source file and other PBR maps are retained. This requires a static, single-material mesh and a free UV channel.'))return;
    const controller=new AbortController();chartAbort.current=controller;
    setBusy(true);setChartRunning(true);setError('');setGeometryStatus('Unwrapping charts and baking original base color…');
    if(action.current)action.current.paused=true;setPlaying(false);
    try{
      const history=historyRef.current,before=history?.begin();const result=await unwrapChartUV(model.scene,geometryNode,chartResolution,controller.signal,!!history);if(history&&before&&current.current===model&&mounted.current)history.commit('Unwrap chart atlas',before);
      if(!mounted.current||current.current!==model)return;
      setMaterialId(result.materialId);refreshGeometry();
      setGeometryStatus(result.charts+' charts · '+result.width+' × '+result.height+' · '+Math.round(result.coverage*100)+'% atlas utilization · UV'+result.channel+' ready. Open Texture Canvas.');
    }catch(e){if(mounted.current){setGeometryStatus(controller.signal.aborted?'Chart unwrap canceled.':'');if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}}
    finally{if(chartAbort.current===controller)chartAbort.current=null;if(mounted.current){setBusy(false);setChartRunning(false);}}
  };
  const splitGeometry=(mode:SeparationMode)=>{
    if(!model||!geometryNode||busy||grayActive||canvasSession)return;
    if(!window.confirm('Separate this mesh into '+(mode==='materials'?'material groups':mode==='sharp'?'sharp-edge surface groups':'connected parts')+'? The original node and transforms remain; save a new edited copy.'))return;
    setError('');setGeometryStatus('');
    try{
      const history=historyRef.current,before=history?.begin();const result=separateMesh(model.scene,geometryNode,mode,!!history,sharpAngle);if(history&&before)history.commit('Split '+mode,before);
      refreshGeometry();const first=result.parts[0],mat=Array.isArray(first.material)?first.material[0]:first.material;
      setMaterialId(mat.uuid);setGeometryStatus('Separated '+result.triangles+' triangles into '+result.parts.length+' independently selectable meshes. Isolate shared materials to edit them separately.');
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  };
  const selectMesh=useCallback((id:string,matId:string)=>{setGeometryNode(id);setMaterialId(matId);setGeometryStatus('');},[]);
  const moveHistory=(direction:'undo'|'redo')=>{
    if(!model||busy||grayActive||canvasSession)return;
    const history=historyRef.current;if(!history)return;
    const label=direction==='undo'?history.undoLabel:history.redoLabel;
    if(!label||!history[direction]())return;
    const node=model.scene.getObjectByProperty('uuid',geometryNode);
    if(node instanceof THREE.Mesh){const mat=Array.isArray(node.material)?node.material[0]:node.material;setMaterialId(mat.uuid);}else{setGeometryNode('');setMaterialId(inspectMaterials(model.scene)[0]?.id??'');}
    refreshGeometry();setGeometryStatus((direction==='undo'?'Undid ':'Redid ')+label);
  };
  const requestUVGuide=()=>model&&canvasRef.current?collectUVGuide(model.scene,canvasRef.current.paintMaterial):{segments:[],truncated:false};
  const applyGray = () => {
    if (!model || busy || canvasSession) return;
    const targets = grayScope === 'object' ? materials : selected ? [selected] : [];
    if (!targets.length) return;
    setError('');
    try {
      graySession.current.apply(targets.map(entry => entry.material), grayColor, grayStrength / 100);
      setGrayActive(graySession.current.active);
      setRevision(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const restoreGray = () => {
    graySession.current.restoreAll();
    setGrayActive(false);
    setRevision(v => v + 1);
  };
  const openCanvas = (id=materialId) => {
    if (!model || busy || (canvasSession&&!canvasReady)) return;
    const index=materials.findIndex(m=>m.id===id),entry=materials[index];
    if(!entry)return;
    setError('');
    const target=entry.material;
    const uv=target.map?.channel?'uv'+target.map.channel:'uv';
    let missing=false;
    model.scene.traverse(node=>{
      if(node instanceof THREE.Mesh&&(Array.isArray(node.material)?node.material:[node.material]).includes(target)&&!node.geometry.getAttribute(uv))missing=true;
    });
    if(missing){setError('Selected material has surfaces without suitable UVs. Choose the mesh in Geometry Tools and generate missing UV0, or repair mapped UVs externally.');return;}
    try{
      if(grayActive&&!window.confirm('Restore the current preview and use editable Gray Out layers in the canvas instead?'))return;
      if(grayActive)restoreGray();
      if(!canvasSession){historyRef.current?.clear();setPickMode(false);}
      const next=workspace.current.open(materials,index);
      if(canvasRef.current===next.session)return;
      setPaintTarget(null);canvasRef.current=next.session;canvasOwner.current=model;canvasDoc.current=next.document;
      setInitialDocument(next.document);setCanvasSession(next.session);setCanvasReady(false);setMaterialId(id);
      setLibraryOpen(false);setCatalogOpen(false);setCanvasMode('split');setRevision(v=>v+1);setDocRevision(v=>v+1);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  };
  const closeCanvas = () => {
    if(!window.confirm('Close all material canvases and restore original materials? Save the editable project first.'))return;
    workspace.current.restoreAll();canvasRef.current=null;canvasOwner.current=null;canvasDoc.current=null;surfaceId.current=undefined;lastPersisted.current=null;setInitialDocument(undefined);setCanvasSession(null);setCanvasReady(false);setPaintTarget(null);setRevision(v=>v+1);
  };
  const duration = model?.clips[clipIndex]?.duration ?? 0;
  const togglePlay = () => {
    if (!action.current) return;
    action.current.paused = !action.current.paused;
    setPlaying(!action.current.paused);
  };
  const seek = (value: number) => {
    const active = action.current;
    if (!model || !active) return;
    active.time = Math.max(0, Math.min(value, Math.max(0, duration - 0.00001)));
    model.mixer.update(0);
    setTime(active.time);
  };
  const swap = async (channel: MapChannel, file?: File) => {
    if (!file || !model || !selected || busy || grayActive || canvasSession) return;
    const source = model;
    setBusy(true);
    setError('');
    try {
      historyRef.current?.clear();
      await replaceMaterialMap(source.scene, selected.material, channel, file,
        () => mounted.current && current.current === source);
      if (mounted.current) { sourceModified.current=true;sourceSnapshot.current=null;setRevision((v) => v + 1); setDirty(true); }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally { if (mounted.current) setBusy(false); }
  };
  const optimizeTextures = () => {
    if (!model || busy || grayActive || canvasSession) return;
    if (!window.confirm('Downscale textures larger than 2048px? This changes the edited export, not your original file.')) return;
    setError('');
    try {
      historyRef.current?.clear();
      const count = downscaleModelTextures(model.scene, 2048);
      setOptimizationNote(count ? count + ' texture maps downscaled.' : 'No eligible oversized textures.');
      if (count) {sourceModified.current=true;sourceSnapshot.current=null;setDirty(true);}
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRevision((v) => v + 1); }
  };
  const saveSnapshot = async (sendBack=false) => {
    if (!model || busy || grayActive || (canvasSession&&!canvasReady)) return;
    setBusy(true); setError(''); setLibraryStatus('');
    if (action.current) action.current.paused = true;
    setPlaying(false);
    try {
      const blob = await encodeSceneGlb(model.scene, model.clips);
      if (blob.size > 100 * 1024 * 1024) throw new Error('Saved GLB exceeds the current 100 MB reopen limit. Downscale textures or export it instead.');
      let info:SavedModelInfo;
      const session=canvasRef.current,doc=canvasDoc.current;
      if(session&&!doc)throw new Error('Texture document is not ready.');
      if(session&&doc){
        const binding=inspectMaterials(model.scene).findIndex(entry=>entry.material===session.paintMaterial);
        if(binding<0)throw new Error('Active material no longer belongs to this model.');
        let source=sourceSnapshot.current;
        if(!source){
          if(!sourceModified.current&&sourceFileRef.current)source=sourceFileRef.current;
          else{
            workspace.current.showOriginal(true);
            try{const original=await encodeSceneGlb(model.scene,model.clips);source=new File([original],model.name.replace(/\\.(glb|gltf)$/i,'')+'-source.glb',{type:'model/gltf-binary'});}
            finally{workspace.current.showOriginal(false);}
          }
          sourceSnapshot.current=source;
        }
        if(source.size>100*1024*1024)throw new Error('Original source exceeds the local reopen limit.');
        info=await saveSurfaceProject(model.name,blob,{source,sourceName:source.name,materialIndex:binding,materialName:doc.material,document:doc,documents:workspace.current.bindings(),lighting,projectId:project.id},surfaceId.current);
        surfaceId.current=info.id;lastPersisted.current={document:doc,lighting};
      }else info=await saveModelSnapshot(model.name,blob,savedId);
      if (mounted.current) {
        if(!canvasSession)setSavedId(info.id); setDirty(false); setLibraryStatus((canvasSession?'Saved editable surface locally · ':'Saved locally · ') + new Date(info.savedAt).toLocaleTimeString());
        setSavedModels(await listSavedModels());
        if(sendBack&&info.layered){onSendBack?.(info);onExit();}
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const openSnapshot = async (id: string, baked=false) => {
    if(canvasRef.current||busy)return;
    try {
      const surface=baked?undefined:await readSurfaceProject(id);
      if(surface){if(surface.projectId!==project.id)throw new Error('Open this surface from its associated Product Studio project.');await importFile(new File([surface.source],surface.sourceName),id,undefined,surface);}
      else{const file=await readSavedModel(id);await importFile(file,baked?undefined:id);}
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e));}
  };
  useEffect(()=>{
    if(!initialModelId)return;
    let canceled=false;
    Promise.resolve().then(()=>{if(!canceled)void openSnapshot(initialModelId);});
    return()=>{canceled=true;};
  },[initialModelId]);
  const deleteSnapshot = async (id: string) => {
    if (busy || canvasRef.current || !window.confirm('Delete this saved local copy? The original file is not affected.')) return;
    try {
      await removeSavedModel(id); setSavedModels(await listSavedModels());
      if (savedId === id) { setSavedId(undefined); setDirty(true); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : String(e)); }
  };
  const exit = () => { if ((!dirty && !grayActive && !canvasSession) || window.confirm('Leave without saving this model or surface preview?')) onExit(); };
  const exportModel = async () => {
    if (!model || busy) return;
    if (canvasSession && (!canvasReady || !window.confirm('Export a baked texture GLB copy? Save editable layers separately.'))) return;
    if (grayActive && !window.confirm('Export a baked Gray Out GLB copy? The source remains unchanged, but the preview adjustment cannot be restored from the exported file.')) return;
    setBusy(true);
    setError('');
    if (action.current) action.current.paused = true;
    setPlaying(false);
    try {
      await exportSceneToGlb(model.scene, model.name.replace(/\.(glb|gltf)$/i, '') + '-edited.glb', model.clips);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally { if (mounted.current) setBusy(false); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080808] text-neutral-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
        <button className={button} onClick={exit} disabled={busy}>← Procedural studio</button>
        <div className="mr-auto"><div className="text-sm font-semibold">GLB Import Studio</div>
          <div className="text-xs text-neutral-500">Local model · PBR materials · Animation clips</div></div>
        <label className={button + (busy ? ' opacity-40' : ' cursor-pointer')}>
          Import model
          <input type="file" accept=".glb,.gltf" disabled={busy || !!canvasSession} className="hidden"
            onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void importFile(f); }} />
        </label>
        <button className={button} onClick={() => { setCatalogOpen(v=>!v); setLibraryOpen(false); }} disabled={busy || !!canvasSession}>Product GLBs ({PRODUCT_GLB_CATALOG.length})</button>
        <button className={button} onClick={() => { setLibraryOpen(v=>!v); setCatalogOpen(false); }} disabled={busy || !!canvasSession}>Library ({savedModels.length})</button>
        <button className={button+' border-sky-500/40 text-sky-300'} onClick={()=>openCanvas()} disabled={!selected || busy || !!canvasSession}>Open Texture Canvas</button>
        {canvasSession && <label className="flex items-center gap-1 text-xs">Material canvas · {workspace.current.size} open<select aria-label="Switch material canvas" className="max-w-44 rounded-lg bg-neutral-900 p-2" value={materialId} disabled={busy||!canvasReady} onChange={e=>openCanvas(e.target.value)}>{materials.map(m=><option key={m.id} value={m.id}>{workspace.current.get(m.id)?'● ':''}{m.name}</option>)}</select></label>}
        {canvasSession && <div className="flex gap-1">{(['split','2d','3d'] as const).map(mode=><button key={mode} className={button+(canvasMode===mode?' border-sky-500 text-sky-300':'')} onClick={()=>setCanvasMode(mode)}>{mode==='split'?'Split':mode==='2d'?'2D':'3D'}</button>)}</div>}
        <button className={button} onClick={()=>void saveSnapshot()} disabled={!model || busy || grayActive || (!!canvasSession&&!canvasReady)}>{canvasSession?'Save editable project':dirty?'Save model •':'Save model'}</button>
        {canvasSession&&<button className={button+' border-emerald-500/40 text-emerald-300'} disabled={busy||!canvasReady} onClick={()=>void saveSnapshot(true)}>Send Back to Product Studio</button>}
        <button className={button} onClick={exportModel} disabled={!model || busy || (!!canvasSession && !canvasReady)}>Export edited GLB</button>
      </header>
      {downloadStatus && <div role="status" className="flex items-center justify-between gap-2 bg-sky-500/10 px-4 py-2 text-xs text-sky-300"><span>{downloadStatus}</span><button className={button} onClick={()=>downloadController.current?.abort()}>Cancel download</button></div>}
      {catalogOpen && <section className="max-h-72 overflow-y-auto border-b border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto text-sm font-semibold">Product GLB library</h3>
          <input aria-label="Search products" placeholder="Search products…" className="rounded-lg bg-neutral-900 p-2 text-xs" value={catalogQuery} onChange={e=>setCatalogQuery(e.target.value)}/>
          <select aria-label="Product category" className="rounded-lg bg-neutral-900 p-2 text-xs" value={catalogCategory} onChange={e=>setCatalogCategory(e.target.value)}>{['All', ...new Set(PRODUCT_GLB_CATALOG.map(asset=>asset.category))].map(category=><option key={category}>{category}</option>)}</select>
        </div>
        <p className="text-xs text-neutral-400">Real GLB models from the Khronos collection. Download only the product you select. Save locally for offline reuse.</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">{catalogItems.map(asset=><div key={asset.id} className="rounded-xl border border-white/10 bg-white/[.025] p-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-sky-400">{asset.category} · {asset.license}</div>
          <h4 className="text-sm font-semibold">{asset.name}</h4>
          <p className="text-[10px] text-neutral-400">{asset.credit}</p>
          {asset.note && <p className="text-[10px] text-neutral-500">{asset.note}</p>}
          <div className="flex items-center gap-2"><button className={button} disabled={busy} onClick={()=>void importFile(undefined,undefined,asset)}>Load GLB</button><a className="text-xs text-sky-400" href={asset.source} target="_blank" rel="noreferrer">Source / license</a></div>
        </div>)}</div>
        {!catalogItems.length && <p className="text-xs text-neutral-500">No matching products.</p>}
      </section>}
      {libraryStatus && <div role="status" className="px-4 py-2 text-xs text-sky-300">{libraryStatus}</div>}
      {libraryOpen && <section className="max-h-52 overflow-y-auto border-b border-white/10 p-4 space-y-2"><h3 className="text-xs font-semibold">Saved models · local device</h3>{!savedModels.length && <p className="text-xs text-neutral-500">No saved models yet.</p>}{savedModels.map(item => <div key={item.id} className="flex items-center gap-2 text-xs"><span className="mr-auto truncate">{item.name} · {(item.size/1048576).toFixed(1)} MB{item.layered?' · layered':''}{item.draftSavedAt?' · newer draft':''}</span><button className={button} disabled={busy||!!canvasSession} onClick={()=>void openSnapshot(item.id)}>{item.layered?'Edit layers':'Open'}</button>{item.layered&&<button className={button} disabled={busy||!!canvasSession} onClick={()=>void openSnapshot(item.id,true)}>Open baked copy</button>}<button className={button} disabled={busy||!!canvasSession} onClick={()=>void deleteSnapshot(item.id)}>Delete</button></div>)}</section>}
      {error && <div role="alert" className="border-b border-red-500/30 bg-red-950/30 px-4 py-2 text-xs text-red-300">{error}</div>}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className={canvasSession && canvasMode==='2d' ? 'hidden' : 'relative flex-1 min-w-0'}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void importFile(e.dataTransfer.files[0]); }}>
          {model ? <Viewport3D project={viewportProject} importedGroup={model.display} onFrame={tick} quality={effectiveQuality} paintTarget={busy ? null : paintTarget} selectedMeshId={!canvasSession?geometryNode:undefined} meshPickEnabled={pickMode&&!busy&&!canvasSession&&!grayActive} onMeshPick={selectMesh} /> :
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/10">
              <span className="text-lg font-medium">Drop a 3D model here</span>
              <span className="text-xs text-neutral-500">GLB or self-contained glTF · up to 100 MB</span>
              <span className="text-xs text-neutral-500">Use Import model to browse files, or choose a ready-made product.</span>
              <button className={button} disabled={busy} onClick={()=>{setCatalogOpen(true);setLibraryOpen(false);}}>Browse product GLBs</button>
            </div>}
          {busy && <div role="status" className="absolute top-3 left-3 rounded-lg bg-black/80 px-3 py-2 text-xs">Working…</div>}
          {model && <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <select className="min-w-0 rounded-lg bg-neutral-900 p-2 text-xs" value={clipIndex}
                disabled={busy || !model.clips.length} onChange={(e) => selectClip(model, Number(e.target.value))}>
                {!model.clips.length && <option value={-1}>No animation clips</option>}
                {model.clips.map((clip, i) => <option key={i} value={i}>{clip.name || 'Clip ' + (i + 1)}</option>)}
              </select>
              <button className={button} disabled={busy || clipIndex < 0} onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
              <input aria-label="Animation timeline" className="min-w-24 flex-1 accent-sky-500" type="range" min={0} max={duration || 1}
                step={0.01} value={time} disabled={busy || !duration} onChange={(e) => seek(Number(e.target.value))} />
              <span className="text-xs tabular-nums text-neutral-400">{time.toFixed(1)} / {duration.toFixed(1)} s</span>
              <button className={button} onClick={() => setRotation((v) => !v)}>{rotation ? 'Stop turntable' : 'Turntable'}</button>
            </div>
          </div>}
        </main>
        {canvasSession && model && <div className={canvasMode==='3d'?'hidden':'min-w-0 flex-1 border-l border-white/10'}><TextureCanvasPanel root={model.scene} key={canvasSession.paintMaterial.uuid} session={canvasSession} initialDocument={initialDocument} initialHistory={workspace.current.getBySession(canvasSession)?.history} onHistory={onCanvasHistory} onDocument={onCanvasDocument} onRequestUVGuide={requestUVGuide} onClose={closeCanvas} onReady={setCanvasReady} onError={setError} onPaintTarget={setPaintTarget} busy={busy}/></div>}
        <aside className={(canvasSession?'hidden ':'')+"w-80 shrink-0 overflow-y-auto border-l border-white/10 p-4 space-y-4"}>
          <div><h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Model inspector</h3>
            <p className="mt-2 truncate text-sm" title={model?.name}>{model?.name || 'No model imported'}</p>
            {model && <p className="text-xs text-neutral-500">{model.meshCount} meshes · {model.triangles.toLocaleString()} triangles · {model.clips.length} clips</p>}
          </div>
          <div className="space-y-2 rounded-xl border border-white/10 p-3 text-xs">
            <h3 className="font-bold uppercase tracking-wider text-neutral-400">Performance</h3>
            <label className="block">Preview quality
              <select className="mt-1 w-full rounded-lg bg-neutral-900 p-2" value={qualityMode} onChange={(e) => setQualityMode(e.target.value as QualityMode)}>
                <option value="auto">Auto (Intel-friendly)</option><option value="eco">Eco</option><option value="balanced">Balanced</option><option value="high">High</option>
              </select>
            </label>
            {budget && <div className="space-y-1 text-neutral-400">
              <p>Active: {effectiveQuality} · ~{fps || '—'} FPS</p>
              <p>{budget.triangles.toLocaleString()} triangles · {budget.textureCount} maps</p>
              <p>Estimated texture memory: {(budget.estimatedTextureBytes / 1048576).toFixed(1)} MB</p>
              <p>Geometry buffers: {(budget.geometryBytes / 1048576).toFixed(1)} MB</p>
              <p>Largest texture: {budget.largestTexture}px</p>
              <button className={button + ' w-full'} disabled={busy || grayActive || !!canvasSession || budget.largestTexture <= 2048} onClick={optimizeTextures}>Downscale textures to 2K</button>
              <p className="text-neutral-500">Optional; changes exported textures. Original file stays intact.</p>
              {optimizationNote && <p role="status" className="text-sky-300">{optimizationNote}</p>}
            </div>}
          </div>
          <label className="block text-xs text-neutral-400">Lighting
            <select className="mt-1 w-full rounded-lg bg-neutral-900 p-2 text-neutral-100" value={lighting} onChange={(e) => setLighting(e.target.value as Product3DProject['state']['lighting'])}>
              <option value="studio">Studio</option><option value="neon">Neon</option><option value="daylight">Daylight</option><option value="dramatic_rim">Dramatic rim</option>
            </select>
          </label>
          {model && <section className="space-y-3 rounded-xl border border-sky-500/30 p-3 text-xs">
            <h3 className="font-semibold text-sky-300">Surface Editor · Gray Out</h3>
            <label className="block">Scope
              <select className="mt-1 w-full rounded-lg bg-neutral-900 p-2" value={grayScope} onChange={e=>setGrayScope(e.target.value as 'material' | 'object')}>
                <option value="material">Selected material</option><option value="object">Entire object (PBR materials)</option>
              </select>
            </label>
            <label className="flex items-center justify-between">Neutral color <input type="color" value={grayColor} onChange={e=>setGrayColor(e.target.value)}/></label>
            <label className="block">Intensity · {grayStrength}% <input className="block w-full accent-sky-500" type="range" min={0} max={100} value={grayStrength} onChange={e=>setGrayStrength(Number(e.target.value))}/></label>
            <div className="flex gap-2"><button className={button + ' flex-1'} disabled={busy || (grayScope === 'material' ? !selected : !materials.length)} onClick={applyGray}>{grayActive ? 'Update preview' : 'Gray Out'}</button><button className={button} disabled={busy || !grayActive} onClick={restoreGray}>Restore original</button></div>
            <p className="text-neutral-400">Base color only. Normal, roughness, metallic, geometry and alpha remain untouched. Artwork baked into other maps, vertex colors, or geometry needs separate cleanup. Shared materials affect every linked mesh.</p>
            {grayActive && <p role="status" className="text-amber-300">Edited preview active. Restore to compare or change materials; export a baked copy. Layered saving is not implemented yet.</p>}
          </section>}
          {model && <section className="rounded-xl border border-white/10 p-3 text-xs">
            <button className={button + ' w-full text-left'} onClick={()=>setHierarchyOpen(v=>!v)}>{hierarchyOpen ? 'Hide' : 'Show'} object hierarchy · {hierarchy.length} nodes</button>
            <section className="mt-2 rounded-xl border border-white/10 p-2 space-y-2">
              <strong className="text-xs">Geometry Tools</strong>
              <button className={button+' w-full '+(pickMode?'border-sky-400 text-sky-300':'')} disabled={busy||grayActive} onClick={()=>setPickMode(v=>!v)}>{pickMode?'Pick mode on · click a mesh':'Pick mesh in 3D'}</button>
              <div className="grid grid-cols-2 gap-1"><button className={button} disabled={!historyRef.current?.undoLabel||busy||grayActive} title={historyRef.current?.undoLabel} onClick={()=>moveHistory('undo')}>Undo geometry</button><button className={button} disabled={!historyRef.current?.redoLabel||busy||grayActive} title={historyRef.current?.redoLabel} onClick={()=>moveHistory('redo')}>Redo geometry</button></div>
              <p className="text-neutral-500">Geometry history lasts until opening a texture canvas, changing material maps, or reloading a model.</p>
              <select aria-label="Geometry mesh" className="w-full rounded-lg bg-neutral-900 p-2 text-xs" value={geometryNode} disabled={busy||grayActive} onChange={e=>{setGeometryNode(e.target.value);setGeometryStatus('');}}>
                <option value="">Select a mesh</option>{hierarchy.filter(n=>n.materials.length).map(n=><option key={n.id} value={n.id}>{'· '.repeat(Math.min(n.depth,5))}{n.name} ({n.uvSets.length?n.uvSets.join(', '):'no UV'})</option>)}
              </select>
              <div className="rounded-lg bg-white/5 p-2 space-y-2">
                <label className="block text-[10px] text-neutral-400">Chart atlas size<select aria-label="Chart atlas resolution" className="w-full rounded bg-neutral-900 p-1" value={chartResolution} disabled={busy} onChange={e=>setChartResolution(Number(e.target.value) as ChartResolution)}>{[512,1024,2048].map(n=><option key={n} value={n}>{n}px</option>)}</select></label>
                <button className={button+' w-full border-sky-500/40 text-sky-300'} disabled={!geometryNode||busy||grayActive} onClick={()=>void unwrapCharts()}>Unwrap charts + preserve artwork</button>
                {chartRunning&&<button className={button+' w-full'} onClick={()=>chartAbort.current?.abort()}>Cancel unwrap</button>}
                <p className="text-neutral-500">xatlas charts with independent UV0/UV1 artwork. Original PBR channels and existing UV coordinates are retained.</p>
              </div>
              <button className={button+' w-full'} disabled={!geometryNode||busy||grayActive} onClick={generateUV}>Generate missing UV0 (simple atlas)</button>
              <div className="grid grid-cols-2 gap-1"><button className={button} disabled={!geometryNode||busy||grayActive} onClick={()=>splitGeometry('materials')}>Split materials</button><button className={button} disabled={!geometryNode||busy||grayActive} onClick={()=>splitGeometry('connected')}>Split connected parts</button></div>
              <label className="block text-xs text-neutral-400">Sharp edge angle · {sharpAngle}°<input type="range" min={10} max={170} step={5} value={sharpAngle} disabled={busy||grayActive} className="w-full" onChange={e=>setSharpAngle(Number(e.target.value))}/></label>
              <button className={button+' w-full'} disabled={!geometryNode||busy||grayActive} onClick={()=>splitGeometry('sharp')}>Split sharp-edge surfaces</button>
              <button className={button+' w-full'} disabled={!sourceFileRef.current||busy||grayActive} onClick={()=>{const original=sourceFileRef.current;if(original)void importFile(original);}}>Reload imported source</button>
              <p className="text-neutral-500">Static meshes only. Chart unwrapping uses xatlas; simple atlas is a per-triangle fallback. Splitting keeps geometry attributes and original transforms; connected parts use exact coincident vertices.</p>
              {geometryStatus&&<p role="status" className="text-sky-300">{geometryStatus}</p>}
            </section>
            {hierarchyOpen && <div className="mt-2 max-h-64 overflow-auto space-y-1">{hierarchy.map(node=><div key={node.id} style={{paddingLeft: Math.min(node.depth, 10)*8}}><div className="break-all text-neutral-200">{node.name}</div><div className="text-neutral-500">{node.kind}{node.uvSets.length ? ' · '+node.uvSets.join(', ') : ''}{node.groups ? ' · '+node.groups+' groups' : ''}</div>{node.materials.filter(id=>materials.some(m=>m.id===id)).map((id,i)=><div key={id+'-'+i} className="flex flex-wrap items-center gap-1"><button className="text-left text-sky-300 hover:underline" onClick={()=>setMaterialId(id)}>{materials.find(m=>m.id===id)?.name}</button>{(materials.find(m=>m.id===id)?.meshes.length??0)>1&&<button className="text-[10px] text-amber-300 hover:underline" disabled={busy||grayActive} onClick={()=>isolateMaterial(node.id,id)}>Isolate on mesh</button>}</div>)}</div>)}</div>}
          </section>}
          <div className="border-t border-white/10 pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">PBR material library</h3>
            <select aria-label="Material" className="w-full rounded-lg bg-neutral-900 p-2 text-xs" value={materialId}
              disabled={busy || !materials.length} onChange={(e) => setMaterialId(e.target.value)}>
              {!materials.length && <option value="">No supported PBR materials</option>}
              {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
            {selected && <div className="mt-3 space-y-3">
              <p className="break-words text-xs text-neutral-500">Shared by: {selected.meshes.join(', ')}</p>
              <label className="flex items-center justify-between text-xs">Color tint
                <input type="color" disabled={busy || grayActive} value={'#' + selected.material.color.getHexString()}
                  onChange={(e) => { selected.material.color.set(e.target.value); sourceModified.current=true;sourceSnapshot.current=null;setRevision((v) => v + 1); setDirty(true); }} />
              </label>
              {(['roughness', 'metalness'] as const).map((key) => <label key={key} className="block text-xs capitalize">
                {key} · {selected.material[key].toFixed(2)}
                <input className="block w-full accent-sky-500" type="range" min={0} max={1} step={0.01}
                  disabled={busy || grayActive} value={selected.material[key]} onChange={(e) => {
                    selected.material[key] = Number(e.target.value); sourceModified.current=true;sourceSnapshot.current=null;setRevision((v) => v + 1); setDirty(true);
                  }} />
              </label>)}
              {MAP_CHANNELS.map((channel) => <div key={channel} className="rounded-xl border border-white/10 p-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>{channelNames[channel]}</span>
                  <span className="text-neutral-500">{selected.material[channel] ? 'Mapped' : 'Empty'}</span>
                </div>
                <label className="mt-2 block cursor-pointer rounded-lg bg-white/5 p-2 text-center text-xs text-sky-300">
                  Replace image
                  <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || grayActive} className="hidden"
                    onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void swap(channel, f); }} />
                </label>
              </div>)}
            </div>}
          </div>
          {modelCredit && <div className="rounded-xl border border-white/10 p-3 text-xs space-y-1"><h3 className="font-semibold">Model attribution</h3><p>{modelCredit.name} · {modelCredit.creator}</p><p>{modelCredit.license}</p><p>{modelCredit.note}</p>{modelCredit.source.startsWith('https://github.com/KhronosGroup/glTF-Sample-Assets/') && <a href={modelCredit.source} target="_blank" rel="noreferrer" className="text-sky-400">Original source and license</a>}<p className="text-neutral-500">Retain attribution when sharing edited models.</p></div>}
          <p className="text-xs text-neutral-500">Save model to reopen locally, or export an edited GLB for a portable backup. The library is device-local and not synced.</p>
        </aside>
      </div>
    </div>
  );
}
