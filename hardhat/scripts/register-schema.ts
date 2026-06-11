// ─── Register Schema on Local Hardhat ───────────────────────────────────────

import { ethers } from "hardhat";

async function main() {
  const schemaRegistryAddress = process.env.EAS_SCHEMA_REGISTRY_ADDRESS_BASE;
  if (!schemaRegistryAddress) {
    console.error("Set EAS_SCHEMA_REGISTRY_ADDRESS_BASE first (run deploy-eas.ts)");
    process.exit(1);
  }

  const schemaRegistry = await ethers.getContractAt("SchemaRegistry", schemaRegistryAddress);
  const schemaString = "bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot";

  const tx = await schemaRegistry.register(schemaString, ethers.ZeroAddress, true);
  const receipt = await tx.wait();

  console.log("Schema registered on local Hardhat");
  console.log("tx:", receipt?.hash);
  console.log(`\nAdd to .env.local.test:\nEAS_SCHEMA_UID_BASE=<decode from logs>`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
