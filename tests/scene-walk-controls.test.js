import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalkControls, movementKey } from '../scene/walk-controls.js';

test('walking recognizes physical WASD on Cyrillic layouts and ignores other keys', () => {
  assert.equal(movementKey({ key:'ц', code:'KeyW' }), 'w');
  assert.equal(movementKey({ key:'ф', code:'KeyA' }), 'a');
  assert.equal(movementKey({ key:'ы', code:'KeyS' }), 's');
  assert.equal(movementKey({ key:'в', code:'KeyD' }), 'd');
  assert.equal(movementKey({ key:'ArrowRight', code:'ArrowRight' }), 'ArrowRight');
  assert.equal(movementKey({ key:'D' }), 'd');
  assert.equal(movementKey({ key:'Enter', code:'Enter' }), null);
});

function harness() {
  const nodes = [];
  const documentRef = { hidden:false, defaultView:null };
  class Node {
    constructor() { this.ownerDocument=documentRef;this.children=[];this.dataset={};this.attributes={};this.listeners=new Map();this.captures=new Set();nodes.push(this); }
    addEventListener(type,fn) { const set=this.listeners.get(type)||new Set();set.add(fn);this.listeners.set(type,set); }
    removeEventListener(type,fn) { this.listeners.get(type)?.delete(fn); }
    emit(type,extra={}) { const event={type,button:0,pointerId:1,preventDefault(){this.defaultPrevented=true;},...extra};for(const fn of [...(this.listeners.get(type)||[])]) fn(event);return event; }
    setAttribute(key,value) { this.attributes[key]=value; }
    appendChild(child) { this.children.push(child);child.parent=this; }
    remove() { if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this); }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    focus() { this.focused=true; }
  }
  const eventDocument=new Node();Object.assign(documentRef,{listeners:eventDocument.listeners,addEventListener:eventDocument.addEventListener,removeEventListener:eventDocument.removeEventListener,emit:eventDocument.emit,createElement:()=>new Node()});
  const host=new Node(),stage=new Node(),inputs=[];
  let centers=0;
  const controls=createWalkControls({host,stage,onInput:(key,down)=>inputs.push([key,down]),onCenter:()=>centers++});
  return {controls,host,stage,inputs,documentRef,nodes,centers:()=>centers,button:key=>host.children[0].children.find(node=>node.dataset.walkKey===key)};
}

test('touch holds and cancellation release movement without leaving a stuck key', () => {
  const h=harness(),button=h.button('ArrowUp');
  assert.equal(h.host.children[0].hidden,true);
  button.emit('pointerdown');assert.deepEqual(h.inputs,[]);
  h.controls.setEnabled(true);
  assert.equal(button.emit('pointerdown').defaultPrevented,true);
  assert.deepEqual(h.inputs,[['ArrowUp',true]]);
  assert.equal(button.hasPointerCapture(1),true);
  button.emit('pointercancel');
  assert.deepEqual(h.inputs,[['ArrowUp',true],['ArrowUp',false]]);
  assert.equal(button.hasPointerCapture(1),false);
  h.controls.destroy();
});

test('leaving walk mode and hiding the tab release every held direction', () => {
  const h=harness();h.controls.setEnabled(true);
  h.button('ArrowLeft').emit('pointerdown');h.button('ArrowDown').emit('pointerdown',{pointerId:2});
  h.controls.setEnabled(false);
  assert.deepEqual(h.inputs.slice(-2),[['ArrowLeft',false],['ArrowDown',false]]);
  h.controls.setEnabled(true);h.button('ArrowUp').emit('pointerdown');
  h.documentRef.hidden=true;h.documentRef.emit('visibilitychange');
  assert.deepEqual(h.inputs.at(-1),['ArrowUp',false]);
  h.controls.destroy();assert.equal(h.host.children.length,0);
  assert.equal(h.nodes.reduce((n,node)=>n+[...node.listeners.values()].reduce((sum,set)=>sum+set.size,0),0),0);
});

test('direction buttons support keyboard holds and center returns focus to map', () => {
  const h=harness();h.controls.setEnabled(true);const right=h.button('ArrowRight');
  right.emit('keydown',{key:'Enter'});right.emit('keydown',{key:'Enter',repeat:true});
  right.emit('keyup',{key:'Enter'});
  assert.deepEqual(h.inputs,[['ArrowRight',true],['ArrowRight',false]]);
  h.button('center').emit('click');assert.equal(h.centers(),1);assert.equal(h.stage.focused,true);
  h.controls.destroy();h.controls.destroy();
});
