import {BufferGeometry,Float32BufferAttribute,Group,Mesh,Euler,Vector3,Shape,ExtrudeGeometry,SphereGeometry,LatheGeometry,Vector2,InstancedMesh,CylinderGeometry,Matrix4,Quaternion,MeshStandardMaterial} from 'three';
import {RouteController,ROUTE} from '../journey/RouteController';
import {GeometryBatch} from './GeometryBatch';
import {VenetianKit} from './VenetianKit';
export class JourneyScenery {
 readonly root=new Group();readonly bridges:Group[]=[];readonly collision:Mesh[]=[];readonly landmark=new Group();
 constructor(readonly route:RouteController,readonly kit:VenetianKit){this.banks();for(const bridge of ROUTE.bridges){const g=this.bridge(bridge.distance,bridge.style);this.bridges.push(g);this.root.add(g);}this.church();this.poles();}
 private banks(){const n=Math.ceil((this.route.length+38)/.55),b=new GeometryBatch(this.root);for(const side of [-1,1]){const pos:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let i=0;i<=n;i++){const s=-18+(this.route.length+38)*i/n,p=this.route.pointAtDistance(s),t=this.route.tangentAtDistance(s),w=this.route.widthAt(s)/2;
   const x=p.x-t.z*(w+.05)*side,z=p.z+t.x*(w+.05)*side;pos.push(x,-.95,z,x,.36,z);uv.push(s/2.4,-.4,s/2.4,.15);if(i<n){const a=i*2;if(side===1)idx.push(a,a+1,a+2,a+1,a+3,a+2);else idx.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(pos,3));geo.setAttribute('uv',new Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const m=new Mesh(geo,this.kit.brick);m.castShadow=true;m.receiveShadow=true;m.layers.enable(1);this.root.add(m);
  for(let s=-18;s<this.route.length+18;s+=1.4){const p=this.route.pointAtDistance(s),t=this.route.tangentAtDistance(s),c=new Vector3(-t.z,0,t.x),yaw=Math.atan2(-t.x,-t.z);p.addScaledVector(c,(this.route.widthAt(s)/2+.2)*side);b.transform.makeRotationY(yaw).setPosition(p);
   b.box(this.kit.stone,.55,.20,1.47,0,.32,0,new Euler(0,0,Math.sin(s*2)*.012),2.2);
   // Quay strip follows the canal instead of an infinite horizontal plane.
   b.box(this.kit.stone,9,.16,1.49,side*4.55,.15,0);
  }
 }b.flush('Quay and eroded coping');}
 private bridge(distance:number,style:number){const root=new Group(),b=new GeometryBatch(root),d=new GeometryBatch(root,false);const width=this.route.widthAt(distance)+.9,span=width/2,arch=style===0?3.7:style===1?3.3:6.1,base=.45,depth=style===1?2.7:3.7,thick=style===2?.65:.48;
  const y=(x:number)=>base+arch*Math.sqrt(Math.max(0,1-(x/span)**2));const shape=new Shape();shape.moveTo(-span,base);for(let i=0;i<=80;i++){const x=-span+i/80*width;shape.lineTo(x,y(x)+thick);}for(let i=80;i>=0;i--){const x=-span+i/80*width;shape.lineTo(x,y(x));}shape.closePath();
  b.add(new ExtrudeGeometry(shape,{depth,bevelEnabled:false}),style===1?this.kit.brick:this.kit.stone,new Vector3(0,0,-depth/2));
  for(const z of [-depth/2-.06,depth/2+.06]){
   for(let i=0;i<48;i++){const x=-span+(i+.5)/48*width,slope=Math.atan2(y(Math.min(span,x+.02))-y(Math.max(-span,x-.02)),.04);
    b.box(this.kit.stone,width/48+.012,.20,.20,x,y(x)+.12,z,new Euler(0,0,slope),2);
    if(style===2){d.cylinder(this.kit.stone,.047,.065,.83,x,y(x)+thick+.47,z,7);d.box(this.kit.stone,width/48+.02,.13,.30,x,y(x)+thick+.97,z,new Euler(0,0,slope));}
    else{d.box(this.kit.iron,.031,.91,.036,x,y(x)+thick+.49,z);for(const dy of [.18,.96])d.box(this.kit.iron,width/48+.05,.042,.048,x,y(x)+thick+dy,z,new Euler(0,0,slope));}
   }
  }
  for(const side of [-1,1]){b.box(this.kit.stone,.9,1.8,depth+.5,side*span,.25,0);for(let i=0;i<7;i++)b.box(this.kit.stone,.48,.16*(7-i),depth,side*(span+.3+i*.46),.37+.08*(7-i),0);}
  this.collision.push(...b.flush('Bridge '+style));d.flush('Bridge railing '+style);root.position.copy(this.route.pointAtDistance(distance));const t=this.route.tangentAtDistance(distance);root.rotation.y=Math.atan2(-t.x,-t.z);root.name=ROUTE.bridges[style].name;return root;
 }
 private church(){const k=this.kit,b=new GeometryBatch(this.landmark),d=new GeometryBatch(this.landmark,false);const p=this.route.pointAtDistance(ROUTE.landmarkDistance),t=this.route.tangentAtDistance(ROUTE.landmarkDistance),cross=new Vector3(-t.z,0,t.x);this.landmark.position.copy(p.addScaledVector(cross,22));this.landmark.rotation.y=Math.atan2(-t.x,-t.z);this.root.add(this.landmark);
  b.box(k.stone,23,.70,25,0,0,-5);b.box(k.stone,5.2,1.1,7,-12,.03,-7);
  b.box(k.walls[3],18,13,14,0,6.5,-5);b.box(k.stone,19,.65,15,0,13.2,-5);b.cylinder(k.stone,6.1,6.4,3.1,0,14.5,-5,32);
  const points=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI/2;points.push(new Vector2(Math.cos(a)*6.2,Math.sin(a)*8.1));}b.add(new LatheGeometry(points,48),k.roof,new Vector3(0,15.9,-5));b.cylinder(k.stone,.65,.85,2.5,0,24,-5,16);b.cylinder(k.iron,.03,.04,1.8,0,25.9,-5,7);b.box(k.iron,1.05,.07,.06,0,26.25,-5);
  for(const x of [-7.3,-4.3,4.3,7.3]){b.cylinder(k.stone,.33,.41,10,x,5.4,2.5,12);b.box(k.stone,.95,.4,.95,x,.56,2.5);b.box(k.stone,.95,.3,.95,x,10.5,2.5);}
  k.door(b,d,0,.2,3.6,6.8,false);b.box(k.stone,19,.42,1.2,0,11,2.2);
  // A separate campanile provides a readable slender silhouette against sky.
  b.box(k.walls[4],4.2,24,4.2,-12,12,-7);b.box(k.stone,4.7,.45,4.7,-12,24,-7);b.box(k.recess,3.6,3.7,3.6,-12,26,-7);
  for(const x of [-13.8,-10.2])for(const z of [-8.8,-5.2])b.box(k.stone,.37,4,.37,x,26,z);
  b.box(k.stone,4.6,.4,4.6,-12,28.1,-7);b.cylinder(k.roof,0,3.1,5,-12,30.5,-7,4,new Euler(0,Math.PI/4,0));b.flush('Santa quiete');d.flush('Church doorway');}
 private poles(){const geometry=new CylinderGeometry(.105,.135,2.15,9),mat=this.kit.wood;const points:Vector3[]=[];for(let s=3;s<this.route.length;s+=17){for(const side of [-1,1]){const p=this.route.pointAtDistance(s),t=this.route.tangentAtDistance(s);points.push(p.addScaledVector(new Vector3(-t.z,0,t.x),side*(this.route.widthAt(s)/2-.48)).setY(.55));}}
  const mesh=new InstancedMesh(geometry,mat,points.length),m=new Matrix4();points.forEach((p,i)=>mesh.setMatrixAt(i,m.makeTranslation(p.x,p.y,p.z)));mesh.castShadow=true;mesh.receiveShadow=true;mesh.layers.enable(1);this.root.add(mesh);
 }
 dispose(){this.root.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});this.root.removeFromParent();}
}
