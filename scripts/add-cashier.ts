import { resolve } from 'node:path';
import { PilotDatabase } from '../lib/server/database.ts';
if(!process.env.PILOT_DATABASE_PATH)throw new Error('Set PILOT_DATABASE_PATH');
const [ownerName,shopId,cashierName]=process.argv.slice(2);
if(!ownerName||!shopId||!cashierName)throw new Error('Usage: node scripts/add-cashier.ts owner_username shop_id cashier_username');
const db=new PilotDatabase(resolve(process.env.PILOT_DATABASE_PATH));
try {const owner=db.db.prepare('SELECT id FROM users WHERE username=?').get(ownerName);if(!owner)throw new Error('Owner not found');db.grantMember(String(owner.id),shopId,cashierName,'cashier');console.log('Cashier access granted for the selected shop.');}finally{db.db.close();}
