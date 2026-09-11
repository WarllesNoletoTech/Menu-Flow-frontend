const assert = require('node:assert/strict');
const test = require('node:test');
const { customerAuthPayload } = require('../.test-dist/customer-auth.js');

test('login envia exclusivamente e-mail normalizado e senha', () => {
  const form = new FormData();
  form.set('name', 'Propriedade indevida');
  form.set('phone', '11999999999');
  form.set('confirmPassword', 'segredo123');
  form.set('role', 'RESTAURANT_ADMIN');
  form.set('email', '  CLIENTE@EXEMPLO.COM ');
  form.set('password', 'segredo123');
  assert.deepEqual(customerAuthPayload('login', form), { email: 'cliente@exemplo.com', password: 'segredo123' });
});

test('cadastro envia os quatro campos previstos, sem confirmação', () => {
  const form = new FormData();
  form.set('name', '  Maria Silva ');
  form.set('phone', ' 11999999999 ');
  form.set('email', ' MARIA@EXEMPLO.COM ');
  form.set('password', 'segredo123');
  form.set('confirmPassword', 'segredo123');
  assert.deepEqual(customerAuthPayload('register', form), { name: 'Maria Silva', phone: '11999999999', email: 'maria@exemplo.com', password: 'segredo123' });
});
