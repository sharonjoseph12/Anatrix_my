// ─── Wei ↔ USD conversion ───────────────────────────────────────────────────

/**
 * Convert wei to USD using a given ETH/USD price.
 * Returns a number rounded to 6 decimal places.
 *
 * @param wei - Gas cost in wei (bigint or string)
 * @param ethUsdPrice - Current ETH/USD price
 * @returns USD cost rounded to 6 decimals
 */
export function weiToUsd(wei: bigint | string, ethUsdPrice: number): number {
  const weiBigInt = typeof wei === 'string' ? BigInt(wei) : wei;
  // 1 ETH = 1e18 wei
  const ethAmount = Number(weiBigInt) / 1e18;
  const usd = ethAmount * ethUsdPrice;
  // Round to 6 decimal places
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/**
 * Convert USD to wei using a given ETH/USD price.
 *
 * @param usd - USD amount
 * @param ethUsdPrice - Current ETH/USD price
 * @returns Wei as bigint
 */
export function usdToWei(usd: number, ethUsdPrice: number): bigint {
  const ethAmount = usd / ethUsdPrice;
  return BigInt(Math.round(ethAmount * 1e18));
}
