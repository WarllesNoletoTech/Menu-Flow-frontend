export type DeliveryContract = { deliveryEnabled: boolean; deliveryAvailable: boolean; deliveryZones: Array<{ active?: boolean }> };

export function canOfferDelivery(restaurant: DeliveryContract) {
  return restaurant.deliveryEnabled === true && restaurant.deliveryAvailable === true && restaurant.deliveryZones.some((zone) => zone.active !== false);
}
