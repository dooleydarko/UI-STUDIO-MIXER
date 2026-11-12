import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Product3DProject, ProductPreset } from '../types';

type Zone = { color: string; roughness: number; metalness: number };
const z = (color: string, roughness = .65, metalness = 0): Zone => ({ color, roughness, metalness });
export const DETAIL_PRESETS: Partial<Record<ProductPreset, { dimensions: [number,number,number]; zones: Record<string, Zone> }>> = {
  sneaker: { dimensions: [110,125,285], zones: { upper: z('#dfdcd6'), sole: z('#f2eee6'), outsole: z('#303033'), laces: z('#eeeeee'), trim: z('#30343d') } },
  headphones: { dimensions: [185,205,85], zones: { shell: z('#24262c', .25,.4), cushion: z('#17171a',.8), headband: z('#333238'), metal: z('#a7adb5',.25,.85), grille: z('#30343a',.5,.35) } },
  tote_bag: { dimensions: [350,400,110], zones: { body: z('#c7ae8c'), handles: z('#695343'), seam: z('#a58a70') } },
  shopping_bag: { dimensions: [300,360,120], zones: { body: z('#e4d7bf'), handles: z('#282725'), seam: z('#a89477') } },
  business_card: { dimensions: [89,51,1], zones: { front: z('#e9e4da',.5), back: z('#282828',.5), edge: z('#b6a98b',.5) } },
};

export function createDetailedProduct(project: Product3DProject, artwork?: THREE.Texture | null): THREE.Group | null {
  const definition = DETAIL_PRESETS[project.preset];
  if (!definition) return null;
  const group = new THREE.Group();
  group.name = 'product_' + project.preset;
  const materials: Record<string, THREE.MeshStandardMaterial> = {};
  for (const [name, fallback] of Object.entries(definition.zones)) {
    const zone = project.materialZones?.[name] ?? fallback;
    materials[name] = new THREE.MeshStandardMaterial({ name, color: zone.color, roughness: zone.roughness,
      metalness: zone.metalness, wireframe: project.state.showWireframe });
  }
  const mesh = (name: string, geo: THREE.BufferGeometry, zone: string, pos: [number,number,number], scale?: [number,number,number]) => {
    const object = new THREE.Mesh(geo, materials[zone]);
    object.name = name; object.position.set(...pos); if (scale) object.scale.set(...scale);
    object.castShadow = object.receiveShadow = true; group.add(object); return object;
  };
  const box = (name: string, size: [number,number,number], zone: string, pos: [number,number,number], radius = .05) =>
    mesh(name, new RoundedBoxGeometry(...size, 3, radius), zone, pos);
  const tube = (name: string, points: [number,number,number][], radius: number, zone: string) =>
    mesh(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))), 32, radius, 8, false), zone, [0,0,0]);
  const ellipsoid = (name: string, size: [number,number,number], zone: string, pos: [number,number,number]) =>
    mesh(name,new THREE.SphereGeometry(1,32,16),zone,pos,size);
  if (project.preset === 'sneaker') {
    box('rubber outsole',[.95,.13,2.2],'outsole',[0,.075,0],.06);
    box('cushioned midsole',[.96,.23,2.17],'sole',[0,.22,0],.11);
    ellipsoid('toe and vamp',[.46,.31,.8],'upper',[0,.48,.32]);
    ellipsoid('heel counter',[.43,.51,.55],'upper',[0,.61,-.53]);
    box('tongue',[.42,.10,.65],'upper',[0,.83,-.03],.05).rotation.x=-.38;
    const collar = mesh('padded collar',new THREE.TorusGeometry(.28,.09,12,32),'trim',[0,.94,-.55],[1,1.25,1]);
    collar.rotation.x=Math.PI/2;
    for(let i=0;i<6;i++){
      const p=-.20+i*.105;
      tube('lace '+(i+1),[[-.22,.83-i*.025,p],[0,.91-i*.025,p+.055],[.22,.83-i*.025,p+.10]],.025,'laces');
    }
    for(const side of [-1,1]) tube('side accent',[[side*.43,.46,-.7],[side*.46,.56,-.1],[side*.4,.45,.5]],.03,'trim');
    for(let i=0;i<12;i++) box('tread '+i,[.72,.035,.09],'outsole',[0,.018,-.9+i*.16],.015);
  } else if (project.preset === 'headphones') {
    const arch = Array.from({length:13},(_,i):[number,number,number]=>{const a=Math.PI*i/12;return [Math.cos(a)*.80,1.12+Math.sin(a)*.94,0]});
    tube('headband',arch,.105,'headband');
    tube('padded underside',arch.slice(2,-2).map(([x,y,z]):[number,number,number]=>[x,y-.07,z]),.095,'cushion');
    for(const side of [-1,1]){
      box('metal slider',[.12,.45,.14],'metal',[side*.79,1.1,0],.04);
      const shell=mesh('earcup shell',new THREE.CylinderGeometry(.41,.41,.23,40),'shell',[side*.76,.70,0],[1,1,1]);shell.rotation.z=Math.PI/2;
      const cushion=mesh('ear cushion',new THREE.TorusGeometry(.30,.13,16,40),'cushion',[side*.60,.70,0],[1,1.18,1]);cushion.rotation.y=Math.PI/2;
      const grille=mesh('driver grille',new THREE.CylinderGeometry(.27,.27,.04,32),'grille',[side*.57,.70,0]);grille.rotation.z=Math.PI/2;
    }
  } else if (project.preset === 'business_card') {
    box('card edge',[1.8,1.02,.025],'edge',[0,.54,0],.012);
    const front=mesh('front face',new THREE.PlaneGeometry(1.78,1.0),'front',[0,.54,.014]);
    const back=mesh('back face',new THREE.PlaneGeometry(1.78,1.0),'back',[0,.54,-.014]);back.rotation.y=Math.PI;
    if(artwork){materials.front.map=artwork;materials.front.color.set('#ffffff');front.material.needsUpdate=true;}
  } else {
    const w=1.5,h=1.46,d=.52,t=.045;
    box('bottom',[w,t,d],'body',[0,t/2,0],.018);
    for(const side of [-1,1]){
      box('front/back panel',[w,h,t],'body',[0,h/2,side*d/2],.02);
      box('side gusset',[t,h,d],'seam',[side*w/2,h/2,0],.02);
      const depth=side*(d/2+.015);
      tube('handle',[[ -.44,h-.06,depth],[-.48,h+.38,depth],[0,h+.63,depth],[.48,h+.38,depth],[.44,h-.06,depth]],project.preset==='tote_bag'?.055:.033,'handles');
      for(const x of [-.44,.44])box('handle reinforcement',[.12,.20,.045],'seam',[x,h-.11,depth],.015);
    }
    if(artwork){
      const m=materials.body.clone();m.name='artwork';m.map=artwork;m.color.set('#ffffff');
      const label=new THREE.Mesh(new THREE.PlaneGeometry(w-.12,h-.14),m);label.name='front artwork';label.position.set(0,h/2,d/2+t/2+.002);group.add(label);
    }
  }
  return group;
}
