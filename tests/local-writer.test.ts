import { it } from 'node:test';
import assert from 'node:assert/strict';
it('native Web Locks serialize independent local store instances and transfer ownership on pagehide',{timeout:5000},async()=>{
  const prior=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{value:{},configurable:true});
  // Independent module instances emulate tab-local state, sharing the real lock manager.
  const firstPath='../lib/local-writer.ts?instance=one',secondPath='../lib/local-writer.ts?instance=two';
  const first=await import(firstPath),second=await import(secondPath);
  try {
    await new Promise<void>(resolve=>first.acquireLocalWriter(resolve));
    const acquired=new Promise<void>(resolve=>second.acquireLocalWriter(resolve));
    assert.equal(first.canWriteLocalStore(),true);assert.equal(second.canWriteLocalStore(),false);
    first.releaseLocalWriter();await acquired;
    assert.equal(first.canWriteLocalStore(),false);assert.equal(second.canWriteLocalStore(),true);
  }finally{first.releaseLocalWriter();second.releaseLocalWriter();if(prior)Object.defineProperty(globalThis,'document',prior);else Reflect.deleteProperty(globalThis,'document');}
});
it('uses a stable hydration snapshot and publishes live writer transitions', async () => {
  const path = '../lib/local-writer.ts?instance=hydration';
  const writer = await import(path);
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const messages: (string | null)[] = [];
  const unsubscribe = writer.subscribeLocalWriter(() => messages.push(writer.localWriterMessage()));
  try {
    assert.equal(writer.initialWriterMessage(), null);
    Object.defineProperty(globalThis, 'document', {value: {}, configurable: true});
    assert.equal(writer.initialWriterMessage(), null);
    assert.ok(writer.localWriterMessage());
    await new Promise<void>(resolve => writer.acquireLocalWriter(resolve));
    writer.releaseLocalWriter();
    assert.deepEqual(messages, [null, writer.localWriterMessage()]);
  } finally {
    unsubscribe();
    writer.releaseLocalWriter();
    if (prior) Object.defineProperty(globalThis, 'document', prior);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
