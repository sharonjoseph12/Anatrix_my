// apps/web/src/lib/biometrics/index.ts
// Barrel for biometric integration helpers. Importers can write:
//   import { oura, whoop, correlate, aggregateOuraDaily } from "@/lib/biometrics";

export * as oura from "./oura-client";
export * as whoop from "./whoop-client";
export * from "./aggregator";
export * from "./correlator";
