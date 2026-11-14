import { backup as sqliteBackup } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { describe,it,beforeEach,afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PilotDatabase, toBackup } from '../lib/server/database.ts';
import { createEmptyShopData, DEFAULT_INITIAL_PROFILE } from '../lib/storage.ts';
import type { DukaanStoreData } from '../types';
let db:PilotDatabase,dir:string,owner:string,cashier:string,outsider:string,shop:string;
const fixture=()=>{
  const data=createEmptyShopData({...DEFAULT_INITIAL_PROFILE,isOnboarded:true});
  data.products=[{id:'p1',name:'Rice',category:'Grains',unit:'kg',currentStock:1,sellingPrice:50,minStockAlert:1,updatedAt:new Date().toISOString()}];return toBackup(data);
};
const sale=(state:DukaanStoreData,operationId=randomUUID())=>({kind:'sale' as const,shopId:shop,revision:state.revision!,operationId,payload:{items:[{productId:'p1',productName:'Rice',unit:'kg',quantity:1,unitPrice:50,totalPrice:50}],paymentMode:'cash'}});
describe('Durable authenticated pilot',()=>{
  beforeEach(()=>{
    dir=mkdtempSync(join(tmpdir(),'dukaan-pilot-test-'));db=new PilotDatabase(join(dir,'test.sqlite'));
    owner=db.createUser('owner','test-only-password-123');cashier=db.createUser('cashier','test-only-password-456');outsider=db.createUser('outsider','test-only-password-789');
    const backup=fixture();shop=db.importShop(owner,'initial',backup,db.previewImport(backup).hash);db.grantMember(owner,shop,'cashier','cashier');
  });
  afterEach(()=>{db.db.close();rmSync(dir,{recursive:true,force:true});});
  it('migrates once and survives reopen with sessions and committed data',()=>{
    const token=db.login('owner','test-only-password-123');db.mutate(owner,sale(db.read(owner,shop)));
    db.db.close();db=new PilotDatabase(join(dir,'test.sqlite'));
    assert.equal(db.authenticate(token),owner);assert.equal(db.read(owner,shop).sales.length,1);
    db.logout(token);assert.throws(()=>db.authenticate(token),/Sign in/);
  });
  it('denies invalid login, cross-shop access and cashier restore/product changes',()=>{
    assert.throws(()=>db.login('owner','incorrect'),/Invalid login/);
    assert.throws(()=>db.read(outsider,shop),/denied/);
    assert.throws(()=>db.mutate(cashier,{...sale(db.read(cashier,shop)),kind:'product',payload:{}}),/Owner/);
    assert.throws(()=>db.recoverySnapshot(cashier,shop,'anything'),/Owner/);
  });
  it('serializes last-stock sale with a second database connection and rejects stale writes',()=>{
    const other=new PilotDatabase(join(dir,'test.sqlite'));
    try {
      const a=db.read(owner,shop),b=other.read(cashier,shop);db.mutate(owner,sale(a));
      assert.throws(()=>other.mutate(cashier,sale(b)),/changed/);
      assert.throws(()=>other.mutate(cashier,sale(other.read(cashier,shop))),/Insufficient stock/);
      assert.equal(other.read(cashier,shop).products[0].currentStock,0);
    }finally{other.db.close();}
  });
  it('deduplicates retry after reload, rejects operation-ID reuse and rolls back malformed sale',()=>{
    const command=sale(db.read(owner,shop));const saved=db.mutate(owner,command);
    assert.equal(db.mutate(owner,command).sales[0].id,saved.sales[0].id);
    assert.throws(()=>db.mutate(owner,{...command,revision:1}),/conflict/);
    assert.equal(db.read(owner,shop).sales.length,1);
    assert.throws(()=>db.mutate(owner,{...command,operationId:randomUUID(),revision:1,payload:{items:[null]}}),/Invalid bill/);
    assert.equal(db.read(owner,shop).revision,1);
  });
  it('imports only previewed data, retries once and leaves original backup unchanged',()=>{
    const b=fixture(),original=JSON.stringify(b);const preview=db.previewImport(b);
    const id=db.importShop(owner,'retry-import',b,preview.hash);assert.equal(db.importShop(owner,'retry-import',b,preview.hash),id);
    assert.equal(JSON.stringify(b),original);assert.throws(()=>db.importShop(owner,'bad',b,'wrong'),/Preview/);
  });
  it('keeps recovery snapshots, immutable audit and reversible full returns',()=>{
    let data=db.mutate(owner,sale(db.read(owner,shop)));const bill=data.sales[0];
    data=db.mutate(owner,{operationId:randomUUID(),shopId:shop,revision:data.revision!,kind:'reverse_sale',payload:{saleId:bill.id,reason:'Customer returned all goods'}});
    assert.equal(data.products[0].currentStock,1);assert.ok(data.sales[0].reversedAt);assert.equal(data.sales[0].refundRecordedAt,undefined);
    assert.throws(()=>db.mutate(owner,{operationId:randomUUID(),shopId:shop,revision:data.revision!,kind:'reverse_sale',payload:{saleId:bill.id,reason:'Again'}}),/Valid sale/);
    const audit=db.audit(owner,shop);assert.equal(audit.length,3);
    const prior=db.recoverySnapshot(owner,shop,String(audit[0].id));assert.equal(prior.products[0].currentStock,0);
    assert.throws(()=>db.db.exec('DELETE FROM audit'),/immutable/);
  });
  it('reconciles advances against credit and repayments in one commit',()=>{
    let data=db.mutate(owner,{operationId:randomUUID(),shopId:shop,revision:0,kind:'customer',payload:{name:'Ramesh'}});const id=data.customers[0].id;
    for(const [type,amount] of [['payment_received',100],['credit_given',60],['credit_given',70]] as const){data=db.mutate(cashier,{operationId:randomUUID(),shopId:shop,revision:data.revision!,kind:'ledger',payload:{customerId:id,type,amount}});}
    assert.equal(data.customers[0].currentBalance,30);assert.equal(data.customers[0].advanceBalance,0);
  });
  it('enforces persisted request budgets',()=>{db.limit('test',1);assert.throws(()=>db.limit('test',1),/Too many/);});
  it('simultaneous worker commits sell the last stock exactly once',async()=>{
    const state=db.read(owner,shop);
    const workers=[owner,cashier].map(userId=>new Worker(new URL('./helpers/pilot-race.ts',import.meta.url),{workerData:{path:join(dir,'test.sqlite'),userId,command:sale(state)}}));
    try {
      await Promise.all(workers.map(w=>new Promise<void>((resolve,reject)=>{w.once('message',()=>resolve());w.once('error',reject);})));
      const results=workers.map(w=>new Promise<{success:boolean}>((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);}));
      workers.forEach(w=>w.postMessage('commit'));
      assert.equal((await Promise.all(results)).filter(r=>r.success).length,1);
      assert.equal(db.read(owner,shop).sales.length,1);assert.equal(db.read(owner,shop).products[0].currentStock,0);
    }finally{await Promise.all(workers.map(w=>w.terminate()));}
  });

  it('restores a previewed backup while retaining the exact pre-restore snapshot',()=>{
    const original=fixture();let data=db.mutate(owner,sale(db.read(owner,shop)));
    data=db.mutate(owner,{operationId:randomUUID(),shopId:shop,revision:data.revision!,kind:'restore',payload:{backup:original,previewHash:db.previewImport(original).hash}});
    assert.equal(data.sales.length,0);assert.equal(data.products[0].currentStock,1);
    const row=db.audit(owner,shop)[0];assert.equal(row.kind,'restore');
    const recovery=db.recoverySnapshot(owner,shop,String(row.id));assert.equal(recovery.sales.length,1);assert.equal(recovery.products[0].currentStock,0);
  });
  it('consistent SQLite backup restores financial records, users and audit history',async()=>{
    db.mutate(owner,sale(db.read(owner,shop)));
    const destination=join(dir,'backup.sqlite');await sqliteBackup(db.db,destination);
    const restored=new PilotDatabase(destination);
    try{assert.equal(restored.read(owner,shop).sales.length,1);assert.equal(restored.audit(owner,shop).length,2);assert.ok(restored.login('owner','test-only-password-123'));}finally{restored.db.close();}
  });
  it('rejects bad stock and price corrections and stale cashier prices',()=>{
    let data=db.read(owner,shop);const oldSale=sale(data);
    assert.throws(()=>db.mutate(owner,{operationId:randomUUID(),shopId:shop,revision:0,kind:'stock',payload:{productId:'p1',quantity:-2,reason:'Correction'}}),/negative/);
    data=db.mutate(owner,{operationId:randomUUID(),shopId:shop,revision:0,kind:'price',payload:{productId:'p1',price:55,reason:'Supplier price changed'}});
    assert.throws(()=>db.mutate(cashier,{...oldSale,revision:data.revision!}),/Price changed/);
    assert.equal(db.read(owner,shop).products[0].currentStock,1);
  });

});
