import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer,build} from 'vite';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
test('framework demo: real transforms, component saves, Tailwind generation, conflicts and byte-exact undo',async()=>{
 let server;const names=['examples/frameworks/main.jsx','examples/frameworks/Card.vue'];
 const original=Object.fromEntries(await Promise.all(names.map(async n=>[n,await fs.readFile(path.join(root,n),'utf8')])));
 try {
  server=await createServer({configFile:path.join(root,'examples/frameworks/vite.config.js'),server:{port:0}});await server.listen();
  const base='http://127.0.0.1:'+server.httpServer.address().port;
  const state=async()=>{const r=await fetch(base+'/__click_to_css/state');assert.equal(r.status,200);return r.json()};
  const post=(route,data,origin=base)=>fetch(base+'/__click_to_css/'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
  for(const [file,mode] of [[names[0],'react-style'],[names[0],'styled-template'],[names[0],'classes'],[names[1],'vue-css'],[names[1],'inline-css'],[names[1],'classes']]){
   const snapshot=await state(),target=snapshot.components[file].targets.find(t=>t.mode===mode);assert.ok(target,mode);
   const payload={page:'examples/frameworks/index.html',file,before:snapshot.css[file],target:target.id,value:'p-6 text-[46px] md:text-[52px]',changes:[{property:'font-size',value:'46px'}]};
   assert.equal((await post('component',payload,'https://example.org')).status,403);
   const result=await post('component',payload);assert.equal(result.status,200,await result.text());
   const after=await fs.readFile(path.join(root,file),'utf8');assert.notEqual(after,original[file]);
   assert.equal((await post('component',payload)).status,409);
   const compiled=await server.transformRequest('/'+file);assert.ok(compiled.code.includes('data-click-to-css-source'));
   if(mode==='classes') {const css=await server.transformRequest('/examples/frameworks/tailwind.css');assert.match(css.code,/46px/);}
   assert.equal((await post('undo',{})).status,200);assert.equal(await fs.readFile(path.join(root,file),'utf8'),original[file]);
  }
  const snapshot=await state();const target=snapshot.components[names[0]].targets.find(t=>t.mode==='react-style');
  const data={page:'examples/frameworks/index.html',file:names[0],before:snapshot.css[names[0]],target:target.id,changes:[{property:'font-size',value:'46px'}]};
  assert.equal((await post('component',{...data,file:'../outside.jsx'})).status,400);
  assert.equal((await post('component',data)).status,200);
  await fs.appendFile(path.join(root,names[0]),'\n// external edit\n');assert.equal((await post('undo',{})).status,409);
 }finally{await server?.close();for(const [file,source]of Object.entries(original))await fs.writeFile(path.join(root,file),source);}
});
