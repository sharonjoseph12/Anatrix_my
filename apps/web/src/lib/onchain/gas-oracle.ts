// ─── Gas Oracle ─────────────────────────────────────────────────────────────
// Fetches gas price from Base RPC, ETH/USD from CoinGecko, projects cost

import { createPublicClient, http, formatGwei } from 'viem';
import { base } from 'viem/chains';
import { weiToUsd } from '@antarix/utils';

function getEnv(key: string, fallback?: string): string {
  return process.env[key] ?? fallback ?? '';
}

/**
 * Fetch current gas price from Base L2 RPC.
 * @returns Gas price in wei as bigint
 */
export async function fetchGasPrice(): Promise<bigint> {
  const client = createPublicClient({
    chain: base,
    transport: http(getEnv('BASE_RPC_URL', 'https://mainnet.base.org')),
  });
  return client.getGasPrice();
}

/**
 * Fetch current ETH/USD price from CoinGecko.
 */
export async function fetchEthUsdPrice(): Promise<number> {
  const url = getEnv(
    'GAS_ORACLE_URL',
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ETH/USD fetch failed: ${res.status}`);
  const data = (await res.json()) as { ethereum: { usd: number } };
  return data.ethereum.usd;
}

export interface ProjectedCost {
  wei: bigint;
  usd: number;
}

/**
 * Project the USD cost of a transaction given estimated gas, gas price, and ETH/USD.
 */
export function getProjectedCost(
  estimatedGas: bigint,
  gasPriceWei: bigint,
  ethUsdPrice: number,
): ProjectedCost {
  const totalWei = estimatedGas * gasPriceWei;
  return {
    wei: totalWei,
    usd: weiToUsd(totalWei, ethUsdPrice),
  };
}

/**
 * Should we defer this submission because the projected cost is too high?
 */
export function shouldDefer(projectedCostUsd: number, threshold?: number): boolean {
  const thresholdUsd = threshold ?? Number(getEnv('GAS_COST_THRESHOLD_USD', '0.02'));
  return projectedCostUsd > thresholdUsd;
}
