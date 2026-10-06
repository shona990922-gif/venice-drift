import {defineConfig} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export default defineConfig({base:'./',build:{target:'es2022',chunkSizeWarningLimit:850},server:{port:5188,strictPort:true,host:'127.0.0.1',watch:{ignored:['**/qa/**','**/.build/**']}},plugins:[{name:'local-evidence',apply:'serve',configureServer(server){server.middlewares.use('/__evidence',async(req,res,next)=>{
 if(req.method!=='POST')return next();const origin=req.headers.origin;if(origin&&!/^http:\/\/(localhost|127\.0\.0\.1):5188$/.test(origin)){res.statusCode=403;return res.end();}
 const name=new URL(req.url||'','http://localhost').searchParams.get('name')||'';if(!/^[a-zA-Z0-9_-]{1,100}\.(png|json|webm)$/.test(name)){res.statusCode=400;return res.end();}
 try{let size=0;const parts:Buffer[]=[];for await(const p of req){size+=p.length;if(size>64*1024*1024)throw Error('Too large');parts.push(p);}await mkdir(resolve('qa'),{recursive:true});await writeFile(resolve('qa',name),Buffer.concat(parts));res.end('saved');}catch(e){res.statusCode=400;res.end(String(e));}
 });}}]});
