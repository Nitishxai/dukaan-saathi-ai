import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
if(!process.env.PILOT_DATABASE_PATH||!process.argv[2])throw new Error('Set PILOT_DATABASE_PATH; usage: node scripts/backup-server.ts output.sqlite');
const source=resolve(process.env.PILOT_DATABASE_PATH),destination=resolve(process.argv[2]);
if(source===destination)throw new Error('Backup must use a new destination');
const db=new DatabaseSync(source,{readOnly:true});
try {await backup(db,destination);console.log('Consistent server backup completed. Store it securely.');}finally{db.close();}
