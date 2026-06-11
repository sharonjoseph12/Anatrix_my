// ─── Register EAS Schema on Base ────────────────────────────────────────────
// One-time idempotent script

import { createPublicClient, createWalletClient, http, keccak256, stringToBytes } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';

const SCHEMA_STRING = 'bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot';

async function main() {
  const rpcUrl = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
  const registryAddress = process.env.EAS_SCHEMA_REGISTRY_ADDRESS_BASE as `0x${string}`;
  const attesterKey = process.env.EAS_ATTESTER_PRIVATE_KEY as `0x${string}`;

  if (!registryAddress || !attesterKey) {
    console.error('Missing EAS_SCHEMA_REGISTRY_ADDRESS_BASE or EAS_ATTESTER_PRIVATE_KEY');
    process.exit(1);
  }

  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const account = privateKeyToAccount(attesterKey);
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) });

  // Check if schema already registered (idempotent)
  const expectedUid = keccak256(stringToBytes(SCHEMA_STRING));
  console.log(`Expected schema UID: ${expectedUid}`);

  try {
    const existing = await publicClient.readContract({
      address: registryAddress,
      abi: [{
        name: 'getSchema',
        type: 'function',
        inputs: [{ name: 'uid', type: 'bytes32' }],
        outputs: [{ name: '', type: 'tuple', components: [
          { name: 'uid', type: 'bytes32' },
          { name: 'resolver', type: 'address' },
          { name: 'revocable', type: 'bool' },
          { name: 'schema', type: 'string' },
        ]}],
        stateMutability: 'view',
      }],
      functionName: 'getSchema',
      args: [expectedUid],
    });

    if (existing && (existing as any).schema === SCHEMA_STRING) {
      console.log('Schema already registered.');
      console.log(`schema_uid: ${expectedUid}`);
      process.exit(0);
    }
  } catch {
    // Schema not found — proceed to register
  }

  console.log('Registering schema...');
  const txHash = await walletClient.writeContract({
    address: registryAddress,
    abi: [{
      name: 'register',
      type: 'function',
      inputs: [
        { name: 'schema', type: 'string' },
        { name: 'resolver', type: 'address' },
        { name: 'revocable', type: 'bool' },
      ],
      outputs: [{ name: '', type: 'bytes32' }],
      stateMutability: 'nonpayable',
    }],
    functionName: 'register',
    args: [SCHEMA_STRING, '0x0000000000000000000000000000000000000000', true],
  });

  console.log(`tx_hash: ${txHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`schema_uid: ${expectedUid}`);

  // Write to chain_mirror_schema table
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    await supabase.from('chain_mirror_schema').upsert({
      version: 'v1',
      schema_string: SCHEMA_STRING,
      schema_uid: expectedUid,
      registered_tx_hash: txHash,
      status: 'active',
    }, { onConflict: 'version' });
    console.log('Written to chain_mirror_schema table.');
  }

  console.log('\nDone. Set EAS_SCHEMA_UID_BASE in your .env:');
  console.log(`EAS_SCHEMA_UID_BASE=${expectedUid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
