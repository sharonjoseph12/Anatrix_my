// script to register EAS schema to local hardhat network
import { ethers } from "hardhat";

async function main() {
  console.log("Registering EAS schema...");
  // ... actual schema registration logic ...
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
