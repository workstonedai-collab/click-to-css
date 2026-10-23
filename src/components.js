// SPDX-License-Identifier: MIT
// Source adapters only: no project code is evaluated on the server.
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { parse as parseSFC } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-dom';
import MagicString from 'magic-string';
import postcss from 'postcss';
const traverse = traverseModule.default || traverseModule;
export const SOURCE_ATTRIBUTE = 'data-click-to-css-source';
const camel = key => key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const marker = (file, start) => encodeURIComponent(file) + ':' + start;
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'extra', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(n => walk(n, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
function literalObject(node) {
  return node?.type === 'ObjectExpression' && node.properties.every(p =>
    p.type === 'ObjectProperty' && !p.computed &&
    ['Identifier', 'StringLiteral'].includes(p.key.type) &&
    ['StringLiteral', 'NumericLiteral'].includes(p.value.type));
}
function literalClasses(value) {
  return typeof value === 'string' && value.length <= 2000 &&
    !/[;{}<>"'`&\\\u0000-\u001f]/.test(value) && !/(?:url|expression)\s*\(/i.test(value);
}
function staticTemplate(binding) {
  const declaration = binding?.path.node;
  if (declaration?.type !== 'VariableDeclarator') return null;
  const tagged = declaration.init;
  if (tagged?.type !== 'TaggedTemplateExpression' || tagged.quasi.expressions.length) return null;
  let factory;
  if (tagged.tag.type === 'MemberExpression' && !tagged.tag.computed) factory = tagged.tag.object;
  else if (tagged.tag.type === 'CallExpression' && tagged.tag.arguments.length === 1 && tagged.tag.arguments[0].type === 'StringLiteral') factory = tagged.tag.callee;
  if (factory?.type !== 'Identifier') return null;
  const imported = binding.path.scope.getBinding(factory.name)?.path;
  if (!imported || imported.node.type !== 'ImportDefaultSpecifier' || !['styled-components', '@emotion/styled'].includes(imported.parent.source?.value)) return null;
  const css = tagged.quasi.quasis[0].value.raw;
  if (css.includes("\\")) return null;
  const root = postcss.parse(css);
  // Nested selectors and interpolations need separate source targets.
  if (!root.nodes.every(n => ['decl', 'comment'].includes(n.type))) return null;
  return {start: tagged.quasi.start + 1, end: tagged.quasi.end - 1, css};
}
export function analyzeSource(source, file) {
  const elements = [], targets = [];
  function element(start, insert, tag) {
    const item = {id: marker(file, start), file, line: source.slice(0, start).split('\n').length, tag, insert};
    elements.push(item); return item;
  }
  function target(item, mode, fields) { targets.push({...item, id: item.id + ':' + mode, elementId: item.id, mode, ...fields}); }
  if (file.endsWith('.vue')) {
    const {descriptor, errors} = parseSFC(source, {filename:file});
    if (errors.length) throw new Error('Invalid Vue source');
    const template = descriptor.template;
    if (!template || template.lang && template.lang !== 'html' || template.src) throw new Error('Only local HTML Vue templates are supported');
    const offset = template.loc.start.offset;
    const ast = baseParse(template.content);
    walk(ast, node => {
      if (node.type !== 1 || node.tagType !== 0 || node.props.some(p => p.name === SOURCE_ATTRIBUTE || p.type === 7 && p.name === 'bind' && !p.arg)) return;
      const start = offset + node.loc.start.offset;
      const item = element(start, start + 1 + node.tag.length, node.tag);
      for (const attr of node.props) {
        if (attr.type !== 6 || !attr.value || !['class','style'].includes(attr.name)) continue;
        const raw = attr.loc.source, m = raw.match(/^[\w-]+\s*=\s*(["'])([\s\S]*)\1$/);
        if (!m || m[2].includes('&')) continue;
        const begin = offset + attr.loc.start.offset + raw.indexOf(m[1]) + 1;
        const range = {start:begin,end:begin+m[2].length};
        if (attr.name === 'class') {
          if (node.props.some(p => p.type === 7 && p.name === 'bind' && p.arg?.content === 'class')) continue;
          if (literalClasses(m[2])) target(item,'classes',{...range,value:m[2]});
        } else if (!node.props.some(p => p.type === 7 && p.name === 'bind' && p.arg?.content === 'style')) target(item,'inline-css',{...range,css:m[2]});
      }
    });
    for (const block of descriptor.styles) {
      if (block.src || block.lang && block.lang !== 'css' || block.module) continue;
      const counts = new Map();
      postcss.parse(block.content).walkRules(rule => {
        const occurrence = counts.get(rule.selector) || 0;counts.set(rule.selector,occurrence+1);
        if (rule.parent.type !== 'root') return;
        targets.push({id:marker(file,block.loc.start.offset)+':rule:'+targets.length,file,mode:'vue-css',selector:rule.selector,occurrence,start:block.loc.start.offset,end:block.loc.end.offset,css:block.content,line:source.slice(0,block.loc.start.offset).split('\n').length});
      });
    }
  } else {
    const ast = parse(source,{sourceType:'module',plugins:['jsx', ...(file.endsWith('.tsx') ? ['typescript'] : [])]});
    traverse(ast, {JSXOpeningElement(p) {
      const node = p.node;
      if (node.name.type !== 'JSXIdentifier' || node.attributes.some(a => a.type === 'JSXSpreadAttribute' || a.name?.name === SOURCE_ATTRIBUTE)) return;
      const tag = node.name.name;
      const styled = /^[A-Z]/.test(tag) ? staticTemplate(p.scope.getBinding(tag)) : null;
      if (!/^[a-z]/.test(tag) && !styled) return;
      const item = element(node.start,node.name.end,tag);
      if (styled) target(item,'styled-template',styled);
      for (const attr of node.attributes) {
        let value = attr.value;
        if (value?.type === 'JSXExpressionContainer') value = value.expression;
        if (attr.name?.name === 'className' && value?.type === 'StringLiteral' && literalClasses(value.value)) target(item,'classes',{start:value.start,end:value.end,value:value.value,js:true});
        if (attr.name?.name === 'style' && literalObject(value)) target(item,'react-style',{start:value.start,end:value.end,properties:value.properties});
      }
    }});
  }
  return {elements,targets};
}
export function instrumentSource(source,file) {
  const {elements} = analyzeSource(source,file), result = new MagicString(source);
  for (const el of elements) result.appendLeft(el.insert, ` ${SOURCE_ATTRIBUTE}="${el.id}"`);
  return {code:result.toString(),map:result.generateMap({source:file,includeContent:true,hires:true})};
}
export function publicTargets(source,file) {
  const {elements,targets} = analyzeSource(source,file);
  return {elements:elements.map(({insert,...e})=>e),targets:targets.map(({properties,...t})=>t)};
}
export function editComponent(source,file,payload,editRule,validateValue,properties) {
  const target = analyzeSource(source,file).targets.find(t => t.id === payload.target);
  if (!target) throw new Error('Source target no longer exists');
  let replacement;
  if (target.mode === 'classes') {
    if (!literalClasses(payload.value)) throw new Error('Use a literal class list without quotes, entities or code');
    replacement = target.js ? JSON.stringify(payload.value) : payload.value;
  } else {
    if (!Array.isArray(payload.changes) || payload.changes.length !== 1 || !properties.has(payload.changes[0].property)) throw new Error('Choose one supported property');
    const {property} = payload.changes[0], value = validateValue(payload.changes[0].value);
    if (target.mode === 'react-style') {
      const key = camel(property), found = target.properties.filter(p => (p.key.name || p.key.value) === key).at(-1);
      if (found) return source.slice(0,found.value.start)+JSON.stringify(value)+source.slice(found.value.end);
      const original = source.slice(target.start,target.end-1), separator = target.properties.length && !original.trimEnd().endsWith(',') ? ',' : '';
      replacement = original + separator + JSON.stringify(key)+':'+JSON.stringify(value)+'}';
    } else if (target.mode === 'vue-css') replacement = editRule(target.css,{selector:target.selector,occurrence:target.occurrence,changes:[{property,value}]});
    else {
      const wrapped = editRule('.target{'+target.css+'}',{selector:'.target',changes:[{property,value}]});
      replacement = wrapped.slice(wrapped.indexOf('{')+1,-1);
      if (target.mode === 'inline-css' && /["'&<>]/.test(replacement)) throw new Error('HTML style values cannot contain quotes or entities');
      if (target.mode === 'styled-template' && /`|\$\{|\\/.test(replacement)) throw new Error('Template interpolation and escapes are not editable');
    }
  }
  const after = source.slice(0,target.start)+replacement+source.slice(target.end);
  analyzeSource(after,file); // Parse the complete updated source before writing it.
  return after;
}
