import { parentPort,workerData } from 'node:worker_threads';
import { PilotDatabase } from '../../lib/server/database.ts';
const db=new PilotDatabase(workerData.path);
parentPort!.postMessage('ready');
parentPort!.once('message',()=>{
  try {db.mutate(workerData.userId,workerData.command);parentPort!.postMessage({success:true});}
  catch(error){parentPort!.postMessage({success:false,error:error instanceof Error?error.message:'failed'});}
  finally{db.db.close();parentPort!.close();}
});
