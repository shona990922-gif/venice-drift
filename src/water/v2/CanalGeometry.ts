import {BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector3} from 'three';
import type {RouteController} from '../../journey/RouteController';

/** Metre-scale strip follows the existing canal. Nothing extends under streets. */
export function makeCanalGeometry(route:RouteController, halfWidth:number, step=.30) {
  const positions:number[]=[],uv:number[]=[],bank:number[]=[],indices:number[]=[];
  const length=route.length+36,start=-18,n=Math.ceil(length/step),across=Math.ceil(halfWidth*2/step);
  for(let i=0;i<=n;i++) {
    const s=start+length*i/n,p=route.pointAtDistance(s),t=route.tangentAtDistance(s);
    for(let j=0;j<=across;j++) {
      const width=route.widthAt(s)/2;const side=(j/across*2-1)*width;
      positions.push(p.x-t.z*side,0,p.z+t.x*side);uv.push(s,side);
      bank.push(Math.max(0,width-Math.abs(side)));
      if(i<n&&j<across){const a=i*(across+1)+j,b=a+across+1;indices.push(a,a+1,b,a+1,b+1,b);}
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setAttribute('bankDistance',new Float32BufferAttribute(bank,1));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function makeCanalBed(surface:BufferGeometry) {
  const geometry=surface.clone(),p=geometry.getAttribute('position'),bank=geometry.getAttribute('bankDistance');
  for(let i=0;i<p.count;i++){const d=Math.min(1,bank.getX(i)/2.7);p.setY(i,-(.8+2.3*d*d*(3-2*d)));}
  geometry.computeVertexNormals();const m=new Mesh(geometry,new MeshStandardMaterial({color:'#343d37',roughness:1}));
  m.name='Dark canal bed / no sand';m.receiveShadow=true;m.layers.enable(2);return m;
}
