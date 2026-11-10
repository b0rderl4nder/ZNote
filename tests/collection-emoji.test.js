import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';
import { createCollector } from '../addons/connectors/cloudflare/collector.js';

test('collection emojis persist independently of names and work in the installed Android catalogue', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'znote-collection-emoji-'));
  const old = openDatabase(dir);
  old.prepare('INSERT INTO collections VALUES(?,?,?,?)').run('old-photo','摄影','#666666','2025-01-01');
  const schema = old.prepare('PRAGMA user_version').get().user_version;
  old.close();

  const runtime = createApp({dataDir:dir});
  const server = runtime.app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const request = (path, {method='GET',body,headers={}}={}) => fetch(base+path,{
    method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},
    ...(body ? {body:JSON.stringify(body)} : {}),
  });
  try {
    const setup = await request('/api/auth/setup',{method:'POST',body:{password:'1234'}});
    assert.equal(setup.status,201);
    cookie = setup.headers.get('set-cookie').split(';')[0];
    const list = async headers => (await request('/api/collections',{headers})).json();
    const [photo] = await list();
    assert.equal(photo.name,'摄影');
    assert.ok(photo.emoji);
    assert.equal(photo.display_name,`${photo.emoji} 摄影`);
    const created = await request('/api/collections',{method:'POST',body:{name:'建模'}});
    assert.equal(created.status,201);
    const model = await created.json();
    assert.notEqual(model.emoji,photo.emoji);

    const edit = body => request('/api/collections/old-photo',{method:'PATCH',body});
    assert.equal((await edit({name:'摄影参考',emoji:'👩🏽‍🎨'})).status,200);
    assert.equal((await edit({name:'摄影',emoji:'📚🎨'})).status,400);
    assert.equal((await edit({name:'摄影资料'})).status,200);
    const [native] = await list({'User-Agent':'Dalvik/2.1.0 (Linux; U; Android 15; fixture)'});
    assert.equal(native.id,photo.id);
    assert.equal(native.name,'👩🏽‍🎨 摄影资料');
    assert.equal((await list())[0].name,'摄影资料');
    assert.equal((await edit({name:'摄影资料',emoji:''})).status,200);
    assert.equal((await list())[0].display_name,'摄影资料');
    assert.equal(runtime.db.prepare('PRAGMA user_version').get().user_version,schema);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    runtime.db.close();
    await rm(dir,{recursive:true,force:true});
  }
});

test('relay sync presents the emoji to legacy capture pickers while preserving the destination id',async()=>{
  const collections=[{id:'model',name:'建模',display_name:'🧩 建模'},{id:'legacy',name:'旧知识库'}];
  const relay=async(path,method,input)=>{
    assert.equal(path,'/connector/sync');
    assert.deepEqual(input.collections,[{id:'model',name:'🧩 建模'},{id:'legacy',name:'旧知识库'}]);
    return {};
  };
  await createCollector({local:async()=>collections,relay}).step();
});
