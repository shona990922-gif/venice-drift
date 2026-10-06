import { BoxGeometry, BufferGeometry, CatmullRomCurve3, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Shape, TubeGeometry, Vector3 } from 'three';
import { RouteController } from './RouteController';
export class BoatController {
  readonly root = new Group();
  readonly visual = new Group();
  constructor() {
    this.root.name = 'BoatRoot'; this.visual.name = 'BoatVisual'; this.root.add(this.visual);
    this.buildGondolaStudy();
  }
  update(route: RouteController) { this.root.position.copy(route.position); this.root.rotation.y = route.yaw; }
  private buildGondolaStudy() {
    const black = new MeshStandardMaterial({color: '#111b1a', roughness: 0.32, metalness: 0.04, side: DoubleSide});
    const wood = new MeshStandardMaterial({color: '#40312a', roughness: 0.52});
    const trim = new MeshStandardMaterial({color: '#78674b', roughness: 0.34, metalness: 0.66});
    const seat = new MeshStandardMaterial({color: '#493934', roughness: 0.87});
    const metal = new MeshStandardMaterial({color: '#959c98', metalness: 0.9, roughness: 0.23});
    const add = (mesh: Mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; mesh.layers.enable(1); this.visual.add(mesh); return mesh; };
    const vertices: number[] = [], indices: number[] = [];
    const rails = [[], []] as Vector3[][];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80, z = 4.85 - t * 10;
      const width = Math.pow(Math.sin(Math.PI * t), 0.62) * 0.83 + 0.018;
      const lift = Math.pow(Math.abs(t * 2 - 1), 5) * 0.68;
      const profile = [[-width, 0.43 + lift], [-width * 0.76, -0.16 + lift * 0.4], [0, -0.30 + lift * 0.55], [width * 0.76, -0.16 + lift * 0.4], [width, 0.43 + lift]];
      for (const [x,y] of profile) vertices.push(x,y,z);
      rails[0].push(new Vector3(-width,0.45+lift,z)); rails[1].push(new Vector3(width,0.45+lift,z));
      if (i < 80) for (let j = 0; j < 4; j++) { const a=i*5+j,b=a+5; indices.push(a,b,a+1,b,b+1,a+1); }
    }
    const hull = new BufferGeometry(); hull.setAttribute('position',new Float32BufferAttribute(vertices,3)); hull.setIndex(indices); hull.computeVertexNormals(); add(new Mesh(hull,black));
    for (const rail of rails) add(new Mesh(new TubeGeometry(new CatmullRomCurve3(rail),100,0.044,8,false),black));
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat=wood)=>{const m=add(new Mesh(new BoxGeometry(w,h,d),mat)); m.position.set(x,y,z); return m;};
    box(1.40,0.10,6.8,0,0.18,-0.1);
    for (let i=0;i<9;i++) box(0.012,0.008,6.65,-0.57+i*0.142,0.236,-0.1,black);
    box(1.36,0.13,0.55,0,0.53,0.72,seat);
    box(1.20,0.12,0.46,0,0.45,-1.50,wood);
    box(1.3,0.38,0.1,0,0.73,2.22,seat);
    const deck=new Shape();deck.moveTo(-0.58,-2.55);deck.quadraticCurveTo(-0.32,-4.6,0,-5.12);deck.quadraticCurveTo(0.32,-4.6,0.58,-2.55);deck.closePath();
    const deckMesh=add(new Mesh(new ExtrudeGeometry(deck,{depth:0.035,bevelEnabled:false,curveSegments:24}),black)); deckMesh.rotation.x=Math.PI/2;deckMesh.position.y=0.58;
    for(const x of [-0.67,0.67])box(0.026,0.032,3.8,x,0.49,-0.12,trim);
    // A silhouette study of the ferro; replaced by an authored GLB in ROUND 02.
    const ferro = new Shape(); ferro.moveTo(-0.12,0);ferro.lineTo(0.06,0);ferro.lineTo(0.09,0.85);ferro.quadraticCurveTo(0.05,1.12,-0.19,1.2);ferro.lineTo(-0.24,1.02);ferro.quadraticCurveTo(-0.08,0.99,-0.07,0.77);ferro.lineTo(-0.12,0);
    const fm=add(new Mesh(new ExtrudeGeometry(ferro,{depth:0.035,bevelEnabled:true,bevelSegments:2,bevelSize:0.012,bevelThickness:0.01}),metal));fm.rotation.y=Math.PI/2;fm.position.set(-0.018,0.61,-4.95);
    for(let i=0;i<6;i++)box(0.044,0.036,0.24,0,0.77+i*0.075,-5.06,metal);
  }
}
