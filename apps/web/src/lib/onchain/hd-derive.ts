// ─── HD Wallet Derivation ───────────────────────────────────────────────────
// Platform-custodial address derivation using BIP-44 / Ethereum path

import { HDKey } from 'viem/accounts';
import { publicKeyToAddress } from 'viem/accounts';

export interface DerivedAddress {
  address: `0x${string}`;
  privateKey: `0x${string}`;
}

/**
 * Derive a custodial Ethereum address from a seed and index.
 * Derivation path: m/44'/60'/0'/0/{index}
 *
 * The seed is fetched from Vault externally; this function is pure.
 *
 * @param seed - hex-encoded seed bytes (from Vault)
 * @param index - BIP-44 address index
 */
export function deriveCustodialAddress(
  seed: Uint8Array,
  index: number,
): DerivedAddress {
  const hdKey = HDKey.fromMasterSeed(seed);
  const derivationPath = `m/44'/60'/0'/0/${index}`;
  const child = hdKey.derive(derivationPath);

  if (!child.privateKey) {
    throw new Error(`Failed to derive key at path ${derivationPath}`);
  }

  const privateKeyHex = `0x${Buffer.from(child.privateKey).toString('hex')}` as `0x${string}`;
  const address = publicKeyToAddress(
    `0x${Buffer.from(child.publicKey!).toString('hex')}` as `0x${string}`,
  );

  return {
    address,
    privateKey: privateKeyHex,
  };
}
