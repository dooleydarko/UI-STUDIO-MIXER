import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Product3DProject } from '../types';
import { Viewport3D } from './Viewport3D';
import { loadStudioModel, releaseStudioModel, type ImportedStudioModel } from './glbLoader';
import { inspectMaterials, MAP_CHANNELS, replaceMaterialMap, type MapChannel } from './glbTextureSwapper';
import { exportSceneToGlb } from './glbExporter';

interface Props {
  project: Product3DProject;
  onExit: () => void;
}

const button = 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-40';
const channelNames: Record<MapChannel, string> = {
  map: 'Base color / artwork', normalMap: 'Normal', roughnessMap: 'Roughness',
  metalnessMap: 'Metalness', emissiveMap: 'Emissive', aoMap: 'Ambient occlusion',
};

export function ImportedModelStudio({ project, onExit }: Props) {
  const [model, setModel] = useState<ImportedStudioModel | null>(null);
  const current = useRef<ImportedStudioModel | null>(null);
  const mounted = useRef(false);
  const request = useRef(0);
  const action = useRef<THREE.AnimationAction | null>(null);
  const [clipIndex, setClipIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const lastUpdate = useRef(0);
  const [materialId, setMaterialId] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rotation, setRotation] = useState(false);
  const [lighting, setLighting] = useState(project.state.lighting);
  const viewportProject = React.useMemo(() => ({
    ...project, state: { ...project.state, rotationActive: rotation, lighting }
  }), [project, rotation, lighting]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current++; current.current = null; action.current = null; };
  }, []);
  useEffect(() => () => { if (model) releaseStudioModel(model); }, [model]);

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

  const importFile = async (file?: File) => {
    if (!file || busy) return;
    const id = ++request.current;
    setBusy(true);
    setError('');
    try {
      const loaded = await loadStudioModel(file);
      if (!mounted.current || id !== request.current) { releaseStudioModel(loaded); return; }
      current.current = loaded;
      setModel(loaded);
      setMaterialId(inspectMaterials(loaded.scene)[0]?.id ?? '');
      selectClip(loaded, loaded.clips.length ? 0 : -1);
    } catch (e) {
      if (mounted.current && id === request.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current && id === request.current) setBusy(false);
    }
  };

  const tick = useCallback((delta: number) => {
    const source = current.current;
    const active = action.current;
    if (!source || !active || active.paused) return;
    source.mixer.update(delta);
    lastUpdate.current += delta;
    if (lastUpdate.current >= 0.1) { setTime(active.time); lastUpdate.current = 0; }
  }, []);

  const materials = React.useMemo(() => model ? inspectMaterials(model.scene) : [], [model, revision]);
  const selected = materials.find((entry) => entry.id === materialId);
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
    if (!file || !model || !selected || busy) return;
    const source = model;
    setBusy(true);
    setError('');
    try {
      await replaceMaterialMap(source.scene, selected.material, channel, file,
        () => mounted.current && current.current === source);
      if (mounted.current) setRevision((v) => v + 1);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally { if (mounted.current) setBusy(false); }
  };
  const exportModel = async () => {
    if (!model || busy) return;
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
        <button className={button} onClick={onExit} disabled={busy}>← Procedural studio</button>
        <div className="mr-auto"><div className="text-sm font-semibold">GLB Import Studio</div>
          <div className="text-xs text-neutral-500">Local model · PBR materials · Animation clips</div></div>
        <label className={button + (busy ? ' opacity-40' : ' cursor-pointer')}>
          Import model
          <input type="file" accept=".glb,.gltf" disabled={busy} className="hidden"
            onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void importFile(f); }} />
        </label>
        <button className={button} onClick={exportModel} disabled={!model || busy}>Export edited GLB</button>
      </header>
      {error && <div role="alert" className="border-b border-red-500/30 bg-red-950/30 px-4 py-2 text-xs text-red-300">{error}</div>}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="relative flex-1 min-w-0"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void importFile(e.dataTransfer.files[0]); }}>
          {model ? <Viewport3D project={viewportProject} importedGroup={model.display} onFrame={tick} /> :
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/10">
              <span className="text-lg font-medium">Drop a 3D model here</span>
              <span className="text-xs text-neutral-500">GLB or self-contained glTF · up to 100 MB</span>
              <span className="text-xs text-neutral-500">Use the Import model button to browse files.</span>
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
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 p-4 space-y-4">
          <div><h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Model inspector</h3>
            <p className="mt-2 truncate text-sm" title={model?.name}>{model?.name || 'No model imported'}</p>
            {model && <p className="text-xs text-neutral-500">{model.meshCount} meshes · {model.triangles.toLocaleString()} triangles · {model.clips.length} clips</p>}
          </div>
          <label className="block text-xs text-neutral-400">Lighting
            <select className="mt-1 w-full rounded-lg bg-neutral-900 p-2 text-neutral-100" value={lighting} onChange={(e) => setLighting(e.target.value as Product3DProject['state']['lighting'])}>
              <option value="studio">Studio</option><option value="neon">Neon</option><option value="daylight">Daylight</option><option value="dramatic_rim">Dramatic rim</option>
            </select>
          </label>
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
                <input type="color" disabled={busy} value={'#' + selected.material.color.getHexString()}
                  onChange={(e) => { selected.material.color.set(e.target.value); setRevision((v) => v + 1); }} />
              </label>
              {(['roughness', 'metalness'] as const).map((key) => <label key={key} className="block text-xs capitalize">
                {key} · {selected.material[key].toFixed(2)}
                <input className="block w-full accent-sky-500" type="range" min={0} max={1} step={0.01}
                  disabled={busy} value={selected.material[key]} onChange={(e) => {
                    selected.material[key] = Number(e.target.value); setRevision((v) => v + 1);
                  }} />
              </label>)}
              {MAP_CHANNELS.map((channel) => <div key={channel} className="rounded-xl border border-white/10 p-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>{channelNames[channel]}</span>
                  <span className="text-neutral-500">{selected.material[channel] ? 'Mapped' : 'Empty'}</span>
                </div>
                <label className="mt-2 block cursor-pointer rounded-lg bg-white/5 p-2 text-center text-xs text-sky-300">
                  Replace image
                  <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="hidden"
                    onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void swap(channel, f); }} />
                </label>
              </div>)}
            </div>}
          </div>
          <p className="text-xs text-neutral-500">Imported edits are session-only. Export an edited GLB before leaving.</p>
        </aside>
      </div>
    </div>
  );
}
