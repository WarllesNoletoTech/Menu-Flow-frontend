const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWhatsAppUrl, normalizeWhatsAppText } = require('../.test-dist/whatsapp');

test('mensagem do WhatsApp mantém UTF-8 pt-BR e remove espaços Unicode problemáticos', () => {
  const text = normalizeWhatsAppText('Relatório - Redenção
Taxa: R$ 1,00');
  assert.equal(text, 'Relatório - Redenção
Taxa: R$ 1,00');
  const url = buildWhatsAppUrl('(94) 99999-9999', text);
  assert.equal(decodeURIComponent(url.split('text=')[1]), text);
  assert.doesNotMatch(text, /�/);
});
