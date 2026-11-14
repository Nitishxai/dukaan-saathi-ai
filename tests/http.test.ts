import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET,POST } from '../app/api/pilot/route.ts';
import { pilotDatabase,closePilotDatabase } from '../lib/server/http.ts';
it('HTTP boundary fails closed, validates origins and bodies, and issues revocable private sessions',async()=>{
  const old={enabled:process.env.PILOT_ENABLED,path:process.env.PILOT_DATABASE_PATH,origin:process.env.PILOT_ORIGIN};
  const dir=mkdtempSync(join(tmpdir(),'dukaan-http-test-'));
  const request=(body:unknown,origin='http://localhost:3101',cookie='')=>new Request('http://localhost:3101/api/pilot',{method:'POST',headers:{'content-type':'application/json',origin,cookie},body:JSON.stringify(body)});
  try {
    process.env.PILOT_ENABLED='false';assert.equal((await GET(new Request('http://localhost:3101/api/pilot'))).status,503);
    process.env.PILOT_ENABLED='true';process.env.PILOT_DATABASE_PATH=join(dir,'test.sqlite');process.env.PILOT_ORIGIN='http://localhost:3101';
    const db=pilotDatabase();db.createUser('owner','test-only-http-password');
    assert.equal((await GET(new Request('http://localhost:3101/api/pilot'))).status,401);
    assert.equal((await POST(request({action:'login',username:'owner',password:'test-only-http-password'},'https://attacker.invalid'))).status,403);
    const login=await POST(request({action:'login',username:'owner',password:'test-only-http-password'}));assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
    const authenticated=await GET(new Request('http://localhost:3101/api/pilot',{headers:{cookie}}));assert.equal(authenticated.status,200);assert.deepEqual((await authenticated.json()).shops,[]);
    const invalid=await POST(request({action:'mutate',command:null},undefined,cookie));assert.equal(invalid.status,400);
    assert.equal((await POST(request({action:'logout'},undefined,cookie))).status,200);
    assert.equal((await GET(new Request('http://localhost:3101/api/pilot',{headers:{cookie}}))).status,401);
  }finally{
    closePilotDatabase();for(const [key,value] of Object.entries({PILOT_ENABLED:old.enabled,PILOT_DATABASE_PATH:old.path,PILOT_ORIGIN:old.origin})){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    rmSync(dir,{recursive:true,force:true});
  }
});
