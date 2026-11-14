'use client';
import { useState } from 'react';
import { validateShopBackup } from '../lib/backup';
import { downloadRecoveryBytes, importRecoveredShop } from '../lib/storage';
import type { DukaanShopBackup } from '../types';
export function RecoveryPanel({ message }: { message: string }) {
  const [backup,setBackup]=useState<DukaanShopBackup|null>(null);
  const [error,setError]=useState('');
  return <main className="max-w-xl mx-auto p-6 space-y-4"><h1 className="text-2xl font-bold">Data recovery zaroori hai</h1><p role="alert">{message}</p><p>Original records replace nahi honge. Valid backup ek nayi shop mein khulega.</p>
    <button className="p-3 bg-emerald-700 text-white rounded-lg" onClick={downloadRecoveryBytes}>1. Download original data</button>
    <label className="block">2. Select shop backup<input type="file" accept=".json" className="block p-3" onChange={async e=>{
      setBackup(null);setError('');const file=e.target.files?.[0];if(!file)return;
      if(file.size>10_000_000){setError('Backup is too large (10 MB maximum).');return;}
      try { const result=validateShopBackup(JSON.parse(await file.text()));if(!result.isValid||!result.backup)throw new Error(result.error);setBackup(result.backup); } catch(err){setError(err instanceof Error?err.message:'Invalid backup');}
    }}/></label>
    {backup&&<section className="border p-4 rounded-lg space-y-3"><p>{backup.shopProfile.shopName}: {backup.data.products.length} products, {backup.data.sales.length} bills, {backup.data.customers.length} customers.</p><button className="p-3 bg-emerald-700 text-white rounded-lg" onClick={()=>{
      const p=backup.shopProfile;
      const result=importRecoveredShop({...backup.data,profile:p,shopName:p.shopName,shopkeeperName:p.ownerName,phone:p.phone||''});
      if(!result.success)setError(result.error||'Recovery failed');
    }}>3. Confirm import into NEW shop</button></section>}
    {error&&<p role="alert">{error}</p>}
  </main>;
}
