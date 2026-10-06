import { Euler, ExtrudeGeometry, Group, Shape, TorusGeometry, Vector3 } from 'three';
import { GeometryBatch } from './GeometryBatch';
import { VenetianKit } from './VenetianKit';
import { RouteController, ROUTE } from '../journey/RouteController';
export const bridgeUnderside=(x:number)=>.65+2.8*Math.sqrt(Math.max(0,1-(x/5.65)**2));
export function buildHeroBridge(route:RouteController,kit:VenetianKit){
 const root=new Group();root.name='Ponte della Quietudine / stone arch';
 const b=new GeometryBatch(root),d=new GeometryBatch(root,false);
 const strip=(x0:number,x1:number,offset:number,thick:number,depth:number,z:number)=>{
  const s=new Shape();s.moveTo(x0,bridgeUnderside(x0)+offset);
  const subdivisions=Math.max(6,Math.ceil((x1-x0)*12));
  for(let i=0;i<=subdivisions;i++){const x=x0+(x1-x0)*i/subdivisions;s.lineTo(x,bridgeUnderside(x)+offset+thick);}
  for(let i=subdivisions;i>=0;i--){const x=x0+(x1-x0)*i/subdivisions;s.lineTo(x,bridgeUnderside(x)+offset);}s.closePath();
  b.add(new ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:2}),kit.stone,new Vector3(0,0,z),undefined,undefined,2);
 };
 // Real voussoirs with narrow mortar joints; continuous structural barrel behind them.
 strip(-5.65,5.65,0,.50,3.7,-1.85);
 for(const z of [-1.94,1.85])for(let i=0;i<36;i++){
  const a=-Math.PI/2+i/36*Math.PI,c=-Math.PI/2+(i+1)/36*Math.PI;
  strip(Math.sin(a)*5.65,Math.sin(c)*5.65,-.035,.60,.095,z);
 }
 for(const z of [-1.91,1.68])strip(-5.7,5.7,.52,.12,.23,z);
 for(const z of [-1.71,1.71]){
  for(let i=0;i<=44;i++){
   const x=-5.56+i/44*11.12,y=bridgeUnderside(x)+.66;
   d.box(kit.iron,.027,.88,.033,x,y+.44,z);
  }
  for(let i=0;i<96;i++){
   const x=-5.56+(i+.5)/96*11.12,slope=Math.atan2(bridgeUnderside(x+.03)-bridgeUnderside(x-.03),.06);
   for(const dy of [.21,.93])d.box(kit.iron,.145,.035,.048,x,bridgeUnderside(x)+.64+dy,z,new Euler(0,0,slope));
  }
  for(let i=0;i<17;i++){
   const x=-5.1+i*.638,y=bridgeUnderside(x)+1.17;
   d.add(new TorusGeometry(.22,.017,5,18),kit.iron,new Vector3(x,y,z),new Euler(0,0,0));
  }
  // Finely moulded Istrian stone crown, echoed in the canal reflection.
  b.box(kit.stone,.42,.64,.17,0,3.74,z+Math.sign(z)*.2);
 }
 for(const side of [-1,1]){
  b.box(kit.stone,.74,1.73,4.08,side*5.70,.38,0);
  for(const z of [-1.73,1.73]){
   b.box(kit.stone,.35,1.25,.35,side*5.43,1.85,z);b.box(kit.stone,.45,.16,.45,side*5.43,2.5,z);
  }
  for(let i=0;i<6;i++)b.box(kit.stone,.48,.15*(6-i),3.6,side*(5.91+i*.47),.67+.075*(6-i),0);
 }
 const collisionMeshes=b.flush('Bridge stone');d.flush('Bridge wrought iron');
 root.position.copy(route.pointAtDistance(ROUTE.bridgeDistance));const t=route.tangentAtDistance(ROUTE.bridgeDistance);root.rotation.y=Math.atan2(-t.x,-t.z);
 return {root,collisionMeshes};
}
