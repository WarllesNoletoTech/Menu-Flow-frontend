'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../lib/authenticated-request';
import { paymentMethodLabel } from '../../lib/payment-methods';
import { useOrderSocket } from '../../lib/order-socket';
import { useDashboard } from './DashboardContext';

type Order = { _id:string; orderNumber:string; publicToken?:string; customerName:string; phone:string; total:number; totalCents?:number; subtotalCents?:number; deliveryFeeCents?:number; discountCents?:number; status:string; createdAt:string; fulfillment:string; paymentMethod:string; needsChange?:boolean; changeForCents?:number; expectedChangeCents?:number; rejectionReason?:string; address?:Record<string,string>; items:Array<{productName:string;quantity:number;observation?:string;addons:Array<{name:string;groupName?:string}>}>; restaurantId?:{name?:string;tradeName?:string} };
export const orderStatus: Record<string,string> = { PENDING:'Aguardando aceitação', NEW:'Novo', ACCEPTED:'Aceito', PREPARING:'Em preparo', READY:'Pronto', OUT_FOR_DELIVERY:'Saiu para entrega', COMPLETED:'Concluído', REJECTED:'Recusado', CANCELLED:'Cancelado' };
const actions: Record<string,Array<[string,string]>> = { PENDING:[['REJECTED','Recusar'],['ACCEPTED','Aceitar']], ACCEPTED:[['PREPARING','Iniciar preparo']], PREPARING:[['READY','Marcar como pronto']], READY:[['OUT_FOR_DELIVERY','Saiu para entrega'],['COMPLETED','Concluir']], OUT_FOR_DELIVERY:[['COMPLETED','Marcar entregue']] };
const money = (value:number) => (value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

function actionErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Não foi possível atualizar o pedido. Tente novamente.';
  if (error.status === 400) return error.message;
  if (error.status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (error.status === 403) return 'Você não possui permissão para alterar este pedido.';
  if (error.status === 404) return 'Pedido não encontrado.';
  if (error.status === 409) return 'Este pedido já mudou de status. Atualizamos os dados.';
  return 'Não foi possível atualizar o pedido. Tente novamente.';
}

export function OrdersList({customer=false,employee=false,restaurantId}:{customer?:boolean;employee?:boolean;restaurantId?:string}) {
  const {request}=useDashboard();
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [actionError,setActionError]=useState<{orderId:string;message:string}>();
  const [success,setSuccess]=useState('');
  const [reject,setReject]=useState<Order>();
  const [updatingOrderId,setUpdatingOrderId]=useState<string>();
  const [updatingStatus,setUpdatingStatus]=useState<string>();
  const path=customer?'/customer/orders':employee?'/employee/orders':restaurantId?`/restaurants/${restaurantId}/orders`:'';
  const load=useCallback(async(showLoading=false)=>{if(!path)return;if(showLoading)setLoading(true);try{setOrders(await request<Order[]>(path));setError('')}catch(e){setError(e instanceof ApiError&&e.status===401?'Sua sessão expirou. Entre novamente.':e instanceof ApiError&&e.status===403?'Você não possui permissão para consultar os pedidos.':e instanceof ApiError&&e.status&&e.status>=500?'Não foi possível carregar os pedidos.':e instanceof Error?e.message:'Não foi possível carregar os pedidos.')}finally{if(showLoading)setLoading(false)}},[path,request]);
  useOrderSocket(useCallback(()=>{load().catch(()=>undefined)},[load]));
  useEffect(()=>{load(true).catch(()=>undefined);const timer=setInterval(()=>load().catch(()=>undefined),30000);return()=>clearInterval(timer)},[load]);

  async function handleStatusChange(order:Order,status:string,reason?:string) {
    if(updatingOrderId)return;
    const endpoint=employee?`/employee/orders/${order._id}/status`:`/restaurants/${restaurantId}/orders/${order._id}/status`;
    setUpdatingOrderId(order._id);setUpdatingStatus(status);setActionError(undefined);setSuccess('');
    try {
      const updated=await request<Order>(endpoint,{method:'PATCH',body:JSON.stringify({status,...(reason?{reason}:{})})});
      setOrders(current=>current.map(item=>item._id===updated._id?updated:item));
      setReject(undefined);
      setSuccess(status==='ACCEPTED'?'Pedido aceito.':status==='REJECTED'?'Pedido recusado.':'Status do pedido atualizado.');
      window.dispatchEvent(new CustomEvent('menu-flow:orders-updated'));
    } catch (caught) {
      setActionError({orderId:order._id,message:actionErrorMessage(caught)});
      if(caught instanceof ApiError&&caught.status===409) await load();
      throw caught;
    } finally { setUpdatingOrderId(undefined);setUpdatingStatus(undefined); }
  }

  if(loading)return <p className="mt-5 rounded-xl bg-surface p-4">Carregando pedidos…</p>;
  if(error)return <p role="alert" className="mt-5 rounded-xl bg-danger/10 p-4 font-bold text-danger">{error}</p>;
  return <div className="mt-5 grid gap-4 xl:grid-cols-2">
    {success&&<p role="status" className="xl:col-span-2 rounded-xl bg-success/10 p-3 font-bold text-success">{success}</p>}
    {orders.map(o=><article key={o._id} className={`min-w-0 rounded-2xl border bg-surface p-5 shadow-sm ${o.status==='PENDING'?'border-accent ring-2 ring-accent/20':''}`}>
      <header className="flex flex-wrap justify-between gap-2"><div><strong className="text-lg">#{o.orderNumber||o._id.slice(-6)}</strong><p className="text-sm text-stone-500">{o.customerName} • {new Date(o.createdAt).toLocaleString('pt-BR')}</p></div><span className="h-fit rounded-full bg-background px-3 py-2 text-xs font-black">{o.status==='READY'&&o.fulfillment==='PICKUP'?'Pronto para retirada':orderStatus[o.status]||o.status}</span></header>
      {customer?<><p className="mt-4">{o.restaurantId?.tradeName||o.restaurantId?.name} · {o.fulfillment==='DELIVERY'?'Entrega':'Retirada'}</p><p className="mt-2">Pagamento: <b>{paymentMethodLabel(o.paymentMethod)}</b></p><Link className="mt-4 inline-flex rounded-xl bg-ink px-4 py-3 font-bold text-white" href={`/acompanhar/${o.orderNumber}?token=${encodeURIComponent(o.publicToken||'')}`}>{['COMPLETED','REJECTED','CANCELLED'].includes(o.status)?'Ver detalhes':'Acompanhar pedido'}</Link></>:<><div className="mt-4 space-y-3 border-y py-4">{o.items?.map((item,i)=><div key={i}><b>{item.quantity}x {item.productName}</b>{item.addons?.length>0&&<p className="text-sm text-stone-500">+ {item.addons.map(a=>a.name).join(', ')}</p>}{item.observation&&<p className="text-sm">Obs.: {item.observation}</p>}</div>)}</div><div className="mt-4 text-sm"><p><b>{o.fulfillment==='DELIVERY'?'ENTREGA':'RETIRADA'}</b></p>{o.address&&<p>{o.address.neighborhood} • {o.address.street}, {o.address.number}</p>}<p className="mt-2">Pagamento: <b>{paymentMethodLabel(o.paymentMethod)}</b></p>{o.paymentMethod==='CASH'&&<p>Troco: <b>{o.needsChange?`para ${money(o.changeForCents||0)} · estimado ${money(o.expectedChangeCents||0)}`:'não precisa'}</b></p>}</div></>}
      <p className="mt-4 flex justify-between text-lg font-black"><span>Total</span><span>{money(o.totalCents??Math.round(o.total*100))}</span></p>
      {!customer&&<div className="mt-4 flex flex-wrap justify-end gap-2">{(actions[o.status]||[]).filter(([status])=>!(o.fulfillment==='PICKUP'&&status==='OUT_FOR_DELIVERY')).map(([status,label])=>{const busy=updatingOrderId===o._id;return <button key={status} disabled={Boolean(updatingOrderId)} onClick={async()=>{if(status==='REJECTED'){setActionError(undefined);setReject(o);return}try{await handleStatusChange(o,status)}catch{}}} className={`rounded-xl px-4 py-3 font-bold disabled:opacity-50 ${status==='REJECTED'?'border text-danger':'bg-ink text-white'}`}>{busy&&updatingStatus===status?(status==='ACCEPTED'?'Aceitando...':'Atualizando...'):label}</button>})}</div>}
      {actionError?.orderId===o._id&&<p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 font-bold text-danger">{actionError.message}</p>}
      {o.rejectionReason&&<p className="mt-3 rounded-xl bg-danger/10 p-3 text-danger">Motivo: {o.rejectionReason}</p>}
    </article>)}
    {!orders.length&&<p className="rounded-2xl border border-dashed bg-surface p-8 text-center text-stone-500">Nenhum pedido encontrado.</p>}
    {reject&&<RejectModal close={()=>{if(!updatingOrderId)setReject(undefined)}} error={actionError?.orderId===reject._id?actionError.message:undefined} submit={reason=>handleStatusChange(reject,'REJECTED',reason)}/>}
  </div>
}

function RejectModal({close,submit,error}:{close:()=>void;submit:(reason:string)=>Promise<void>;error?:string}) {
  const [quick,setQuick]=useState('');const [detail,setDetail]=useState('');const [busy,setBusy]=useState(false);const reason=quick==='Outro'?detail.trim():[quick,detail.trim()].filter(Boolean).join(' — ');
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"><form onSubmit={async event=>{event.preventDefault();if(!reason||busy)return;setBusy(true);try{await submit(reason)}catch{}finally{setBusy(false)}}} className="mx-auto my-8 w-full max-w-md rounded-2xl bg-surface p-5"><h2 className="text-xl font-black">Motivo da recusa</h2><label className="mt-4 block font-bold">Motivo rápido<select required className="field" value={quick} onChange={event=>setQuick(event.target.value)}><option value="">Selecione…</option><option>Produto indisponível</option><option>Loja encerrando atendimento</option><option>Não conseguimos atender o pedido</option><option>Problema com endereço</option><option>Outro</option></select></label><label className="mt-3 block font-bold">{quick==='Outro'?'Descreva o motivo':'Observação adicional (opcional)'}<textarea required={quick==='Outro'} maxLength={500} className="field min-h-24" value={detail} onChange={event=>setDetail(event.target.value)}/></label>{error&&<p role="alert" className="mt-4 rounded-xl bg-danger/10 p-3 font-bold text-danger">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} onClick={close} className="rounded-xl border px-4 py-3 font-bold">Voltar</button><button disabled={!reason||busy} className="rounded-xl bg-danger px-4 py-3 font-bold text-white disabled:opacity-50">{busy?'Recusando...':'Recusar pedido'}</button></div></form></div>
}
