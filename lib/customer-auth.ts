export type CustomerAuthMode = 'login' | 'register';

export function customerAuthPayload(mode: CustomerAuthMode, form: FormData) {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  return mode === 'register'
    ? {
        name: String(form.get('name') ?? '').trim(),
        phone: String(form.get('phone') ?? '').trim(),
        email,
        password,
      }
    : { email, password };
}
