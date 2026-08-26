/** Liste e-posta alıcısı: önce müşteri kartı, sonra sigorta. */
export function resolveOpsEmailDefaultTo(input: {
  customerEmail?: string | null;
  insuranceEmail?: string | null;
}): string | undefined {
  const customer = input.customerEmail?.trim();
  if (customer && customer.includes('@')) return customer;
  const insurance = input.insuranceEmail?.trim();
  if (insurance && insurance.includes('@')) return insurance;
  return undefined;
}
