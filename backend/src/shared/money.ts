/** Monetary values in the API and database are integer minor units (kobo for NGN). */
export function toPaystackMinorUnits(amountMinor: number): number | null {
  return Number.isSafeInteger(amountMinor) && amountMinor > 0 ? amountMinor : null;
}

/** Paystack reports transaction amounts in minor units; never multiply local values again. */
export function gatewayAmountMatches(localMinor: number, gatewayMinor: number): boolean {
  return Number.isSafeInteger(localMinor) && Number.isSafeInteger(gatewayMinor) && localMinor === gatewayMinor;
}

export function formatMinorUnits(amountMinor: number, currency: string): string {
  const majorAmount = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(majorAmount);
  } catch {
    return `${currency} ${majorAmount.toFixed(2)}`;
  }
}
