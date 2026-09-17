import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apps/pool.js', import.meta.url), 'utf8');
const geometry = source.slice(source.indexOf('const rayToRail'), source.indexOf('const resolve'));
const load = balls => {
    const context = vm.createContext({W:700,H:380,M:28,R:9,balls,Math});
    vm.runInContext(`${geometry};globalThis.api={rayToRail,guide,shotSpeed}`, context);
    return context.api;
};

test('aim guide reaches the rail when no ball blocks it', () => {
    const cue={x:37,y:190,on:true,c:'w'}, api=load([cue]);
    assert.equal(api.guide(cue,1,0).cueDistance,626);
    assert.equal(api.guide(cue,-1,0).cueDistance,0);
});

test('cut-shot guide finds the ghost-ball impact and object path', () => {
    const cue={x:100,y:190,on:true,c:'w'}, target={x:300,y:202,on:true,c:'r'}, api=load([cue,target]);
    const path=api.guide(cue,1,0);
    assert.equal(path.hit,target);
    assert.ok(path.cueDistance>185&&path.cueDistance<190);
    assert.ok(path.objectDy>0.6);
    assert.ok(path.objectDistance>100);
});

test('power curve provides fine low-speed control and a wider top range', () => {
    const api=load([]);
    assert.ok(api.shotSpeed(1)>=120);
    assert.ok(api.shotSpeed(10)<api.shotSpeed(20));
    assert.equal(api.shotSpeed(100),3200);
});
