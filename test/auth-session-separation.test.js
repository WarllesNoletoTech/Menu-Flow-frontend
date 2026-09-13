const assert = require('node:assert/strict');
const test = require('node:test');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

global.localStorage = new MemoryStorage();
global.sessionStorage = new MemoryStorage();

const auth = require('../.test-dist/auth.js');

const merchant = {
  accessToken: 'merchant-token',
  user: { id: 'merchant-1', name: 'Loja Teste', role: 'RESTAURANT_ADMIN', restaurantId: 'restaurant-1' },
};
const customer = {
  accessToken: 'customer-token',
  user: { id: 'customer-1', name: 'Cliente Teste', role: 'CUSTOMER' },
};

test.beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test('login de cliente não substitui a sessão do lojista no mesmo aparelho', () => {
  auth.saveSession(merchant);
  auth.saveCustomerSession(customer);

  assert.equal(auth.getSession()?.accessToken, 'merchant-token');
  assert.equal(auth.getSession()?.user.role, 'RESTAURANT_ADMIN');
  assert.equal(auth.getCustomerSession()?.accessToken, 'customer-token');
  assert.equal(auth.getCustomerSession()?.user.role, 'CUSTOMER');
});

test('logout do cliente preserva a sessão do lojista', () => {
  auth.saveSession(merchant);
  auth.saveCustomerSession(customer);

  auth.clearCustomerSession();

  assert.equal(auth.getCustomerSession(), null);
  assert.equal(auth.getSession()?.accessToken, 'merchant-token');
});

test('logout do lojista preserva a sessão do cliente', () => {
  auth.saveSession(merchant);
  auth.saveCustomerSession(customer);

  auth.clearSession();

  assert.equal(auth.getSession(), null);
  assert.equal(auth.getCustomerSession()?.accessToken, 'customer-token');
});

test('migra a sessão única antiga sem misturar cliente e lojista', () => {
  localStorage.setItem('menu-flow.auth-session', JSON.stringify(customer));

  assert.equal(auth.getSession(), null);
  assert.equal(auth.getCustomerSession()?.accessToken, 'customer-token');
  assert.equal(localStorage.getItem('menu-flow.auth-session'), null);
});
