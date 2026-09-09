'use client';
import { createContext, ReactNode, useCallback, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ApiError, authenticatedRequest } from '../../lib/authenticated-request';
type Value={request:<T>(path:string,init?:RequestInit)=>Promise<T>}; const Context=createContext<Value|null>(null);
export function DashboardProvider({children}:{children:ReactNode}){const router=useRouter();const pathname=usePathname();const request=useCallback(async<T,>(path:string,init?:RequestInit)=>{try{return await authenticatedRequest<T>(path,init)}catch(error){if(error instanceof ApiError&&error.status===401)router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);throw error}},[pathname,router]);return <Context.Provider value={{request}}>{children}</Context.Provider>}
export function useDashboard(){const value=useContext(Context);if(!value)throw new Error('useDashboard deve ser usado dentro de DashboardProvider');return value}
