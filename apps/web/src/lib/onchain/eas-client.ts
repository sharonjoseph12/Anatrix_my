// ─── EAS Client ─────────────────────────────────────────────────────────────
// Wraps @ethereum-attestation-service/eas-sdk + viem for Base L2 operations

import { EAS, SchemaRegistry, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { createPublicClient, createWalletClient, http, type Hash } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Environment ────────────────────────────────────────────────────────────

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

// ─── Clients ────────────────────────────────────────────────────────────────

let easInstance: EAS | null = null;
let schemaRegistryInstance: SchemaRegistry | null = null;

function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(getEnv('BASE_RPC_URL')),
  });
}

function getWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: base,
    transport: http(getEnv('BASE_RPC_URL')),
  });
}

// ─── EAS Operations ─────────────────────────────────────────────────────────

export interface AttestParams {
  schema: string;       // schema UID
  data: {
    vcHash: `0x${string}`;
    revocationPointer: string;
    scoreSnapshot: number;
  };
  recipient: string;    // address
}

export interface AttestResult {
  uid: string;
  txHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
}

export interface RevokeResult {
  txHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
}

/**
 * Submit an EAS attestation on Base L2.
 * The attester private key is fetched from Vault at signing time.
 */
export async function attest(
  params: AttestParams,
  attesterPrivateKey: `0x${string}`,
): Promise<AttestResult> {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient(attesterPrivateKey);

  const schemaEncoder = new SchemaEncoder(
    'bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot',
  );

  const encodedData = schemaEncoder.encodeData([
    { name: 'vcHash', value: params.data.vcHash, type: 'bytes32' },
    { name: 'revocationPointer', value: params.data.revocationPointer, type: 'string' },
    { name: 'scoreSnapshot', value: BigInt(params.data.scoreSnapshot), type: 'uint64' },
  ]);

  const easAddress = getEnv('EAS_CONTRACT_ADDRESS_BASE') as `0x${string}`;

  // Use viem directly for the transaction
  const txHash = await walletClient.writeContract({
    address: easAddress,
    abi: [
      {
        name: 'attest',
        type: 'function',
        inputs: [
          {
            name: 'request',
            type: 'tuple',
            components: [
              { name: 'schema', type: 'bytes32' },
              {
                name: 'data',
                type: 'tuple',
                components: [
                  { name: 'recipient', type: 'address' },
                  { name: 'expirationTime', type: 'uint64' },
                  { name: 'revocable', type: 'bool' },
                  { name: 'refUID', type: 'bytes32' },
                  { name: 'data', type: 'bytes' },
                  { name: 'value', type: 'uint256' },
                ],
              },
            ],
          },
        ],
        outputs: [{ name: '', type: 'bytes32' }],
        stateMutability: 'payable',
      },
    ],
    functionName: 'attest',
    args: [
      {
        schema: params.schema as `0x${string}`,
        data: {
          recipient: params.recipient as `0x${string}`,
          expirationTime: 0n,
          revocable: true,
          refUID: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          data: encodedData as `0x${string}`,
          value: 0n,
        },
      },
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    uid: txHash, // In production, decode the attestation UID from logs
    txHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
  };
}

/**
 * Revoke an EAS attestation.
 */
export async function revoke(
  params: { schema: string; uid: string },
  attesterPrivateKey: `0x${string}`,
): Promise<RevokeResult> {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient(attesterPrivateKey);
  const easAddress = getEnv('EAS_CONTRACT_ADDRESS_BASE') as `0x${string}`;

  const txHash = await walletClient.writeContract({
    address: easAddress,
    abi: [
      {
        name: 'revoke',
        type: 'function',
        inputs: [
          {
            name: 'request',
            type: 'tuple',
            components: [
              { name: 'schema', type: 'bytes32' },
              {
                name: 'data',
                type: 'tuple',
                components: [
                  { name: 'uid', type: 'bytes32' },
                  { name: 'value', type: 'uint256' },
                ],
              },
            ],
          },
        ],
        outputs: [],
        stateMutability: 'payable',
      },
    ],
    functionName: 'revoke',
    args: [
      {
        schema: params.schema as `0x${string}`,
        data: {
          uid: params.uid as `0x${string}`,
          value: 0n,
        },
      },
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
  };
}

/**
 * Read an attestation from EAS (public, no signer needed).
 */
export async function getAttestation(uid: string) {
  const publicClient = getPublicClient();
  const easAddress = getEnv('EAS_CONTRACT_ADDRESS_BASE') as `0x${string}`;

  const result = await publicClient.readContract({
    address: easAddress,
    abi: [
      {
        name: 'getAttestation',
        type: 'function',
        inputs: [{ name: 'uid', type: 'bytes32' }],
        outputs: [
          {
            name: '',
            type: 'tuple',
            components: [
              { name: 'uid', type: 'bytes32' },
              { name: 'schema', type: 'bytes32' },
              { name: 'time', type: 'uint64' },
              { name: 'expirationTime', type: 'uint64' },
              { name: 'revocationTime', type: 'uint64' },
              { name: 'refUID', type: 'bytes32' },
              { name: 'recipient', type: 'address' },
              { name: 'attester', type: 'address' },
              { name: 'revocable', type: 'bool' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
        stateMutability: 'view',
      },
    ],
    functionName: 'getAttestation',
    args: [uid as `0x${string}`],
  });

  return result;
}

/**
 * Register a new schema on the EAS SchemaRegistry.
 */
export async function registerSchema(
  schema: string,
  attesterPrivateKey: `0x${string}`,
): Promise<{ schemaUid: string; txHash: Hash }> {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient(attesterPrivateKey);
  const registryAddress = getEnv('EAS_SCHEMA_REGISTRY_ADDRESS_BASE') as `0x${string}`;

  const txHash = await walletClient.writeContract({
    address: registryAddress,
    abi: [
      {
        name: 'register',
        type: 'function',
        inputs: [
          { name: 'schema', type: 'string' },
          { name: 'resolver', type: 'address' },
          { name: 'revocable', type: 'bool' },
        ],
        outputs: [{ name: '', type: 'bytes32' }],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'register',
    args: [
      schema,
      '0x0000000000000000000000000000000000000000' as `0x${string}`,
      true,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    schemaUid: txHash, // In production, decode from logs
    txHash,
  };
}

/**
 * Read a schema from the EAS SchemaRegistry.
 */
export async function getSchema(uid: string) {
  const publicClient = getPublicClient();
  const registryAddress = getEnv('EAS_SCHEMA_REGISTRY_ADDRESS_BASE') as `0x${string}`;

  return publicClient.readContract({
    address: registryAddress,
    abi: [
      {
        name: 'getSchema',
        type: 'function',
        inputs: [{ name: 'uid', type: 'bytes32' }],
        outputs: [
          {
            name: '',
            type: 'tuple',
            components: [
              { name: 'uid', type: 'bytes32' },
              { name: 'resolver', type: 'address' },
              { name: 'revocable', type: 'bool' },
              { name: 'schema', type: 'string' },
            ],
          },
        ],
        stateMutability: 'view',
      },
    ],
    functionName: 'getSchema',
    args: [uid as `0x${string}`],
  });
}
