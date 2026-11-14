'use client';
import { useEffect,useRef,type ReactNode } from 'react';
export function AccessibleDialog({children,className,label,onClose}:{children:ReactNode;className:string;label:string;onClose?:()=>void}){
  const root=useRef<HTMLDivElement>(null),close=useRef(onClose);
  useEffect(()=>{close.current=onClose;},[onClose]);
  useEffect(()=>{
    const element=root.current,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    if(!element)return;
    const focusable=()=>Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
    document.body.style.overflow='hidden';(focusable()[0]||element).focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&close.current){event.preventDefault();close.current();}
      if(event.key!=='Tab')return;
      const elements=focusable(),first=elements[0],last=elements[elements.length-1];
      if(!first){event.preventDefault();element.focus();return;}
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===element)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===element)){event.preventDefault();first.focus();}
    };
    element.addEventListener('keydown',keydown);
    return()=>{element.removeEventListener('keydown',keydown);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
  },[]);
  return <div ref={root} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={className}>{children}</div>;
}
