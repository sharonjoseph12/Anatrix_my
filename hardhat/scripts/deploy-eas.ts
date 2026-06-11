// ─── Deploy EAS Contracts to Local Hardhat ──────────────────────────────────

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying EAS contracts with account:", deployer.address);

  // Deploy SchemaRegistry
  const SchemaRegistry = await ethers.getContractFactory("SchemaRegistry");
  const schemaRegistry = await SchemaRegistry.deploy();
  await schemaRegistry.waitForDeployment();
  const schemaRegistryAddress = await schemaRegistry.getAddress();
  console.log("SchemaRegistry deployed to:", schemaRegistryAddress);

  // Deploy EAS
  const EAS = await ethers.getContractFactory("EAS");
  const eas = await EAS.deploy(schemaRegistryAddress);
  await eas.waitForDeployment();
  const easAddress = await eas.getAddress();
  console.log("EAS deployed to:", easAddress);

  // Register the mirror schema
  const schemaString = "bytes32 vcHash,string revocationPointer,uint64 scoreSnapshot";
  const tx = await schemaRegistry.register(
    schemaString,
    ethers.ZeroAddress, // no resolver
    true, // revocable
  );
  const receipt = await tx.wait();
  console.log("Schema registered, tx:", receipt?.hash);

  // Print env vars
  console.log("\n--- Set these in .env.local.test ---");
  console.log(`BASE_RPC_URL=http://localhost:8545`);
  console.log(`EAS_CONTRACT_ADDRESS_BASE=${easAddress}`);
  console.log(`EAS_SCHEMA_REGISTRY_ADDRESS_BASE=${schemaRegistryAddress}`);
  console.log(`EAS_ATTESTER_ADDRESS_BASE=${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
