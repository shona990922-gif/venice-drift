import { BufferGeometry, CatmullRomCurve3, ConeGeometry, Euler, Float32BufferAttribute, Group, Line, LineBasicMaterial, Matrix4, Mesh, MeshStandardMaterial, Path, Quaternion, Shape, ShapeGeometry, ShapeUtils, TubeGeometry, Vector2, Vector3 } from 'three';
import { RouteController, ROUTE } from '../journey/RouteController';
import { BoatController } from '../journey/BoatController';
import { GeometryBatch } from './GeometryBatch';
import { VenetianKit, rand, type FacadeSpec } from './VenetianKit';
import { buildHeroBridge } from './HeroBridge';
import type { PBRSet } from './Materials';
export const HERO_LENGTH=125;
// Twelve authored elevations. This is a spatial/art study, not a surveyed reconstruction.
export const FACADES:FacadeSpec[]=[
 {name:'Casa delle Tende',s:3,side:-1,width:19,height:13.2,color:2,floors:[1.3,4.6,8.0,10.7],columns:[-7,-4.2,-1.35,2.3,6.6],type:'house',seed:10},
 {name:'Palazzo del Melograno',s:18.4,side:-1,width:11.2,height:16.4,color:4,floors:[1.3,5.0,9.0,13.0],columns:[-4.1,-1.65,0,1.65,4.1],type:'gothic',seed:31},
 {name:'Casa Rosa',s:39.9,side:-1,width:23.0,height:14.4,color:1,floors:[1.5,5.0,8.4,11.6],columns:[-9.6,-6.9,-3.6,-.9,2.5,6.0,9.6],type:'house',seed:68},
 {name:'Palazzo delle Colonne',s:64.0,side:-1,width:23.5,height:16.0,color:3,floors:[1.4,5.3,9.5,13.0],columns:[-9.7,-6.5,-3,0,3,6.5,9.7],type:'palazzo',seed:99},
 {name:'Casa delle Vigne',s:90,side:-1,width:25.8,height:12.9,color:0,floors:[1.4,4.7,8.0,10.6],columns:[-10.8,-7.7,-4.6,-1.5,2,5.3,8.5,11],type:'house',seed:127},
 {name:'Palazzo dei Mori',s:118,side:-1,width:27,height:17.6,color:4,floors:[1.4,5.1,9.2,13.6],columns:[-11.4,-8,-4.6,-1.55,1.55,4.6,8,11.4],type:'gothic',seed:159},
 {name:'Palazzo del Sole',s:4.4,side:1,width:20.6,height:15.0,color:0,floors:[1.4,5.0,8.8,12.1],columns:[-8.5,-5.3,-1.65,1.65,5.3,8.5],type:'palazzo',seed:203},
 {name:'Casa dell’Acqua',s:20.0,side:1,width:9.4,height:12.3,color:3,floors:[1.4,4.6,7.7,10],columns:[-3.05,0,3.05],type:'house',seed:231},
 {name:'Palazzo Rosso',s:40.0,side:1,width:23.6,height:16.7,color:1,floors:[1.35,5.1,9.1,13.1],columns:[-9.8,-6.8,-3.3,0,3.3,6.8,9.8],type:'gothic',seed:260},
 {name:'Casa dei Pescatori',s:65,side:1,width:25,height:13.3,color:2,floors:[1.4,4.8,8.1,10.8],columns:[-10.6,-7.4,-4.2,-1,2.7,6.6,10.3],type:'house',seed:283},
 {name:'Palazzo della Riva',s:91,side:1,width:25,height:15.1,color:5,floors:[1.3,4.9,8.7,12.1],columns:[-10.3,-7,-3.4,0,3.4,7,10.3],type:'palazzo',seed:317},
 {name:'Casa del Campanile',s:117,side:1,width:26,height:13.8,color:2,floors:[1.3,4.8,8.2,11.2],columns:[-11,-7.5,-4.2,-1,2.6,6.3,9.9],type:'house',seed:344},
];
export class VeniceScene{
 readonly root=new Group();readonly routeLine:Line;readonly chunks:Group[]=[];readonly collisionMeshes:Mesh[]=[];
 readonly bridge:Group;readonly kit:VenetianKit;
 readonly bankHalfWidth=ROUTE.width/2;
 private detailGroups:Group[]=[];
 private placements:{spec:FacadeSpec;world:Matrix4}[]=[];
 constructor(readonly route:RouteController,materials:PBRSet){
  this.root.name='Venice Hero Canal / 125 m';this.kit=new VenetianKit(materials);
  for(let c=0;c<3;c++){
   const chunk=new Group();chunk.name=`Hero_${'ABC'[c]}`;this.chunks.push(chunk);this.root.add(chunk);
   const details=new Group();details.name='Near façade details';chunk.add(details);this.detailGroups.push(details);
   const b=new GeometryBatch(chunk),d=new GeometryBatch(details,false);
   for(const s of FACADES.filter(f=>Math.min(2,Math.floor(f.s/43))===c)){
    const p=route.pointAtDistance(s.s),t=route.tangentAtDistance(s.s),cross=new Vector3(-t.z,0,t.x);
    let offset=5.94;
    // A straight historic frontage must never protrude into the curved fairway.
    for(let v=-s.width/2;v<=s.width/2;v+=.4){const test=route.pointAtDistance(s.s+v);offset=Math.max(offset,5.92+test.clone().sub(p).dot(cross)*s.side);}
    const pos=p.addScaledVector(cross,s.side*offset),normal=cross.multiplyScalar(-s.side);
    const world=new Matrix4().compose(pos,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(normal.x,normal.z)),new Vector3(1,1,1));
    this.placements.push({spec:s,world:world.clone()});
    b.transform.copy(world);d.transform.copy(world);this.kit.facade(b,d,s);
   }
   this.collisionMeshes.push(...b.flush(chunk.name));d.flush('Shutters, plants and ironwork');
  }
  this.buildGround();this.buildBanks();this.closeCourtyards();
  const bridge=buildHeroBridge(route,this.kit);this.bridge=bridge.root;this.root.add(this.bridge);this.collisionMeshes.push(...bridge.collisionMeshes);
  this.dressing();this.landmark();
  const points=[];for(let s=0;s<=HERO_LENGTH;s+=.2)points.push(route.pointAtDistance(s).setY(.09));
  this.routeLine=new Line(new BufferGeometry().setFromPoints(points),new LineBasicMaterial({color:'#e8b251',depthTest:false}));this.routeLine.visible=false;this.routeLine.renderOrder=9;this.root.add(this.routeLine);
 }
 update(position:Vector3){
  // Only small hardware/foliage is culled; the reflecting skyline remains complete.
  this.detailGroups.forEach((g,i)=>g.visible=position.distanceTo(this.route.pointAtDistance(i*43+21))<79);
 }
 private buildGround(){
  const shores:Vector2[][]=[[],[]];
  for(let i=0;i<560;i++){const p=this.route.pointAtDistance(i/560*this.route.length),t=this.route.tangentAtDistance(i/560*this.route.length);for(let k=0;k<2;k++){const cross=(k===0?-1:1)*this.bankHalfWidth;shores[k].push(new Vector2(p.x-t.z*cross,-p.z-t.x*cross));}}
  shores.sort((a,b)=>Math.abs(ShapeUtils.area(b))-Math.abs(ShapeUtils.area(a)));
  const outer=new Shape([new Vector2(-220,-220),new Vector2(220,-220),new Vector2(220,220),new Vector2(-220,220)]);outer.holes.push(new Path(shores[0]));
  const b=new GeometryBatch(this.root);b.add(new ShapeGeometry([outer,new Shape(shores[1])]),this.kit.stone,new Vector3(0,.43,0),new Euler(-Math.PI/2,0,0),undefined,2);b.flush('Continuous masonry ground');
 }
 private buildBanks(){
  const b=new GeometryBatch(this.root);
  for(const side of [-1,1]){
   // Continuous submerged brickwork: individual coping stones may be irregular,
   // but the retaining wall must have no daylight holes around bends.
   const pos:number[]=[],uv:number[]=[],indices:number[]=[];
   for(let i=0;i<=640;i++){
    const s=-16+i/640*163,p=this.route.pointAtDistance(s),t=this.route.tangentAtDistance(s);
    const x=p.x-t.z*(this.bankHalfWidth+.02)*side,z=p.z+t.x*(this.bankHalfWidth+.02)*side;
    pos.push(x,-.72,z,x,.37,z);uv.push(s/2.4,-.3,s/2.4,.16);
    if(i<640){const a=i*2;if(side===1)indices.push(a,a+1,a+2,a+1,a+3,a+2);else indices.push(a,a+2,a+1,a+1,a+2,a+3);}
   }
   const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
   const m=new Mesh(g,this.kit.brick);m.receiveShadow=true;m.castShadow=true;m.layers.enable(1);this.root.add(m);
   for(let i=-16;i<148;i++){
    const ss=i*.98,p=this.route.pointAtDistance(ss),t=this.route.tangentAtDistance(ss),yaw=Math.atan2(-t.x,-t.z);
    const ahead=this.route.tangentAtDistance(ss+.98),bend=Math.acos(Math.min(1,t.dot(ahead)));
    const cross=new Vector3(-t.z,0,t.x),world=new Matrix4().compose(p.addScaledVector(cross,(this.bankHalfWidth+.13)*side),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw),new Vector3(1,1,1));b.transform.copy(world);
    const jitter=rand(i+side*31)*.036;
    b.box(this.kit.stone,.46,.17+jitter,1.02+bend*5.7,0,.33+jitter*.5,0,new Euler(0,0,(rand(i+90)-.5)*.018),2);
   }
  }
  b.flush('Individual eroded coping stones');
 }
 private closeCourtyards(){
  const b=new GeometryBatch(this.root),d=new GeometryBatch(this.root,false),k=this.kit;
  for(const side of [-1,1]){
   const bank=this.placements.filter(p=>p.spec.side===side).sort((a,b)=>a.spec.s-b.spec.s);
   for(let i=0;i<bank.length-1;i++){
    const a=bank[i],c=bank[i+1];
    const pa=new Vector3(-side*a.spec.width/2,0,0).applyMatrix4(a.world),pb=new Vector3(side*c.spec.width/2,0,0).applyMatrix4(c.world);
    const middle=pa.clone().add(pb).multiplyScalar(.5),direction=pb.clone().sub(pa),gap=direction.length();
    const t=this.route.tangentAtDistance((a.spec.s+c.spec.s)/2),outward=new Vector3(-t.z,0,t.x).multiplyScalar(side);
    // Setback closing elevation behind the narrow calle. It prevents views into
    // an infinite ground plane without building another neighbourhood.
    middle.addScaledVector(outward,3.7);
    let normal=new Vector3(-direction.z,0,direction.x).normalize();if(normal.dot(outward)>0)normal.negate();
    const world=new Matrix4().compose(middle,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(normal.x,normal.z)),new Vector3(1,1,1));b.transform.copy(world);d.transform.copy(world);
    const height=Math.min(a.spec.height,c.spec.height)-.3;
    b.box(k.walls[(a.spec.color+2)%6],gap+5,height,1.2,0,height/2,-.6);
    b.box(k.stone,gap+5.2,.22,1.4,0,height+.04,-.5);
    k.door(b,d,0,.43,1.45,2.65,true);
    for(let yy=4.8;yy<height-2;yy+=3.2)k.window(b,d,{x:0,y:yy,w:.95,h:1.8,arch:false,gothic:false,id:i*53+22,floor:2},'house');
   }
  }
  // Two shallow terminal returns close the view beyond this finite study segment.
  // Both are outside the playable 0–125 m interval and add no navigable map.
  for(const ss of [-18,151]){
   const p=this.route.pointAtDistance(ss),t=this.route.tangentAtDistance(ss),yaw=Math.atan2(-t.x,-t.z)+(ss<0?Math.PI:0);
   b.transform.compose(p,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw),new Vector3(1,1,1));d.transform.copy(b.transform);
   b.box(k.walls[ss<0?1:2],32,13.5,7,0,6.4,-3.5);b.box(k.stone,32.4,.24,7.4,0,13.3,-3.5);
   for(let x=-13;x<=13;x+=3.2)for(const y of [1.1,4.8,8.4,11])k.window(b,d,{x,y,w:1.0,h:y===11?1.6:2.1,arch:y===4.8,gothic:false,id:Math.round(x*11+y*13),floor:y===4.8?1:2},'house');
  }
  b.flush('Recessed calle closures');d.flush('Calle details');
 }
 private dressing(){
  const b=new GeometryBatch(this.root),d=new GeometryBatch(this.root,false);
  for(const [s,side]of [[8,-1],[12,-1],[18,1],[34,-1],[44,1],[48,1],[83,-1],[88,-1],[112,1]]){
   const p=this.route.pointAtDistance(s),t=this.route.tangentAtDistance(s),cross=new Vector3(-t.z,0,t.x);p.addScaledVector(cross,side*(this.bankHalfWidth-.5));
   b.cylinder(this.kit.wood,.135,.18,2.2,p.x,.38,p.z,12,new Euler(.02,0,-.018));b.cylinder(this.kit.stone,.14,.14,.075,p.x,1.50,p.z,12);
   // Hemp lashing follows the pile and has no floating endpoints.
   for(let y=.7;y<.86;y+=.045){const points=[];for(let k=0;k<=24;k++)points.push(new Vector3(p.x+Math.cos(k/24*Math.PI*2)*.145,y,p.z+Math.sin(k/24*Math.PI*2)*.145));d.add(new TubeGeometry(new CatmullRomCurve3(points),24,.016,5,false),this.kit.wood);}
   const shore=p.clone().addScaledVector(cross,side*.68);d.add(new TubeGeometry(new CatmullRomCurve3([new Vector3(p.x,.77,p.z),new Vector3((p.x+shore.x)/2,.53,(p.z+shore.z)/2),new Vector3(shore.x,.64,shore.z)]),12,.018,6,false),this.kit.wood);
  }
  b.flush('Mooring piles');d.flush('Ropes');
  const parked=new BoatController();const p=this.route.pointAtDistance(44),t=this.route.tangentAtDistance(44);p.add(new Vector3(-t.z,0,t.x).multiplyScalar(4.45));parked.root.position.copy(p);parked.root.rotation.y=Math.atan2(-t.x,-t.z)+.06;parked.root.scale.set(.8,.88,.83);parked.root.name='Moored gondola';this.root.add(parked.root);
 }
 private landmark(){
  const landmark=new Group();landmark.name='Distant Venetian campanile';this.root.add(landmark);
  // Deliberately on the first vista axis, behind the canal bend, not a new district.
  const initial=this.route.pointAtDistance(0),t=this.route.tangentAtDistance(15);landmark.position.copy(initial.addScaledVector(t,115));landmark.position.x+=3.0;
  const b=new GeometryBatch(landmark),k=this.kit;
  b.box(k.brick,4.3,29,4.3,0,14.5,0);b.box(k.stone,4.7,.45,4.7,0,1,0);
  for(const x of [-2.04,2.04])for(const z of [-2.04,2.04])b.box(k.stone,.24,28.5,.24,x,14.25,z);
  for(const y of [20.7,28.7,29.3,34.1,34.7])b.box(k.stone,4.8,.22,4.8,0,y,0);
  b.box(k.recess,3.9,4.7,3.9,0,31.7,0);
  for(const x of [-2.08,2.08])for(const z of [-2.08,2.08])b.box(k.stone,.52,4.6,.52,x,31.7,z);
  for(const side of [-1,1])for(const x of [-.73,.73]){b.cylinder(k.stone,.13,.17,3.3,x,31.45,side*2.04,12);b.cylinder(k.stone,.13,.17,3.3,side*2.04,31.45,x,12);}
  b.box(k.stone,4.92,.52,4.92,0,34.5,0);
  const copper=new MeshStandardMaterial({color:'#618475',roughness:.63,metalness:.22});b.add(new ConeGeometry(3.5,6,4),copper,new Vector3(0,37.65,0),new Euler(0,Math.PI/4,0));
  b.cylinder(k.iron,.038,.06,1.5,0,41.1,0,8);b.box(k.iron,.65,.05,.05,0,41.38,0);b.flush('Campanile');
 }
}
