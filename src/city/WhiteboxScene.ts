import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, Matrix4, Mesh, MeshStandardMaterial, Path, Quaternion, Shape, ShapeGeometry, ShapeUtils, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RouteController, ROUTE, shortestDistance } from '../journey/RouteController';
export const bridgeUnderside = (cross: number) => .65 + 2.8 * Math.sqrt(Math.max(0,1-(cross/5.65)**2));
export class WhiteboxScene {
  readonly root=new Group();
  readonly bridge=new Group();
  readonly routeLine:Line;
  readonly chunks:Group[]=[];
  readonly collisionMeshes:Mesh[]=[];
  readonly bankHalfWidth=ROUTE.width/2;
  private box=new BoxGeometry(1,1,1);
  private mats={
    volume:new MeshStandardMaterial({color:'#d4d1c7',roughness:.9}),
    stone:new MeshStandardMaterial({color:'#bfbeb5',roughness:.85}),
    light:new MeshStandardMaterial({color:'#e1e0d6',roughness:.81}),
    recess:new MeshStandardMaterial({color:'#56605b',roughness:.94}),
    wet:new MeshStandardMaterial({color:'#5b6860',roughness:.47}),
    iron:new MeshStandardMaterial({color:'#4f5650',roughness:.7,metalness:.15}),
  };
  constructor(readonly route:RouteController) {
    this.root.name='Whitebox canal study';
    for(let c=0;c<4;c++){
      const chunk=new Group();chunk.name=`Canal_${'ABCD'[c]} (resident whitebox)`;this.chunks.push(chunk);this.root.add(chunk);
      const batches=new Map<keyof typeof this.mats,BufferGeometry[]>();
      const add=(key:keyof typeof this.mats,g:BufferGeometry)=>{const list=batches.get(key)??[];list.push(g);batches.set(key,list);};
      const interval=9.6;
      for(let s=c*route.length/4+4.8;s<(c+1)*route.length/4;s+=interval){
        if(shortestDistance(s,ROUTE.bridgeDistance,route.length)<7.1)continue;
        const p=route.pointAtDistance(s),t=route.tangentAtDistance(s),yaw=Math.atan2(-t.x,-t.z);
        const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw);
        const world=new Matrix4().compose(p,q,new Vector3(1,1,1));
        const stamp=(key:keyof typeof this.mats,w:number,h:number,d:number,x:number,y:number,z:number)=>{
          const m=new Matrix4().makeScale(w,h,d);m.setPosition(x,y,z);m.premultiply(world);add(key,this.box.clone().applyMatrix4(m));
        };
        for(const side of [-1,1]){
          const n=Math.round(s/interval)+(side===1?2:0),height=[10.8,13.5,11.8,15,12.5][n%5];
          const frontage=8.8,depth=8.5,front=this.bankHalfWidth+.65;
          stamp('volume',depth,height,frontage,side*(front+depth/2),height/2+.45,0);
          stamp('wet',.08,.5,frontage,side*(front-.05),.20,0);
          stamp('stone',.23,.7,frontage,side*(front-.10),.74,0);
          stamp('light',depth+.3,.3,frontage+.22,side*(front+depth/2),height+.5,0);
          const floors=Math.floor((height-1.4)/2.85);
          for(let floor=0;floor<floors;floor++)for(let col=0;col<3;col++){
            const z=-2.85+col*2.85,y=2.2+floor*2.85;
            stamp('recess',.09,1.53,.92,side*(front-.06),y,z);
            stamp('light',.22,.14,1.19,side*(front-.15),y-.85,z);
            stamp('stone',.17,.1,1.16,side*(front-.12),y+.81,z);
            stamp('light',.18,1.59,.11,side*(front-.13),y,z-.54);
            stamp('light',.18,1.59,.11,side*(front-.13),y,z+.54);
          }
          stamp('recess',.12,1.95,1.32,side*(front-.07),1.18,1.42);
          if(n%3===0){
            stamp('stone',.80,.20,1.65,side*(front-.38),4.24,-1.45);
            stamp('iron',.05,.8,1.62,side*(front-.79),4.75,-1.45);
          }
        }
      }
      for(const [key,geometries] of batches){
        const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
        if(!geometry)continue;
        const mesh=new Mesh(geometry,this.mats[key]);mesh.castShadow=true;mesh.receiveShadow=true;mesh.layers.enable(1);mesh.name=`${chunk.name} / ${key}`;chunk.add(mesh);
        if(key==='volume')this.collisionMeshes.push(mesh);
      }
    }
    this.buildLand();this.buildBanks();this.buildBridge();this.buildMoorings();
    const points=route.curve.getSpacedPoints(700).map(p=>p.setY(.085));
    this.routeLine=new Line(new BufferGeometry().setFromPoints(points),new LineBasicMaterial({color:'#e2ad5c',depthTest:false}));
    this.routeLine.name='Debug route';this.routeLine.visible=false;this.routeLine.renderOrder=9;this.root.add(this.routeLine);
    // A distant silhouette, explicitly part of the spatial whitebox.
    const p=route.pointAtDistance(route.length*.62),t=route.tangentAtDistance(route.length*.62);
    const tower=new Mesh(new BoxGeometry(4.8,24,4.8),this.mats.stone);tower.position.set(p.x-t.z*19,12,p.z+t.x*19);tower.castShadow=true;tower.receiveShadow=true;tower.layers.enable(1);this.root.add(tower);
  }
  private buildLand(){
    // Continuous land regions with an actual canal-shaped hole, so gaps between
    // study volumes do not reveal the sky below the street plane.
    const shores:Vector2[][]=[[],[]];
    for(let i=0;i<560;i++){
      const p=this.route.pointAtDistance(i/560*this.route.length),t=this.route.tangentAtDistance(i/560*this.route.length);
      for(let k=0;k<2;k++){const cross=(k===0?-1:1)*this.bankHalfWidth;
        shores[k].push(new Vector2(p.x-t.z*cross,-p.z-t.x*cross));
      }
    }
    shores.sort((a,b)=>Math.abs(ShapeUtils.area(b))-Math.abs(ShapeUtils.area(a)));
    const outer=new Shape([new Vector2(-220,-220),new Vector2(220,-220),new Vector2(220,220),new Vector2(-220,220)]);
    outer.holes.push(new Path(shores[0]));
    const island=new Shape(shores[1]);
    const ground=new Mesh(new ShapeGeometry([outer,island]),this.mats.stone);
    ground.rotation.x=-Math.PI/2;ground.position.y=.655;ground.receiveShadow=true;ground.layers.enable(1);this.root.add(ground);
  }
  private buildBanks(){
    for(const side of [-1,1])for(const band of [0,1,2]){
      const vertices:number[]=[],indices:number[]=[];
      for(let i=0;i<=560;i++){
        const s=i/560*this.route.length,p=this.route.pointAtDistance(s),t=this.route.tangentAtDistance(s);
        const inner=this.bankHalfWidth;
        const coordinates=band===0?[[inner,.68],[inner+3.5,.68]]:band===1?[[inner,-.8],[inner,.22]]:[[inner,.22],[inner,.68]];
        for(const [cross,y]of coordinates)vertices.push(p.x-t.z*cross*side,y,p.z+t.x*cross*side);
        if(i<560){let a=i*2,b=a+2;if(side===1)indices.push(a,a+1,b,a+1,b+1,b);else indices.push(a,b,a+1,a+1,b,b+1);}
      }
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
      const m=new Mesh(g,band===1?this.mats.wet:this.mats.stone);m.receiveShadow=true;m.castShadow=band===2;m.layers.enable(1);this.root.add(m);
    }
  }
  private buildBridge(){
    const shape=new Shape();const half=5.65;
    shape.moveTo(-half,bridgeUnderside(-half));
    for(let i=0;i<=64;i++){let x=-half+i/64*half*2;shape.lineTo(x,bridgeUnderside(x)+.53);}
    for(let i=64;i>=0;i--){let x=-half+i/64*half*2;shape.lineTo(x,bridgeUnderside(x));}shape.closePath();
    const geometry=new ExtrudeGeometry(shape,{depth:3.6,bevelEnabled:false,steps:1});geometry.translate(0,0,-1.8);
    const arch=new Mesh(geometry,this.mats.stone);arch.name='Solid arch with open passage';this.bridge.add(arch);this.collisionMeshes.push(arch);
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat=this.mats.light)=>{const mesh=new Mesh(new BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);this.bridge.add(mesh);};
    for(const z of [-1.65,1.65]){
      for(let i=0;i<=28;i++){const x=-5.55+i/28*11.1,y=bridgeUnderside(x)+.55;box(.055,.92,.065,x,y+.46,z,this.mats.iron);}
      for(let i=0;i<56;i++){
        const x=-5.55+(i+.5)/56*11.1,y=bridgeUnderside(x)+1.46;
        const rail=new Mesh(new BoxGeometry(.24,.065,.08),this.mats.iron);rail.position.set(x,y,z);rail.rotation.z=Math.atan2(bridgeUnderside(x+.10)-bridgeUnderside(x-.10),.20);this.bridge.add(rail);
      }
    }
    for(const side of [-1,1])box(.50,1.58,3.95,side*5.57,.35,0);
    // Combine static bridge material groups to keep both mirror and shadow passes cheap.
    for(const material of [this.mats.stone,this.mats.light,this.mats.iron]){
      const meshes=this.bridge.children.filter(m=>(m as Mesh).material===material) as Mesh[];
      const gs=meshes.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});
      if(!gs.length)continue;
      const g=mergeGeometries(gs);gs.forEach(g=>g.dispose());
      meshes.forEach(m=>{this.bridge.remove(m);m.geometry.dispose();});
      if(g){const m=new Mesh(g,material);m.castShadow=true;m.receiveShadow=true;m.layers.enable(1);this.bridge.add(m);if(material===this.mats.stone){this.collisionMeshes.splice(this.collisionMeshes.indexOf(arch),1,m);}}
    }
    this.bridge.name='Ponte 01 / clearance 3.45 m';this.bridge.position.copy(this.route.pointAtDistance(ROUTE.bridgeDistance));
    const tangent=this.route.tangentAtDistance(ROUTE.bridgeDistance);this.bridge.rotation.y=Math.atan2(-tangent.x,-tangent.z);this.root.add(this.bridge);
  }
  private buildMoorings(){
    const gs:BufferGeometry[]=[];
    for(const s of [8,14,49,54,119,125,172,178])for(const side of [-1,1]){
      const p=this.route.pointAtDistance(s),t=this.route.tangentAtDistance(s);
      const x=p.x-t.z*(this.bankHalfWidth-.25)*side,z=p.z+t.x*(this.bankHalfWidth-.25)*side;
      const g=new CylinderGeometry(.11,.14,1.8,10);g.translate(x,.3,z);gs.push(g);
    }
    const geometry=mergeGeometries(gs);gs.forEach(g=>g.dispose());
    if(geometry){const m=new Mesh(geometry,new MeshStandardMaterial({color:'#6b6458',roughness:.83}));m.castShadow=true;m.receiveShadow=true;m.layers.enable(1);this.root.add(m);}
  }
}
