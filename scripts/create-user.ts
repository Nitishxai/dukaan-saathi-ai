import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { resolve } from 'node:path';
import { PilotDatabase } from '../lib/server/database.ts';
if(!process.env.PILOT_DATABASE_PATH)throw new Error('Set PILOT_DATABASE_PATH to a local persistent disk path first.');
const username=process.argv[2];
if(!username)throw new Error('Usage: node scripts/create-user.ts username');
let muted=false;
const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk,encoding);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
process.stdout.write('New password (12+ characters, hidden): ');muted=true;
const password=await rl.question('');muted=false;process.stdout.write('\n');rl.close();
const db=new PilotDatabase(resolve(process.env.PILOT_DATABASE_PATH));
try {db.createUser(username,password);process.stdout.write('User created. Sign in at /pilot and import a reviewed backup.\n');}finally{db.db.close();}
