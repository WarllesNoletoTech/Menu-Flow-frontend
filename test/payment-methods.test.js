const test = require('node:test');
const assert = require('node:assert/strict');
const { paymentMethodLabel } = require('../.test-dist/payment-methods');

test('traduz todos os métodos de pagamento padronizados para PT-BR', () => {
  assert.equal(paymentMethodLabel('PIX'), 'Pix');
  assert.equal(paymentMethodLabel('CASH', 'Cash'), 'Dinheiro');
  assert.equal(paymentMethodLabel('CREDIT_CARD'), 'Cartão de crédito');
  assert.equal(paymentMethodLabel('DEBIT_CARD'), 'Cartão de débito');
});

test('mantém fallback seguro para método externo desconhecido', () => {
  assert.equal(paymentMethodLabel('VOUCHER', 'Vale-refeição'), 'Vale-refeição');
  assert.equal(paymentMethodLabel(undefined), 'Não informado');
});
