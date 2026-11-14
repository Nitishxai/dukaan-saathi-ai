import { PilotError, toBackup, type PilotCommand } from '../../../lib/server/database.ts';
import { pilotDatabase, requireSameOrigin, sessionToken, boundedJson } from '../../../lib/server/http.ts';
const reply=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const failure=(error:unknown)=>reply({success:false,error:error instanceof PilotError?error.message:'Server operation failed. No success was recorded.'},error instanceof PilotError?error.status:500);
export async function GET(request:Request) {
  try {
    const db=pilotDatabase(),user=db.authenticate(sessionToken(request));db.limit('read:'+user,120);
    const url=new URL(request.url),shopId=url.searchParams.get('shopId');
    if(!shopId)return reply({success:true,shops:db.listShops(user)});
    if(url.searchParams.get('audit'))return reply({success:true,audit:db.audit(user,shopId)});
    if(url.searchParams.get('snapshot'))return reply({success:true,backup:toBackup(db.recoverySnapshot(user,shopId,url.searchParams.get('snapshot')!))});
    const store=db.read(user,shopId);
    return reply({success:true,store,role:db.role(user,shopId),...(url.searchParams.get('export')?{backup:toBackup(store)}:{})});
  }catch(error){return failure(error);}
}
export async function POST(request:Request) {
  try {
    const db=pilotDatabase();requireSameOrigin(request);const body=await boundedJson(request);
    if(body.action==='login') {
      if(typeof body.username!=='string'||typeof body.password!=='string')throw new PilotError('Username and password required');
      const token=db.login(body.username,body.password);
      const secure=process.env.PILOT_ORIGIN?.startsWith('https:')?'; Secure':'';
      return reply({success:true},200,{'Set-Cookie':`dukaan_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`});
    }
    const token=sessionToken(request),user=db.authenticate(token);db.limit('write:'+user,60);
    switch(body.action){
      case 'logout':db.logout(token);return reply({success:true},200,{'Set-Cookie':'dukaan_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
      case 'preview_import':return reply({success:true,preview:db.previewImport(body.backup)});
      case 'import': {
        if(typeof body.operationId!=='string'||typeof body.previewHash!=='string')throw new PilotError('Import identity required');
        return reply({success:true,shopId:db.importShop(user,body.operationId,body.backup,body.previewHash)});
      }
      case 'mutate':return reply({success:true,store:db.mutate(user,body.command as PilotCommand)});
      default:throw new PilotError('Unknown action');
    }
  }catch(error){return failure(error);}
}
