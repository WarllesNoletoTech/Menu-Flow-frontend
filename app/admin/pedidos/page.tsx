'use client';
import { OrdersList } from '../../../components/dashboard/OrdersList';

export default function Page(){
  return <section className="mx-auto max-w-7xl">
    <h1 className="text-3xl font-black">Pedidos</h1>
    <p className="mt-1 text-stone-500">Acompanhe os pedidos dos estabelecimentos ativos de todas as cidades ou filtre uma cidade específica.</p>
    <OrdersList admin/>
  </section>;
}
