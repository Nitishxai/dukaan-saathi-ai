import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrations } from './migrations.ts';
import { applySale, type SaleInput } from '../accounting.ts';
import { validateBackupRecords } from '../validation.ts';
import type { DukaanStoreData, DukaanShopBackup, Product, Customer } from '../../types';

export class PilotError extends Error { status: number; constructor(message: string, status=400) { super(message); this.status=status; } }
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const money=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&Number.isSafeInteger(Math.round(value*100))&&Math.abs(value*100-Math.round(value*100))<1e-6;
const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
const name=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=200;
export type PilotCommand = { operationId:string; shopId:string; revision:number; kind:'sale'|'product'|'stock'|'price'|'customer'|'ledger'|'reverse_sale'|'refund'|'restore'; payload:unknown };
export function toBackup(data:DukaanStoreData):DukaanShopBackup {
  return {app:'Dukaan Sathi AI',schemaVersion:'1.0',exportedAt:now(),shopProfile:data.profile,data:{products:data.products,sales:data.sales,customers:data.customers,udhaarTransactions:data.udhaarTransactions,stockMovements:data.stockMovements,activities:data.activities,lastResetAt:data.lastResetAt},meta:{totalProducts:data.products.length,totalSales:data.sales.length,totalCustomers:data.customers.length,totalUdhaarTransactions:data.udhaarTransactions.length}};
}
function validatedBackup(value:unknown):DukaanShopBackup {
  if(!value||typeof value!=='object')throw new PilotError('Invalid backup');
  const b=value as DukaanShopBackup;
  if(b.app!=='Dukaan Sathi AI'||b.schemaVersion!=='1.0')throw new PilotError('Unsupported backup version');
  const error=validateBackupRecords(value);if(error)throw new PilotError(error);return b;
}
function object(value:unknown):Record<string,unknown> {if(!value||typeof value!=='object'||Array.isArray(value))throw new PilotError('Expected an object');return value as Record<string,unknown>;}

export class PilotDatabase {
  db:DatabaseSync;
  constructor(path:string) {
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path,{timeout:5000});
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
    this.transaction(()=>{
      const version=Number(this.db.prepare('PRAGMA user_version').get()?.user_version??0);
      if(version>migrations.length)throw new Error('Database is newer than this application. Roll forward or restore a compatible backup.');
      for(const migration of migrations.filter(m=>m.version>version)){this.db.exec(migration.sql);this.db.exec(`PRAGMA user_version=${migration.version}`);}
    });
  }
  transaction<T>(fn:()=>T):T {this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  createUser(username:string,password:string):string {
    if(!/^[a-z0-9._-]{3,64}$/.test(username)||password.length<12||password.length>256)throw new PilotError('Username: 3–64 lowercase letters/numbers. Password: 12–256 characters.');
    const salt=randomBytes(16).toString('hex');const digest=scryptSync(password,salt,64).toString('hex');const id=randomUUID();
    this.db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,username,`${salt}:${digest}`,now());return id;
  }
  limit(bucket:string,maximum=60,windowMs=60_000):void {
    const window=Math.floor(Date.now()/windowMs);
    this.transaction(()=>{
      this.db.prepare('INSERT INTO rate_limits VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END, window=excluded.window').run(bucket,window);
    });
    if(Number(this.db.prepare('SELECT count FROM rate_limits WHERE bucket=?').get(bucket)?.count)>maximum)throw new PilotError('Too many requests. Try again later.',429);
  }
  login(username:string,password:string):string {
    this.limit('login-global',30);this.limit('login:'+hash(username),5,300_000);
    if(typeof username!=='string'||typeof password!=='string'||password.length>256)throw new PilotError('Invalid login',401);
    const user=this.db.prepare('SELECT * FROM users WHERE username=?').get(username);
    const [salt,stored]=String(user?.password_hash||'00000000000000000000000000000000:'+ '0'.repeat(128)).split(':');
    const supplied=scryptSync(password,salt,64);
    if(!timingSafeEqual(supplied,Buffer.from(stored,'hex'))||!user)throw new PilotError('Invalid login',401);
    const token=randomBytes(32).toString('hex');
    this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),String(user.id),Date.now()+8*60*60*1000);return token;
  }
  authenticate(token:string):string {
    const session=this.db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(hash(token),Date.now());
    if(!session)throw new PilotError('Sign in required',401);return String(session.user_id);
  }
  logout(token:string):void {this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));}
  role(userId:string,shopId:string):'owner'|'cashier' {
    const row=this.db.prepare('SELECT role FROM members WHERE shop_id=? AND user_id=?').get(shopId,userId);
    if(!row)throw new PilotError('Shop access denied',403);return row.role as 'owner'|'cashier';
  }
  grantMember(ownerId:string,shopId:string,username:string,role:'owner'|'cashier'):void {
    if(this.role(ownerId,shopId)!=='owner')throw new PilotError('Owner permission required',403);
    const user=this.db.prepare('SELECT id FROM users WHERE username=?').get(username);if(!user)throw new PilotError('User not found');
    this.db.prepare('INSERT INTO members VALUES(?,?,?) ON CONFLICT(shop_id,user_id) DO UPDATE SET role=excluded.role').run(shopId,String(user.id),role);
  }
  listShops(userId:string) {return this.db.prepare("SELECT shops.id,members.role,json_extract(data,'$.profile.shopName') AS name FROM shops JOIN members ON members.shop_id=shops.id WHERE user_id=?").all(userId);}
  read(userId:string,shopId:string):DukaanStoreData {this.role(userId,shopId);const row=this.db.prepare('SELECT data,revision FROM shops WHERE id=?').get(shopId)!;return {...JSON.parse(String(row.data)),revision:Number(row.revision)};}
  previewImport(value:unknown) {const b=validatedBackup(value);return {shopName:b.shopProfile.shopName,products:b.data.products.length,sales:b.data.sales.length,customers:b.data.customers.length,hash:hash(JSON.stringify(b))};}
  importShop(userId:string,operationId:string,value:unknown,previewHash:string):string {
    const b=validatedBackup(value);const digest=hash(JSON.stringify(b));
    if(digest!==previewHash||!name(operationId))throw new PilotError('Backup changed. Preview again.');
    return this.transaction(()=>{
      const prior=this.db.prepare('SELECT * FROM imports WHERE user_id=? AND operation_id=?').get(userId,operationId);
      if(prior){if(prior.request_hash!==digest)throw new PilotError('Import ID conflict',409);return String(prior.shop_id);}
      const id=randomUUID();const profile={...b.shopProfile,id,isDemo:false,isOnboarded:true};
      const data:DukaanStoreData={...b.data,profile,shopName:profile.shopName,shopkeeperName:profile.ownerName,phone:profile.phone||'',revision:0};
      this.db.prepare('INSERT INTO shops VALUES(?,0,?)').run(id,JSON.stringify(data));
      this.db.prepare("INSERT INTO members VALUES(?,?,'owner')").run(id,userId);
      this.db.prepare('INSERT INTO imports VALUES(?,?,?,?)').run(userId,operationId,digest,id);
      this.db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),id,userId,operationId,'import',0,JSON.stringify(data),now());return id;
    });
  }
  mutate(userId:string,command:PilotCommand):DukaanStoreData {
    object(command);
    if(!name(command.operationId)||!name(command.shopId)||!Number.isSafeInteger(command.revision)||command.revision<0)throw new PilotError('Invalid operation identity or revision');
    const digest=hash(JSON.stringify(command));
    return this.transaction(()=>{
      const role=this.role(userId,command.shopId);
      const prior=this.db.prepare('SELECT * FROM operations WHERE shop_id=? AND operation_id=?').get(command.shopId,command.operationId);
      if(prior){if(prior.request_hash!==digest)throw new PilotError('Operation ID conflict',409);return JSON.parse(String(prior.response));}
      const current=this.read(userId,command.shopId);
      if(current.revision!==command.revision)throw new PilotError('Shop changed. Refresh and review before saving.',409);
      if(!['sale','customer','ledger'].includes(command.kind)&&role!=='owner')throw new PilotError('Owner permission required',403);
      const data=structuredClone(current),p=object(command.payload);
      switch(command.kind){
        case 'sale': {
          if(!Array.isArray(p.items)||p.items.length>100||p.items.some(i=>!i||typeof i!=='object'))throw new PilotError('Invalid bill items');
          const input={...p,operationId:command.operationId,shopId:command.shopId} as SaleInput;
          if(input.paymentMode==='online' && (input.paymentStatus!=='manually_confirmed'||input.paymentVerificationStatus==='paid'))throw new PilotError('UPI requires manual confirmation; automatic verification is unavailable');
          if(input.invoiceNo)throw new PilotError('Invoice numbers are server assigned');
          const result=applySale(data,input);if(!result.success||!result.data)throw new PilotError(result.error||'Sale failed');Object.assign(data,result.data);break;
        }
        case 'product': {
          if(!name(p.name)||!name(p.unit)||!money(p.sellingPrice)||p.sellingPrice<=0||typeof p.currentStock!=='number'||!Number.isFinite(p.currentStock)||p.currentStock<0)throw new PilotError('Invalid product price or stock');
          const product:Product={id:randomUUID(),name:p.name.trim(),unit:p.unit,category:typeof p.category==='string'?p.category:'General',sellingPrice:p.sellingPrice,currentStock:p.currentStock,minStockAlert:5,updatedAt:now()};
          data.products.push(product);data.stockMovements.push({id:randomUUID(),productId:product.id,productName:product.name,type:'opening',quantity:product.currentStock!,previousStock:null,newStock:product.currentStock,reason:'Opening stock',createdAt:now()});break;
        }
        case 'stock': {
          const product=data.products.find(v=>v.id===p.productId);
          if(!product || product.currentStock===null || typeof p.quantity!=='number' || !Number.isFinite(p.quantity) || p.quantity===0 || Math.round(p.quantity*1000)!==p.quantity*1000 || !name(p.reason))throw new PilotError('Product, signed quantity and reason required');
          const previous=product.currentStock,next=Math.round((previous+p.quantity)*1000)/1000;
          if(next<0)throw new PilotError('Stock cannot become negative');product.currentStock=next;product.updatedAt=now();
          data.stockMovements.push({id:randomUUID(),productId:product.id,productName:product.name,type:p.quantity>0?'purchase':'adjustment',quantity:p.quantity,previousStock:previous,newStock:next,reason:p.reason,createdAt:now()});break;
        }
        case 'price': {
          const product=data.products.find(v=>v.id===p.productId);if(!product||!money(p.price)||p.price<=0||!name(p.reason))throw new PilotError('Valid product, price and reason required');product.sellingPrice=p.price;product.updatedAt=now();break;
        }
        case 'customer': {
          if(!name(p.name))throw new PilotError('Customer name required');const customer:Customer={id:randomUUID(),name:p.name.trim(),phone:typeof p.phone==='string'?p.phone:'',currentBalance:0,advanceBalance:0,createdAt:now()};data.customers.push(customer);break;
        }
        case 'ledger': {
          if(!money(p.amount)||p.amount<=0||!['credit_given','payment_received'].includes(String(p.type)))throw new PilotError('Invalid ledger amount or type');
          const customer=data.customers.find(c=>c.id===p.customerId);if(!customer)throw new PilotError('Customer not found');
          const net=round(customer.currentBalance-(customer.advanceBalance??0)+(p.type==='credit_given'?p.amount:-p.amount));
          customer.currentBalance=Math.max(0,net);customer.advanceBalance=Math.max(0,-net);customer.lastTransactionAt=now();
          data.udhaarTransactions.push({id:randomUUID(),customerId:customer.id,type:p.type as 'credit_given'|'payment_received',amount:p.amount,notes:typeof p.notes==='string'?p.notes:'Counter entry',createdAt:now()});break;
        }
        case 'reverse_sale': {
          const sale=data.sales.find(s=>s.id===p.saleId);if(!sale||sale.reversedAt||!name(p.reason))throw new PilotError('Valid sale and correction reason required');
          sale.reversedAt=now();sale.reversalReason=p.reason;
          for(const item of sale.items){const product=data.products.find(v=>v.id===item.productId);if(!product)throw new PilotError('Cannot reverse: product no longer exists');const previous=product.currentStock;if(previous!==null)product.currentStock=Math.round((previous+item.quantity)*1000)/1000;data.stockMovements.push({id:randomUUID(),productId:product.id,productName:product.name,type:'return',quantity:item.quantity,previousStock:previous,newStock:product.currentStock,reason:p.reason,referenceId:sale.id,createdAt:now()});}
          if(sale.paymentMode==='udhaar') {const c=data.customers.find(c=>c.id===sale.customerId);if(!c)throw new PilotError('Customer not found');const net=round(c.currentBalance-(c.advanceBalance??0)-sale.totalAmount);c.currentBalance=Math.max(0,net);c.advanceBalance=Math.max(0,-net);data.udhaarTransactions.push({id:randomUUID(),customerId:c.id,type:'credit_reversal',amount:sale.totalAmount,notes:'Full return: '+p.reason,saleId:sale.id,createdAt:now()});}
          // Financial reversal records a liability; it never claims money was refunded automatically.
          break;
        }
        case 'refund': {
          const sale=data.sales.find(s=>s.id===p.saleId);
          if(!sale?.reversedAt || sale.refundRecordedAt || sale.paymentMode==='udhaar' || !name(p.reason))throw new PilotError('A reversed paid bill and refund reason are required');
          sale.refundRecordedAt=now();break;
        }
        case 'restore': {
          const b=validatedBackup(p.backup);if(p.previewHash!==hash(JSON.stringify(b)))throw new PilotError('Preview changed. Review backup again.');
          Object.assign(data,b.data,{profile:{...b.shopProfile,id:current.profile.id},shopName:b.shopProfile.shopName,shopkeeperName:b.shopProfile.ownerName,phone:b.shopProfile.phone||''});break;
        }
        default:throw new PilotError('Unknown operation');
      }
      data.revision=(current.revision??0)+1;
      const error=validateBackupRecords(toBackup(data));if(error)throw new PilotError(error);
      const encoded=JSON.stringify(data);
      this.db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),command.shopId,userId,command.operationId,command.kind,current.revision??0,JSON.stringify(current),now());
      this.db.prepare('UPDATE shops SET data=?,revision=? WHERE id=?').run(encoded,data.revision,command.shopId);
      this.db.prepare('INSERT INTO operations VALUES(?,?,?,?)').run(command.shopId,command.operationId,digest,encoded);return data;
    });
  }
  audit(userId:string,shopId:string){this.role(userId,shopId);return this.db.prepare('SELECT id,actor_id,kind,previous_revision,created_at FROM audit WHERE shop_id=? ORDER BY rowid DESC LIMIT 100').all(shopId);}
  recoverySnapshot(userId:string,shopId:string,auditId:string):DukaanStoreData {
    if(this.role(userId,shopId)!=='owner')throw new PilotError('Owner permission required',403);
    const row=this.db.prepare('SELECT before_data FROM audit WHERE id=? AND shop_id=?').get(auditId,shopId);if(!row)throw new PilotError('Snapshot not found',404);return JSON.parse(String(row.before_data));
  }
}
