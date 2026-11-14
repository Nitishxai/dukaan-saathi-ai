import { resolve } from 'node:path';
import { PilotDatabase, PilotError } from './database.ts';
let instance:PilotDatabase|undefined;
export function closePilotDatabase():void { instance?.db.close(); instance=undefined; }
export function pilotDatabase():PilotDatabase {
  if(process.env.PILOT_ENABLED!=='true'||!process.env.PILOT_DATABASE_PATH||!process.env.PILOT_ORIGIN)throw new PilotError('Pilot server is not configured. See README setup.',503);
  const origin=new URL(process.env.PILOT_ORIGIN);
  if(origin.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname))throw new PilotError('HTTPS is required outside localhost',503);
  instance??=new PilotDatabase(resolve(process.env.PILOT_DATABASE_PATH));return instance;
}
export function requireSameOrigin(request:Request):void {
  if(request.headers.get('origin')!==process.env.PILOT_ORIGIN)throw new PilotError('Origin not allowed',403);
}
export function sessionToken(request:Request):string {return request.headers.get('cookie')?.split(';').map(p=>p.trim()).find(p=>p.startsWith('dukaan_session='))?.slice('dukaan_session='.length)||'';}
export async function boundedJson(request:Request):Promise<Record<string,unknown>> {
  if(!request.headers.get('content-type')?.includes('application/json'))throw new PilotError('JSON required',415);
  if(Number(request.headers.get('content-length')||0)>10_000_000)throw new PilotError('Request too large',413);
  const reader=request.body?.getReader();if(!reader)throw new PilotError('Missing body');
  const chunks:Uint8Array[]=[];let length=0;
  const timeout=setTimeout(()=>{void reader.cancel();},10_000);
  try {
    for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>10_000_000)throw new PilotError('Request too large',413);chunks.push(value);}
    const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!value||typeof value!=='object'||Array.isArray(value))throw new PilotError('Expected JSON object');return value;
  }catch(error){if(error instanceof PilotError)throw error;throw new PilotError('Invalid or incomplete JSON');}
  finally{clearTimeout(timeout);void reader.cancel();}
}
