// apps/web/src/lib/ats/index.ts
// Barrel for ATS integration helpers. Importers can write:
//   import { greenhouse, lever, matches } from "@/lib/ats";

export * as greenhouse from "./greenhouse-client";
export * as lever from "./lever-client";
export * from "./saved-search-evaluator";
