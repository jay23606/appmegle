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

test('local win/loss streak records each synchronized round only once', () => {
    const recordSource=source.slice(source.indexOf('const readRecord'),source.indexOf('const sub'));
    const values=new Map(), localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
    const context=vm.createContext({JSON,localStorage,over:true,result:'a',me:'a',seriesId:'series',round:1,localRecord:null});
    vm.runInContext(`${recordSource};globalThis.recordOutcome=recordOutcome`,context);
    context.recordOutcome(); context.recordOutcome();
    context.round=2; context.result='b'; context.recordOutcome();
    const record=JSON.parse(values.get('appmegle:pool-record:v1'));
    assert.deepEqual({wins:record.wins,losses:record.losses,runType:record.runType,run:record.run},{wins:1,losses:1,runType:'loss',run:1});
});
