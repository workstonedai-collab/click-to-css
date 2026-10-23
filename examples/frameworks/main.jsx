import React from 'react';
import {createRoot} from 'react-dom/client';
import {createApp} from 'vue';
import styled from 'styled-components';
import Card from './Card.vue';
import './tailwind.css';
const Heading=styled.h2`font-size:32px;color:#176a58;`;
function Demo(){return <section className="p-6 bg-slate-50"><h1 className="text-[52px] font-bold text-slate-900">React + Tailwind</h1><p style={{fontSize:24,color:'#425466'}}>React inline styles</p><Heading>Static styled-components</Heading></section>}
const reactRoot=createRoot(document.getElementById('react-root'));
const vueApp=createApp(Card);
reactRoot.render(<Demo/>);
vueApp.mount('#vue-root');
if(import.meta.hot) import.meta.hot.dispose(()=>{reactRoot.unmount();vueApp.unmount();});
