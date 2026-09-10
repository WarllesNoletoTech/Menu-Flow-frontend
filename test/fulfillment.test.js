const test = require('node:test');
const assert = require('node:assert/strict');
const { canOfferDelivery } = require('../.test-dist/fulfillment');

test('checkout offers delivery only when enabled and an active zone is returned', () => {
  assert.equal(canOfferDelivery({ deliveryEnabled: true, deliveryAvailable: true, deliveryZones: [{ active: true }] }), true);
  assert.equal(canOfferDelivery({ deliveryEnabled: false, deliveryAvailable: false, deliveryZones: [{ active: true }] }), false);
  assert.equal(canOfferDelivery({ deliveryEnabled: true, deliveryAvailable: false, deliveryZones: [] }), false);
});
