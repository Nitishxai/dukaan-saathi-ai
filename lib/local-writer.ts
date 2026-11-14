/** One writer tab serializes all synchronous localStorage mutations. */
let owned=false,started=false,lifecycleInstalled=false;
let release:(()=>void)|undefined;
let acquiredCallback:(()=>void)|undefined;
const writerListeners = new Set<() => void>();
export function subscribeLocalWriter(listener: () => void) {
  writerListeners.add(listener);
  return () => { writerListeners.delete(listener); };
}
// The server and the hydrating client both start without a browser lock banner.
export function initialWriterMessage(): null { return null; }
function setOwnership(value: boolean) {
  if (owned === value) return;
  owned = value;
  writerListeners.forEach(listener => listener());
}
export function canWriteLocalStore():boolean{return typeof document==='undefined'||owned;}
export function localWriterMessage():string|null{
  if(canWriteLocalStore())return null;
  return typeof navigator!=='undefined'&&navigator.locks?'Read-only: another tab may be using the counter. Close that tab to enable saving here.':'This browser cannot safely lock shop data. Use current Chrome or Edge on HTTPS or localhost.';
}
export function releaseLocalWriter():void { setOwnership(false);release?.(); }
export function acquireLocalWriter(onAcquired:()=>void):void {
  acquiredCallback=onAcquired;
  if(typeof document==='undefined'||started)return;
  started=true;
  if(!navigator.locks)return;
  if(typeof window!=='undefined'&&!lifecycleInstalled){
    lifecycleInstalled=true;
    window.addEventListener('pagehide',releaseLocalWriter);
    window.addEventListener('pageshow',()=>{if(!owned&&!started&&acquiredCallback)acquireLocalWriter(acquiredCallback);});
  }
  void navigator.locks.request('dukaan-local-writer-v3',{mode:'exclusive'},async()=>{
    setOwnership(true);
    const lifetime=new Promise<void>(resolve=>{release=resolve;});
    acquiredCallback?.();
    await lifetime;
    release=undefined;started=false;
  });
}
