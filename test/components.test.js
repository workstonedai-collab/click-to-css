import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSource,instrumentSource,editComponent} from '../src/components.js';
import {editRule,validateValue} from '../src/index.js';
const props=new Set(['font-size','color','margin-top']);
function edit(source,file,mode,extra={}) {
 const target=analyzeSource(source,file).targets.find(t=>t.mode===mode);
 assert.ok(target,mode);return editComponent(source,file,{target:target.id,...extra},editRule,validateValue,props);
}
test('React TSX mapping preserves source; only host elements are instrumented',()=>{
 const source='type Props={text:string}; export const Card=({text}:Props)=><section><h1 className="text-xl">{text}</h1><Unknown /></section>';
 const mapped=instrumentSource(source,'Card.tsx');
 assert.equal(analyzeSource(source,'Card.tsx').elements.length,2);
 assert.match(mapped.code,/data-click-to-css-source="Card.tsx:/);assert.ok(mapped.map.mappings);
 assert.ok(!source.includes('data-click-to-css-source'));
});
test('literal Tailwind classes preserve variants and arbitrary values in JSX and Vue',()=>{
 for(const [file,source] of [['Card.jsx','export const C=()=> <h1 className="text-xl hover:text-red-500"/>'],['Card.vue','<template><h1 class="text-xl hover:text-red-500">Hello</h1></template>']]){
 const out=edit(source,file,'classes',{value:'text-[46px] md:text-[52px] hover:text-red-500'});
 assert.match(out,/text-\[46px\] md:text-\[52px\]/);
 assert.throws(()=>edit(source,file,'classes',{value:'x" onClick="bad'}));
 }
});
test('dynamic classes, spread attributes and dynamic styles cannot be rewritten',()=>{
 for(const source of ['const C=()=> <h1 className={classes} style={{color:theme.color}}/>','const C=()=> <h1 {...props} className="static"/>']) assert.equal(analyzeSource(source,'C.jsx').targets.length,0);
 assert.equal(analyzeSource('<template><h1 class="base" :class="dynamic"/></template>','C.vue').targets.length,0);
});
test('React inline object preserves comments and updates only the selected occurrence',()=>{
 const source='const C=()=> <><h1 style={{fontSize:52 /*keep*/,color:"red"}}/><h1 style={{fontSize:52}}/></>';
 const out=edit(source,'C.jsx','react-style',{changes:[{property:'font-size',value:'46px'}]});
 assert.match(out,/fontSize:"46px" \/\*keep\*\//);assert.match(out,/<h1 style=\{\{fontSize:52\}\}/);
 assert.match(edit(source,'C.jsx','react-style',{changes:[{property:'margin-top',value:'8px'}]}),/"marginTop":"8px"/);
});
test('Vue scoped CSS edits keep script, template and other style blocks intact',()=>{
 const source='<script setup>const label="Hello"</script>\n<template><h1 class="title">{{label}}</h1></template>\n<style scoped>.title{font-size:52px}</style><style>.other{color:red}</style>';
 const out=edit(source,'C.vue','vue-css',{changes:[{property:'font-size',value:'46px'}]});
 assert.equal(out,source.replace('52px','46px'));assert.match(instrumentSource(source,'C.vue').code,/<h1 data-click-to-css-source=/);
});
test('styled-components and Emotion templates resolve imported binding; dynamic and shadowed bindings are excluded',()=>{
 for(const pkg of ['styled-components','@emotion/styled']){
 const source=`import styled from '${pkg}'; const Heading=styled.h1\`font-size:52px;color:red;\`; export const C=()=> <Heading>Hello</Heading>`;
 assert.match(edit(source,'C.jsx','styled-template',{changes:[{property:'font-size',value:'46px'}]}),/font-size:46px/);
 assert.equal(analyzeSource(source.replace('52px','${size}px'),'C.jsx').targets.length,0);
 const shadow=source.replace('()=> <Heading>','(Heading)=> <Heading>');assert.equal(analyzeSource(shadow,'C.jsx').targets.length,0);
 }
});
test('CSS-in-JS rejects executable template syntax and preserves numeric object values',()=>{
 const source="import styled from 'styled-components';const H=styled.h1`color:red`;const C=()=> <H/>";
 for(const value of ['${secret}','`bad`','url(https://example.com)']) assert.throws(()=>edit(source,'C.jsx','styled-template',{changes:[{property:'color',value}]}));
});

test('Vue duplicate selector after a nested media rule edits the correct top-level occurrence',()=>{
 const source='<template><h1 class="title"/></template><style>@media(max-width:600px){.title{color:red}}.title{color:blue}</style>';
 assert.equal(edit(source,'C.vue','vue-css',{changes:[{property:'color',value:'green'}]}),source.replace('color:blue','color:green'));
});
