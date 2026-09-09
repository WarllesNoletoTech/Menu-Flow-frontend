'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');

  function openMenu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, '');

    if (!normalizedSlug || normalizedSlug.includes('/')) {
      setError('Informe o código da loja para acessar o cardápio.');
      return;
    }

    router.push(`/${encodeURIComponent(normalizedSlug)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft sm:p-10">
        <p className="text-sm font-black tracking-[0.2em] text-stone-500">MENU FLOW</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Seu cardápio digital começa aqui.</h1>
        <p className="mt-4 leading-6 text-stone-600">
          Digite o código da loja ou acesse o link enviado pelo restaurante para fazer seu pedido.
        </p>

        <form className="mt-7" onSubmit={openMenu}>
          <label className="font-bold" htmlFor="restaurant-slug">Código da loja</label>
          <input
            className="field"
            id="restaurant-slug"
            name="restaurant-slug"
            placeholder="Ex.: pizzaria-da-esquina"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              setError('');
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {error && <p className="mt-3 text-sm font-medium text-red-700" role="alert">{error}</p>}
          <button className="mt-5 w-full rounded-xl bg-ink py-4 font-black text-white" type="submit">
            ACESSAR CARDÁPIO
          </button>
        </form>
      </section>
    </main>
  );
}
