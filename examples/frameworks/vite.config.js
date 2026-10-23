import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import tailwind from '@tailwindcss/vite';
import {clickToCss} from '../../src/index.js';
export default defineConfig({
 plugins:[clickToCss({pages:[{file:'examples/frameworks/index.html',label:'React + Vue',styles:[]}],sources:['examples/frameworks/main.jsx','examples/frameworks/Card.vue']}),react(),vue(),tailwind()],
 server:{host:'127.0.0.1'},
 build:{outDir:'dist/frameworks',rolldownOptions:{input:'examples/frameworks/index.html'}}
});
