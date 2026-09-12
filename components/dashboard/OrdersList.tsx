'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/authenticated-request';
import { currentTuesdayMondayRange, type DateRange } from '../../lib/date-range';
import { paymentMethodLabel } from '../../lib/payment-methods';
import { useOrderSocket } from '../../lib/order-socket';
import { useDashboard } from './DashboardContext';

type RestaurantRef = string | { _id:string; name?:string; tradeName?:string; city?:string; state?:string; blocked?:boolean };
type Order = {
  _id:string; orderNumber:string; publicToken?:string; customerName:string; phone:string;
  total:number; totalCents?:number; subtotalCents?:number; deliveryFeeCents?:number;
  customerServiceFeeCents?:number; discountCents?:number; status:string; createdAt:string;
  completedAt?:string; rejectedAt?:string; cancelledAt?:string;
  fulfillment:string; paymentMethod:string; needsChange?:boolean; changeForCents?:number;
  expectedChangeCents?:number; rejectionReason?:string; cancellationReason?:string;
  address?:Record<string,string>;
  items:Array<{productName:string;unitPrice?:number;unitPriceCents?:number;quantity:number;observation?:string;addons:Array<{name:string;groupName?:string;price?:number;priceCents?:number}>}>;
  rappidexSyncRequested?:boolean; rappidexSyncStatus?:string; rappidexDeliveryId?:string;
  rappidexStatus?:string; rappidexLastUpdateAt?:string; rappidexSyncError?:string;
  rappidexMotoboyName?:string; rappidexMotoboyPhone?:string;
  restaurantId?:RestaurantRef;
};

type ActiveCity = { city:string; state:string; count?:number; restaurants?:number };
type CityOption = { key:string; city:string; state:string; label:string };

export const orderStatus: Record<string,string> = {
  PENDING:'Aguardando aceitação', NEW:'Novo', ACCEPTED:'Aceito', PREPARING:'Em preparo',
  READY:'Pronto', OUT_FOR_DELIVERY:'Saiu para entrega', COMPLETED:'Concluído',
  REJECTED:'Recusado', CANCELLED:'Cancelado',
};
const actions: Record<string,Array<[string,string]>> = {
  PENDING:[['REJECTED','Recusar'],['ACCEPTED','Aceitar pedido']],
  ACCEPTED:[['PREPARING','Iniciar preparo']],
  PREPARING:[['READY','Marcar como pronto']],
  READY:[['OUT_FOR_DELIVERY','Saiu para entrega'],['COMPLETED','Concluir']],
  OUT_FOR_DELIVERY:[['COMPLETED','Concluir']],
};
const money = (value:number) => (value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const itemTotalCents = (item:Order['items'][number]) => {
  const unitPriceCents = item.unitPriceCents ?? Math.round((item.unitPrice ?? 0) * 100);
  const addonsCents = (item.addons ?? []).reduce((sum,addon)=>sum+(addon.priceCents ?? Math.round((addon.price ?? 0) * 100)),0);
  return Math.max(0,item.quantity) * (unitPriceCents + addonsCents);
};
const customerWhatsAppHref = (phone?:string) => {
  let digits=(phone??'').replace(/\D/g,'');
  if(!digits)return '';
  if(digits.startsWith('0'))digits=digits.slice(1);
  if(!digits.startsWith('55'))digits=`55${digits}`;
  return /^55\d{10,11}$/.test(digits)?`https://wa.me/${digits}`:'';
};
const rappidexStatusLabel:Record<string,string>={
  AGUARDANDO_LIBERACAO:'Aguardando liberação',PENDENTE:'Pendente',ACAMINHO:'A caminho',
  CHEGOU_ESTABELECIMENTO:'Chegou ao estabelecimento',COLETADO:'Coletado',
  CHEGOU_DESTINO:'Chegou ao destino',AGUARDANDO_CODIGO:'Aguardando código',FINALIZADO:'Finalizado',CANCELADO:'Cancelado',
};
const groups = {
  pending:{label:'Para aceitar',api:'pending',statuses:['PENDING'],empty:'Nenhum pedido aguardando aceitação.'},
  'in-progress':{label:'Em andamento',api:'in_progress',statuses:['ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY'],empty:'Nenhum pedido em andamento.'},
  completed:{label:'Finalizados',api:'completed',statuses:['COMPLETED'],empty:'Nenhum pedido finalizado neste período.'},
  cancelled:{label:'Cancelados',api:'cancelled',statuses:['REJECTED','CANCELLED'],empty:'Nenhum pedido cancelado neste período.'},
} as const;
type Group = keyof typeof groups;
type Counts = {pending:number;inProgress:number;completed:number;cancelled:number};
type PageResponse = {items:Order[];page:number;limit:number;total:number;hasMore:boolean;counts:Counts};
type TabState = {items:Order[];page:number;hasMore:boolean;loaded:boolean};
const blankTab=():TabState=>({items:[],page:0,hasMore:false,loaded:false});
const blankTabs=():Record<Group,TabState>=>({pending:blankTab(),'in-progress':blankTab(),completed:blankTab(),cancelled:blankTab()});
const groupFor=(status:string):Group|undefined=>(Object.entries(groups).find(([,value])=>(value.statuses as readonly string[]).includes(status))?.[0] as Group|undefined);
const countFor=(counts:Counts,key:Group)=>key==='in-progress'?counts.inProgress:counts[key];
const dedupeSort=(orders:Order[])=>Array.from(new Map(orders.map(order=>[order._id,order])).values()).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
const isHistoryGroup=(group:Group)=>group==='completed'||group==='cancelled';
function actionErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Não foi possível atualizar o pedido. Tente novamente.';
  if(error.status===400)return error.message;
  if(error.status===401)return'Sua sessão expirou. Entre novamente.';
  if(error.status===403)return'Você não possui permissão para alterar este pedido.';
  if(error.status===404)return'Pedido não encontrado.';
  if(error.status===409)return'Este pedido já mudou de status. Atualizamos os dados.';
  return'Não foi possível atualizar o pedido. Tente novamente.';
}

export function OrdersList(props:{customer?:boolean;employee?:boolean;restaurantId?:string;admin?:boolean}) {
  if(props.admin)return <AdminOrders/>;
  if(props.restaurantId&&!props.customer&&!props.employee)return <MerchantOrders restaurantId={props.restaurantId}/>;
  return <LegacyOrders {...props}/>;
}

function MerchantOrders({restaurantId}:{restaurantId:string}) {
  const {request}=useDashboard();
  const router=useRouter();
  const search=useSearchParams();
  const requested=search.get('status');
  const urlGroup=(requested&&requested in groups?requested:undefined) as Group|undefined;
  const [active,setActive]=useState<Group>(urlGroup||'pending');
  const [tabs,setTabs]=useState<Record<Group,TabState>>(()=>blankTabs());
  const [counts,setCounts]=useState<Counts>({pending:0,inProgress:0,completed:0,cancelled:0});
  const [range,setRange]=useState<DateRange>(()=>currentTuesdayMondayRange());
  const [draftRange,setDraftRange]=useState<DateRange>(()=>currentTuesdayMondayRange());
  const [periodError,setPeriodError]=useState('');
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState('');
  const [actionError,setActionError]=useState<{orderId:string;message:string}>();
  const [success,setSuccess]=useState('');
  const [reject,setReject]=useState<Order>();
  const [updatingOrderId,setUpdatingOrderId]=useState<string>();
  const [updatingStatus,setUpdatingStatus]=useState<string>();
  const tabsRef=useRef(tabs);
  useEffect(()=>{tabsRef.current=tabs},[tabs]);

  const fetchPage=useCallback(async(group:Group,page:number,append=false,quiet=false,rangeOverride?:DateRange)=>{
    quiet||page>1?setLoadingMore(page>1):setLoading(true);
    const selectedRange=rangeOverride??range;
    try{
      const params=new URLSearchParams({group:groups[group].api,page:String(page),limit:'10',start:selectedRange.start,end:selectedRange.end});
      const result=await request<PageResponse>(`/restaurants/${restaurantId}/orders?${params.toString()}`);
      setCounts(result.counts);
      setTabs(current=>({...current,[group]:{
        items:dedupeSort(append||quiet?[...result.items,...current[group].items]:result.items),
        page:quiet?Math.max(current[group].page,result.page):result.page,
        hasMore:quiet?current[group].hasMore||result.hasMore:result.hasMore,
        loaded:true,
      }}));
      setError('');
      return result;
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os pedidos.');}
    finally{setLoading(false);setLoadingMore(false);}
  },[request,restaurantId,range]);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const result=await fetchPage(active,1);
      if(cancelled||urlGroup||!result)return;
      const preferred:Group=result.counts.pending?'pending':result.counts.inProgress?'in-progress':'completed';
      if(preferred!==active){setActive(preferred);router.replace(`/empresa/pedidos?status=${preferred}`,{scroll:false});}
    })();
    return()=>{cancelled=true};
    // Initial tenant load only. Date changes are applied explicitly by the filter button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[restaurantId]);

  useEffect(()=>{
    if(urlGroup&&urlGroup!==active){setActive(urlGroup);if(!tabsRef.current[urlGroup].loaded)void fetchPage(urlGroup,1);}
  },[urlGroup,active,fetchPage]);

  const select=(group:Group)=>{
    setActive(group);
    router.replace(`/empresa/pedidos?status=${group}`,{scroll:false});
    if(!tabsRef.current[group].loaded)void fetchPage(group,1);
  };

  const applyOrder=useCallback((updated:Order,previousStatus?:string)=>{
    const destination=groupFor(updated.status);
    const previous=previousStatus?groupFor(previousStatus):undefined;
    setTabs(current=>{
      const next={...current} as Record<Group,TabState>;
      for(const key of Object.keys(groups) as Group[])next[key]={...current[key],items:current[key].items.filter(item=>item._id!==updated._id)};
      if(destination&&next[destination].loaded)next[destination]={...next[destination],items:dedupeSort([updated,...next[destination].items])};
      return next;
    });
    if(previous&&destination&&previous!==destination)setCounts(current=>({
      ...current,
      [previous==='in-progress'?'inProgress':previous]:Math.max(0,countFor(current,previous)-1),
      [destination==='in-progress'?'inProgress':destination]:countFor(current,destination)+1,
    }));
  },[]);

  useOrderSocket(useCallback((_event,value)=>{
    const updated=value as Order;
    if(!updated?._id)return;
    const known=Object.values(tabsRef.current).flatMap(tab=>tab.items).find(item=>item._id===updated._id);
    applyOrder(updated,known?.status);
    void fetchPage(active,1,false,true);
  },[active,applyOrder,fetchPage]));
  useEffect(()=>{const timer=setInterval(()=>void fetchPage(active,1,false,true),30000);return()=>clearInterval(timer)},[active,fetchPage]);

  function applyPeriod(){
    if(!draftRange.start||!draftRange.end){setPeriodError('Informe a data inicial e a data final.');return;}
    if(draftRange.start>draftRange.end){setPeriodError('A data inicial não pode ser maior que a data final.');return;}
    setPeriodError('');
    setRange(draftRange);
    setTabs(current=>({...current,completed:blankTab(),cancelled:blankTab()}));
    void fetchPage(active,1,false,false,draftRange);
  }

  async function change(order:Order,status:string,reason?:string){
    if(updatingOrderId)return;
    setUpdatingOrderId(order._id);setUpdatingStatus(status);setActionError(undefined);
    try{
      const updated=await request<Order>(`/restaurants/${restaurantId}/orders/${order._id}/status`,{method:'PATCH',body:JSON.stringify({status,...(reason?{reason}:{})})});
      applyOrder(updated,order.status);
      setReject(undefined);
      setSuccess(status==='ACCEPTED'?'Pedido aceito.':status==='REJECTED'?'Pedido recusado.':'Status do pedido atualizado.');
      window.dispatchEvent(new CustomEvent('menu-flow:orders-updated'));
      void fetchPage(active,1,false,true);
    }catch(e){setActionError({orderId:order._id,message:actionErrorMessage(e)});throw e;}
    finally{setUpdatingOrderId(undefined);setUpdatingStatus(undefined);}
  }

  const tab=tabs[active];
  return <div className="mt-5">
    <OrderTabs active={active} counts={counts} select={select}/>
    {isHistoryGroup(active)&&<DateFilter draft={draftRange} setDraft={setDraftRange} apply={applyPeriod} error={periodError}/>} 
    {success&&<p role="status" className="mt-4 rounded-xl bg-success/10 p-3 font-bold text-success">{success}</p>}
    {error&&<p role="alert" className="mt-4 rounded-xl bg-danger/10 p-4 font-bold text-danger">{error}</p>}
    {loading&&!tab.loaded?<p className="mt-4 rounded-xl bg-surface p-5">Carregando pedidos...</p>:<div className="mt-4 grid gap-4 xl:grid-cols-2">{tab.items.map(order=><OrderCard key={order._id} order={order} updatingOrderId={updatingOrderId} updatingStatus={updatingStatus} actionError={actionError} onReject={setReject} onChange={change}/>)}{!tab.items.length&&<p className="rounded-2xl border border-dashed bg-surface p-8 text-center text-stone-500 xl:col-span-2">{groups[active].empty}</p>}</div>}
    {tab.hasMore&&<div className="mt-5 text-center"><button disabled={loadingMore} onClick={()=>void fetchPage(active,tab.page+1,true)} className="rounded-xl border border-ink bg-surface px-6 py-3 font-black text-ink disabled:opacity-50">{loadingMore?'Carregando...':'Mostrar mais'}</button></div>}
    {reject&&<RejectModal close={()=>setReject(undefined)} error={actionError?.orderId===reject._id?actionError.message:undefined} submit={reason=>change(reject,'REJECTED',reason)}/>} 
  </div>;
}

function AdminOrders() {
  const {request}=useDashboard();
  const router=useRouter();
  const search=useSearchParams();
  const requested=search.get('status');
  const urlGroup=(requested&&requested in groups?requested:undefined) as Group|undefined;
  const [active,setActive]=useState<Group>(urlGroup||'pending');
  const [tabs,setTabs]=useState<Record<Group,TabState>>(()=>blankTabs());
  const [counts,setCounts]=useState<Counts>({pending:0,inProgress:0,completed:0,cancelled:0});
  const [range,setRange]=useState<DateRange>(()=>currentTuesdayMondayRange());
  const [draftRange,setDraftRange]=useState<DateRange>(()=>currentTuesdayMondayRange());
  const [periodError,setPeriodError]=useState('');
  const [cities,setCities]=useState<ActiveCity[]>([]);
  const [cityFilter,setCityFilter]=useState('');
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [actionError,setActionError]=useState<{orderId:string;message:string}>();
  const [reject,setReject]=useState<Order>();
  const [updatingOrderId,setUpdatingOrderId]=useState<string>();
  const [updatingStatus,setUpdatingStatus]=useState<string>();
  const tabsRef=useRef(tabs);
  useEffect(()=>{tabsRef.current=tabs},[tabs]);

  const cityOptions=Array.from(new Map<string,CityOption>(cities.map(item=>{
    const state=(item.state??'').toUpperCase();
    const city=item.city.trim();
    const key=`${state}::${city}`;
    return [key,{key,city,state,label:state?`${city} / ${state}`:city}] as [string,CityOption];
  })).values()).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));

  const fetchPage=useCallback(async(group:Group,page:number,append=false,quiet=false,rangeOverride?:DateRange,cityOverride?:string)=>{
    quiet||page>1?setLoadingMore(page>1):setLoading(true);
    const selectedRange=rangeOverride??range;
    const selectedCity=cityOverride??cityFilter;
    const params=new URLSearchParams({group:groups[group].api,page:String(page),limit:'10',start:selectedRange.start,end:selectedRange.end});
    if(selectedCity){
      const separator=selectedCity.indexOf('::');
      const state=separator>=0?selectedCity.slice(0,separator):'';
      const city=separator>=0?selectedCity.slice(separator+2):selectedCity;
      params.set('city',city);
      if(state)params.set('state',state);
    }
    try{
      const result=await request<PageResponse>(`/admin/orders?${params.toString()}`);
      setCounts(result.counts);
      setTabs(current=>({...current,[group]:{
        items:dedupeSort(append||quiet?[...result.items,...current[group].items]:result.items),
        page:quiet?Math.max(current[group].page,result.page):result.page,
        hasMore:quiet?current[group].hasMore||result.hasMore:result.hasMore,
        loaded:true,
      }}));
      setError('');
      return result;
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os pedidos.');}
    finally{setLoading(false);setLoadingMore(false);}
  },[request,range,cityFilter]);

  useEffect(()=>{
    void request<ActiveCity[]>('/public/cities',{cache:'no-store'}).then(setCities).catch(()=>setCities([]));
    void fetchPage(active,1);
    // Initial admin load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    if(urlGroup&&urlGroup!==active){setActive(urlGroup);if(!tabsRef.current[urlGroup].loaded)void fetchPage(urlGroup,1);}
  },[urlGroup,active,fetchPage]);
  useEffect(()=>{const timer=setInterval(()=>void fetchPage(active,1),30000);return()=>clearInterval(timer)},[active,fetchPage]);

  const select=(group:Group)=>{
    setActive(group);
    router.replace(`/admin/pedidos?status=${group}`,{scroll:false});
    if(!tabsRef.current[group].loaded)void fetchPage(group,1);
  };

  function applyPeriod(){
    if(!draftRange.start||!draftRange.end){setPeriodError('Informe a data inicial e a data final.');return;}
    if(draftRange.start>draftRange.end){setPeriodError('A data inicial não pode ser maior que a data final.');return;}
    setPeriodError('');
    setRange(draftRange);
    setTabs(current=>({...current,completed:blankTab(),cancelled:blankTab()}));
    void fetchPage(active,1,false,false,draftRange);
  }

  function changeCity(value:string){
    setCityFilter(value);
    setTabs(blankTabs());
    void fetchPage(active,1,false,false,range,value);
  }

  async function change(order:Order,status:string,reason?:string){
    if(updatingOrderId)return;
    const restaurantId=typeof order.restaurantId==='object'?order.restaurantId._id:order.restaurantId;
    if(!restaurantId){setActionError({orderId:order._id,message:'Não foi possível identificar o estabelecimento deste pedido.'});return;}
    setUpdatingOrderId(order._id);setUpdatingStatus(status);setActionError(undefined);
    try{
      await request<Order>(`/restaurants/${restaurantId}/orders/${order._id}/status`,{method:'PATCH',body:JSON.stringify({status,...(reason?{reason}:{})})});
      setReject(undefined);
      setSuccess(status==='ACCEPTED'?'Pedido aceito.':status==='REJECTED'?'Pedido recusado.':'Status do pedido atualizado.');
      await fetchPage(active,1);
    }catch(e){setActionError({orderId:order._id,message:actionErrorMessage(e)});throw e;}
    finally{setUpdatingOrderId(undefined);setUpdatingStatus(undefined);}
  }

  const tab=tabs[active];
  return <div className="mt-5">
    <div className="mb-4 rounded-2xl border bg-surface p-4 shadow-sm">
      <label className="block max-w-md text-sm font-bold">Cidade
        <select className="field !mt-2" value={cityFilter} onChange={event=>changeCity(event.target.value)}>
          <option value="">Todas as cidades ativas</option>
          {cityOptions.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </label>
      <p className="mt-2 text-xs text-stone-500">A lista considera somente estabelecimentos ativos (não bloqueados).</p>
    </div>
    <OrderTabs active={active} counts={counts} select={select}/>
    {isHistoryGroup(active)&&<DateFilter draft={draftRange} setDraft={setDraftRange} apply={applyPeriod} error={periodError}/>} 
    {success&&<p role="status" className="mt-4 rounded-xl bg-success/10 p-3 font-bold text-success">{success}</p>}
    {error&&<p role="alert" className="mt-4 rounded-xl bg-danger/10 p-4 font-bold text-danger">{error}</p>}
    {loading&&!tab.loaded?<p className="mt-4 rounded-xl bg-surface p-5">Carregando pedidos...</p>:<div className="mt-4 grid gap-4 xl:grid-cols-2">{tab.items.map(order=><OrderCard key={order._id} order={order} showRestaurant updatingOrderId={updatingOrderId} updatingStatus={updatingStatus} actionError={actionError} onReject={setReject} onChange={change}/>)}{!tab.items.length&&<p className="rounded-2xl border border-dashed bg-surface p-8 text-center text-stone-500 xl:col-span-2">{groups[active].empty}</p>}</div>}
    {tab.hasMore&&<div className="mt-5 text-center"><button disabled={loadingMore} onClick={()=>void fetchPage(active,tab.page+1,true)} className="rounded-xl border border-ink bg-surface px-6 py-3 font-black text-ink disabled:opacity-50">{loadingMore?'Carregando...':'Mostrar mais'}</button></div>}
    {reject&&<RejectModal close={()=>setReject(undefined)} error={actionError?.orderId===reject._id?actionError.message:undefined} submit={reason=>change(reject,'REJECTED',reason)}/>} 
  </div>;
}

function OrderTabs({active,counts,select}:{active:Group;counts:Counts;select:(group:Group)=>void}){
  return <div role="tablist" aria-label="Grupos de pedidos" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
    {(Object.keys(groups) as Group[]).map(key=>{
      const selected=active===key;
      const count=countFor(counts,key);
      return <button role="tab" aria-selected={selected} key={key} onClick={()=>select(key)} className={`flex min-w-0 items-center justify-between gap-2 whitespace-nowrap rounded-xl border px-3 py-3 text-sm font-black transition ${selected?'border-ink bg-ink text-white':'border-stone-200 bg-surface hover:border-accent'} ${key==='pending'&&count&&!selected?'border-accent':''}`}>
        <span>{groups[key].label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${key==='pending'&&count?'bg-accent text-white':selected?'bg-white/20':'bg-background'}`}>{count}</span>
      </button>;
    })}
  </div>;
}

function DateFilter({draft,setDraft,apply,error}:{draft:DateRange;setDraft:(value:DateRange)=>void;apply:()=>void;error:string}){
  return <div className="mt-4 rounded-2xl border bg-surface p-4 shadow-sm">
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-sm font-bold">Data inicial
        <input type="date" className="field !mt-2" value={draft.start} onChange={event=>setDraft({...draft,start:event.target.value})}/>
      </label>
      <label className="text-sm font-bold">Data final
        <input type="date" className="field !mt-2" value={draft.end} onChange={event=>setDraft({...draft,end:event.target.value})}/>
      </label>
      <button type="button" onClick={apply} className="h-fit rounded-xl bg-ink px-5 py-3 font-black text-white">FILTRAR</button>
    </div>
    <p className="mt-2 text-xs text-stone-500">Por padrão, o período vem preenchido da terça-feira mais recente até a próxima segunda-feira.</p>
    {error&&<p role="alert" className="mt-2 text-sm font-bold text-danger">{error}</p>}
  </div>;
}

function statusClass(status:string){if(['COMPLETED','READY'].includes(status))return'bg-success/10 text-success';if(['REJECTED','CANCELLED'].includes(status))return'bg-danger/10 text-danger';if(['PENDING','PREPARING'].includes(status))return'bg-accent/15 text-accent';return'bg-background text-ink'}
function OrderCard({order:o,showRestaurant=false,updatingOrderId,updatingStatus,actionError,onReject,onChange}:{order:Order;showRestaurant?:boolean;updatingOrderId?:string;updatingStatus?:string;actionError?:{orderId:string;message:string};onReject:(o:Order)=>void;onChange:(o:Order,s:string,r?:string)=>Promise<void>}){
  const restaurant=typeof o.restaurantId==='object'?o.restaurantId:undefined;
  const rappidexManaged=Boolean(o.rappidexDeliveryId)||Boolean(o.rappidexSyncRequested)||['SYNCED','PENDING','FAILED','CANCEL_PENDING'].includes(o.rappidexSyncStatus||'');
  const motoboyHref=customerWhatsAppHref(o.rappidexMotoboyPhone);
  return <article className={`min-w-0 rounded-2xl border bg-surface p-5 shadow-sm ${o.status==='PENDING'?'border-accent ring-2 ring-accent/20':''}`}>
    <header className="flex flex-wrap justify-between gap-2"><div><strong className="text-lg">#{o.orderNumber||o._id.slice(-6)}</strong>{showRestaurant&&restaurant&&<p className="mt-1 text-sm font-bold text-ink">{restaurant.tradeName||restaurant.name||'Estabelecimento'}{restaurant.city&&<span className="font-normal text-stone-500"> · {restaurant.city}{restaurant.state?` / ${restaurant.state}`:''}</span>}</p>}<p className="text-sm text-stone-500">{o.customerName} • {new Date(o.createdAt).toLocaleString('pt-BR')}</p></div><span className={`h-fit rounded-full px-3 py-2 text-xs font-black ${statusClass(o.status)}`}>{o.status==='READY'&&o.fulfillment==='PICKUP'?'Pronto para retirada':orderStatus[o.status]||o.status}</span></header>
    <div className="mt-4 space-y-3 border-y py-4">{o.items?.map((item,i)=><div key={i}><div className="flex items-start justify-between gap-4"><b className="min-w-0">{item.quantity}x {item.productName}</b><b className="shrink-0">{money(itemTotalCents(item))}</b></div>{item.addons?.length>0&&<p className="text-sm text-stone-500">+ {item.addons.map(a=>a.name).join(', ')}</p>}{item.observation&&<p className="text-sm">Obs.: {item.observation}</p>}</div>)}</div>
    <div className="mt-4 text-sm"><p><b>{o.fulfillment==='DELIVERY'?'ENTREGA':'RETIRADA'}</b></p>{o.phone&&(()=>{const href=customerWhatsAppHref(o.phone);return <p className="mt-2 flex flex-wrap items-center gap-2"><span>Telefone:</span>{href?<a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp de ${o.customerName}`} className="inline-flex items-center gap-1.5 font-bold text-success underline underline-offset-2"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z"/><path d="M9.1 8.2c.2-.3.4-.3.6-.3h.4c.2 0 .4.1.5.4l.8 1.9c.1.3.1.5-.1.7l-.6.8c-.1.2-.1.3 0 .5.6 1.2 1.5 2.1 2.7 2.7.2.1.4.1.5-.1l.8-1c.2-.2.4-.3.7-.2l1.8.8c.3.1.4.3.4.6 0 .4-.2 1.3-.8 1.8-.5.5-1.3.8-2.1.8-1.1 0-2.7-.5-4.4-2-2-1.7-3.2-4.2-3.3-5.7 0-.7.2-1.3.5-1.7l.6-1Z"/></svg><span>WhatsApp {o.phone}</span></a>:<b>{o.phone}</b>}</p>})()}{o.address&&<div className="mt-2"><p>{o.address.street}, {o.address.number}</p><p>{o.address.neighborhood}</p><p>{o.address.city} - {o.address.state} · CEP {o.address.zipCode}</p>{o.address.complement&&<p>Complemento: {o.address.complement}</p>}{o.address.reference&&<p>Referência: {o.address.reference}</p>}</div>}<p className="mt-2">Pagamento: <b>{paymentMethodLabel(o.paymentMethod)}</b></p>{o.paymentMethod==='CASH'&&<p>Troco: <b>{o.needsChange?`para ${money(o.changeForCents||0)} · estimado ${money(o.expectedChangeCents||0)}`:'não precisa'}</b></p>}</div>
    <div className="mt-4 space-y-1 text-sm"><p className="flex justify-between"><span>Subtotal</span><b>{money(o.subtotalCents??0)}</b></p><p className="flex justify-between"><span>Taxa de entrega</span><b>{money(o.deliveryFeeCents??0)}</b></p><p className="flex justify-between"><span>Taxa de serviço Menu Flow</span><b>{money(o.customerServiceFeeCents??0)}</b></p><p className="flex justify-between text-lg font-black"><span>Total pago pelo cliente</span><span>{money(o.totalCents??Math.round(o.total*100))}</span></p></div>
    {(o.rappidexDeliveryId||o.rappidexStatus||o.rappidexSyncStatus)&&<div className="mt-4 rounded-xl border border-stone-200 bg-background p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><b className="rounded-full bg-ink px-3 py-1 text-xs text-white">RAPPIDEX</b>{o.rappidexStatus&&<b>{rappidexStatusLabel[o.rappidexStatus]||o.rappidexStatus}</b>}</div>{o.rappidexDeliveryId&&<p className="mt-2 text-xs text-stone-500">Entrega: {o.rappidexDeliveryId}</p>}{o.rappidexMotoboyName&&<p className="mt-2">Motoboy: <b>{o.rappidexMotoboyName}</b></p>}{o.rappidexMotoboyPhone&&<p className="mt-1">Telefone: {motoboyHref?<a href={motoboyHref} target="_blank" rel="noopener noreferrer" className="font-bold text-success underline underline-offset-2">WhatsApp {o.rappidexMotoboyPhone}</a>:<b>{o.rappidexMotoboyPhone}</b>}</p>}{o.rappidexSyncStatus==='FAILED'&&o.rappidexSyncError&&<p className="mt-2 text-danger">Sincronização pendente: {o.rappidexSyncError}</p>}</div>}
    {!['COMPLETED','REJECTED','CANCELLED'].includes(o.status)&&<div className="mt-4 flex flex-wrap justify-end gap-2">{(actions[o.status]||[]).filter(([s])=>!(o.fulfillment==='PICKUP'&&s==='OUT_FOR_DELIVERY')&&!(o.fulfillment==='DELIVERY'&&o.status==='READY'&&s==='COMPLETED')&&!(rappidexManaged&&s==='OUT_FOR_DELIVERY')).map(([status,label])=><button key={status} disabled={Boolean(updatingOrderId)} onClick={()=>status==='REJECTED'?onReject(o):void onChange(o,status).catch(()=>undefined)} className={`rounded-xl px-4 py-3 font-bold disabled:opacity-50 ${status==='REJECTED'?'border text-danger':'bg-ink text-white'}`}>{updatingOrderId===o._id&&updatingStatus===status?'Atualizando...':label}</button>)}</div>}
    {actionError?.orderId===o._id&&<p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 font-bold text-danger">{actionError.message}</p>}
    {(o.rejectionReason||o.cancellationReason)&&<p className="mt-3 rounded-xl bg-danger/10 p-3 text-danger">Motivo: {o.rejectionReason||o.cancellationReason}</p>}
  </article>;
}

function LegacyOrders({customer=false,employee=false}:{customer?:boolean;employee?:boolean;restaurantId?:string;admin?:boolean}){
  const {request}=useDashboard();
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const path=customer?'/customer/orders':'/employee/orders';
  const load=useCallback(async()=>{setOrders(await request<Order[]>(path));setLoading(false)},[path,request]);
  useEffect(()=>{void load()},[load]);
  useOrderSocket(useCallback(()=>{void load()},[load]));
  if(loading)return <p className="mt-5">Carregando pedidos...</p>;
  return <div className="mt-5 grid gap-4 xl:grid-cols-2">{orders.map(o=><article key={o._id} className="rounded-2xl bg-surface p-5"><b>#{o.orderNumber}</b><p>{orderStatus[o.status]}</p>{customer&&<Link href={`/acompanhar/${o.orderNumber}?token=${encodeURIComponent(o.publicToken||'')}`} className="mt-3 inline-block font-bold text-accent">Acompanhar pedido</Link>}</article>)}</div>;
}

function RejectModal({close,submit,error}:{close:()=>void;submit:(reason:string)=>Promise<void>;error?:string}) {
  const [quick,setQuick]=useState('');
  const [detail,setDetail]=useState('');
  const [busy,setBusy]=useState(false);
  const reason=quick==='Outro'?detail.trim():[quick,detail.trim()].filter(Boolean).join(' — ');
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"><form onSubmit={async event=>{event.preventDefault();if(!reason||busy)return;setBusy(true);try{await submit(reason)}catch{}finally{setBusy(false)}}} className="mx-auto my-8 w-full max-w-md rounded-2xl bg-surface p-5"><h2 className="text-xl font-black">Motivo da recusa</h2><label className="mt-4 block font-bold">Motivo rápido<select required className="field" value={quick} onChange={event=>setQuick(event.target.value)}><option value="">Selecione…</option><option>Produto indisponível</option><option>Loja encerrando atendimento</option><option>Não conseguimos atender o pedido</option><option>Problema com endereço</option><option>Outro</option></select></label><label className="mt-3 block font-bold">{quick==='Outro'?'Descreva o motivo':'Observação adicional (opcional)'}<textarea required={quick==='Outro'} maxLength={500} className="field min-h-24" value={detail} onChange={event=>setDetail(event.target.value)}/></label>{error&&<p role="alert" className="mt-4 rounded-xl bg-danger/10 p-3 font-bold text-danger">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} onClick={close} className="rounded-xl border px-4 py-3 font-bold">Voltar</button><button disabled={!reason||busy} className="rounded-xl bg-danger px-4 py-3 font-bold text-white disabled:opacity-50">{busy?'Recusando...':'Recusar pedido'}</button></div></form></div>;
}
