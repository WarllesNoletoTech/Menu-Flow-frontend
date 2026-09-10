export const PAYMENT_METHOD_LABELS: Readonly<Record<string, string>> = {
  PIX: 'Pix',
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
};

export function paymentMethodLabel(method?: string, fallbackName?: string) {
  if (!method) return fallbackName?.trim() || 'Não informado';
  return PAYMENT_METHOD_LABELS[method] ?? fallbackName?.trim() ?? method;
}
